import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { MeetingLifecyclePublisher } from './meeting-lifecycle.publisher.js';
import { MeetingsRepository } from './meetings.repository.js';

import type { CreateMeetingResult, Meeting } from './meeting.types.js';

@Injectable()
export class MeetingsService {
  constructor(
    private readonly meetingsRepository: MeetingsRepository,

    private readonly lifecyclePublisher: MeetingLifecyclePublisher,
  ) {}

  async create(): Promise<CreateMeetingResult> {
    const meetingId = randomUUID();

    const roomName = meetingId;

    const meeting = await this.meetingsRepository.create({
      id: meetingId,
      roomName,
    });

    return {
      meetingId: meeting.id,

      roomName: meeting.roomName,

      status: meeting.status,
    };
  }

  async getById(meetingId: string): Promise<Meeting> {
    const meeting = await this.meetingsRepository.findById(meetingId);

    if (!meeting) {
      throw new NotFoundException(`Meeting ${meetingId} was not found`);
    }

    return meeting;
  }

  async getByIdForWorkspace(
    meetingId: string,
    workspaceId: string,
  ): Promise<Meeting> {
    const meeting = await this.meetingsRepository.findByIdForWorkspace(
      meetingId,
      workspaceId,
    );

    if (!meeting) {
      throw new NotFoundException(`Meeting ${meetingId} was not found`);
    }

    return meeting;
  }

  async listForWorkspace(workspaceId: string): Promise<Meeting[]> {
    return this.meetingsRepository.findByWorkspaceId(workspaceId);
  }

  async bindWorkspace(
    meetingId: string,
    workspaceId: string,
  ): Promise<Meeting> {
    await this.getById(meetingId);

    const meeting = await this.meetingsRepository.bindWorkspace(
      meetingId,
      workspaceId,
    );

    if (!meeting) {
      throw new ConflictException(
        `Meeting ${meetingId} belongs to a different workspace`,
      );
    }

    return meeting;
  }

  async start(meetingId: string): Promise<Meeting> {
    const current = await this.getById(meetingId);

    if (current.status === 'ended') {
      throw new ConflictException(`Meeting ${meetingId} has already ended`);
    }

    const meeting = await this.meetingsRepository.markActive(meetingId);

    if (!meeting) {
      throw new ConflictException(`Meeting ${meetingId} cannot be started`);
    }

    // Publish even if the meeting was already active.
    //
    // The Go lifecycle consumer is idempotent by meetingId.
    // Re-publishing also allows a retry to repair a previous
    // DB-success / Redis-failure situation.
    await this.lifecyclePublisher.publishStarted(meeting);

    return meeting;
  }

  async end(meetingId: string): Promise<Meeting> {
    await this.getById(meetingId);

    const meeting = await this.meetingsRepository.markEnded(meetingId);

    if (!meeting) {
      throw new ConflictException(`Meeting ${meetingId} cannot be ended`);
    }

    await this.lifecyclePublisher.publishEnded(meeting);

    return meeting;
  }
}
