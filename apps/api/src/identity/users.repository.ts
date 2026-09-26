import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';

import { UserEntity } from './entities/user.entity.js';

export interface CreateUserInput {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
}

@Injectable()
export class UsersRepository {
  public constructor(
    @InjectRepository(UserEntity)
    private readonly repository: Repository<UserEntity>,
  ) {}

  public async findById(
    id: string,
    manager?: EntityManager,
  ): Promise<UserEntity | null> {
    return this.getRepository(manager).findOne({
      where: {
        id,
      },
    });
  }

  public async findByIdForUpdate(
    id: string,
    manager: EntityManager,
  ): Promise<UserEntity | null> {
    return manager
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .setLock('pessimistic_write')
      .where('user.id = :id', {
        id,
      })
      .getOne();
  }

  public async findByEmail(
    email: string,
    manager?: EntityManager,
  ): Promise<UserEntity | null> {
    return this.getRepository(manager)
      .createQueryBuilder('user')
      .where('LOWER(BTRIM(user.email)) = LOWER(BTRIM(:email))', {
        email,
      })
      .getOne();
  }

  public async create(
    input: CreateUserInput,
    manager?: EntityManager,
  ): Promise<UserEntity> {
    const repository = this.getRepository(manager);

    const user = repository.create({
      id: input.id,

      email: input.email.trim().toLowerCase(),

      displayName: input.displayName.trim(),

      passwordHash: input.passwordHash,

      emailVerifiedAt: null,
    });

    return repository.save(user);
  }

  public async markEmailVerified(
    user: UserEntity,
    verifiedAt: Date,
    manager?: EntityManager,
  ): Promise<UserEntity> {
    user.emailVerifiedAt = verifiedAt;

    return this.getRepository(manager).save(user);
  }

  public async updatePasswordHash(
    user: UserEntity,
    passwordHash: string,
    manager?: EntityManager,
  ): Promise<UserEntity> {
    user.passwordHash = passwordHash;

    return this.getRepository(manager).save(user);
  }

  private getRepository(manager?: EntityManager): Repository<UserEntity> {
    return manager ? manager.getRepository(UserEntity) : this.repository;
  }
}
