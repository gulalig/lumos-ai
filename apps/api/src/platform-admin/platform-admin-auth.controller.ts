import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentPlatformAdmin } from './current-platform-admin.decorator.js';
import { PlatformAdminAuthGuard } from './platform-admin-auth.guard.js';
import { PlatformAdminAuthService } from './platform-admin-auth.service.js';

import type { PlatformAdminPrincipal } from './platform-admin-principal.js';

interface AdminLoginBody {
  email: string;
  password: string;
}

@Controller('admin/auth')
export class PlatformAdminAuthController {
  public constructor(private readonly auth: PlatformAdminAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  public login(
    @Body()
    body: AdminLoginBody,
  ) {
    return this.auth.login(body);
  }

  @Get('me')
  @UseGuards(PlatformAdminAuthGuard)
  public me(
    @CurrentPlatformAdmin()
    admin: PlatformAdminPrincipal,
  ) {
    return {
      admin: {
        id: admin.adminId,

        email: admin.email,

        displayName: admin.displayName,
      },
    };
  }
}
