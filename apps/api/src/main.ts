import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  const port = Number(process.env.PORT ?? 3001);

  app.setGlobalPrefix('api/v1');

  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');

  Logger.log(
    `LUMOS API running on http://localhost:${port}/api/v1`,
    'Bootstrap',
  );
}

await bootstrap();
