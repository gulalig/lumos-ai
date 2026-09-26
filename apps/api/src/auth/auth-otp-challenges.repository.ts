import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { EntityManager, Repository } from 'typeorm';

import {
  AuthOtpChallengeEntity,
  AuthOtpPurpose,
} from './entities/auth-otp-challenge.entity.js';

export interface CreateOtpChallengeInput {
  userId: string | null;
  email: string;
  purpose: AuthOtpPurpose;
  codeHash: string;
  expiresAt: Date;
  maxAttempts: number;
}

@Injectable()
export class AuthOtpChallengesRepository {
  public constructor(
    @InjectRepository(AuthOtpChallengeEntity)
    private readonly repository: Repository<AuthOtpChallengeEntity>,
  ) {}

  public async consumeActive(
    email: string,
    purpose: AuthOtpPurpose,
    consumedAt: Date,
    manager?: EntityManager,
  ): Promise<void> {
    await this.getRepository(manager)
      .createQueryBuilder()
      .update(AuthOtpChallengeEntity)
      .set({
        consumedAt,
      })
      .where('LOWER(BTRIM(email)) = LOWER(BTRIM(:email))', {
        email,
      })
      .andWhere('purpose = :purpose', {
        purpose,
      })
      .andWhere('consumed_at IS NULL')
      .execute();
  }

  public async create(
    input: CreateOtpChallengeInput,
    manager?: EntityManager,
  ): Promise<AuthOtpChallengeEntity> {
    const repository = this.getRepository(manager);

    const challenge = repository.create({
      id: randomUUID(),

      userId: input.userId,

      email: input.email.trim().toLowerCase(),

      purpose: input.purpose,

      codeHash: input.codeHash,

      expiresAt: input.expiresAt,

      attemptCount: 0,

      maxAttempts: input.maxAttempts,

      consumedAt: null,
    });

    return repository.save(challenge);
  }

  public async findActive(
    email: string,
    purpose: AuthOtpPurpose,
    manager?: EntityManager,
  ): Promise<AuthOtpChallengeEntity | null> {
    return this.getRepository(manager)
      .createQueryBuilder('challenge')
      .where('LOWER(BTRIM(challenge.email)) = LOWER(BTRIM(:email))', {
        email,
      })
      .andWhere('challenge.purpose = :purpose', {
        purpose,
      })
      .andWhere('challenge.consumed_at IS NULL')
      .orderBy('challenge.created_at', 'DESC')
      .getOne();
  }

  public async save(
    challenge: AuthOtpChallengeEntity,
    manager?: EntityManager,
  ): Promise<AuthOtpChallengeEntity> {
    return this.getRepository(manager).save(challenge);
  }

  private getRepository(
    manager?: EntityManager,
  ): Repository<AuthOtpChallengeEntity> {
    return manager
      ? manager.getRepository(AuthOtpChallengeEntity)
      : this.repository;
  }
}
