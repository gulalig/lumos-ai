import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { PlatformAdminEntity } from './entities/platform-admin.entity.js';

@Injectable()
export class PlatformAdminsRepository {
  public constructor(
    @InjectRepository(PlatformAdminEntity)
    private readonly repository: Repository<PlatformAdminEntity>,
  ) {}

  public findById(id: string): Promise<PlatformAdminEntity | null> {
    return this.repository.findOne({
      where: {
        id,
      },
    });
  }

  public findByEmail(email: string): Promise<PlatformAdminEntity | null> {
    return this.repository
      .createQueryBuilder('admin')
      .where('LOWER(BTRIM(admin.email)) = LOWER(BTRIM(:email))', {
        email,
      })
      .getOne();
  }

  public async create(input: {
    id: string;
    email: string;
    displayName: string;
    passwordHash: string;
  }): Promise<PlatformAdminEntity> {
    const admin = this.repository.create({
      id: input.id,
      email: input.email.trim().toLowerCase(),
      displayName: input.displayName.trim(),
      passwordHash: input.passwordHash,
      isActive: true,
    });

    return this.repository.save(admin);
  }
}
