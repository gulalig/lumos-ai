import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { InterventionPublisher } from '../interventions/intervention.publisher.js';
import { InterventionService } from '../interventions/intervention.service.js';
import { MeetingsRepository } from '../meetings/meetings.repository.js';
import { RedisService } from '../redis/redis.service.js';
import {
  SEMANTIC_EVENT_TYPE,
  redisFieldsToRecord,
  semanticObservationSchema,
  semanticStreamKey,
} from '../semantics/semantic-observation.js';

import { ExecutionService } from './execution.service.js';

const POLL_INTERVAL_MS = 750;
const READ_BATCH_SIZE = 100;

const EXECUTION_ACTIVATION_KEY = 'lumos:execution:semantic-activation-ms';

@Injectable()
export class SemanticExecutionWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SemanticExecutionWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private polling = false;
  private activationCursor = '0-0';

  constructor(
    private readonly redis: RedisService,
    private readonly meetings: MeetingsRepository,
    private readonly execution: ExecutionService,
    private readonly interventions: InterventionService,
    private readonly interventionPublisher: InterventionPublisher,
  ) {}

  async onModuleInit(): Promise<void> {
    const now = Date.now();

    await this.redis.client.set(EXECUTION_ACTIVATION_KEY, String(now), 'NX');

    const activationValue = await this.redis.client.get(
      EXECUTION_ACTIVATION_KEY,
    );

    if (!activationValue) {
      throw new Error('Execution activation watermark is missing');
    }

    const activationMs = Number(activationValue);

    if (!Number.isFinite(activationMs)) {
      throw new Error('Execution activation watermark is invalid');
    }

    // Use the millisecond immediately before activation
    // so events created during the activation millisecond
    // are still eligible for processing.
    this.activationCursor = `${Math.max(0, activationMs - 1)}-999999`;

    this.timer = setInterval(() => {
      void this.pollSafely();
    }, POLL_INTERVAL_MS);

    await this.pollSafely();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);

      this.timer = null;
    }
  }

  private async pollSafely(): Promise<void> {
    if (this.polling) {
      return;
    }

    this.polling = true;

    try {
      await this.poll();
    } catch (error) {
      this.logger.error(
        'Semantic execution poll failed',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.polling = false;
    }
  }

  private async poll(): Promise<void> {
    const meetings = await this.meetings.findWorkspaceBound();

    for (const meeting of meetings) {
      try {
        await this.processMeeting(meeting.id);
      } catch (error) {
        // One broken meeting must not prevent
        // execution-state processing for every
        // other meeting.
        this.logger.error(
          [
            'Semantic execution meeting processing failed',
            `meetingId=${meeting.id}`,
          ].join(' '),
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  private async processMeeting(meetingId: string): Promise<void> {
    const streamKey = semanticStreamKey(meetingId);

    const cursorKey = this.executionCursorKey(meetingId);

    let cursor = await this.redis.client.get(cursorKey);

    // First processing for this meeting.
    //
    // Use the global execution-layer activation
    // watermark rather than the current stream tail.
    //
    // This skips semantic history created before
    // execution-state support existed while ensuring
    // new observations are not lost if they arrive
    // before this worker first sees the meeting.
    if (cursor === null) {
      await this.redis.client.set(cursorKey, this.activationCursor, 'NX');

      cursor = await this.redis.client.get(cursorKey);

      if (cursor === null) {
        throw new Error(
          `Failed to initialize execution cursor for meeting ${meetingId}`,
        );
      }

      this.logger.log(
        [
          'Semantic execution cursor initialized',
          `meetingId=${meetingId}`,
          `streamId=${cursor}`,
        ].join(' '),
      );
    }

    const start = cursor === '0-0' ? '-' : `(${cursor}`;

    const entries = await this.redis.client.xrange(
      streamKey,
      start,
      '+',
      'COUNT',
      READ_BATCH_SIZE,
    );

    for (const [streamId, fields] of entries) {
      const values = redisFieldsToRecord(fields);

      if (values.event_type !== SEMANTIC_EVENT_TYPE) {
        await this.saveCursor(meetingId, streamId);

        continue;
      }

      const payload = values.payload;

      if (!payload) {
        this.logger.warn(
          [
            'Semantic event missing payload',
            `meetingId=${meetingId}`,
            `streamId=${streamId}`,
          ].join(' '),
        );

        await this.saveCursor(meetingId, streamId);

        continue;
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(payload);
      } catch {
        this.logger.warn(
          [
            'Semantic event contains invalid JSON',
            `meetingId=${meetingId}`,
            `streamId=${streamId}`,
          ].join(' '),
        );

        await this.saveCursor(meetingId, streamId);

        continue;
      }

      const result = semanticObservationSchema.safeParse(parsed);

      if (!result.success) {
        this.logger.warn(
          [
            'Semantic event failed schema validation',
            `meetingId=${meetingId}`,
            `streamId=${streamId}`,
          ].join(' '),
        );

        await this.saveCursor(meetingId, streamId);

        continue;
      }

      const observation = result.data;

      // Execution state v1 only consumes
      // explicit commitments.
      //
      // Decisions / proposals / questions remain
      // semantic meeting observations for now.
      if (observation.kind !== 'commitment') {
        await this.saveCursor(meetingId, streamId);

        continue;
      }

      const owner = observation.owner ?? '';

      const ownerPrefix = 'member:';

      const ownerWorkspaceMemberId = owner.startsWith(ownerPrefix)
        ? owner.slice(ownerPrefix.length)
        : null;

      const referenceTime = this.streamTime(streamId);

      const dueAt = this.resolveDueDate(observation.dueText, referenceTime);

      // IMPORTANT:
      //
      // Cursor is deliberately NOT advanced before
      // execution-state mutation AND intervention
      // lifecycle processing succeed.
      //
      // If either step fails, the same semantic
      // observation is retried on the next poll.
      //
      // ExecutionService is idempotent via the
      // observation -> SprintItem durable link.
      const sprintItem = await this.execution.applyCommitment({
        meetingId,
        observationId: observation.id,
        evidenceEventId: observation.evidenceEventId,
        summary: observation.summary,
        ownerWorkspaceMemberId,
        ownerDisplayName:
          ownerWorkspaceMemberId === null && owner.trim() !== ''
            ? owner.trim()
            : null,
        dueAt,
        supersedesObservationId: observation.supersedesObservationId,
      });

      const resolvedOwnerWorkspaceMemberId = sprintItem.ownerWorkspaceMemberId;

      const resolvedDueAt = sprintItem.dueAt;

      if (resolvedOwnerWorkspaceMemberId) {
        await this.interventionPublisher.resolveGap(
          meetingId,
          sprintItem.id,
          'missing_owner',
          observation.id,
          referenceTime,
        );
      }

      if (resolvedDueAt) {
        await this.interventionPublisher.resolveGap(
          meetingId,
          sprintItem.id,
          'missing_due_date',
          observation.id,
          referenceTime,
        );
      }

      const interventions = this.interventions.evaluate({
        meetingId,
        sprintItemId: sprintItem.id,
        observation,
        ownerWorkspaceMemberId: resolvedOwnerWorkspaceMemberId,
        dueAt: resolvedDueAt,
        createdAt: referenceTime,
      });

      for (const intervention of interventions) {
        const publishResult =
          await this.interventionPublisher.publish(intervention);

        this.logger.log(
          [
            'Intervention evaluated',
            `meetingId=${meetingId}`,
            `sprintItemId=${sprintItem.id}`,
            `observationId=${observation.id}`,
            `gapId=${intervention.gapId}`,
            `reason=${intervention.reason}`,
            `status=${publishResult.status}`,
            `streamId=${publishResult.streamId ?? 'none'}`,
          ].join(' '),
        );
      }

      await this.saveCursor(meetingId, streamId);

      this.logger.log(
        [
          'Semantic commitment applied to execution state',
          `meetingId=${meetingId}`,
          `observationId=${observation.id}`,
          `sprintItemId=${sprintItem.id}`,
          `interventions=${interventions.length}`,
          `streamId=${streamId}`,
        ].join(' '),
      );
    }
  }

  private streamTime(streamId: string): Date {
    const [milliseconds] = streamId.split('-');

    const value = Number(milliseconds);

    if (!Number.isFinite(value)) {
      return new Date();
    }

    return new Date(value);
  }

  private resolveDueDate(
    dueText: string | undefined,
    referenceTime: Date,
  ): Date | null {
    const normalized = dueText?.trim().toLowerCase();

    if (!normalized) {
      return null;
    }

    const weekdayMatch = normalized.match(
      /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
    );

    if (!weekdayMatch) {
      return null;
    }

    const weekday = weekdayMatch[1];

    const weekdayByName: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };

    const targetWeekday = weekdayByName[weekday];

    if (targetWeekday === undefined) {
      return null;
    }

    const due = new Date(referenceTime);

    const currentWeekday = due.getUTCDay();

    let daysAhead = (targetWeekday - currentWeekday + 7) % 7;

    if (daysAhead === 0) {
      daysAhead = 7;
    }

    due.setUTCDate(due.getUTCDate() + daysAhead);

    due.setUTCHours(23, 59, 59, 999);

    return due;
  }

  private executionCursorKey(meetingId: string): string {
    return `lumos:meeting:{${meetingId}}:` + 'execution-cursor';
  }

  private async saveCursor(meetingId: string, streamId: string): Promise<void> {
    await this.redis.client.set(this.executionCursorKey(meetingId), streamId);
  }
}
