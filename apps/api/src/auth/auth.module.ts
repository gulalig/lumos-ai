import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IdentityModule } from '../identity/identity.module.js';

import { AccessTokenService } from './access-token.service.js';
import { AuthController } from './auth.controller.js';
import { AuthEmailService } from './auth-email.service.js';
import { AuthOtpChallengesRepository } from './auth-otp-challenges.repository.js';
import { AuthService } from './auth.service.js';
import { AuthOtpChallengeEntity } from './entities/auth-otp-challenge.entity.js';
import { AuthRefreshSessionEntity } from './entities/auth-refresh-session.entity.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtStrategy } from './jwt.strategy.js';
import { OtpService } from './otp.service.js';
import { PasswordService } from './password.service.js';
import { AuthRefreshSessionsRepository } from './auth-refresh-sessions.repository.js';
import { RefreshCookieService } from './refresh-cookie.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { RolesGuard } from './roles.guard.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';

@Module({
  imports: [
    IdentityModule,

    RateLimitModule,

    PassportModule.register({
      defaultStrategy: 'jwt',
    }),

    JwtModule.register({}),

    TypeOrmModule.forFeature([
      AuthOtpChallengeEntity,
      AuthRefreshSessionEntity,
    ]),
  ],

  controllers: [AuthController],

  providers: [
    AuthOtpChallengesRepository,
    AuthRefreshSessionsRepository,
    PasswordService,
    OtpService,
    AuthEmailService,
    AccessTokenService,
    RefreshTokenService,
    RefreshCookieService,
    JwtStrategy,
    JwtAuthGuard,
    AuthService,
    RolesGuard,
  ],

  exports: [
    AuthService,
    PassportModule,
    OtpService,
    PasswordService,
    AccessTokenService,
    JwtAuthGuard,
    RolesGuard,
    RefreshTokenService,
    RefreshCookieService,
  ],
})
export class AuthModule {}
