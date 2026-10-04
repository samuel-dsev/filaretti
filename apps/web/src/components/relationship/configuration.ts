import 'server-only';
import type { RelationshipConfiguration } from './antispam';
import { validateWebEnvironment } from '@filaretti/config';

export function relationshipConfiguration(): RelationshipConfiguration {
  const environment = validateWebEnvironment(process.env);
  return {
    mock: environment.appEnvironment === 'development' && environment.mockIntegrations,
    siteKey: environment.turnstileSiteKey,
  };
}
