import {
  BadRequestException,
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import type { AuthPrincipal } from '../auth/auth-principal.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  public constructor(private readonly dashboard: DashboardService) {}

  @Get('overview')
  public async getOverview(
    @CurrentUser()
    principal: AuthPrincipal,
  ) {
    if (!principal.workspaceId) {
      throw new BadRequestException('Workspace membership is required');
    }

    return this.dashboard.getOverview(principal.workspaceId);
  }
}
