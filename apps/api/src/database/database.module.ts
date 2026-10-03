import { Global, Module, type DynamicModule } from '@nestjs/common';
import type { ApiEnvironment } from '@filaretti/config';
import { PrismaService } from './prisma.service';

@Global()
@Module({})
export class DatabaseModule {
  static register(environment: ApiEnvironment): DynamicModule {
    return {
      module: DatabaseModule,
      global: true,
      providers: [{ provide: PrismaService, useFactory: () => new PrismaService(environment) }],
      exports: [PrismaService],
    };
  }
}
