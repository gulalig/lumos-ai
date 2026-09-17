import { Module } from '@nestjs/common';

import { LiveKitController } from './livekit.controller.js';
import { LiveKitTokenService } from './livekit-token.service.js';

@Module({
  controllers: [LiveKitController],
  providers: [LiveKitTokenService],
  exports: [LiveKitTokenService],
})
export class LiveKitModule {}
