import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { RedisService } from '../../redis/redis.service.js';

const stateTtlSeconds = 10 * 60;

const consumeStateScript = `
local value = redis.call("GET", KEYS[1])

if not value then
  return nil
end

redis.call("DEL", KEYS[1])

return value
`;

@Injectable()
export class AtlassianOAuthStateStore {
  public constructor(private readonly redis: RedisService) {}

  public async create(workspaceId: string): Promise<string> {
    const state = randomBytes(32).toString('base64url');

    const key = this.key(state);

    const result = await this.redis.client.set(
      key,
      workspaceId,
      'EX',
      stateTtlSeconds,
      'NX',
    );

    if (result !== 'OK') {
      throw new Error('failed to create Atlassian OAuth state');
    }

    return state;
  }

  public async consume(state: string): Promise<string | null> {
    if (state.length === 0) {
      return null;
    }

    const result = await this.redis.client.eval(
      consumeStateScript,
      1,
      this.key(state),
    );

    if (result === null) {
      return null;
    }

    if (typeof result !== 'string') {
      throw new Error('unexpected Atlassian OAuth state value');
    }

    return result;
  }

  private key(state: string): string {
    return `lumos:oauth:atlassian:state:${state}`;
  }
}
