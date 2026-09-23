import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { WorkspaceMemberEntity } from './entities/workspace-member.entity.js';

@Injectable()
export class WorkspaceMembersRepository {
  constructor(
    @InjectRepository(WorkspaceMemberEntity)
    private readonly repository: Repository<WorkspaceMemberEntity>,
  ) {}

  async findById(id: string): Promise<WorkspaceMemberEntity | null> {
    return this.repository.findOne({
      where: {
        id,
      },

      relations: {
        user: true,
        workspace: true,
      },
    });
  }
}
