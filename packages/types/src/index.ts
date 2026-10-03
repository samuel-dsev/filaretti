export interface HealthResponse {
  status: 'ok' | 'error';
  database: 'up' | 'down';
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    requestId: string;
  };
}
