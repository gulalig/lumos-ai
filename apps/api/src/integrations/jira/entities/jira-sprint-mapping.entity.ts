import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { SprintEntity } from '../../../sprints/entities/sprint.entity.js';

@Entity({
  name: 'jira_sprint_mappings',
})
@Unique('jira_sprint_mappings_external_sprint_key', [
  'jiraCloudId',
  'jiraSprintId',
])
export class JiraSprintMappingEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({
    name: 'sprint_id',
    type: 'uuid',
  })
  sprintId!: string;

  @Column({
    name: 'jira_cloud_id',
    type: 'text',
  })
  jiraCloudId!: string;

  @Column({
    name: 'jira_board_id',
    type: 'text',
  })
  jiraBoardId!: string;

  @Column({
    name: 'jira_sprint_id',
    type: 'text',
  })
  jiraSprintId!: string;

  @Column({
    name: 'last_synced_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastSyncedAt!: Date | null;

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

  @OneToOne(() => SprintEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'sprint_id',
  })
  sprint!: SprintEntity;
}
