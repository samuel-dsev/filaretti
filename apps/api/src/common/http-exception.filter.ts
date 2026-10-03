import { ArgumentsHost, Catch, HttpException, type ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ApiErrorResponse } from '@filaretti/types';
import { SanitizedLogger } from './sanitized-logger';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: SanitizedLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const request = context.getRequest<Request & { requestId: string }>();
    const response = context.getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const code =
      status === 404
        ? 'NOT_FOUND'
        : status === 400
          ? 'INVALID_REQUEST'
          : status >= 500
            ? 'INTERNAL_ERROR'
            : 'REQUEST_REJECTED';
    const message =
      status === 404
        ? 'Recurso não encontrado.'
        : status === 400
          ? 'Requisição inválida.'
          : status >= 500
            ? 'Não foi possível processar a requisição.'
            : 'Requisição não permitida.';
    const body: ApiErrorResponse = { error: { code, message, requestId: request.requestId } };
    this.logger.event('request.error', { requestId: request.requestId, statusCode: status });
    response.setHeader('Cache-Control', 'no-store');
    response.status(status).json(body);
  }
}
