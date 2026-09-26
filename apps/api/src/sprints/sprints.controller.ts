import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  Get,
} from '@nestjs/common';
import { z } from 'zod';

import type { AuthPrincipal } from '../auth/auth-principal.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

import { SprintsService } from './sprints.service.js';

const nullableDateSchema = z
  .union([z.string().datetime(), z.null()])
  .optional();

const createSprintSchema = z.object({
  name: z.string().min(1),

  goal: z.string().nullable().optional(),

  startsAt: nullableDateSchema,

  endsAt: nullableDateSchema,
});

const createSprintItemSchema = z.object({
  title: z.string().min(1),

  description: z.string().nullable().optional(),

  ownerWorkspaceMemberId: z.string().uuid().nullable().optional(),

  dueAt: nullableDateSchema,

  acceptanceCriteria: z.array(z.string()).optional(),
});

const updateSprintItemSchema = z
  .object({
    title: z.string().min(1).optional(),

    description: z.string().nullable().optional(),

    status: z
      .enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled'])
      .optional(),

    ownerWorkspaceMemberId: z.string().uuid().nullable().optional(),

    dueAt: nullableDateSchema,

    blockerText: z.string().nullable().optional(),

    acceptanceCriteria: z.array(z.string()).optional(),
  })
  .refine(
    (value) => Object.values(value).some((field) => field !== undefined),
    {
      message: 'At least one sprint item field is required',
    },
  );

@Controller()
@UseGuards(JwtAuthGuard)
export class SprintsController {
  public constructor(private readonly sprints: SprintsService) {}

  @Post('sprints')
  public async createSprint(
    @CurrentUser()
    principal: AuthPrincipal,

    @Body()
    body: unknown,
  ) {
    const workspaceId = this.requireWorkspaceId(principal);

    const parsed = createSprintSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException('Invalid sprint payload');
    }

    return this.sprints.createSprint({
      workspaceId,

      name: parsed.data.name,

      goal: parsed.data.goal,

      startsAt: this.parseOptionalDate(parsed.data.startsAt),

      endsAt: this.parseOptionalDate(parsed.data.endsAt),
    });
  }

  @Post('sprints/:sprintId/items')
  public async createItem(
    @CurrentUser()
    principal: AuthPrincipal,

    @Param(
      'sprintId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    sprintId: string,

    @Body()
    body: unknown,
  ) {
    const workspaceId = this.requireWorkspaceId(principal);

    const parsed = createSprintItemSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException('Invalid sprint item payload');
    }

    return this.sprints.createItem(workspaceId, {
      sprintId,

      title: parsed.data.title,

      description: parsed.data.description,

      ownerWorkspaceMemberId: parsed.data.ownerWorkspaceMemberId,

      dueAt: this.parseOptionalDate(parsed.data.dueAt),

      acceptanceCriteria: parsed.data.acceptanceCriteria,
    });
  }

  @Patch('sprint-items/:itemId')
  public async updateItem(
    @CurrentUser()
    principal: AuthPrincipal,

    @Param(
      'itemId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    itemId: string,

    @Body()
    body: unknown,
  ) {
    const workspaceId = this.requireWorkspaceId(principal);

    const parsed = updateSprintItemSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException('Invalid sprint item update payload');
    }

    return this.sprints.updateItem(workspaceId, itemId, {
      title: parsed.data.title,

      description: parsed.data.description,

      status: parsed.data.status,

      ownerWorkspaceMemberId: parsed.data.ownerWorkspaceMemberId,

      dueAt: this.parseOptionalDate(parsed.data.dueAt),

      blockerText: parsed.data.blockerText,

      acceptanceCriteria: parsed.data.acceptanceCriteria,
    });
  }

  private requireWorkspaceId(principal: AuthPrincipal): string {
    if (!principal.workspaceId) {
      throw new BadRequestException('Workspace membership is required');
    }

    return principal.workspaceId;
  }

  private parseOptionalDate(
    value: string | null | undefined,
  ): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    return new Date(value);
  }

  @Get('sprints/active')
  public async getActiveSprint(
    @CurrentUser()
    principal: AuthPrincipal,
  ) {
    const workspaceId = this.requireWorkspaceId(principal);

    return this.sprints.getActiveSprint(workspaceId);
  }

  @Get('sprints/:sprintId')
  public async getSprint(
    @CurrentUser()
    principal: AuthPrincipal,

    @Param(
      'sprintId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    sprintId: string,
  ) {
    const workspaceId = this.requireWorkspaceId(principal);

    return this.sprints.getSprint(workspaceId, sprintId);
  }

  @Get('sprints/:sprintId/items')
  public async getSprintItems(
    @CurrentUser()
    principal: AuthPrincipal,

    @Param(
      'sprintId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    sprintId: string,
  ) {
    const workspaceId = this.requireWorkspaceId(principal);

    return this.sprints.getSprintItems(workspaceId, sprintId);
  }

  @Get('sprint-items/:itemId')
  public async getItem(
    @CurrentUser()
    principal: AuthPrincipal,

    @Param(
      'itemId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    itemId: string,
  ) {
    const workspaceId = this.requireWorkspaceId(principal);

    return this.sprints.getItem(workspaceId, itemId);
  }
}
