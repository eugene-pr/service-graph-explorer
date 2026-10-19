import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { entryRoutes, graphFixture, routesFixture } from '../test/fixtures';
import { server } from '../test/server';
import { renderWithQueryClient } from '../test/render';
import { ExplorerPage } from './ExplorerPage';

const findNode = async (name: string) => {
  const canvas = await screen.findByRole('region', { name: /service graph/i });
  const group = await within(canvas).findByRole('group', { name });
  const node = within(group).getByText(name).closest<HTMLElement>('[data-node]');
  if (!node) throw new Error(`Node "${name}" has no [data-node] element`);
  return node;
};

describe('ExplorerPage', () => {
  it('renders every node of the graph with text-labelled badges', async () => {
    renderWithQueryClient(<ExplorerPage />);

    const frontend = await findNode('frontend');
    expect(within(frontend).getByText('public')).toBeInTheDocument();

    const auth = await findNode('auth-service');
    expect(within(auth).getByText('high')).toBeInTheDocument();
    expect(within(auth).queryByText('public')).not.toBeInTheDocument();

    const db = await findNode('prod-postgresdb');
    expect(db).toHaveAttribute('data-sink', 'true');
    expect(within(db).getByText('rds')).toBeInTheDocument();

    const inferred = await findNode('assurance-service');
    expect(inferred).toHaveAttribute('data-inferred', 'true');
    expect(within(inferred).getByText('inferred')).toBeInTheDocument();
  });

  it('draws as Sinks the nodes whose kind the API serves as a Sink kind', async () => {
    server.use(http.get('*/api/graph', () => HttpResponse.json({ ...graphFixture, meta: { ...graphFixture.meta, sinkKinds: [] } })));
    renderWithQueryClient(<ExplorerPage />);

    expect(await findNode('prod-postgresdb')).toHaveAttribute('data-sink', 'false');
  });

  it('shows the load warnings in a banner', async () => {
    renderWithQueryClient(<ExplorerPage />);

    const banner = await screen.findByRole('region', { name: /data warnings/i });
    expect(within(banner).getByText(/"assurance-service" is referenced by an edge/)).toBeInTheDocument();
  });

  it('shows no warnings banner when the data has none', async () => {
    server.use(
      http.get('*/api/graph', () => HttpResponse.json({ nodes: [], edges: [], meta: { warnings: [], kinds: [], sinkKinds: [] } })),
    );
    renderWithQueryClient(<ExplorerPage />);

    expect(await screen.findByRole('region', { name: /service graph/i })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /data warnings/i })).not.toBeInTheDocument();
  });

  it('shows a legend explaining badges and shapes', async () => {
    renderWithQueryClient(<ExplorerPage />);

    const legend = await screen.findByRole('region', { name: /legend/i });
    for (const label of ['public', 'critical', 'high', 'medium', 'low', 'unknown', 'Service', 'Sink', 'Inferred Node']) {
      expect(within(legend).getByText(label)).toBeInTheDocument();
    }
  });

  it('shows a loading state while the graph loads', async () => {
    server.use(
      http.get('*/api/graph', async () => {
        await delay('infinite');
        return HttpResponse.json({});
      }),
    );
    renderWithQueryClient(<ExplorerPage />);

    expect(await screen.findByRole('status')).toHaveTextContent(/loading graph/i);
  });

  it('shows an error state when the graph fails to load', async () => {
    server.use(http.get('*/api/graph', () => HttpResponse.json({ title: 'boom' }, { status: 500 })));
    renderWithQueryClient(<ExplorerPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load the graph/i);
  });

  describe('Query', () => {
    /** Answers `/api/routes` with `respond(searchParams)` and records each request's search params. */
    const recordRoutesRequests = (respond: (params: URLSearchParams) => string[][] = () => entryRoutes) => {
      const requests: URLSearchParams[] = [];
      server.use(
        http.get('*/api/routes', ({ request }) => {
          const params = new URL(request.url).searchParams;
          requests.push(params);
          return HttpResponse.json(routesFixture(respond(params)));
        }),
      );
      return requests;
    };

    const routeList = () => screen.findByRole('region', { name: /^routes/i });
    const routeTexts = (list: HTMLElement) => within(list).getAllByRole('listitem').map((li) => li.textContent);

    it('on open, runs the default view and lists Routes from Entries, highlighted on the canvas', async () => {
      const requests = recordRoutesRequests();
      renderWithQueryClient(<ExplorerPage />);

      const list = await routeList();
      expect(await within(list).findByText('2 Routes')).toBeInTheDocument();
      expect(routeTexts(list)).toEqual(['frontend→auth-service→prod-postgresdb', 'frontend→assurance-service']);
      expect(requests[0]?.has('filters')).toBe(false);
      expect(await findNode('frontend')).toHaveAttribute('data-highlighted', 'true');
    });

    it('generates a toggle per Filter in the Filter Catalog, with its description', async () => {
      renderWithQueryClient(<ExplorerPage />);

      const panel = await screen.findByRole('form', { name: /query/i });
      for (const name of ['startsAtEntry', 'startsAtPublic', 'passesThroughFixture']) {
        expect(await within(panel).findByRole('checkbox', { name })).not.toBeChecked();
      }
      expect(within(panel).getByText('Starts at a publicly exposed service.')).toBeInTheDocument();
    });

    it('toggling startsAtPublic and running sends that Query, lists the matching Routes and dims the rest', async () => {
      const user = userEvent.setup();
      const requests = recordRoutesRequests((params) =>
        params.get('filters') === 'startsAtPublic' ? [['frontend', 'auth-service', 'prod-postgresdb']] : entryRoutes,
      );
      renderWithQueryClient(<ExplorerPage />);

      await user.click(await screen.findByRole('checkbox', { name: 'startsAtPublic' }));
      await user.click(screen.getByRole('button', { name: /run/i }));

      const list = await routeList();
      expect(await within(list).findByText('1 Route')).toBeInTheDocument();
      expect(routeTexts(list)).toEqual(['frontend→auth-service→prod-postgresdb']);
      expect(requests.at(-1)?.get('filters')).toBe('startsAtPublic');
      expect(await findNode('auth-service')).toHaveAttribute('data-highlighted', 'true');
      expect(await findNode('assurance-service')).toHaveAttribute('data-highlighted', 'false');
    });

    it('generates param inputs from the params schema and sends params namespaced by Filter', async () => {
      const user = userEvent.setup();
      const requests = recordRoutesRequests();
      renderWithQueryClient(<ExplorerPage />);

      await user.click(await screen.findByRole('checkbox', { name: 'passesThroughFixture' }));
      await user.type(screen.getByRole('textbox', { name: 'node' }), 'auth-service');
      await user.click(screen.getByRole('button', { name: /run/i }));

      await screen.findByText('2 Routes');
      await vi.waitFor(() => expect(requests.at(-1)?.get('filters')).toBe('passesThroughFixture'));
      expect(requests.at(-1)?.get('passesThroughFixture.node')).toBe('auth-service');
    });

    it('lists the graph\'s node kinds for endsAtSink, sending the checked ones, or none for the default', async () => {
      const user = userEvent.setup();
      const requests = recordRoutesRequests();
      renderWithQueryClient(<ExplorerPage />);

      await user.click(await screen.findByRole('checkbox', { name: 'endsAtSink' }));
      const kinds = await screen.findByRole('group', { name: /kinds/i });
      expect(within(kinds).getAllByRole('checkbox').map((box) => box.closest('label')?.textContent)).toEqual(['service', 'rds']);

      await user.click(screen.getByRole('button', { name: /run/i }));
      await vi.waitFor(() => expect(requests.at(-1)?.get('filters')).toBe('endsAtSink'));
      expect(requests.at(-1)?.has('endsAtSink.kinds')).toBe(false);

      await user.click(within(kinds).getByRole('checkbox', { name: 'rds' }));
      await user.click(screen.getByRole('button', { name: /run/i }));
      await vi.waitFor(() => expect(requests.at(-1)?.get('endsAtSink.kinds')).toBe('rds'));
    });

    it('offers hasVulnerability with an optional minSeverity select, sending none for any severity', async () => {
      const user = userEvent.setup();
      const requests = recordRoutesRequests();
      renderWithQueryClient(<ExplorerPage />);

      await user.click(await screen.findByRole('checkbox', { name: 'hasVulnerability' }));
      const minSeverity = screen.getByRole('combobox', { name: /minSeverity/ });
      expect(within(minSeverity).getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Any',
        'low',
        'medium',
        'high',
        'critical',
      ]);

      await user.click(screen.getByRole('button', { name: /run/i }));
      await vi.waitFor(() => expect(requests.at(-1)?.get('filters')).toBe('hasVulnerability'));
      expect(requests.at(-1)?.has('hasVulnerability.minSeverity')).toBe(false);

      await user.selectOptions(minSeverity, 'high');
      await user.click(screen.getByRole('button', { name: /run/i }));
      await vi.waitFor(() => expect(requests.at(-1)?.get('hasVulnerability.minSeverity')).toBe('high'));
    });

    it('reset returns to the default view', async () => {
      const user = userEvent.setup();
      recordRoutesRequests((params) => (params.get('filters') === 'startsAtPublic' ? [['frontend', 'assurance-service']] : entryRoutes));
      renderWithQueryClient(<ExplorerPage />);

      await user.click(await screen.findByRole('checkbox', { name: 'startsAtPublic' }));
      await user.click(screen.getByRole('button', { name: /run/i }));
      const list = await routeList();
      expect(await within(list).findByText('1 Route')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /reset/i }));

      expect(await within(list).findByText('2 Routes')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'startsAtPublic' })).not.toBeChecked();
    });

    it('shows the count and a notice when the results were truncated', async () => {
      server.use(http.get('*/api/routes', () => HttpResponse.json(routesFixture(entryRoutes, { truncated: true, limit: 2 }))));
      renderWithQueryClient(<ExplorerPage />);

      const list = await routeList();
      expect(await within(list).findByText('2 Routes')).toBeInTheDocument();
      expect(within(list).getByRole('status')).toHaveTextContent(/more routes match/i);
    });

    it('Run retries a failed Query even when nothing changed', async () => {
      const user = userEvent.setup();
      let failing = true;
      server.use(
        http.get('*/api/routes', () =>
          failing
            ? HttpResponse.json({ type: 'about:blank', title: 'Internal Server Error', status: 500 }, { status: 500 })
            : HttpResponse.json(routesFixture(entryRoutes)),
        ),
      );
      renderWithQueryClient(<ExplorerPage />);
      const list = await routeList();
      await within(list).findByRole('alert');

      failing = false;
      await user.click(screen.getByRole('button', { name: /run/i }));

      expect(await within(list).findByText('2 Routes')).toBeInTheDocument();
      expect(within(list).queryByRole('alert')).not.toBeInTheDocument();
    });

    it('while a new Query runs, marks the previous Routes as updating and drops their highlight', async () => {
      const user = userEvent.setup();
      let release = () => {};
      const released = new Promise<void>((resolve) => (release = resolve));
      server.use(
        http.get('*/api/routes', async ({ request }) => {
          if (new URL(request.url).searchParams.get('filters') !== 'startsAtPublic') return HttpResponse.json(routesFixture(entryRoutes));
          await released;
          return HttpResponse.json(routesFixture([['frontend', 'assurance-service']]));
        }),
      );
      renderWithQueryClient(<ExplorerPage />);
      const list = await routeList();
      await within(list).findByText('2 Routes');

      await user.click(screen.getByRole('checkbox', { name: 'startsAtPublic' }));
      await user.click(screen.getByRole('button', { name: /run/i }));

      expect(await within(list).findByRole('status')).toHaveTextContent(/updating/i);
      expect(within(list).getByRole('list')).toHaveAttribute('aria-busy', 'true');
      expect(await findNode('frontend')).not.toHaveAttribute('data-highlighted');

      release();
      expect(await within(list).findByText('1 Route')).toBeInTheDocument();
      expect(within(list).queryByRole('status')).not.toBeInTheDocument();
      expect(await findNode('frontend')).toHaveAttribute('data-highlighted', 'true');
    });

    it('shows the problems when the API rejects the Query', async () => {
      server.use(
        http.get('*/api/routes', () =>
          HttpResponse.json(
            {
              type: 'about:blank',
              title: 'Bad Request',
              status: 400,
              detail: 'The Query is invalid.',
              errors: [{ filter: 'passesThroughFixture', param: 'node', message: 'Too small' }],
            },
            { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
          ),
        ),
      );
      renderWithQueryClient(<ExplorerPage />);

      const alert = await within(await routeList()).findByRole('alert');
      expect(alert).toHaveTextContent('The Query is invalid.');
      expect(alert).toHaveTextContent('passesThroughFixture.node: Too small');
    });
  });
});
