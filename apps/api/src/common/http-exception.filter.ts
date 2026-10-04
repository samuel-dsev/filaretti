import { ArgumentsHost, Catch, HttpException, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorResponse } from '@filaretti/types';
import { SanitizedLogger } from './sanitized-logger';

const messages: Record<number, { code: string; message: string }> = {
  400: { code: 'INVALID_REQUEST', message: 'Requisição inválida.' },
  401: { code: 'UNAUTHORIZED', message: 'Autenticação necessária ou sessão inválida.' },
  403: { code: 'FORBIDDEN', message: 'Requisição não permitida.' },
  404: { code: 'NOT_FOUND', message: 'Recurso não encontrado.' },
  409: { code: 'CONFLICT', message: 'O recurso foi alterado ou está em uso.' },
  413: { code: 'PAYLOAD_TOO_LARGE', message: 'Requisição excede o limite permitido.' },
  429: { code: 'RATE_LIMITED', message: 'Limite de tentativas atingido. Tente mais tarde.' },
};
const allowedCodes = new Set([
  'INVALID_CREDENTIALS',
  'SESSION_EXPIRED',
  'INVALID_SESSION',
  'REFRESH_REUSED',
  'CSRF_INVALID',
  'ORIGIN_FORBIDDEN',
  'RATE_LIMITED',
  'FORBIDDEN',
  'CONFLICT',
  'INVALID_TOKEN',
  'PASSWORD_INVALID',
  'USER_DISABLED',
  'LAST_ADMIN',
  'VERSION_CONFLICT',
  'INVALID_CONTENT',
  'INVALID_RELATION',
  'RESOURCE_IN_USE',
  'INVALID_PUBLICATION',
  'REDIRECT_LOOP',
  'INVALID_SORT',
  'CONTENT_FORBIDDEN',
  'INVALID_MEDIA',
  'STORAGE_UNAVAILABLE',
  'SLUG_RESERVED',
]);

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: SanitizedLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request & { requestId: string }>();
    const response = context.getResponse<Response>();
    const parserType =
      exception instanceof Error && 'type' in exception ? exception.type : undefined;
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : parserType === 'entity.too.large'
          ? 413
          : parserType === 'entity.parse.failed'
            ? 400
            : 500;
    const safe = messages[status] ?? {
      code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_REJECTED',
      message:
        status >= 500 ? 'Não foi possível processar a requisição.' : 'Requisição não permitida.',
    };
    const detail = exception instanceof HttpException ? exception.getResponse() : undefined;
    const requestedCode =
      typeof detail === 'object' && detail !== null && 'code' in detail ? detail.code : undefined;
    const code =
      typeof requestedCode === 'string' && allowedCodes.has(requestedCode)
        ? requestedCode
        : safe.code;
    const message = safe.message;
    const body: ApiErrorResponse = { error: { code, message, requestId: request.requestId } };
    this.logger.event('request.error', { requestId: request.requestId, statusCode: status });
    response.setHeader('Cache-Control', 'no-store');
    response.status(status).json(body);
  }
}
