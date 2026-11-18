import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('chat-server');
  for (const k of ['JWT_SECRET', 'INTERNAL_API_KEY']) {
    if (!process.env[k]) {
      logger.error(`${k} is required — refusing to start`);
      process.exit(1);
    }
  }
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: '*' });
  const port = parseInt(process.env.PORT || '3005', 10);
  await app.listen(port);
  logger.log(`chat-server listening on :${port}`);
}
void bootstrap();
