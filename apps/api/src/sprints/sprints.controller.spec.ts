import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { AuthPrincipal } from '../auth/auth-principal.js';

import { SprintsController } from './sprints.controller.js';
import type { SprintsService } from './sprints.service.js';

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
  const sprints = {
    createSprint: vi.fn(),

    createItem: vi.fn(),

    updateItem: vi.fn(),

    getActiveSprint: vi.fn(),

    getSprint: vi.fn(),

    getSprintItems: vi.fn(),

    getItem: vi.fn(),
  } as unknown as SprintsService;

  const controller = new SprintsController(sprints);

  return {
    controller,
    sprints,
  };
}

describe('SprintsController', () => {
  it('creates a sprint using workspaceId from the authenticated principal', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.sprints.createSprint).mockResolvedValue({
      id: 'sprint-1',

      workspaceId: 'workspace-1',

      name: 'Sprint 1',

      goal: null,

      status: 'planned',

      startsAt: null,

      endsAt: null,

      createdAt: new Date(),

      updatedAt: new Date(),

      workspace: undefined as never,
    });

    await fixture.controller.createSprint(createPrincipal(), {
      name: 'Sprint 1',

      goal: null,
    });

    expect(fixture.sprints.createSprint).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',

      name: 'Sprint 1',

      goal: null,

      startsAt: undefined,

      endsAt: undefined,
    });
  });

  it('creates a sprint item using workspaceId from the authenticated principal', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.sprints.createItem).mockResolvedValue({} as never);

    await fixture.controller.createItem(
      createPrincipal(),
      '22222222-2222-4222-8222-222222222222',
      {
        title: 'Deliver API',

        description: null,

        dueAt: '2026-09-30T12:00:00.000Z',
      },
    );

    expect(fixture.sprints.createItem).toHaveBeenCalledWith('workspace-1', {
      sprintId: '22222222-2222-4222-8222-222222222222',

      title: 'Deliver API',

      description: null,

      ownerWorkspaceMemberId: undefined,

      dueAt: new Date('2026-09-30T12:00:00.000Z'),

      acceptanceCriteria: undefined,
    });
  });

  it('updates a sprint item using workspaceId from the authenticated principal', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.sprints.updateItem).mockResolvedValue({} as never);

    await fixture.controller.updateItem(
      createPrincipal(),
      '11111111-1111-4111-8111-111111111111',
      {
        status: 'done',

        dueAt: null,
      },
    );

    expect(fixture.sprints.updateItem).toHaveBeenCalledWith(
      'workspace-1',
      '11111111-1111-4111-8111-111111111111',
      {
        title: undefined,

        description: undefined,

        status: 'done',

        ownerWorkspaceMemberId: undefined,

        dueAt: null,

        blockerText: undefined,

        acceptanceCriteria: undefined,
      },
    );
  });

  it('rejects a principal without workspace membership', async () => {
    const fixture = createFixture();

    await expect(
      fixture.controller.createSprint(createPrincipal(null), {
        name: 'Sprint 1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fixture.sprints.createSprint).not.toHaveBeenCalled();
  });

  it('rejects an empty sprint update payload', async () => {
    const fixture = createFixture();

    await expect(
      fixture.controller.updateItem(
        createPrincipal(),
        '11111111-1111-4111-8111-111111111111',
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fixture.sprints.updateItem).not.toHaveBeenCalled();
  });

  it('reads a sprint using workspaceId from the authenticated principal', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.sprints.getSprint).mockResolvedValue({} as never);

    await fixture.controller.getSprint(
      createPrincipal(),
      '22222222-2222-4222-8222-222222222222',
    );

    expect(fixture.sprints.getSprint).toHaveBeenCalledWith(
      'workspace-1',
      '22222222-2222-4222-8222-222222222222',
    );
  });

  it('reads a sprint item using workspaceId from the authenticated principal', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.sprints.getItem).mockResolvedValue({} as never);

    await fixture.controller.getItem(
      createPrincipal(),
      '11111111-1111-4111-8111-111111111111',
    );

    expect(fixture.sprints.getItem).toHaveBeenCalledWith(
      'workspace-1',
      '11111111-1111-4111-8111-111111111111',
    );
  });
});
