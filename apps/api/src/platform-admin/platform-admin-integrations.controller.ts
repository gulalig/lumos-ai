import { Controller, Get, UseGuards } from '@nestjs/common';

import { PlatformAdminAuthGuard } from './platform-admin-auth.guard.js';
import { PlatformAdminIntegrationsService } from './platform-admin-integrations.service.js';

@Controller('admin/integrations')
@UseGuards(PlatformAdminAuthGuard)
export class PlatformAdminIntegrationsController {
  public constructor(
    private readonly integrations: PlatformAdminIntegrationsService,
  ) {}

  @Get()
  public listIntegrations() {
    return this.integrations.listIntegrations();
  }
}
