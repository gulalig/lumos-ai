import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

import { WorkspaceMemberEntity } from '../../identity/entities/workspace-member.entity.js';
import { SprintEntity } from './sprint.entity.js';

export type SprintItemStatus =
  | 'todo'
  | 'in_progress'
  | 'blocked'
  | 'done'
  | 'cancelled';

@Entity({
  name: 'sprint_items',
})
@Check(
  'sprint_items_status_check',
  `"status" IN ('todo', 'in_progress', 'blocked', 'done', 'cancelled')`,
)
@Index('sprint_items_sprint_status_idx', ['sprintId', 'status'])
@Index('sprint_items_owner_idx', ['ownerWorkspaceMemberId'])
export class SprintItemEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({
    name: 'sprint_id',
    type: 'uuid',
  })
  sprintId!: string;

  @Column({
    type: 'text',
  })
  title!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  description!: string | null;

  @Column({
    type: 'text',
    default: 'todo',
  })
  status!: SprintItemStatus;

  @Column({
    name: 'owner_workspace_member_id',
    type: 'uuid',
    nullable: true,
  })
  ownerWorkspaceMemberId!: string | null;

  @Column({
    name: 'due_at',
    type: 'timestamptz',
    nullable: true,
  })
  dueAt!: Date | null;

  @Column({
    name: 'blocker_text',
    type: 'text',
    nullable: true,
  })
  blockerText!: string | null;

  @Column({
    name: 'acceptance_criteria',
    type: 'text',
    array: true,
    default: () => "'{}'",
  })
  acceptanceCriteria!: string[];

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

  @ManyToOne(() => SprintEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'sprint_id',
  })
  sprint!: SprintEntity;

  @ManyToOne(() => WorkspaceMemberEntity, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({
    name: 'owner_workspace_member_id',
  })
  owner!: WorkspaceMemberEntity | null;
}
