import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from './entities/user.entity.js';
import { WorkspaceMemberEntity } from './entities/workspace-member.entity.js';
import { WorkspaceEntity } from './entities/workspace.entity.js';

import { IdentityService } from './identity.service.js';
import { UsersRepository } from './users.repository.js';
import { WorkspaceMembersRepository } from './workspace-members.repository.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      WorkspaceEntity,
      WorkspaceMemberEntity,
    ]),
  ],

  providers: [UsersRepository, WorkspaceMembersRepository, IdentityService],

  exports: [UsersRepository, WorkspaceMembersRepository, IdentityService],
})
export class IdentityModule {}
