import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { UserEntity } from '../../identity/entities/user.entity.js';
import { WorkspaceMemberEntity } from '../../identity/entities/workspace-member.entity.js';

@Entity({
  name: 'auth_refresh_sessions',
})
@Index('auth_refresh_sessions_user_idx', ['userId'])
@Index('auth_refresh_sessions_family_idx', ['familyId'])
@Index('auth_refresh_sessions_expires_idx', ['expiresAt'])
export class AuthRefreshSessionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({
    name: 'family_id',
    type: 'uuid',
  })
  familyId!: string;

  @Column({
    name: 'user_id',
    type: 'uuid',
  })
  userId!: string;

  @Column({
    name: 'workspace_member_id',
    type: 'uuid',
    nullable: true,
  })
  workspaceMemberId!: string | null;

  @Column({
    name: 'token_hash',
    type: 'text',
    unique: true,
  })
  tokenHash!: string;

  @Column({
    name: 'expires_at',
    type: 'timestamptz',
  })
  expiresAt!: Date;

  @Column({
    name: 'last_used_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastUsedAt!: Date | null;

  @Column({
    name: 'revoked_at',
    type: 'timestamptz',
    nullable: true,
  })
  revokedAt!: Date | null;

  @Column({
    name: 'revoke_reason',
    type: 'text',
    nullable: true,
  })
  revokeReason!: string | null;

  @Column({
    name: 'rotated_from_id',
    type: 'uuid',
    nullable: true,
  })
  rotatedFromId!: string | null;

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

  @ManyToOne(() => UserEntity, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'auth_refresh_sessions_user_id_fkey',
  })
  user!: UserEntity;

  @ManyToOne(() => WorkspaceMemberEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'workspace_member_id',
    foreignKeyConstraintName: 'auth_refresh_sessions_workspace_member_id_fkey',
  })
  workspaceMember!: WorkspaceMemberEntity | null;

  @ManyToOne(() => AuthRefreshSessionEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'rotated_from_id',
    foreignKeyConstraintName: 'auth_refresh_sessions_rotated_from_id_fkey',
  })
  rotatedFrom!: AuthRefreshSessionEntity | null;
}
