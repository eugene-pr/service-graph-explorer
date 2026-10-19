import { z } from 'zod';
import { buildApp } from './app.js';
import { DEFAULT_GRAPH_FILE, loadGraphFile } from './graph/loadGraph.js';

const Env = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('127.0.0.1'),
  GRAPH_FILE: z.string().min(1).optional(),
});
const env = Env.parse(process.env);

const graph = await loadGraphFile(env.GRAPH_FILE ?? DEFAULT_GRAPH_FILE);
const app = buildApp(graph, { logger: true });
for (const warning of graph.warnings) app.log.warn(warning);

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
