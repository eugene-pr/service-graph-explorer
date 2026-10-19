import { http, HttpResponse } from 'msw';
import { graphFixture } from './fixtures';

/** Default API handlers; override per test with `server.use(...)`. */
export const handlers = [http.get('*/api/graph', () => HttpResponse.json(graphFixture))];
