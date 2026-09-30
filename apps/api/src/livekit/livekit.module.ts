import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { IdentityModule } from '../identity/identity.module.js';
import { MeetingsModule } from '../meetings/meetings.module.js';
import { UsageModule } from '../usage/usage.module.js';

import { LiveKitController } from './livekit.controller.js';
import { LiveKitTokenService } from './livekit-token.service.js';
import { RateLimitModule } from '../rate-limit/rate-limit.module.js';

@Module({
  imports: [
    AuthModule,
    IdentityModule,
    MeetingsModule,
    UsageModule,
    RateLimitModule,
  ],

  controllers: [LiveKitController],

  providers: [LiveKitTokenService],

  exports: [LiveKitTokenService],
})
export class LiveKitModule {}
