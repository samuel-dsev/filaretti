export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'up' | 'down';
}

export * from './domain';
export * from './auth';
export * from './cms';
export * from './relationship';
export * from './search';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}
