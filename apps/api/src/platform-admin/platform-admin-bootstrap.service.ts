import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { PasswordService } from '../auth/password.service.js';
import type { Env } from '../config/env.js';

import { PlatformAdminsRepository } from './platform-admins.repository.js';

@Injectable()
export class PlatformAdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PlatformAdminBootstrapService.name);

  public constructor(
    private readonly config: ConfigService<Env, true>,

    private readonly admins: PlatformAdminsRepository,

    private readonly passwords: PasswordService,
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get('PLATFORM_ADMIN_BOOTSTRAP_EMAIL', {
      infer: true,
    });

    const password = this.config.get('PLATFORM_ADMIN_BOOTSTRAP_PASSWORD', {
      infer: true,
    });

    const displayName = this.config.get('PLATFORM_ADMIN_BOOTSTRAP_NAME', {
      infer: true,
    });

    if (!email || !password) {
      return;
    }

    const existing = await this.admins.findByEmail(email);

    if (existing) {
      return;
    }

    const passwordHash = await this.passwords.hash(password);

    await this.admins.create({
      id: randomUUID(),

      email,

      displayName: displayName || 'Lumos Admin',

      passwordHash,
    });

    this.logger.log(`Platform admin bootstrap account created for ${email}`);
  }
}
