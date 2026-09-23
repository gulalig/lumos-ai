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

import { WorkspaceEntity } from '../../identity/entities/workspace.entity.js';

export type SprintStatus = 'planned' | 'active' | 'completed' | 'cancelled';

@Entity({
  name: 'sprints',
})
@Check(
  'sprints_status_check',
  `"status" IN ('planned', 'active', 'completed', 'cancelled')`,
)
@Index('sprints_workspace_status_idx', ['workspaceId', 'status'])
export class SprintEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({
    name: 'workspace_id',
    type: 'uuid',
  })
  workspaceId!: string;

  @Column({
    type: 'text',
  })
  name!: string;

  @Column({
    type: 'text',
    nullable: true,
  })
  goal!: string | null;

  @Column({
    type: 'text',
    default: 'planned',
  })
  status!: SprintStatus;

  @Column({
    name: 'starts_at',
    type: 'timestamptz',
    nullable: true,
  })
  startsAt!: Date | null;

  @Column({
    name: 'ends_at',
    type: 'timestamptz',
    nullable: true,
  })
  endsAt!: Date | null;

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
    onDelete: 'RESTRICT',
  })
  @JoinColumn({
    name: 'workspace_id',
  })
  workspace!: WorkspaceEntity;
}
