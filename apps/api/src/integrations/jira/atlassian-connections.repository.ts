import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AtlassianConnectionEntity } from './entities/atlassian-connection.entity.js';

@Injectable()
export class AtlassianConnectionsRepository {
  public constructor(
    @InjectRepository(AtlassianConnectionEntity)
    private readonly repository: Repository<AtlassianConnectionEntity>,
  ) {}

  public async findByWorkspaceId(
    workspaceId: string,
  ): Promise<AtlassianConnectionEntity | null> {
    return this.repository.findOne({
      where: {
        workspaceId,
      },
    });
  }

  public async save(
    connection: AtlassianConnectionEntity,
  ): Promise<AtlassianConnectionEntity> {
    return this.repository.save(connection);
  }

  public create(
    values: Partial<AtlassianConnectionEntity>,
  ): AtlassianConnectionEntity {
    return this.repository.create(values);
  }
}
