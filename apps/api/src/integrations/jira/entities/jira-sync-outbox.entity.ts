import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { WorkspaceEntity } from '../../../identity/entities/workspace.entity.js';
import { SprintItemEntity } from '../../../sprints/entities/sprint-item.entity.js';

export type JiraSyncOutboxStatus = 'pending' | 'processing' | 'completed';

@Entity({
  name: 'jira_sync_outbox',
})
@Check(
  'jira_sync_outbox_status_check',
  `"status" IN ('pending', 'processing', 'completed')`,
)
@Unique('jira_sync_outbox_sprint_item_unique', ['sprintItemId'])
@Index('jira_sync_outbox_available_idx', ['status', 'availableAt'])
@Index('jira_sync_outbox_workspace_idx', ['workspaceId'])
export class JiraSyncOutboxEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({
    name: 'workspace_id',
    type: 'uuid',
  })
  workspaceId!: string;

  @Column({
    name: 'sprint_item_id',
    type: 'uuid',
  })
  sprintItemId!: string;

  @Column({
    type: 'text',
    default: 'pending',
  })
  status!: JiraSyncOutboxStatus;

  @Column({
    type: 'integer',
    default: 1,
  })
  revision!: number;

  @Column({
    type: 'integer',
    default: 0,
  })
  attempts!: number;

  @Column({
    name: 'available_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  availableAt!: Date;

  @Column({
    name: 'locked_at',
    type: 'timestamptz',
    nullable: true,
  })
  lockedAt!: Date | null;

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

  @OneToOne(() => SprintItemEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'sprint_item_id',
  })
  sprintItem!: SprintItemEntity;
}
