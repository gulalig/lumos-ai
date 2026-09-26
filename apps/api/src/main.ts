import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';
import cookie from '@fastify/cookie';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const config = app.get(ConfigService<Env, true>);

  const port = config.get('API_PORT', {
    infer: true,
  });

  const webOrigin = config.get('WEB_ORIGIN', {
    infer: true,
  });

  await app.register(cookie);

  app.enableCors({
    origin: webOrigin,
    methods: ['GET', 'POST'],
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  Logger.log(
    `LUMOS API running on http://localhost:${port}/api/v1`,
    'Bootstrap',
  );
}

await bootstrap();
