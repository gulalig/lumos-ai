import {
  Check,
  Column,
  CreateDateColumn,
  Entity, Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';

import { WorkspaceEntity } from '../identity/entities/workspace.entity.js';

export type MeetingStatus = 'created' | 'active' | 'ended';

@Index('idx_meetings_status', ['status'])
@Index('idx_meetings_created_at', ['createdAt'])
@Index('idx_meetings_workspace_id', ['workspaceId'])
@Entity({
  name: 'meetings',
})
@Unique('meetings_room_name_key', ['roomName'])
@Check('meetings_status_check', `"status" IN ('created', 'active', 'ended')`)
export class MeetingEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({
    name: 'room_name',
    type: 'text',
  })
  roomName!: string;

  @Column({
    type: 'text',
    default: 'created',
  })
  status!: MeetingStatus;

  @Column({
    name: 'workspace_id',
    type: 'uuid',
    nullable: true,
  })
  workspaceId!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt!: Date;

  @Column({
    name: 'started_at',
    type: 'timestamptz',
    nullable: true,
  })
  startedAt!: Date | null;

  @Column({
    name: 'ended_at',
    type: 'timestamptz',
    nullable: true,
  })
  endedAt!: Date | null;

  @ManyToOne(() => WorkspaceEntity, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'workspace_id',
    foreignKeyConstraintName: 'meetings_workspace_id_fkey',
  })
  workspace!: WorkspaceEntity | null;
}
