import { Controller, Get, UseGuards } from '@nestjs/common';

import { PlatformAdminAuthGuard } from './platform-admin-auth.guard.js';
import { PlatformAdminOverviewService } from './platform-admin-overview.service.js';

@Controller('admin/overview')
@UseGuards(PlatformAdminAuthGuard)
export class PlatformAdminOverviewController {
  public constructor(private readonly overview: PlatformAdminOverviewService) {}

  @Get()
  public getOverview() {
    return this.overview.getOverview();
  }
}
