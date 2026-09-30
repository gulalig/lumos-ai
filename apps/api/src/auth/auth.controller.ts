import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Get,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';

import type { FastifyReply, FastifyRequest } from 'fastify';

import { AuthService } from './auth.service.js';
import { RefreshCookieService } from './refresh-cookie.service.js';
import type { AuthPrincipal } from './auth-principal.js';
import { CurrentUser } from './current-user.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RateLimit } from '../rate-limit/rate-limit.decorator.js';
import { RateLimitGuard } from '../rate-limit/rate-limit.guard.js';

interface SignupBody {
  email: string;

  password: string;

  acceptedTerms: boolean;

  newsletterOptIn: boolean;
}

interface VerifyEmailBody {
  email: string;
  code: string;
}

interface ResendVerificationBody {
  email: string;
}

interface LoginBody {
  email: string;
  password: string;
}

interface ForgotPasswordBody {
  email: string;
}

interface ResetPasswordBody {
  email: string;
  code: string;
  newPassword: string;
}

@Controller('auth')
export class AuthController {
  public constructor(
    private readonly auth: AuthService,
    private readonly refreshCookies: RefreshCookieService,
  ) {}

  @Post('signup')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    namespace: 'auth-signup',
    scope: 'ip',
    limit: 5,
    windowSeconds: 60 * 60,
  })
  public signup(
    @Body()
    body: SignupBody,
  ) {
    return this.auth.signup(body);
  }

  @Post('verify-email')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    namespace: 'auth-verify-email',
    scope: 'ip',
    limit: 10,
    windowSeconds: 10 * 60,
  })
  @HttpCode(HttpStatus.OK)
  public verifyEmail(@Body() body: VerifyEmailBody) {
    return this.auth.verifyEmail(body);
  }

  @Post('resend-email-verification')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    namespace: 'auth-resend-verification',

    scope: 'ip',

    limit: 3,

    windowSeconds: 15 * 60,
  })
  @HttpCode(HttpStatus.OK)
  public resendEmailVerification(
    @Body()
    body: ResendVerificationBody,
  ) {
    return this.auth.resendEmailVerification(body);
  }

  @Post('login')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    namespace: 'auth-login',
    scope: 'ip',
    limit: 10,
    windowSeconds: 10 * 60,
  })
  @HttpCode(HttpStatus.OK)
  public async login(
    @Body() body: LoginBody,

    @Res({
      passthrough: true,
    })
    reply: FastifyReply,
  ) {
    const result = await this.auth.login(body);

    this.refreshCookies.set(reply, result.refreshToken);

    const {
      refreshToken: _refreshToken,

      refreshTokenExpiresAt: _refreshTokenExpiresAt,

      ...response
    } = result;

    return response;
  }

  @Post('refresh')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    namespace: 'auth-refresh',

    scope: 'ip',

    limit: 30,

    windowSeconds: 10 * 60,
  })
  public async refresh(
    @Req()
    request: FastifyRequest,

    @Res({
      passthrough: true,
    })
    reply: FastifyReply,
  ) {
    const refreshToken = this.refreshCookies.read(request);

    const result = await this.auth.refresh(refreshToken ?? '');

    this.refreshCookies.set(reply, result.refreshToken);

    const {
      refreshToken: _refreshToken,

      refreshTokenExpiresAt: _refreshTokenExpiresAt,

      ...response
    } = result;

    return response;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  public me(
    @CurrentUser()
    principal: AuthPrincipal,
  ) {
    return {
      user: {
        id: principal.userId,

        email: principal.email,

        displayName: principal.displayName,
      },

      workspace:
        principal.workspaceId && principal.workspaceMemberId && principal.role
          ? {
              workspaceId: principal.workspaceId,

              workspaceMemberId: principal.workspaceMemberId,

              name: principal.workspaceName,

              role: principal.role,
            }
          : null,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  public async logout(
    @Req()
    request: FastifyRequest,

    @Res({
      passthrough: true,
    })
    reply: FastifyReply,
  ) {
    const refreshToken = this.refreshCookies.read(request);

    await this.auth.logout(refreshToken ?? '');

    this.refreshCookies.clear(reply);

    return {
      loggedOut: true,
    };
  }

  @Post('forgot-password')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    namespace: 'auth-forgot-password',

    scope: 'ip',

    limit: 5,

    windowSeconds: 60 * 60,
  })
  @HttpCode(HttpStatus.OK)
  public forgotPassword(
    @Body()
    body: ForgotPasswordBody,
  ) {
    return this.auth.forgotPassword(body);
  }

  @Post('reset-password')
  @UseGuards(RateLimitGuard)
  @RateLimit({
    namespace: 'auth-reset-password',

    scope: 'ip',

    limit: 10,

    windowSeconds: 60 * 60,
  })
  @HttpCode(HttpStatus.OK)
  public resetPassword(
    @Body()
    body: ResetPasswordBody,
  ) {
    return this.auth.resetPassword(body);
  }
}
