import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { Env } from '../config/env.js';

import type {
  PlatformAdminAccessTokenPayload,
  PlatformAdminPrincipal,
} from './platform-admin-principal.js';
import { PlatformAdminsRepository } from './platform-admins.repository.js';

@Injectable()
export class PlatformAdminJwtStrategy extends PassportStrategy(
  Strategy,
  'platform-admin-jwt',
) {
  public constructor(
    config: ConfigService<Env, true>,

    private readonly admins: PlatformAdminsRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey: config.get('JWT_ACCESS_SECRET', {
        infer: true,
      }),
    });
  }

  public async validate(
    payload: PlatformAdminAccessTokenPayload,
  ): Promise<PlatformAdminPrincipal> {
    if (
      !payload.sub ||
      typeof payload.sub !== 'string' ||
      payload.kind !== 'platform_admin'
    ) {
      throw new UnauthorizedException();
    }

    const admin = await this.admins.findById(payload.sub);

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException();
    }

    return {
      adminId: admin.id,

      email: admin.email,

      displayName: admin.displayName,

      kind: 'platform_admin',
    };
  }
}
