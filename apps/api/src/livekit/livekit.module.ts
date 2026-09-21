import { Module } from '@nestjs/common';

import { MeetingsModule } from '../meetings/meetings.module.js';

import { LiveKitController } from './livekit.controller.js';
import { LiveKitTokenService } from './livekit-token.service.js';

@Module({
  imports: [ MeetingsModule ],
  controllers: [ LiveKitController ],
  providers: [ LiveKitTokenService ],
  exports: [ LiveKitTokenService ],
})
export class LiveKitModule {}
