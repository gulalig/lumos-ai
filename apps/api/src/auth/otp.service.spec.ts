import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import type { Env } from '../config/env.js';

import { AuthOtpChallengesRepository } from './auth-otp-challenges.repository.js';
import { AuthOtpChallengeEntity } from './entities/auth-otp-challenge.entity.js';
import { OtpService } from './otp.service.js';

function createFixture() {
  let activeChallenge: AuthOtpChallengeEntity | null = null;

  const repository = {
    findActive: vi.fn(async () => activeChallenge),

    consumeActive: vi.fn(async () => {
      if (activeChallenge) {
        activeChallenge.consumedAt = new Date();
      }
    }),

    create: vi.fn(
      async (input: {
        userId: string | null;
        email: string;
        purpose: 'verify_email' | 'reset_password';
        codeHash: string;
        expiresAt: Date;
        maxAttempts: number;
      }) => {
        activeChallenge = Object.assign(new AuthOtpChallengeEntity(), {
          id: 'challenge-1',
          userId: input.userId,
          email: input.email,
          purpose: input.purpose,
          codeHash: input.codeHash,
          expiresAt: input.expiresAt,
          attemptCount: 0,
          maxAttempts: input.maxAttempts,
          consumedAt: null,
          createdAt: new Date(),
        });

        return activeChallenge;
      },
    ),

    save: vi.fn(async (challenge: AuthOtpChallengeEntity) => challenge),
  } as unknown as AuthOtpChallengesRepository;

  const config = {
    get: vi.fn(() => 'test-otp-pepper-that-is-long-enough-for-tests'),
  } as unknown as ConfigService<Env, true>;

  const service = new OtpService(repository, config);

  return {
    service,
    repository,
    getActiveChallenge: () => activeChallenge,
    setActiveChallenge: (challenge: AuthOtpChallengeEntity | null) => {
      activeChallenge = challenge;
    },
  };
}

describe('OtpService', () => {
  it('creates a six-digit OTP challenge without storing the raw code', async () => {
    const fixture = createFixture();

    const result = await fixture.service.createChallenge({
      userId: 'user-1',
      email: ' Test@Example.com ',
      purpose: 'verify_email',
    });

    expect(result.code).toMatch(/^\d{6}$/);

    expect(result.challengeId).toBe('challenge-1');

    const challenge = fixture.getActiveChallenge();

    expect(challenge).not.toBeNull();

    expect(challenge!.email).toBe('test@example.com');

    expect(challenge!.codeHash).not.toBe(result.code);

    expect(challenge!.codeHash).toHaveLength(64);

    expect(challenge!.maxAttempts).toBe(5);

    expect(challenge!.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('verifies a valid OTP and consumes the challenge', async () => {
    const fixture = createFixture();

    const created = await fixture.service.createChallenge({
      userId: 'user-1',
      email: 'test@example.com',
      purpose: 'verify_email',
    });

    await fixture.service.verifyCode({
      email: 'test@example.com',
      purpose: 'verify_email',
      code: created.code,
    });

    const challenge = fixture.getActiveChallenge();

    expect(challenge!.consumedAt).not.toBeNull();

    expect(fixture.repository.save).toHaveBeenCalled();
  });

  it('increments the attempt counter for an invalid OTP', async () => {
    const fixture = createFixture();

    await fixture.service.createChallenge({
      userId: 'user-1',
      email: 'test@example.com',
      purpose: 'verify_email',
    });

    await expect(
      fixture.service.verifyCode({
        email: 'test@example.com',
        purpose: 'verify_email',
        code: '999999',
      }),
    ).rejects.toThrow('Verification code is invalid or expired');

    expect(fixture.getActiveChallenge()!.attemptCount).toBe(1);
  });

  it('rejects and consumes an expired OTP', async () => {
    const fixture = createFixture();

    const challenge = Object.assign(new AuthOtpChallengeEntity(), {
      id: 'challenge-expired',
      userId: 'user-1',
      email: 'test@example.com',
      purpose: 'verify_email' as const,
      codeHash: '00'.repeat(32),
      expiresAt: new Date(Date.now() - 60_000),
      attemptCount: 0,
      maxAttempts: 5,
      consumedAt: null,
      createdAt: new Date(Date.now() - 11 * 60_000),
    });

    fixture.setActiveChallenge(challenge);

    await expect(
      fixture.service.verifyCode({
        email: 'test@example.com',
        purpose: 'verify_email',
        code: '123456',
      }),
    ).rejects.toThrow('Verification code is invalid or expired');

    expect(challenge.consumedAt).not.toBeNull();
  });

  it('enforces the resend cooldown', async () => {
    const fixture = createFixture();

    await fixture.service.createChallenge({
      userId: 'user-1',
      email: 'test@example.com',
      purpose: 'verify_email',
    });

    let error: unknown;

    try {
      await fixture.service.createChallenge({
        userId: 'user-1',
        email: 'test@example.com',
        purpose: 'verify_email',
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(HttpException);

    expect((error as HttpException).getStatus()).toBe(429);
  });
});
