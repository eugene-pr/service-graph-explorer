import { z } from 'zod';
import { buildApp } from './app.js';
import { loadGraphFromEnv } from './graph/loadGraph.js';

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('127.0.0.1'),
  WEB_DIST: z.string().min(1).optional(),
});
const env = Env.parse(process.env);

const graph = await loadGraphFromEnv(process.env);
const app = buildApp(graph, { logger: true, ...(env.WEB_DIST && { webDist: env.WEB_DIST }) });
for (const warning of graph.warnings) app.log.warn(warning);

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
