import { ConflictException, Injectable } from '@nestjs/common';

import type { ResolvedMemberIdentity } from '../identity/identity.service.js';

import { MeetingParticipantEntity } from './meeting-participant.entity.js';
import { MeetingParticipantsRepository } from './meeting-participants.repository.js';

@Injectable()
export class MeetingParticipantsService {
  constructor(
    private readonly participantsRepository: MeetingParticipantsRepository,
  ) {}

  async ensureMember(
    meetingId: string,
    identity: ResolvedMemberIdentity,
  ): Promise<MeetingParticipantEntity> {
    const participant = await this.participantsRepository.ensureMember({
      meetingId,

      workspaceId: identity.workspaceId,

      workspaceMemberId: identity.workspaceMemberId,

      displayName: identity.displayName,

      livekitIdentity: identity.livekitIdentity,
    });

    if (!participant) {
      throw new ConflictException(
        `Meeting ${meetingId} is not available to this workspace member`,
      );
    }

    return participant;
  }
}
