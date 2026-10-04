import { Module, type DynamicModule } from '@nestjs/common';
import type { ApiEnvironment } from '@filaretti/config';
import { SearchController } from './search.controller';
import { SEARCH_ENVIRONMENT, SearchService } from './search.service';

@Module({ controllers: [SearchController], providers: [SearchService] })
export class SearchModule {
  static register(environment: ApiEnvironment): DynamicModule {
    return {
      module: SearchModule,
      providers: [{ provide: SEARCH_ENVIRONMENT, useValue: environment }],
    };
  }
}
