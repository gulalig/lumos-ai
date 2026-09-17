import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';

import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('should return healthy status', () => {
    expect(controller.getHealth()).toEqual({
      status: 'ok',
      service: 'lumos-api',
    });
  });
});
