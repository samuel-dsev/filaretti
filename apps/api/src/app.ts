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
  // Browser requests use the same-origin BFF. No cross-origin cookie API is exposed.
  // Forwarded IP/protocol headers remain untrusted; signed BFF assertions are validated per route.
  app.getHttpAdapter().getInstance().set('trust proxy', false);
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.use((request: Request & { requestId: string }, response: Response, next: NextFunction) => {
    request.requestId = randomUUID();
    response.setHeader('X-Request-Id', request.requestId);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Referrer-Policy', 'no-referrer');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=()',
    );
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (environment.APP_ENV !== 'development') {
      if (new URL(environment.API_PUBLIC_URL).protocol === 'https:')
        response.setHeader('Strict-Transport-Security', 'max-age=31536000');
      response.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      );
    }
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
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'health/live', 'health/ready'].map((path) => ({
      path,
      method: RequestMethod.GET,
    })),
  });
  app.enableShutdownHooks();

  if (environment.APP_ENV === 'development' && environment.NODE_ENV === 'development') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Filaretti — API local')
        .setDescription('F8: CMS, relacionamento e operação privada. Dados locais fictícios.')
        .setVersion('0.8.0')
        .addCookieAuth('filaretti_access', { type: 'apiKey' }, 'filaretti_access')
        .build(),
    );
    SwaggerModule.setup('api/docs', app, document);
  }
  return app;
}
