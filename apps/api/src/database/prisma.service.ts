import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import type { ApiEnvironment } from '@filaretti/config';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(environment: ApiEnvironment) {
    super({
      adapter: new PrismaPg({
        connectionString: environment.DATABASE_URL,
        connectionTimeoutMillis: environment.DATABASE_TIMEOUT_MS,
        max: 10,
      }),
      errorFormat: 'minimal',
      log: [],
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
