import type { PrismaClient } from '@prisma/client';
import { createSeedClient, reportSeedFailure } from './seed-client';

export function assertProductionSeedEnvironment(): void {
  if (
    process.env.APP_ENV !== 'production' ||
    process.env.NODE_ENV !== 'production' ||
    process.env.MOCK_CONTENT !== 'false'
  ) {
    throw new Error('PRODUCTION_SEED_FORBIDDEN');
  }
}

export async function seedProduction(client: PrismaClient): Promise<void> {
  assertProductionSeedEnvironment();
  // Only the empty settings structure. No mock material, identities or passwords.
  await client.siteSetting.upsert({
    where: { id: 'site' },
    update: {},
    create: { id: 'site', siteName: '', address: {}, socialLinks: [], isMock: false },
  });
}

if (require.main === module) {
  let client: PrismaClient | undefined;
  Promise.resolve()
    .then(async () => {
      assertProductionSeedEnvironment();
      client = createSeedClient();
      await seedProduction(client);
      process.stdout.write('Production structural seed completed.\n');
    })
    .catch((error: unknown) => reportSeedFailure('PRODUCTION_SEED_FAILED', error))
    .finally(async () => client?.$disconnect());
}
