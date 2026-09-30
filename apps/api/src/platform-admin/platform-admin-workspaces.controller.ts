import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';

import { PlatformAdminAuthGuard } from './platform-admin-auth.guard.js';

import {
  PlatformAdminWorkspacesService,
  type UpdatePlatformAdminWorkspaceUsageInput,
} from './platform-admin-workspaces.service.js';

const updateWorkspaceUsageSchema = z
  .object({
    enabled: z.boolean(),

    trialEndsAt: z.string().datetime().nullable(),

    monthlyMeetingLimit: z.number().int().min(0).nullable(),

    meetingCreationEnabled: z.boolean(),

    livekitEnabled: z.boolean(),

    disabledReason: z.string().trim().max(500).nullable(),
  })
  .strict();

@Controller('admin/workspaces')
@UseGuards(PlatformAdminAuthGuard)
export class PlatformAdminWorkspacesController {
  public constructor(
    private readonly workspaces: PlatformAdminWorkspacesService,
  ) {}

  @Get()
  public listWorkspaces() {
    return this.workspaces.listWorkspaces();
  }

  @Get(':workspaceId/usage')
  public getWorkspaceUsage(
    @Param(
      'workspaceId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    workspaceId: string,
  ) {
    return this.workspaces.getWorkspaceUsage(workspaceId);
  }

  @Patch(':workspaceId/usage')
  public updateWorkspaceUsage(
    @Param(
      'workspaceId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    workspaceId: string,

    @Body()
    body: unknown,
  ) {
    const parsed = updateWorkspaceUsageSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException('Invalid workspace usage settings');
    }

    const input: UpdatePlatformAdminWorkspaceUsageInput = {
      enabled: parsed.data.enabled,

      trialEndsAt: parsed.data.trialEndsAt
        ? new Date(parsed.data.trialEndsAt)
        : null,

      monthlyMeetingLimit: parsed.data.monthlyMeetingLimit,

      meetingCreationEnabled: parsed.data.meetingCreationEnabled,

      livekitEnabled: parsed.data.livekitEnabled,

      disabledReason: parsed.data.disabledReason || null,
    };

    return this.workspaces.updateWorkspaceUsage(workspaceId, input);
  }
}
