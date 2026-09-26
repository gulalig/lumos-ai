import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { IdentityModule } from '../identity/identity.module.js';

import { OnboardingController } from './onboarding.controller.js';
import { OnboardingService } from './onboarding.service.js';

@Module({
  imports: [AuthModule, IdentityModule],

  controllers: [OnboardingController],

  providers: [OnboardingService],

  exports: [OnboardingService],
})
export class OnboardingModule {}
