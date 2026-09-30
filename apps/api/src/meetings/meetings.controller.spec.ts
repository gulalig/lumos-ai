import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { AuthPrincipal } from '../auth/auth-principal.js';

import type { InterventionHistoryService } from '../interventions/intervention-history.service.js';

import type { UsageControlService } from '../usage/usage-control.service.js';

import { MeetingsController } from './meetings.controller.js';

import type { MeetingSnapshotService } from './meeting-snapshot.service.js';
import type { MeetingsService } from './meetings.service.js';

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
  const meetingsService = {
    create: vi.fn(),

    bindWorkspace: vi.fn(),

    listForWorkspace: vi.fn(),

    getByIdForWorkspace: vi.fn(),

    end: vi.fn(),
  } as unknown as MeetingsService;

  const snapshotService = {
    getSnapshot: vi.fn(),
  } as unknown as MeetingSnapshotService;

  const interventionHistory = {
    listByMeeting: vi.fn(),
  } as unknown as InterventionHistoryService;

  const usage = {
    getWorkspaceUsage: vi.fn(),

    assertMeetingCreationAllowed: vi.fn(),

    assertLiveKitAllowed: vi.fn(),
  } as unknown as UsageControlService;

  const controller = new MeetingsController(
    meetingsService,
    snapshotService,
    interventionHistory,
    usage,
  );

  return {
    controller,

    meetingsService,

    snapshotService,

    interventionHistory,

    usage,
  };
}

describe('MeetingsController', () => {
  it('creates a meeting only after usage validation and binds it to the authenticated workspace', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.usage.assertMeetingCreationAllowed).mockResolvedValue(
      undefined,
    );

    vi.mocked(fixture.meetingsService.create).mockResolvedValue({
      meetingId: '22222222-2222-4222-8222-222222222222',

      roomName: '22222222-2222-4222-8222-222222222222',

      status: 'created',
    });

    vi.mocked(fixture.meetingsService.bindWorkspace).mockResolvedValue(
      {} as never,
    );

    const result = await fixture.controller.createMeeting(createPrincipal());

    expect(fixture.usage.assertMeetingCreationAllowed).toHaveBeenCalledWith(
      'workspace-1',
    );

    expect(fixture.meetingsService.create).toHaveBeenCalledTimes(1);

    expect(fixture.meetingsService.bindWorkspace).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      'workspace-1',
    );

    expect(result).toEqual({
      meetingId: '22222222-2222-4222-8222-222222222222',

      roomName: '22222222-2222-4222-8222-222222222222',

      status: 'created',
    });
  });

  it('does not create a meeting when usage validation rejects the workspace', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.usage.assertMeetingCreationAllowed).mockRejectedValue(
      new Error('Monthly meeting limit reached'),
    );

    await expect(
      fixture.controller.createMeeting(createPrincipal()),
    ).rejects.toThrow('Monthly meeting limit reached');

    expect(fixture.meetingsService.create).not.toHaveBeenCalled();

    expect(fixture.meetingsService.bindWorkspace).not.toHaveBeenCalled();
  });

  it('reads a meeting using workspaceId from the authenticated principal', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.meetingsService.getByIdForWorkspace).mockResolvedValue(
      {} as never,
    );

    await fixture.controller.getMeeting(
      createPrincipal(),

      '22222222-2222-4222-8222-222222222222',
    );

    expect(fixture.meetingsService.getByIdForWorkspace).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',

      'workspace-1',
    );
  });

  it('reads a meeting snapshot using workspaceId from the authenticated principal', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.snapshotService.getSnapshot).mockResolvedValue(
      {} as never,
    );

    await fixture.controller.getMeetingSnapshot(
      createPrincipal(),

      '22222222-2222-4222-8222-222222222222',
    );

    expect(fixture.snapshotService.getSnapshot).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',

      'workspace-1',
    );
  });

  it('verifies workspace ownership before ending a meeting', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.meetingsService.getByIdForWorkspace).mockResolvedValue(
      {} as never,
    );

    vi.mocked(fixture.meetingsService.end).mockResolvedValue({} as never);

    await fixture.controller.endMeeting(
      createPrincipal(),

      '22222222-2222-4222-8222-222222222222',
    );

    expect(fixture.meetingsService.getByIdForWorkspace).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',

      'workspace-1',
    );

    expect(fixture.meetingsService.end).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
    );
  });

  it('rejects a principal without workspace membership', async () => {
    const fixture = createFixture();

    await expect(
      fixture.controller.getMeeting(
        createPrincipal(null),

        '22222222-2222-4222-8222-222222222222',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fixture.meetingsService.getByIdForWorkspace).not.toHaveBeenCalled();
  });

  it('rejects meeting creation without workspace membership', async () => {
    const fixture = createFixture();

    await expect(
      fixture.controller.createMeeting(createPrincipal(null)),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fixture.usage.assertMeetingCreationAllowed).not.toHaveBeenCalled();

    expect(fixture.meetingsService.create).not.toHaveBeenCalled();
  });

  it('reads meeting interventions only after verifying workspace ownership', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.meetingsService.getByIdForWorkspace).mockResolvedValue(
      {} as never,
    );

    vi.mocked(fixture.interventionHistory.listByMeeting).mockResolvedValue([]);

    const meetingId = '22222222-2222-4222-8222-222222222222';

    const result = await fixture.controller.getMeetingInterventions(
      createPrincipal(),

      meetingId,
    );

    expect(result).toEqual([]);

    expect(fixture.meetingsService.getByIdForWorkspace).toHaveBeenCalledWith(
      meetingId,

      'workspace-1',
    );

    expect(fixture.interventionHistory.listByMeeting).toHaveBeenCalledWith(
      meetingId,
    );
  });

  it('does not read intervention history when the meeting is outside the workspace', async () => {
    const fixture = createFixture();

    vi.mocked(fixture.meetingsService.getByIdForWorkspace).mockRejectedValue(
      new Error('Meeting not found'),
    );

    await expect(
      fixture.controller.getMeetingInterventions(
        createPrincipal(),

        '22222222-2222-4222-8222-222222222222',
      ),
    ).rejects.toThrow('Meeting not found');

    expect(fixture.interventionHistory.listByMeeting).not.toHaveBeenCalled();
  });
});
