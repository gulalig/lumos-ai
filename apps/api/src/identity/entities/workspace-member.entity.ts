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
  UpdateDateColumn,
} from 'typeorm';

import { UserEntity } from './user.entity.js';
import { WorkspaceEntity } from './workspace.entity.js';

export type WorkspaceMemberRole = 'owner' | 'admin' | 'member';

@Entity({
  name: 'workspace_members',
})
@Unique('workspace_members_workspace_user_key', ['userId', 'workspaceId'])
@Check('workspace_members_role_check', `"role" IN ('owner', 'admin', 'member')`)
@Index('idx_workspace_members_workspace_id', ['workspaceId'])
@Index('idx_workspace_members_user_id', ['userId'])
export class WorkspaceMemberEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({
    name: 'workspace_id',
    type: 'uuid',
  })
  workspaceId!: string;

  @Column({
    name: 'user_id',
    type: 'uuid',
  })
  userId!: string;

  @Column({
    type: 'text',
    default: 'member',
  })
  role!: WorkspaceMemberRole;

  @Column({
    name: 'job_title',
    type: 'text',
    nullable: true,
  })
  jobTitle!: string | null;

  @Column({
    name: 'team_name',
    type: 'text',
    nullable: true,
  })
  teamName!: string | null;

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

  @ManyToOne(() => WorkspaceEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'workspace_id',
    foreignKeyConstraintName: 'workspace_members_workspace_id_fkey',
  })
  workspace!: WorkspaceEntity;

  @ManyToOne(() => UserEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'workspace_members_user_id_fkey',
  })
  user!: UserEntity;
}
