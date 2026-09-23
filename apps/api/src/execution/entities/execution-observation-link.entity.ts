import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { MeetingEntity } from '../../meetings/meeting.entity.js';
import { SprintItemEntity } from '../../sprints/entities/sprint-item.entity.js';

@Entity({
  name: 'execution_observation_links',
})
@Index(
  'execution_observation_links_meeting_idx',
  ['meetingId'],
)
@Index(
  'execution_observation_links_sprint_item_idx',
  ['sprintItemId'],
)
export class ExecutionObservationLinkEntity {
  @PrimaryColumn({
    name: 'observation_id',
    type: 'text',
  })
  observationId!: string;

  @Column({
    name: 'meeting_id',
    type: 'uuid',
  })
  meetingId!: string;

  @Column({
    name: 'sprint_item_id',
    type: 'uuid',
  })
  sprintItemId!: string;

  @Column({
    type: 'text',
  })
  kind!: string;

  @Column({
    name: 'evidence_event_id',
    type: 'text',
  })
  evidenceEventId!: string;

  @CreateDateColumn({
    name: 'applied_at',
    type: 'timestamptz',
  })
  appliedAt!: Date;

  @ManyToOne(() => MeetingEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'meeting_id',
  })
  meeting!: MeetingEntity;

  @ManyToOne(() => SprintItemEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'sprint_item_id',
  })
  sprintItem!: SprintItemEntity;
}
