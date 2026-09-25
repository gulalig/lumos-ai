import { ConfigService } from '@nestjs/config';
import { describe, expect, it } from 'vitest';

import type { Env } from '../../config/env.js';

import { AtlassianTokenCryptoService } from './atlassian-token-crypto.service.js';

function createService(): AtlassianTokenCryptoService {
  const key = Buffer.alloc(32, 7).toString('base64');

  const config = {
    get: (name: keyof Env) => {
      if (name === 'ATLASSIAN_TOKEN_ENCRYPTION_KEY') {
        return key;
      }

      throw new Error(`unexpected config key ${name}`);
    },
  } as unknown as ConfigService<Env, true>;

  return new AtlassianTokenCryptoService(config);
}

describe('AtlassianTokenCryptoService', () => {
  it('encrypts and decrypts a token', () => {
    const service = createService();

    const plaintext = 'access-token-secret';

    const encrypted = service.encrypt(plaintext);

    expect(encrypted).not.toContain(plaintext);

    expect(service.decrypt(encrypted)).toBe(plaintext);
  });

  it('uses a fresh IV for each encryption', () => {
    const service = createService();

    const first = service.encrypt('same-token');

    const second = service.encrypt('same-token');

    expect(first).not.toBe(second);

    expect(service.decrypt(first)).toBe('same-token');

    expect(service.decrypt(second)).toBe('same-token');
  });

  it('rejects tampered ciphertext', () => {
    const service = createService();

    const encrypted = service.encrypt('secret');

    const corrupted = `${encrypted.slice(0, -1)}A`;

    expect(() => service.decrypt(corrupted)).toThrow();
  });
});
