import { http, HttpResponse } from 'msw';
import { entryRoutes, filtersFixture, graphFixture, routesFixture } from './fixtures';

/** Default API handlers; override per test with `server.use(...)`. */
export const handlers = [
  http.get('*/api/graph', () => HttpResponse.json(graphFixture)),
  http.get('*/api/filters', () => HttpResponse.json(filtersFixture)),
  http.get('*/api/routes', () => HttpResponse.json(routesFixture(entryRoutes))),
];
