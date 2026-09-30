import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { RedisService } from '../redis/redis.service.js';

import {
  SEMANTIC_EVENT_TYPE,
  redisFieldsToRecord,
  semanticObservationSchema,
  semanticStreamKey,
  type SemanticObservation,
} from '../semantics/semantic-observation.js';

import { MeetingsService } from './meetings.service.js';

import type {
  MeetingSnapshot,
  MeetingSnapshotItem,
  MeetingTranscriptItem,
} from './meeting-snapshot.types.js';

const EVIDENCE_EVENT_TYPE = 'evidence.turn.final';

interface EvidenceTurnPayload {
  eventId: string;

  meetingId: string;

  participantId: string;

  turnOrder: number;

  text: string;

  capturedAt: string;
}

@Injectable()
export class MeetingSnapshotService {
  private readonly logger = new Logger(MeetingSnapshotService.name);

  constructor(
    private readonly redis: RedisService,

    private readonly meetingsService: MeetingsService,
  ) {}

  async getSnapshot(
    meetingId: string,
    workspaceId: string,
  ): Promise<MeetingSnapshot> {
    const meeting = await this.meetingsService.getByIdForWorkspace(
      meetingId,
      workspaceId,
    );

    const semanticKey = semanticStreamKey(meetingId);

    const evidenceKey = this.evidenceStreamKey(meetingId);

    const [semanticEntries, evidenceEntries] = await Promise.all([
      this.redis.client.xrange(semanticKey, '-', '+'),

      this.redis.client.xrange(evidenceKey, '-', '+'),
    ]);

    const applied = new Set<string>();

    const snapshot: MeetingSnapshot = {
      meetingId,

      status: meeting.status,

      version: 0,

      transcript: [],

      decisions: [],

      commitments: [],

      proposals: [],

      questions: [],
    };

    for (const entry of evidenceEntries) {
      const [streamId, fields] = entry;

      const values = redisFieldsToRecord(fields);

      if (values.event_type !== EVIDENCE_EVENT_TYPE) {
        continue;
      }

      const payload = values.payload;

      if (!payload) {
        continue;
      }

      const turn = this.parseEvidenceTurn(
        meetingId,
        streamId,
        payload,
      );

      const transcriptItem: MeetingTranscriptItem = {
        id: turn.eventId,

        participantId: turn.participantId,

        text: turn.text,

        capturedAt: turn.capturedAt,

        turnOrder: turn.turnOrder,
      };

      snapshot.transcript.push(transcriptItem);
    }

    for (const entry of semanticEntries) {
      const [streamId, fields] = entry;

      const values = redisFieldsToRecord(fields);

      const eventType = values.event_type;

      if (eventType !== SEMANTIC_EVENT_TYPE) {
        this.logger.warn(
          [
            'Ignoring unsupported semantic event',
            `meetingId=${meetingId}`,
            `streamId=${streamId}`,
            `eventType=${eventType ?? 'missing'}`,
          ].join(' '),
        );

        continue;
      }

      const payload = values.payload;

      if (!payload) {
        throw new InternalServerErrorException(
          'Meeting semantic history contains an invalid event',
        );
      }

      const observation = this.parseObservation(
        meetingId,
        streamId,
        payload,
      );

      if (observation.kind === 'unknown') {
        continue;
      }

      if (applied.has(observation.id)) {
        continue;
      }

      applied.add(observation.id);

      if (observation.supersedesObservationId) {
        this.removeObservation(
          snapshot,
          observation.supersedesObservationId,
        );
      }

      const item: MeetingSnapshotItem = {
        id: observation.id,

        kind: observation.kind,

        evidenceEventId: observation.evidenceEventId,

        evidenceText: observation.evidenceText,

        summary: observation.summary,

        owner: observation.owner ?? '',

        dueText: observation.dueText ?? '',

        explicit: observation.explicit,

        confidence: observation.confidence,
      };

      switch (observation.kind) {
        case 'decision':
          snapshot.decisions.push(item);
          break;

        case 'commitment':
          snapshot.commitments.push(item);
          break;

        case 'proposal':
          snapshot.proposals.push(item);
          break;

        case 'question':
          snapshot.questions.push(item);
          break;
      }

      snapshot.version += 1;
    }

    snapshot.transcript.sort(
      (left, right) =>
        new Date(left.capturedAt).getTime() -
        new Date(right.capturedAt).getTime(),
    );

    return snapshot;
  }

  private evidenceStreamKey(
    meetingId: string,
  ): string {
    return `lumos:meeting:{${meetingId}}:evidence`;
  }

  private parseEvidenceTurn(
    meetingId: string,
    streamId: string,
    payload: string,
  ): EvidenceTurnPayload {
    try {
      const parsed =
        JSON.parse(payload) as Partial<EvidenceTurnPayload>;

      if (
        typeof parsed.eventId !== 'string' ||
        parsed.meetingId !== meetingId ||
        typeof parsed.participantId !== 'string' ||
        typeof parsed.turnOrder !== 'number' ||
        typeof parsed.text !== 'string' ||
        typeof parsed.capturedAt !== 'string'
      ) {
        throw new Error(
          'Invalid evidence payload',
        );
      }

      return parsed as EvidenceTurnPayload;
    } catch (error) {
      this.logger.error(
        [
          'Invalid meeting evidence turn',
          `meetingId=${meetingId}`,
          `streamId=${streamId}`,
        ].join(' '),

        error instanceof Error
          ? error.stack
          : undefined,
      );

      throw new InternalServerErrorException(
        'Meeting evidence history contains an invalid turn',
      );
    }
  }

  private parseObservation(
    meetingId: string,
    streamId: string,
    payload: string,
  ): SemanticObservation {
    try {
      const parsed = JSON.parse(payload);

      return semanticObservationSchema.parse(
        parsed,
      );
    } catch (error) {
      this.logger.error(
        [
          'Invalid semantic observation',
          `meetingId=${meetingId}`,
          `streamId=${streamId}`,
        ].join(' '),

        error instanceof Error
          ? error.stack
          : undefined,
      );

      throw new InternalServerErrorException(
        'Meeting semantic history contains an invalid observation',
      );
    }
  }

  private removeObservation(
    snapshot: MeetingSnapshot,
    observationId: string,
  ): void {
    snapshot.decisions =
      snapshot.decisions.filter(
        (item) =>
          item.id !== observationId,
      );

    snapshot.commitments =
      snapshot.commitments.filter(
        (item) =>
          item.id !== observationId,
      );

    snapshot.proposals =
      snapshot.proposals.filter(
        (item) =>
          item.id !== observationId,
      );

    snapshot.questions =
      snapshot.questions.filter(
        (item) =>
          item.id !== observationId,
      );
  }
}
