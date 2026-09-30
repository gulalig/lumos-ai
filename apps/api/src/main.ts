import { Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';
import cookie from '@fastify/cookie';
import { trustedProxyRanges } from './config/production.js';

async function bootstrap() {
  await ConfigModule.envVariablesLoaded;
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      trustProxy: trustedProxyRanges(process.env.TRUSTED_PROXY_CIDRS),
    }),
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
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  Logger.log('LUMOS API listening on port ' + port + ' (/api/v1)', 'Bootstrap');
}

await bootstrap();
