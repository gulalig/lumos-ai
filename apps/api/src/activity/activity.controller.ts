import {
  BadRequestException,
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';

import type { AuthPrincipal } from '../auth/auth-principal.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';

import { ActivityService } from './activity.service.js';

@Controller('activity')
@UseGuards(JwtAuthGuard)
export class ActivityController {
  public constructor(private readonly activity: ActivityService) {}

  @Get()
  public getActivity(
    @CurrentUser()
    principal: AuthPrincipal,
  ) {
    if (!principal.workspaceId) {
      throw new BadRequestException('Workspace membership is required');
    }

    return this.activity.getFeed(principal.workspaceId);
  }
}
