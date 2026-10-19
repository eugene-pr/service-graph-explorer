import { z } from 'zod';
import { buildApp } from './app.js';

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('127.0.0.1'),
});
const env = Env.parse(process.env);

const app = buildApp({ logger: true });

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
