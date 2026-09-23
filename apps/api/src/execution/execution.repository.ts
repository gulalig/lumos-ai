import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ExecutionObservationLinkEntity } from './entities/execution-observation-link.entity.js';

export interface CreateExecutionObservationLinkInput {
  observationId: string;
  meetingId: string;
  sprintItemId: string;
  kind: string;
  evidenceEventId: string;
}

@Injectable()
export class ExecutionRepository {
  constructor(
    @InjectRepository(ExecutionObservationLinkEntity)
    private readonly links:
    Repository<ExecutionObservationLinkEntity>,
  ) {}

  async findByObservationId(
    observationId: string,
  ): Promise<ExecutionObservationLinkEntity | null> {
    return this.links.findOne({
      where: {
        observationId,
      },
    });
  }

  async createLink(
    input: CreateExecutionObservationLinkInput,
  ): Promise<ExecutionObservationLinkEntity> {
    const link =
      this.links.create({
        observationId:
        input.observationId,

        meetingId:
        input.meetingId,

        sprintItemId:
        input.sprintItemId,

        kind:
        input.kind,

        evidenceEventId:
        input.evidenceEventId,
      });

    return this.links.save(link);
  }
}
