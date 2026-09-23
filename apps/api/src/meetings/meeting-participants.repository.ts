import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';

import { MeetingParticipantEntity } from './meeting-participant.entity.js';
import { MeetingEntity } from './meeting.entity.js';

export interface EnsureMemberParticipantInput {
  meetingId: string;

  workspaceId: string;
  workspaceMemberId: string;

  displayName: string;
  livekitIdentity: string;
}

@Injectable()
export class MeetingParticipantsRepository {
  constructor(
    @InjectRepository(MeetingParticipantEntity)
    private readonly repository: Repository<MeetingParticipantEntity>,
  ) {}

  async ensureMember(
    input: EnsureMemberParticipantInput,
  ): Promise<MeetingParticipantEntity | null> {
    return this.repository.manager.transaction(async (manager) => {
      const meetings = manager.getRepository(MeetingEntity);

      const participants = manager.getRepository(MeetingParticipantEntity);

      const meeting = await meetings.findOne({
        where: {
          id: input.meetingId,
        },

        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!meeting) {
        return null;
      }

      if (meeting.workspaceId !== input.workspaceId) {
        return null;
      }

      const existing = await participants.findOne({
        where: {
          meetingId: input.meetingId,

          workspaceMemberId: input.workspaceMemberId,
        },
      });

      if (existing) {
        existing.displayName = input.displayName;

        existing.livekitIdentity = input.livekitIdentity;

        existing.leftAt = null;

        return participants.save(existing);
      }

      const participant = participants.create({
        id: randomUUID(),

        meetingId: input.meetingId,

        workspaceMemberId: input.workspaceMemberId,

        participantType: 'member',

        displayName: input.displayName,

        livekitIdentity: input.livekitIdentity,

        joinedAt: new Date(),

        leftAt: null,
      });

      return participants.save(participant);
    });
  }

  async findByMeetingAndMember(
    meetingId: string,
    workspaceMemberId: string,
  ): Promise<MeetingParticipantEntity | null> {
    return this.repository.findOne({
      where: {
        meetingId,
        workspaceMemberId,
      },
    });
  }
}
