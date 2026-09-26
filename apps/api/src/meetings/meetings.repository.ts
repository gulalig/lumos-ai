import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';

import { MeetingEntity } from './meeting.entity.js';

import type { CreateMeetingInput, Meeting } from './meeting.types.js';

@Injectable()
export class MeetingsRepository {
  constructor(
    @InjectRepository(MeetingEntity)
    private readonly repository: Repository<MeetingEntity>,
  ) {}

  async create(input: CreateMeetingInput): Promise<Meeting> {
    const meeting = this.repository.create({
      id: input.id,

      roomName: input.roomName,

      status: 'created',

      workspaceId: null,

      startedAt: null,

      endedAt: null,
    });

    return this.repository.save(meeting);
  }

  async findById(id: string): Promise<Meeting | null> {
    return this.repository.findOne({
      where: {
        id,
      },
    });
  }

  async findByIdForWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<Meeting | null> {
    return this.repository.findOne({
      where: {
        id,
        workspaceId,
      },
    });
  }

  async findWorkspaceBound(): Promise<MeetingEntity[]> {
    return this.repository.find({
      where: {
        workspaceId: Not(IsNull()),
      },
      order: {
        createdAt: 'ASC',
      },
    });
  }

  async bindWorkspace(
    id: string,
    workspaceId: string,
  ): Promise<Meeting | null> {
    return this.repository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(MeetingEntity);

      const meeting = await repository.findOne({
        where: {
          id,
        },

        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!meeting) {
        return null;
      }

      if (meeting.workspaceId !== null && meeting.workspaceId !== workspaceId) {
        return null;
      }

      if (meeting.workspaceId === workspaceId) {
        return meeting;
      }

      meeting.workspaceId = workspaceId;

      return repository.save(meeting);
    });
  }

  async markActive(id: string): Promise<Meeting | null> {
    return this.repository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(MeetingEntity);

      const meeting = await repository.findOne({
        where: {
          id,
        },

        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!meeting) {
        return null;
      }

      if (meeting.status === 'ended') {
        return null;
      }

      meeting.status = 'active';

      if (meeting.startedAt === null) {
        meeting.startedAt = new Date();
      }

      return repository.save(meeting);
    });
  }

  async markEnded(id: string): Promise<Meeting | null> {
    return this.repository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(MeetingEntity);

      const meeting = await repository.findOne({
        where: {
          id,
        },

        lock: {
          mode: 'pessimistic_write',
        },
      });

      if (!meeting) {
        return null;
      }

      meeting.status = 'ended';

      if (meeting.endedAt === null) {
        meeting.endedAt = new Date();
      }

      return repository.save(meeting);
    });
  }
}
