import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module.js';
import { RedisModule } from '../redis/redis.module.js';
import { UsageModule } from '../usage/usage.module.js';

import { PlatformAdminEntity } from './entities/platform-admin.entity.js';

import { PlatformAdminAccessTokenService } from './platform-admin-access-token.service.js';

import { PlatformAdminAuthController } from './platform-admin-auth.controller.js';
import { PlatformAdminAuthGuard } from './platform-admin-auth.guard.js';
import { PlatformAdminAuthService } from './platform-admin-auth.service.js';

import { PlatformAdminBootstrapService } from './platform-admin-bootstrap.service.js';

import { PlatformAdminIntegrationsController } from './platform-admin-integrations.controller.js';
import { PlatformAdminIntegrationsService } from './platform-admin-integrations.service.js';

import { PlatformAdminJwtStrategy } from './platform-admin-jwt.strategy.js';

import { PlatformAdminOverviewController } from './platform-admin-overview.controller.js';
import { PlatformAdminOverviewService } from './platform-admin-overview.service.js';

import { PlatformAdminSystemController } from './platform-admin-system.controller.js';
import { PlatformAdminSystemService } from './platform-admin-system.service.js';

import { PlatformAdminUsersController } from './platform-admin-users.controller.js';
import { PlatformAdminUsersService } from './platform-admin-users.service.js';

import { PlatformAdminWorkspacesController } from './platform-admin-workspaces.controller.js';
import { PlatformAdminWorkspacesService } from './platform-admin-workspaces.service.js';

import { PlatformAdminsRepository } from './platform-admins.repository.js';

@Module({
  imports: [
    AuthModule,

    RedisModule,

    UsageModule,

    PassportModule,

    JwtModule.register({}),

    TypeOrmModule.forFeature([PlatformAdminEntity]),
  ],

  controllers: [
    PlatformAdminAuthController,

    PlatformAdminOverviewController,

    PlatformAdminUsersController,

    PlatformAdminWorkspacesController,

    PlatformAdminIntegrationsController,

    PlatformAdminSystemController,
  ],

  providers: [
    PlatformAdminsRepository,

    PlatformAdminAccessTokenService,

    PlatformAdminAuthService,

    PlatformAdminJwtStrategy,

    PlatformAdminAuthGuard,

    PlatformAdminBootstrapService,

    PlatformAdminOverviewService,

    PlatformAdminUsersService,

    PlatformAdminWorkspacesService,

    PlatformAdminIntegrationsService,

    PlatformAdminSystemService,
  ],

  exports: [PlatformAdminAuthGuard, PlatformAdminsRepository],
})
export class PlatformAdminModule {}
