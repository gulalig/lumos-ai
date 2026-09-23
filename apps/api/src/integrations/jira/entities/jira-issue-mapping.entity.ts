import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { SprintItemEntity } from '../../../sprints/entities/sprint-item.entity.js';

@Entity({
  name: 'jira_issue_mappings',
})
@Unique('jira_issue_mappings_external_issue_key', [
  'jiraCloudId',
  'jiraIssueId',
])
@Index('jira_issue_mappings_issue_key_idx', ['jiraIssueKey'])
export class JiraIssueMappingEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({
    name: 'sprint_item_id',
    type: 'uuid',
  })
  sprintItemId!: string;

  @Column({
    name: 'jira_cloud_id',
    type: 'text',
  })
  jiraCloudId!: string;

  @Column({
    name: 'jira_issue_id',
    type: 'text',
  })
  jiraIssueId!: string;

  @Column({
    name: 'jira_issue_key',
    type: 'text',
  })
  jiraIssueKey!: string;

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

  @OneToOne(() => SprintItemEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'sprint_item_id',
  })
  sprintItem!: SprintItemEntity;
}
