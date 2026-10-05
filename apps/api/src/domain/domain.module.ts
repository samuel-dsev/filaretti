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
import {
  PublicRelationshipController,
  AdminContactsController,
  AdminContactDownloadsController,
  AdminSubscribersController,
} from '../relationship/relationship.controllers';
import { RelationshipService } from '../relationship/relationship.service';
import { TurnstileService } from '../relationship/turnstile.service';
import { RelationshipRateLimiter } from '../relationship/rate-limit.service';
import { RelationshipPublicGuard } from '../relationship/public.guard';
import { RelationshipWorker } from '../relationship/email-worker.service';
import { ResendWebhookController } from '../relationship/webhook.controller';
import { AttachmentScanner } from '../relationship/attachment-scanner';
import { OperationsController } from '../operations/operations.controller';
import { OperationsService } from '../operations/operations.service';

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
    PublicRelationshipController,
    AdminContactsController,
    AdminContactDownloadsController,
    AdminSubscribersController,
    ResendWebhookController,
    OperationsController,
  ],
  providers: [
    ArticlesService,
    InstitutionService,
    StorageService,
    MediaService,
    CmsWorker,
    RelationshipService,
    TurnstileService,
    RelationshipRateLimiter,
    RelationshipPublicGuard,
    RelationshipWorker,
    AttachmentScanner,
    OperationsService,
  ],
})
export class DomainModule {
  static register(environment: ApiEnvironment): DynamicModule {
    return {
      module: DomainModule,
      providers: [{ provide: DOMAIN_ENVIRONMENT, useValue: environment }],
    };
  }
}
