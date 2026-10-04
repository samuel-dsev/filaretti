import { Module, type DynamicModule } from '@nestjs/common';
import type { ApiEnvironment } from '@filaretti/config';
import { ArticlesService } from './articles.service';
import { InstitutionService } from './institution.service';
import {
  AdminArticlesController,
  AdminInstitutionController,
  AdminTaxonomiesController,
  PublicArticlesController,
  PublicEditorialController,
  PublicInstitutionController,
  PublicTaxonomiesController,
} from './domain.controllers';
import { DOMAIN_ENVIRONMENT } from './shared';
import {
  AdminMediaController,
  PublicMediaController,
  PublicPreviewController,
} from '../cms/cms.controllers';
import { StorageService } from '../cms/storage.service';
import { MediaService } from '../cms/media.service';
import { CmsWorker } from '../cms/worker.service';

@Module({
  controllers: [
    PublicArticlesController,
    PublicEditorialController,
    AdminArticlesController,
    PublicInstitutionController,
    AdminInstitutionController,
    PublicTaxonomiesController,
    AdminTaxonomiesController,
    AdminMediaController,
    PublicMediaController,
    PublicPreviewController,
  ],
  providers: [ArticlesService, InstitutionService, StorageService, MediaService, CmsWorker],
})
export class DomainModule {
  static register(environment: ApiEnvironment): DynamicModule {
    return {
      module: DomainModule,
      providers: [{ provide: DOMAIN_ENVIRONMENT, useValue: environment }],
    };
  }
}
