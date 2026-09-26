import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { AuthRefreshSessionEntity } from './entities/auth-refresh-session.entity.js';

export interface CreateRefreshSessionInput {
  id: string;
  familyId: string;
  userId: string;
  workspaceMemberId: string | null;
  tokenHash: string;
  expiresAt: Date;
  rotatedFromId: string | null;
}

@Injectable()
export class AuthRefreshSessionsRepository {
  public constructor(
    @InjectRepository(AuthRefreshSessionEntity)
    private readonly repository: Repository<AuthRefreshSessionEntity>,
  ) {}

  public async findByTokenHash(
    tokenHash: string,
    manager?: EntityManager,
  ): Promise<AuthRefreshSessionEntity | null> {
    return this.getRepository(manager).findOne({
      where: {
        tokenHash,
      },
    });
  }

  public async findByTokenHashForUpdate(
    tokenHash: string,
    manager: EntityManager,
  ): Promise<AuthRefreshSessionEntity | null> {
    return manager
      .getRepository(AuthRefreshSessionEntity)
      .createQueryBuilder('session')
      .setLock('pessimistic_write')
      .where('session.token_hash = :tokenHash', {
        tokenHash,
      })
      .getOne();
  }

  public async create(
    input: CreateRefreshSessionInput,
    manager?: EntityManager,
  ): Promise<AuthRefreshSessionEntity> {
    const repository = this.getRepository(manager);

    const session = repository.create({
      id: input.id,

      familyId: input.familyId,

      userId: input.userId,

      workspaceMemberId: input.workspaceMemberId,

      tokenHash: input.tokenHash,

      expiresAt: input.expiresAt,

      lastUsedAt: null,

      revokedAt: null,

      revokeReason: null,

      rotatedFromId: input.rotatedFromId,
    });

    return repository.save(session);
  }

  public async save(
    session: AuthRefreshSessionEntity,
    manager?: EntityManager,
  ): Promise<AuthRefreshSessionEntity> {
    return this.getRepository(manager).save(session);
  }

  public async revokeFamily(
    familyId: string,
    revokedAt: Date,
    reason: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.getRepository(manager)
      .createQueryBuilder()
      .update(AuthRefreshSessionEntity)
      .set({
        revokedAt,
        revokeReason: reason,
      })
      .where('family_id = :familyId', {
        familyId,
      })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  public async revokeAllForUser(
    userId: string,
    revokedAt: Date,
    reason: string,
    manager?: EntityManager,
  ): Promise<void> {
    await this.getRepository(manager)
      .createQueryBuilder()
      .update(AuthRefreshSessionEntity)
      .set({
        revokedAt,
        revokeReason: reason,
      })
      .where('user_id = :userId', {
        userId,
      })
      .andWhere('revoked_at IS NULL')
      .execute();
  }

  private getRepository(
    manager?: EntityManager,
  ): Repository<AuthRefreshSessionEntity> {
    return manager
      ? manager.getRepository(AuthRefreshSessionEntity)
      : this.repository;
  }
}
