import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';

import type { AuthPrincipal } from '../auth/auth-principal.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

import { ExecutionHistoryService } from './execution-history.service.js';

@Controller('sprint-items')
@UseGuards(JwtAuthGuard)
export class ExecutionHistoryController {
  constructor(private readonly history: ExecutionHistoryService) {}

  @Get(':itemId/history')
  async getSprintItemHistory(
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

    return this.history.listSprintItemHistory(workspaceId, itemId);
  }

  private requireWorkspaceId(principal: AuthPrincipal): string {
    if (!principal.workspaceId) {
      throw new BadRequestException('Workspace membership is required');
    }

    return principal.workspaceId;
  }
}
