import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

@Unique('workspaces_slug_key', ['slug'])
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

  @Column({
    type: 'text',
    nullable: true,
  })
  industry!: string | null;

  @Column({
    name: 'company_size',
    type: 'text',
    nullable: true,
  })
  companySize!: string | null;

  @Column({
    type: 'text',
    nullable: true,
  })
  website!: string | null;

  @Column({
    name: 'primary_use_case',
    type: 'text',
    nullable: true,
  })
  primaryUseCase!: string | null;

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
