import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';

import { UserEntity } from '../../identity/entities/user.entity.js';

export type AuthOtpPurpose = 'verify_email' | 'reset_password';

@Entity({
  name: 'auth_otp_challenges',
})
@Check(
  'auth_otp_challenges_purpose_check',
  `"purpose" IN ('verify_email', 'reset_password')`,
)
@Index('auth_otp_challenges_expires_idx', ['expiresAt'])
export class AuthOtpChallengeEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({
    name: 'user_id',
    type: 'uuid',
    nullable: true,
  })
  userId!: string | null;

  @Column({
    type: 'text',
  })
  email!: string;

  @Column({
    type: 'text',
  })
  purpose!: AuthOtpPurpose;

  @Column({
    name: 'code_hash',
    type: 'text',
  })
  codeHash!: string;

  @Column({
    name: 'expires_at',
    type: 'timestamptz',
  })
  expiresAt!: Date;

  @Column({
    name: 'attempt_count',
    type: 'integer',
    default: 0,
  })
  attemptCount!: number;

  @Column({
    name: 'max_attempts',
    type: 'integer',
    default: 5,
  })
  maxAttempts!: number;

  @Column({
    name: 'consumed_at',
    type: 'timestamptz',
    nullable: true,
  })
  consumedAt!: Date | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
  })
  createdAt!: Date;

  @ManyToOne(() => UserEntity, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'user_id',
    foreignKeyConstraintName: 'auth_otp_challenges_user_id_fkey',
  })
  user!: UserEntity | null;
}
