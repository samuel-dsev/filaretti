import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Module, RequestMethod, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response, NextFunction } from 'express';
import type { ApiEnvironment } from '@filaretti/config';
import { HealthController } from './health/health.controller';
import { HealthService } from './health/health.service';
import { HttpExceptionFilter } from './common/http-exception.filter';
import { SanitizedLogger } from './common/sanitized-logger';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { DomainModule } from './domain/domain.module';
import type { PasswordRecoveryDelivery } from './auth/types';
import { SearchModule } from './search/search.module';

export async function createApplication(
  environment: ApiEnvironment,
  logger = new SanitizedLogger(),
  recoveryDelivery?: PasswordRecoveryDelivery,
) {
  @Module({
    imports: [
      DatabaseModule.register(environment),
      AuthModule.register(environment, recoveryDelivery),
      DomainModule.register(environment),
      SearchModule.register(environment),
    ],
    controllers: [HealthController],
    providers: [{ provide: HealthService, useFactory: () => new HealthService(environment) }],
  })
  class AppModule {}

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger,
    bodyParser: false,
    rawBody: true,
  });
  app.use((request: Request & { requestId: string }, response: Response, next: NextFunction) => {
    request.requestId = randomUUID();
    response.setHeader('X-Request-Id', request.requestId);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    response.on('finish', () =>
      logger.event('request.completed', {
        requestId: request.requestId,
        statusCode: response.statusCode,
      }),
    );
    next();
  });
  app.useBodyParser('json', { limit: '512kb' });
  app.useGlobalPipes(
    new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(logger));
  app.setGlobalPrefix('api/v1', { exclude: [{ path: 'health', method: RequestMethod.GET }] });
  app.enableShutdownHooks();

  if (environment.APP_ENV === 'development' && environment.NODE_ENV === 'development') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Filaretti — API local')
        .setDescription('F7: CMS, relacionamento, busca e publicação. Dados locais fictícios.')
        .setVersion('0.7.0')
        .addCookieAuth('filaretti_access', { type: 'apiKey' }, 'filaretti_access')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
  return app;
}
