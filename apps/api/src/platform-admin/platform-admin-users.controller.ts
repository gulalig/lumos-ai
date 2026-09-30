import { Controller, Get, UseGuards } from '@nestjs/common';

import { PlatformAdminAuthGuard } from './platform-admin-auth.guard.js';
import { PlatformAdminUsersService } from './platform-admin-users.service.js';

@Controller('admin/users')
@UseGuards(PlatformAdminAuthGuard)
export class PlatformAdminUsersController {
  public constructor(private readonly users: PlatformAdminUsersService) {}

  @Get()
  public listUsers() {
    return this.users.listUsers();
  }
}
