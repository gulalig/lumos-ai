import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import type { Env } from '../../config/env.js';

const algorithm = 'aes-256-gcm';
const ivLength = 12;
const encryptionVersion = 'v1';

@Injectable()
export class AtlassianTokenCryptoService {
  private readonly key: Buffer;

  public constructor(config: ConfigService<Env, true>) {
    const encodedKey = config.get('ATLASSIAN_TOKEN_ENCRYPTION_KEY', {
      infer: true,
    });

    const key = Buffer.from(encodedKey, 'base64');

    if (key.length !== 32) {
      throw new Error(
        'ATLASSIAN_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes',
      );
    }

    this.key = key;
  }

  public encrypt(plaintext: string): string {
    if (plaintext.length === 0) {
      throw new Error('cannot encrypt an empty Atlassian token');
    }

    const iv = randomBytes(ivLength);

    const cipher = createCipheriv(algorithm, this.key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authenticationTag = cipher.getAuthTag();

    return [
      encryptionVersion,
      iv.toString('base64url'),
      authenticationTag.toString('base64url'),
      ciphertext.toString('base64url'),
    ].join(':');
  }

  public decrypt(encrypted: string): string {
    const parts = encrypted.split(':');

    if (parts.length !== 4 || parts[0] !== encryptionVersion) {
      throw new Error('unsupported Atlassian token ciphertext format');
    }

    const [, ivEncoded, authenticationTagEncoded, ciphertextEncoded] = parts;

    if (!ivEncoded || !authenticationTagEncoded || !ciphertextEncoded) {
      throw new Error('invalid Atlassian token ciphertext');
    }

    const iv = Buffer.from(ivEncoded, 'base64url');

    const authenticationTag = Buffer.from(
      authenticationTagEncoded,
      'base64url',
    );

    const ciphertext = Buffer.from(ciphertextEncoded, 'base64url');

    if (iv.length !== ivLength) {
      throw new Error('invalid Atlassian token ciphertext IV');
    }

    const decipher = createDecipheriv(algorithm, this.key, iv);

    decipher.setAuthTag(authenticationTag);

    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  }
}
