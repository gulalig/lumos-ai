import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { AuthPrincipal } from '../auth/auth-principal.js';

import { ExecutionHistoryController } from './execution-history.controller.js';
import type { ExecutionHistoryService } from './execution-history.service.js';

function createPrincipal(
  workspaceId: string | null = 'workspace-1',
): AuthPrincipal {
  return {
    userId: 'user-1',

    email: 'user@example.com',

    displayName: 'User',

    workspaceMemberId: workspaceId ? 'member-1' : null,

    workspaceId,

    role: workspaceId ? 'member' : null,
  };
}

function createFixture() {
  const history = {
    listSprintItemHistory: vi.fn(),
  } as unknown as ExecutionHistoryService;

  const controller = new ExecutionHistoryController(history);

  return {
    controller,
    history,
  };
}

describe('ExecutionHistoryController', () => {
  it('reads sprint item history using workspaceId from the authenticated principal', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.history.listSprintItemHistory).mockResolvedValue([]);

    const result = await fixture.controller.getSprintItemHistory(
      createPrincipal(),
      '11111111-1111-4111-8111-111111111111',
    );

    expect(result).toEqual([]);

    expect(fixture.history.listSprintItemHistory).toHaveBeenCalledWith(
      'workspace-1',
      '11111111-1111-4111-8111-111111111111',
    );
  });

  it('rejects a principal without workspace membership', async () => {
    const fixture = createFixture();

    await expect(
      fixture.controller.getSprintItemHistory(
        createPrincipal(null),
        '11111111-1111-4111-8111-111111111111',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fixture.history.listSprintItemHistory).not.toHaveBeenCalled();
  });
});
