import { describe, expect, it } from 'vitest';

import { PasswordService } from './password.service.js';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes and verifies a password with Argon2id', async () => {
    const password = 'correct horse battery staple';

    const hash = await service.hash(password);

    expect(hash).not.toBe(password);

    expect(hash.startsWith('$argon2id$')).toBe(true);

    await expect(service.verify(hash, password)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await service.hash('correct-password');

    await expect(service.verify(hash, 'wrong-password')).resolves.toBe(false);
  });

  it('returns false for a malformed hash', async () => {
    await expect(
      service.verify('not-an-argon2-hash', 'password'),
    ).resolves.toBe(false);
  });
});
