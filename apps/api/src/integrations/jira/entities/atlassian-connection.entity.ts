import {
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

import { WorkspaceEntity } from '../../../identity/entities/workspace.entity.js';

@Entity({
  name: 'atlassian_connections',
})
@Unique('atlassian_connections_workspace_key', ['workspaceId'])
@Index('atlassian_connections_cloud_id_idx', ['cloudId'])
export class AtlassianConnectionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({
    name: 'workspace_id',
    type: 'uuid',
  })
  workspaceId!: string;

  @Column({
    name: 'cloud_id',
    type: 'text',
    nullable: true,
  })
  cloudId!: string | null;

  @Column({
    name: 'site_name',
    type: 'text',
    nullable: true,
  })
  siteName!: string | null;

  @Column({
    name: 'site_url',
    type: 'text',
    nullable: true,
  })
  siteUrl!: string | null;

  @Column({
    name: 'project_id',
    type: 'text',
    nullable: true,
  })
  projectId!: string | null;

  @Column({
    name: 'project_key',
    type: 'text',
    nullable: true,
  })
  projectKey!: string | null;

  @Column({
    name: 'project_name',
    type: 'text',
    nullable: true,
  })
  projectName!: string | null;

  @Column({
    name: 'access_token_encrypted',
    type: 'text',
    nullable: true,
  })
  accessTokenEncrypted!: string | null;

  @Column({
    name: 'refresh_token_encrypted',
    type: 'text',
    nullable: true,
  })
  refreshTokenEncrypted!: string | null;

  @Column({
    name: 'access_token_expires_at',
    type: 'timestamptz',
    nullable: true,
  })
  accessTokenExpiresAt!: Date | null;

  @Column({
    name: 'granted_scopes',
    type: 'text',
    array: true,
    default: '{}',
  })
  grantedScopes!: string[];

  @Column({
    name: 'status',
    type: 'text',
    default: 'pending',
  })
  status!: 'pending' | 'connected' | 'error';

  @Column({
    name: 'last_error',
    type: 'text',
    nullable: true,
  })
  lastError!: string | null;

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
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'workspace_id',
  })
  workspace!: WorkspaceEntity;
}
