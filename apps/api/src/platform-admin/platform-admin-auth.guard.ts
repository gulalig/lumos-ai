import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class PlatformAdminAuthGuard extends AuthGuard('platform-admin-jwt') {}
