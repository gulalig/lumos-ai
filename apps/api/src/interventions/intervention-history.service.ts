import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { RedisService } from '../redis/redis.service.js';

import { INTERVENTION_EVENT_TYPE } from './intervention.publisher.js';

import type { Intervention, InterventionReason } from './intervention.js';

export interface InterventionHistoryEntry {
  streamId: string;
  intervention: Intervention;
}

@Injectable()
export class InterventionHistoryService {
  private readonly logger = new Logger(InterventionHistoryService.name);

  constructor(private readonly redis: RedisService) {}

  async listByMeeting(meetingId: string): Promise<InterventionHistoryEntry[]> {
    const entries = await this.redis.client.xrange(
      this.streamKey(meetingId),
      '-',
      '+',
    );

    const history: InterventionHistoryEntry[] = [];

    for (const [streamId, fields] of entries) {
      const record = this.fieldsToRecord(fields);

      if (record.event_type !== INTERVENTION_EVENT_TYPE) {
        this.logger.warn(
          [
            'Ignoring unsupported intervention event',
            `meetingId=${meetingId}`,
            `streamId=${streamId}`,
            `eventType=${record.event_type ?? 'missing'}`,
          ].join(' '),
        );

        continue;
      }

      const payload = record.payload;

      if (!payload) {
        throw new InternalServerErrorException(
          'Meeting intervention history contains an invalid event',
        );
      }

      history.push({
        streamId,

        intervention: this.parseIntervention(meetingId, streamId, payload),
      });
    }

    return history;
  }

  private parseIntervention(
    meetingId: string,
    streamId: string,
    payload: string,
  ): Intervention {
    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>;

      if (
        typeof parsed.id !== 'string' ||
        typeof parsed.gapId !== 'string' ||
        parsed.meetingId !== meetingId ||
        typeof parsed.sprintItemId !== 'string' ||
        typeof parsed.observationId !== 'string' ||
        !this.isReason(parsed.reason) ||
        typeof parsed.message !== 'string' ||
        typeof parsed.createdAt !== 'string'
      ) {
        throw new Error('Invalid intervention payload');
      }

      const createdAt = new Date(parsed.createdAt);

      if (Number.isNaN(createdAt.getTime())) {
        throw new Error('Invalid intervention createdAt');
      }

      return {
        id: parsed.id,

        gapId: parsed.gapId,

        meetingId: parsed.meetingId,

        sprintItemId: parsed.sprintItemId,

        observationId: parsed.observationId,

        reason: parsed.reason,

        message: parsed.message,

        createdAt,
      };
    } catch (error) {
      this.logger.error(
        [
          'Invalid intervention history entry',
          `meetingId=${meetingId}`,
          `streamId=${streamId}`,
        ].join(' '),
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException(
        'Meeting intervention history contains an invalid intervention',
      );
    }
  }

  private fieldsToRecord(fields: string[]): Record<string, string> {
    const record: Record<string, string> = {};

    for (let index = 0; index < fields.length; index += 2) {
      const key = fields[index];

      const value = fields[index + 1];

      if (key !== undefined && value !== undefined) {
        record[key] = value;
      }
    }

    return record;
  }

  private isReason(value: unknown): value is InterventionReason {
    return value === 'missing_owner' || value === 'missing_due_date';
  }

  private streamKey(meetingId: string): string {
    return `lumos:meeting:{${meetingId}}:` + 'interventions';
  }
}
