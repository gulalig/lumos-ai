import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { z } from 'zod';

import { RedisService } from '../redis/redis.service.js';

import { MeetingsService } from './meetings.service.js';

import type {
  MeetingSnapshot,
  MeetingSnapshotItem,
} from './meeting-snapshot.types.js';

const semanticObservationSchema =
  z.object({
    id:
      z.string().min(1),

    kind:
      z.enum([
        'unknown',
        'proposal',
        'decision',
        'commitment',
        'question',
      ]),

    evidenceEventId:
      z.string().min(1),

    supportingEvidenceEventIds:
      z.array(
        z.string().min(1),
      ).optional(),

    evidenceText:
      z.string(),

    summary:
      z.string().min(1),

    owner:
      z.string().optional(),

    dueText:
      z.string().optional(),

    supersedesObservationId:
      z.string()
        .min(1)
        .optional(),

    explicit:
      z.boolean(),

    confidence:
      z.number()
        .min(0)
        .max(1),
  });

type SemanticObservation =
  z.infer<
    typeof semanticObservationSchema
  >;

const SEMANTIC_EVENT_TYPE =
  'semantic.observation.v1';

@Injectable()
export class MeetingSnapshotService {
  private readonly logger =
    new Logger(
      MeetingSnapshotService.name,
    );

  constructor(
    private readonly redis:
    RedisService,

    private readonly meetingsService:
    MeetingsService,
  ) {}

  async getSnapshot(
    meetingId: string,
  ): Promise<MeetingSnapshot> {
    const meeting =
      await this.meetingsService
        .getById(
          meetingId,
        );

    const streamKey =
      this.semanticStreamKey(
        meetingId,
      );

    const entries =
      await this.redis.client.xrange(
        streamKey,
        '-',
        '+',
      );

    const applied =
      new Set<string>();

    const snapshot:
      MeetingSnapshot = {
      meetingId,

      status:
      meeting.status,

      version:
        0,

      decisions:
        [],

      commitments:
        [],

      proposals:
        [],

      questions:
        [],
    };

    for (
      const entry of entries
      ) {
      const [
        streamId,
        fields,
      ] = entry;

      const values =
        this.fieldsToRecord(
          fields,
        );

      const eventType =
        values.event_type;

      if (
        eventType !==
        SEMANTIC_EVENT_TYPE
      ) {
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

      const payload =
        values.payload;

      if (!payload) {
        throw new InternalServerErrorException(
          'Meeting semantic history contains an invalid event',
        );
      }

      const observation =
        this.parseObservation(
          meetingId,
          streamId,
          payload,
        );

      // Unknown observations are durable semantic
      // events, but they do not become part of the
      // meeting outcome snapshot.
      if (
        observation.kind ===
        'unknown'
      ) {
        continue;
      }

      // Observation IDs are deterministic.
      //
      // Semantic delivery is at-least-once, therefore
      // an identical observation may appear more than
      // once in the stream. It must only be applied once.
      if (
        applied.has(
          observation.id,
        )
      ) {
        continue;
      }

      applied.add(
        observation.id,
      );

      // Semantic history remains append-only.
      //
      // When a newer observation explicitly supersedes
      // an older one, remove the older observation from
      // the CURRENT read model before applying the new
      // observation.
      //
      // The old event still remains in Redis history.
      if (
        observation
          .supersedesObservationId
      ) {
        this.removeObservation(
          snapshot,
          observation
            .supersedesObservationId,
        );
      }

      const item:
        MeetingSnapshotItem = {
        id:
        observation.id,

        kind:
        observation.kind,

        evidenceEventId:
        observation
          .evidenceEventId,

        evidenceText:
        observation
          .evidenceText,

        summary:
        observation.summary,

        owner:
          observation.owner ??
          '',

        dueText:
          observation.dueText ??
          '',

        explicit:
        observation.explicit,

        confidence:
        observation.confidence,
      };

      switch (
        observation.kind
        ) {
        case 'decision':
          snapshot.decisions.push(
            item,
          );
          break;

        case 'commitment':
          snapshot.commitments.push(
            item,
          );
          break;

        case 'proposal':
          snapshot.proposals.push(
            item,
          );
          break;

        case 'question':
          snapshot.questions.push(
            item,
          );
          break;
      }

      // Version represents the number of unique,
      // applicable semantic events processed.
      //
      // A superseding observation is still a new
      // semantic event, so it increments version even
      // though it replaces an older item in the view.
      snapshot.version += 1;
    }

    return snapshot;
  }

  private semanticStreamKey(
    meetingId: string,
  ): string {
    return (
      `lumos:meeting:{${meetingId}}:` +
      'semantics'
    );
  }

  private fieldsToRecord(
    fields: string[],
  ): Record<string, string> {
    const result:
      Record<string, string> = {};

    for (
      let index = 0;
      index < fields.length;
      index += 2
    ) {
      const key =
        fields[index];

      const value =
        fields[index + 1];

      if (
        key === undefined ||
        value === undefined
      ) {
        continue;
      }

      result[key] = value;
    }

    return result;
  }

  private parseObservation(
    meetingId: string,
    streamId: string,
    payload: string,
  ): SemanticObservation {
    try {
      const parsed =
        JSON.parse(
          payload,
        );

      return semanticObservationSchema
        .parse(
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
          item.id !==
          observationId,
      );

    snapshot.commitments =
      snapshot.commitments.filter(
        (item) =>
          item.id !==
          observationId,
      );

    snapshot.proposals =
      snapshot.proposals.filter(
        (item) =>
          item.id !==
          observationId,
      );

    snapshot.questions =
      snapshot.questions.filter(
        (item) =>
          item.id !==
          observationId,
      );
  }
}
