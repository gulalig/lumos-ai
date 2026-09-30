import { Controller, Get, UseGuards } from '@nestjs/common';

import { PlatformAdminAuthGuard } from './platform-admin-auth.guard.js';
import { PlatformAdminSystemService } from './platform-admin-system.service.js';

@Controller('admin/system')
@UseGuards(PlatformAdminAuthGuard)
export class PlatformAdminSystemController {
  public constructor(private readonly system: PlatformAdminSystemService) {}

  @Get()
  public getSystemStatus() {
    return this.system.getSystemStatus();
  }
}
