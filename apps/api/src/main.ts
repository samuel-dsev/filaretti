import 'dotenv/config';
import { validateApiEnvironment } from '@filaretti/config';
import { createApplication } from './app';

async function bootstrap() {
  const environment = validateApiEnvironment(process.env);
  const app = await createApplication(environment);
  await app.listen(environment.API_PORT, environment.API_HOST);
}

void bootstrap().catch(() => {
  // Never print a startup exception: DB URLs/secrets may occur in vendor messages.
  console.error(
    JSON.stringify({
      event: 'startup.failed',
      message: 'Check local configuration and port availability.',
    }),
  );
  process.exitCode = 1;
});
