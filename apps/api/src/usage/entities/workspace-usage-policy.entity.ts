import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { WorkspaceEntity } from '../../identity/entities/workspace.entity.js';

@Entity({
  name: 'workspace_usage_policies',
})
@Index('workspace_usage_policies_trial_ends_at_idx', ['trialEndsAt'])
export class WorkspaceUsagePolicyEntity {
  @PrimaryColumn({
    name: 'workspace_id',
    type: 'uuid',
  })
  workspaceId!: string;

  @Column({
    name: 'enabled',
    type: 'boolean',
    default: true,
  })
  enabled!: boolean;

  @Column({
    name: 'trial_ends_at',
    type: 'timestamptz',
    nullable: true,
  })
  trialEndsAt!: Date | null;

  @Column({
    name: 'monthly_meeting_limit',
    type: 'integer',
    nullable: true,
  })
  monthlyMeetingLimit!: number | null;

  @Column({
    name: 'meeting_creation_enabled',
    type: 'boolean',
    default: true,
  })
  meetingCreationEnabled!: boolean;

  @Column({
    name: 'livekit_enabled',
    type: 'boolean',
    default: true,
  })
  livekitEnabled!: boolean;

  @Column({
    name: 'disabled_reason',
    type: 'text',
    nullable: true,
  })
  disabledReason!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
  })
  updatedAt!: Date;

  @OneToOne(() => WorkspaceEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'workspace_id',
    foreignKeyConstraintName: 'workspace_usage_policies_workspace_id_fkey',
  })
  workspace!: WorkspaceEntity;
}
