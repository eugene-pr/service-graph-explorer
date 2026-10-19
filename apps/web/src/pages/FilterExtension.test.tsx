import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { filterCatalog, FilterInfo } from '@sge/domain';
import { http, HttpResponse } from 'msw';
import { expect, it, vi } from 'vitest';
import { entryRoutes, filtersFixture, routesFixture } from '../test/fixtures';
import { renderWithQueryClient } from '../test/render';
import { server } from '../test/server';
import { ExplorerPage } from './ExplorerPage';

// Model the documented extension seam: add metadata without changing the UI.
vi.mock('@sge/domain', async (importOriginal) => {
  const domain = await importOriginal<typeof import('@sge/domain')>();
  return {
    ...domain,
    filterCatalog: {
      ...domain.filterCatalog,
      publicExposure: {
        description: 'Starts at a node with the chosen public exposure.',
        position: 'start',
        params: domain.filterCatalog.startsAtPublic.params.extend({ exposed: domain.GraphNode.shape.publicExposed }),
      },
    },
  };
});

it('submits a new boolean Filter through flat inputs and advanced edits', async () => {
  const user = userEvent.setup();
  const catalog = new Map(Object.entries(filterCatalog));
  const definition = catalog.get('publicExposure');
  if (!definition) throw new Error('Missing fixture Filter.');
  const filter = FilterInfo.parse({
    name: 'publicExposure', ...definition, params: definition.params.toJSONSchema({ io: 'input' }),
  });
  const gets: URLSearchParams[] = [];
  const posts: unknown[] = [];
  server.use(
    http.get('*/api/filters', () => HttpResponse.json({ filters: [...filtersFixture.filters, filter] })),
    http.get('*/api/routes', ({ request }) => {
      gets.push(new URL(request.url).searchParams);
      return HttpResponse.json(routesFixture(entryRoutes));
    }),
    http.post('*/api/routes/query', async ({ request }) => {
      posts.push(await request.json());
      return HttpResponse.json(routesFixture(entryRoutes));
    }),
  );
  renderWithQueryClient(<ExplorerPage />);

  await user.click(await screen.findByRole('checkbox', { name: 'publicExposure' }));
  await user.type(screen.getByRole('textbox', { name: 'exposed' }), 'false');
  await user.click(screen.getByRole('button', { name: 'Run' }));
  await vi.waitFor(() => expect(gets.at(-1)?.get('publicExposure.exposed')).toBe('false'));
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();

  await user.click(screen.getByRole('checkbox', { name: 'Advanced' }));
  const input = within(screen.getByRole('group', { name: 'publicExposure 1' })).getByRole('textbox', { name: 'exposed' });
  expect(input).toHaveValue('false');
  await user.clear(input);
  await user.type(input, 'true');
  await user.click(screen.getByRole('button', { name: 'Run' }));
  await vi.waitFor(() => expect(posts.at(-1)).toEqual({
    query: { and: [{ filter: 'publicExposure', params: { exposed: true } }] }, limit: 100,
  }));
});
