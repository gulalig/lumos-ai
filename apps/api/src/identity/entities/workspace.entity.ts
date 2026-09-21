import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({
  name: 'workspaces',
})
export class WorkspaceEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({
    type: 'text',
  })
  name!: string;

  @Column({
    type: 'text',
  })
  slug!: string;

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
}
