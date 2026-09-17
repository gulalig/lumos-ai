import {
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';

import { LiveKitTokenService } from './livekit-token.service.js';
import type { LiveKitConnectionDetails } from './livekit.types.js';

@Controller('livekit')
export class LiveKitController {
  constructor(
    private readonly liveKitTokenService: LiveKitTokenService,
  ) {}

  @Post('token')
  @HttpCode(HttpStatus.CREATED)
  async createToken(): Promise<LiveKitConnectionDetails> {
    return this.liveKitTokenService.createConnectionDetails();
  }
}
