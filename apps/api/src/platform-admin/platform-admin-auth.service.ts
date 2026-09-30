import { Injectable, UnauthorizedException } from '@nestjs/common';

import { PasswordService } from '../auth/password.service.js';

import { PlatformAdminAccessTokenService } from './platform-admin-access-token.service.js';
import { PlatformAdminsRepository } from './platform-admins.repository.js';

@Injectable()
export class PlatformAdminAuthService {
  public constructor(
    private readonly admins: PlatformAdminsRepository,

    private readonly passwords: PasswordService,

    private readonly accessTokens: PlatformAdminAccessTokenService,
  ) {}

  public async login(input: { email: string; password: string }) {
    const admin = await this.admins.findByEmail(input.email);

    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const passwordMatches = await this.passwords.verify(
      admin.passwordHash,
      input.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const token = await this.accessTokens.create(admin.id);

    return {
      ...token,

      admin: {
        id: admin.id,

        email: admin.email,

        displayName: admin.displayName,
      },
    };
  }
}
