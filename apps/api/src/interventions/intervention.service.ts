import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { interventionGapId } from './intervention-gap.js';

import type { SemanticObservation } from '../semantics/semantic-observation.js';

import type {
  Intervention,
  InterventionReason,
} from './intervention.js';

type EvaluateInput = {
  meetingId: string;
  sprintItemId: string;
  observation: SemanticObservation;
  ownerWorkspaceMemberId: string | null;
  dueAt: Date | null;
  createdAt?: Date;
};

@Injectable()
export class InterventionService {
  evaluate(
    input: EvaluateInput,
  ): Intervention[] {
    const {
      meetingId,
      sprintItemId,
      observation,
      ownerWorkspaceMemberId,
      dueAt,
      createdAt = new Date(),
    } = input;

    if (observation.kind !== 'commitment') {
      return [];
    }

    if (!ownerWorkspaceMemberId) {
      return [
        this.createIntervention({
          meetingId,
          sprintItemId,
          observationId: observation.id,
          reason: 'missing_owner',
          message: 'Who owns this commitment?',
          createdAt,
        }),
      ];
    }

    if (!dueAt) {
      return [
        this.createIntervention({
          meetingId,
          sprintItemId,
          observationId: observation.id,
          reason: 'missing_due_date',
          message: 'When is this commitment due?',
          createdAt,
        }),
      ];
    }

    return [];
  }

  private createIntervention(
    input: {
      meetingId: string;
      sprintItemId: string;
      observationId: string;
      reason: InterventionReason;
      message: string;
      createdAt: Date;
    },
  ): Intervention {
    const gapId = interventionGapId(
      input.sprintItemId,
      input.reason,
    );

    return {
      id: this.requestId(
        input.observationId,
        gapId,
      ),
      gapId,
      meetingId: input.meetingId,
      sprintItemId: input.sprintItemId,
      observationId: input.observationId,
      reason: input.reason,
      message: input.message,
      createdAt: input.createdAt,
    };
  }

  private requestId(
    observationId: string,
    gapId: string,
  ): string {
    return createHash(
      'sha256',
    )
      .update(
        `${observationId}:${gapId}`,
      )
      .digest(
        'hex',
      );
  }
}
