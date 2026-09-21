import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { WorkspaceMemberEntity } from '../identity/entities/workspace-member.entity.js';

import { MeetingEntity } from './meeting.entity.js';

export type MeetingParticipantType = 'member' | 'guest';

@Entity({
  name: 'meeting_participants',
})
@Unique('meeting_participants_meeting_identity_key', [
  'meetingId',
  'livekitIdentity',
])
@Unique('meeting_participants_meeting_member_key', [
  'meetingId',
  'workspaceMemberId',
])
@Index('idx_meeting_participants_meeting_id', ['meetingId'])
@Index('idx_meeting_participants_workspace_member_id', ['workspaceMemberId'])
@Check(
  'meeting_participants_type_check',
  `"participant_type" IN ('member', 'guest')`,
)
@Check(
  'meeting_participants_member_check',
  `
    (
      "participant_type" = 'member'
      AND "workspace_member_id" IS NOT NULL
    )
    OR
    (
      "participant_type" = 'guest'
      AND "workspace_member_id" IS NULL
    )
  `,
)
export class MeetingParticipantEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({
    name: 'meeting_id',
    type: 'uuid',
  })
  meetingId!: string;

  @Column({
    name: 'workspace_member_id',
    type: 'uuid',
    nullable: true,
  })
  workspaceMemberId!: string | null;

  @Column({
    name: 'participant_type',
    type: 'text',
    default: 'member',
  })
  participantType!: MeetingParticipantType;

  @Column({
    name: 'display_name',
    type: 'text',
  })
  displayName!: string;

  @Column({
    name: 'livekit_identity',
    type: 'text',
  })
  livekitIdentity!: string;

  @Column({
    name: 'joined_at',
    type: 'timestamptz',
  })
  joinedAt!: Date;

  @Column({
    name: 'left_at',
    type: 'timestamptz',
    nullable: true,
  })
  leftAt!: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt!: Date;

  @ManyToOne(() => MeetingEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'meeting_id',
  })
  meeting!: MeetingEntity;

  @ManyToOne(() => WorkspaceMemberEntity, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'workspace_member_id',
  })
  workspaceMember!: WorkspaceMemberEntity | null;
}
