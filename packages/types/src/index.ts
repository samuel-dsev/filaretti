export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'up' | 'down';
}

export * from './domain';
export * from './auth';
export * from './cms';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}
