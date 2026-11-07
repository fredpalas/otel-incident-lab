import { createApp } from './app';
import { config } from './config';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  await app.listen(config.port);
}

void bootstrap();
