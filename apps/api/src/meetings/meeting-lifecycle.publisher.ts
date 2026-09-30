import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { RedisService } from '../redis/redis.service.js';

import type { Meeting } from './meeting.types.js';

export const MEETING_LIFECYCLE_STREAM = 'lumos:meetings:lifecycle';

export const MEETING_STARTED_EVENT = 'meeting.started.v1';

export const MEETING_ENDED_EVENT = 'meeting.ended.v1';

@Injectable()
export class MeetingLifecyclePublisher {
  private readonly logger = new Logger(MeetingLifecyclePublisher.name);

  constructor(private readonly redis: RedisService) {}

  async publishStarted(meeting: Meeting): Promise<void> {
    await this.publish(MEETING_STARTED_EVENT, meeting);
  }

  async publishEnded(meeting: Meeting): Promise<void> {
    await this.publish(MEETING_ENDED_EVENT, meeting);
  }

  private async publish(type: string, meeting: Meeting): Promise<void> {
    const eventId = randomUUID();
    const occurredAt = new Date().toISOString();

    const streamId = await this.redis.client.xadd(
      MEETING_LIFECYCLE_STREAM,
      '*',

      'type',
      type,

      'eventId',
      eventId,

      'meetingId',
      meeting.id,

      'roomName',
      meeting.roomName,

      'occurredAt',
      occurredAt,
    );

    if (!streamId) {
      throw new Error('Redis did not return a lifecycle stream ID');
    }

    this.logger.log(
      [
        'Meeting lifecycle event published',
        `type=${type}`,
        `meetingId=${meeting.id}`,
        `streamId=${streamId}`,
      ].join(' '),
    );
  }
}
