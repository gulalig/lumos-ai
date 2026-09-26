import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { Env } from '../config/env.js';

import { UsersRepository } from '../identity/users.repository.js';
import { WorkspaceMembersRepository } from '../identity/workspace-members.repository.js';

import type { AccessTokenPayload, AuthPrincipal } from './auth-principal.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  public constructor(
    config: ConfigService<Env, true>,

    private readonly users: UsersRepository,

    private readonly workspaceMembers: WorkspaceMembersRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      ignoreExpiration: false,

      secretOrKey: config.get('JWT_ACCESS_SECRET', {
        infer: true,
      }),
    });
  }

  public async validate(payload: AccessTokenPayload): Promise<AuthPrincipal> {
    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new UnauthorizedException();
    }

    const user = await this.users.findById(payload.sub);

    if (!user || !user.emailVerifiedAt) {
      throw new UnauthorizedException();
    }

    if (!payload.workspaceMemberId) {
      return {
        userId: user.id,

        email: user.email,

        displayName: user.displayName,

        workspaceMemberId: null,

        workspaceId: null,

        role: null,
      };
    }

    const member = await this.workspaceMembers.findById(
      payload.workspaceMemberId,
    );

    if (!member || member.userId !== user.id) {
      throw new UnauthorizedException();
    }

    return {
      userId: user.id,

      email: user.email,

      displayName: user.displayName,

      workspaceMemberId: member.id,

      workspaceId: member.workspaceId,

      role: member.role,
    };
  }
}
