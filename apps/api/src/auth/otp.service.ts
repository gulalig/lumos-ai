import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { EntityManager } from 'typeorm';

import type { Env } from '../config/env.js';

import { AuthOtpPurpose } from './entities/auth-otp-challenge.entity.js';
import { AuthOtpChallengesRepository } from './auth-otp-challenges.repository.js';

const OTP_EXPIRY_MS = 10 * 60 * 1000;

const OTP_MAX_ATTEMPTS = 5;

const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

export interface CreatedOtpChallenge {
  challengeId: string;
  code: string;
  expiresAt: Date;
}

@Injectable()
export class OtpService {
  private readonly pepper: string;

  public constructor(
    private readonly challenges: AuthOtpChallengesRepository,

    config: ConfigService<Env, true>,
  ) {
    this.pepper = config.get('AUTH_OTP_PEPPER', {
      infer: true,
    });
  }

  public async createChallenge(
    input: {
      userId: string | null;
      email: string;
      purpose: AuthOtpPurpose;
    },
    manager?: EntityManager,
  ): Promise<CreatedOtpChallenge> {
    const normalizedEmail = this.normalizeEmail(input.email);

    const existing = await this.challenges.findActive(
      normalizedEmail,
      input.purpose,
      manager,
    );

    if (
      existing &&
      Date.now() - existing.createdAt.getTime() < OTP_RESEND_COOLDOWN_MS
    ) {
      throw new HttpException(
        'Please wait before requesting another verification code',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const now = new Date();

    await this.challenges.consumeActive(
      normalizedEmail,
      input.purpose,
      now,
      manager,
    );

    const code = this.generateCode();

    const challenge = await this.challenges.create(
      {
        userId: input.userId,

        email: normalizedEmail,

        purpose: input.purpose,

        codeHash: this.hashCode(normalizedEmail, input.purpose, code),

        expiresAt: new Date(now.getTime() + OTP_EXPIRY_MS),

        maxAttempts: OTP_MAX_ATTEMPTS,
      },
      manager,
    );

    return {
      challengeId: challenge.id,

      code,

      expiresAt: challenge.expiresAt,
    };
  }

  public async verifyCode(
    input: {
      email: string;
      purpose: AuthOtpPurpose;
      code: string;
    },
    manager?: EntityManager,
  ): Promise<void> {
    const normalizedEmail = this.normalizeEmail(input.email);

    const challenge = await this.challenges.findActive(
      normalizedEmail,
      input.purpose,
      manager,
    );

    if (!challenge) {
      throw new BadRequestException('Verification code is invalid or expired');
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      challenge.consumedAt = new Date();

      await this.challenges.save(challenge, manager);

      throw new BadRequestException('Verification code is invalid or expired');
    }

    if (challenge.attemptCount >= challenge.maxAttempts) {
      challenge.consumedAt = new Date();

      await this.challenges.save(challenge, manager);

      throw new HttpException(
        'Verification code attempt limit reached',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const expected = Buffer.from(challenge.codeHash, 'hex');

    const actual = Buffer.from(
      this.hashCode(normalizedEmail, input.purpose, input.code),
      'hex',
    );

    const valid =
      expected.length === actual.length && timingSafeEqual(expected, actual);

    if (!valid) {
      challenge.attemptCount += 1;

      if (challenge.attemptCount >= challenge.maxAttempts) {
        challenge.consumedAt = new Date();
      }

      await this.challenges.save(challenge, manager);

      throw new BadRequestException('Verification code is invalid or expired');
    }

    challenge.consumedAt = new Date();

    await this.challenges.save(challenge, manager);
  }

  private generateCode(): string {
    return randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private hashCode(
    email: string,
    purpose: AuthOtpPurpose,
    code: string,
  ): string {
    return createHash('sha256')
      .update([this.pepper, email, purpose, code].join(':'))
      .digest('hex');
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}
