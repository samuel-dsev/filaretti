import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';
import type { ApiEnvironment } from '@filaretti/config';
import type { HealthResponse } from '@filaretti/types';

@Injectable()
export class HealthService implements OnApplicationShutdown {
  private readonly pool: Pool;

  constructor(environment: ApiEnvironment) {
    this.pool = new Pool({
      connectionString: environment.DATABASE_URL,
      connectionTimeoutMillis: environment.DATABASE_TIMEOUT_MS,
      query_timeout: environment.DATABASE_TIMEOUT_MS,
      statement_timeout: environment.DATABASE_TIMEOUT_MS,
      idleTimeoutMillis: 5000,
      max: 2,
    });
    // Idle socket errors must not crash the API or print credentials.
    this.pool.on('error', () => undefined);
  }

  async check(): Promise<HealthResponse> {
    try {
      await this.pool.query('SELECT 1');
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'error', database: 'down' };
    }
  }

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
