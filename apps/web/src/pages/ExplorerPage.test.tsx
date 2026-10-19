import { fireEvent, screen, within } from '@testing-library/react';
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

/** A plain click: user-event's mousedown has no `view` in jsdom, which the canvas's pan handler (d3-zoom) reads. */
const clickNode = async (name: string) => fireEvent.click(await findNode(name));

const nodeDetails = () => screen.getByRole('region', { name: /node details/i });

const routeButtons = async () => {
  const list = await screen.findByRole('region', { name: /^routes/i });
  await within(list).findByText('2 Routes');
  return within(list).getAllByRole('button');
};

const findEdge = async (id: string) => {
  const canvas = await screen.findByRole('region', { name: /service graph/i });
  return within(canvas).findByTestId(`rf__edge-${id}`);
};

/** The details panel's fields as label → value. */
const detailRows = (details: HTMLElement) =>
  Object.fromEntries([...details.querySelectorAll('dt')].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]));

describe('ExplorerPage', () => {
  describe('Route highlights', () => {
    it('restores the selected Route when a hovered Route disappears after a Query update', async () => {
      const user = userEvent.setup();
      const extraNode = {
        id: 'billing-service',
        data: { name: 'billing-service', kind: 'service', publicExposed: false, vulnerabilities: [], inferred: false },
      };
      const extraEdge = { id: 'frontend->billing-service', source: 'frontend', target: 'billing-service' };
      server.use(
        http.get('*/api/graph', () => HttpResponse.json({
          ...graphFixture, nodes: [...graphFixture.nodes, extraNode], edges: [...graphFixture.edges, extraEdge],
        })),
        http.get('*/api/routes', ({ request }) => {
          const filters = new URL(request.url).searchParams.get('filters');
          const result = routesFixture([
            ...(filters === 'startsAtPublic' ? entryRoutes.slice(0, 1) : entryRoutes),
            ['frontend', 'billing-service'],
          ]);
          return HttpResponse.json({ ...result, nodes: [...result.nodes, extraNode], edges: [...result.edges, extraEdge] });
        }),
      );
      renderWithQueryClient(<ExplorerPage />);
      const first = await screen.findByRole('button', { name: 'Route: frontend → auth-service → prod-postgresdb' });
      await user.click(first);

      // Prepare a different Query, then run it by keyboard while the pointer stays over the Route that disappears.
      await user.click(screen.getByRole('checkbox', { name: 'startsAtPublic' }));
      const run = screen.getByRole('button', { name: /run/i });
      for (let i = 0; i < 30 && document.activeElement !== run; i++) await user.tab();
      expect(run).toHaveFocus();
      await user.hover(screen.getByRole('button', { name: 'Route: frontend → assurance-service' }));
      expect(await findNode('auth-service')).toHaveAttribute('data-highlighted', 'false');
      await user.keyboard('{Enter}');

      await screen.findByText('2 Routes');
      expect(first).toHaveAttribute('aria-pressed', 'true');
      expect(await findNode('auth-service')).toHaveAttribute('data-highlighted', 'true');
      expect(await findNode('billing-service')).toHaveAttribute('data-highlighted', 'false');
      expect(await findEdge('frontend->billing-service')).toHaveAttribute('data-highlighted', 'false');
    });

    it('dims an edge outside the selected Route even when both endpoints are highlighted', async () => {
      const user = userEvent.setup();
      const shortcut = { id: 'frontend->prod-postgresdb', source: 'frontend', target: 'prod-postgresdb' };
      const result = routesFixture([...entryRoutes, ['frontend', 'prod-postgresdb']]);
      server.use(
        http.get('*/api/graph', () => HttpResponse.json({ ...graphFixture, edges: [...graphFixture.edges, shortcut] })),
        http.get('*/api/routes', () => HttpResponse.json({ ...result, edges: [...result.edges, shortcut] })),
      );
      renderWithQueryClient(<ExplorerPage />);

      await user.click(await screen.findByRole('button', { name: 'Route: frontend → auth-service → prod-postgresdb' }));

      expect(await findNode('frontend')).toHaveAttribute('data-highlighted', 'true');
      expect(await findNode('prod-postgresdb')).toHaveAttribute('data-highlighted', 'true');
      expect(await findEdge('frontend->auth-service')).toHaveAttribute('data-highlighted', 'true');
      expect(await findEdge('auth-service->prod-postgresdb')).toHaveAttribute('data-highlighted', 'true');
      expect(await findEdge('frontend->prod-postgresdb')).toHaveAttribute('data-highlighted', 'false');
    });

    it('Matched only shows an empty canvas when the Query has no matches', async () => {
      const user = userEvent.setup();
      server.use(http.get('*/api/routes', () => HttpResponse.json(routesFixture([]))));
      renderWithQueryClient(<ExplorerPage />);
      await screen.findByText('0 Routes');
      const frontend = await findNode('frontend');
      expect(frontend).toHaveAttribute('data-highlighted', 'false');

      await user.click(screen.getByRole('checkbox', { name: /matched only/i }));

      const canvas = screen.getByRole('region', { name: /service graph/i });
      expect(canvas.querySelector('[data-node]')).not.toBeInTheDocument();
      expect(canvas.querySelector('[data-testid^="rf__edge-"]')).not.toBeInTheDocument();

      await user.click(screen.getByRole('checkbox', { name: /matched only/i }));
      expect(await findNode('frontend')).toHaveAttribute('data-highlighted', 'false');
    });

    it('Matched only hides unmatched nodes and edges, keeps other matches dimmed, and restores the full graph', async () => {
      const user = userEvent.setup();
      server.use(http.get('*/api/graph', () => HttpResponse.json({
        ...graphFixture,
        nodes: [...graphFixture.nodes, {
          id: 'unmatched-service',
          data: { name: 'unmatched-service', kind: 'service', publicExposed: false, vulnerabilities: [], inferred: false },
        }],
        edges: [...graphFixture.edges, { id: 'frontend->unmatched-service', source: 'frontend', target: 'unmatched-service' }],
      })));
      renderWithQueryClient(<ExplorerPage />);
      const [first] = await routeButtons();
      if (!first) throw new Error('Expected a Route');
      const unmatched = await findNode('unmatched-service');
      expect(unmatched).toHaveAttribute('data-highlighted', 'false');
      expect(await findEdge('frontend->unmatched-service')).toHaveAttribute('data-highlighted', 'false');

      await user.click(first);
      await user.click(screen.getByRole('checkbox', { name: /matched only/i }));

      expect(unmatched).not.toBeInTheDocument();
      expect(screen.queryByTestId('rf__edge-frontend->unmatched-service')).not.toBeInTheDocument();
      expect(await findNode('assurance-service')).toHaveAttribute('data-highlighted', 'false');
      expect(await findEdge('frontend->assurance-service')).toHaveAttribute('data-highlighted', 'false');
      expect(await findNode('auth-service')).toHaveAttribute('data-highlighted', 'true');

      await user.click(screen.getByRole('checkbox', { name: /matched only/i }));
      expect(await findNode('unmatched-service')).toHaveAttribute('data-highlighted', 'false');
      expect(await findEdge('frontend->unmatched-service')).toHaveAttribute('data-highlighted', 'false');
    });

    it('clicking keeps a Route highlighted, hovering previews another, and leaving restores the selection', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<ExplorerPage />);
      const [first, second] = await routeButtons();
      if (!first || !second) throw new Error('Expected two Routes');

      await user.click(first);
      await user.unhover(first);
      expect(first).toHaveAttribute('aria-pressed', 'true');
      expect(await findNode('assurance-service')).toHaveAttribute('data-highlighted', 'false');

      await user.hover(second);
      expect(await findNode('auth-service')).toHaveAttribute('data-highlighted', 'false');
      expect(await findNode('assurance-service')).toHaveAttribute('data-highlighted', 'true');

      await user.unhover(second);
      expect(await findNode('auth-service')).toHaveAttribute('data-highlighted', 'true');
      expect(await findNode('assurance-service')).toHaveAttribute('data-highlighted', 'false');

      await user.keyboard('{Escape}');
      expect(first).toHaveAttribute('aria-pressed', 'false');
      expect(await findNode('assurance-service')).toHaveAttribute('data-highlighted', 'true');
    });

    it('Tab enters the Route list, arrows select, Enter keeps the selection, and Escape clears it', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<ExplorerPage />);
      const [first, second] = await routeButtons();
      if (!first || !second) throw new Error('Expected two Routes');

      for (let i = 0; i < 30 && document.activeElement !== first; i++) await user.tab();
      expect(first).toHaveFocus();
      await user.keyboard('{ArrowDown}');

      expect(second).toHaveFocus();
      expect(second).toHaveAttribute('aria-pressed', 'true');
      expect(await findNode('auth-service')).toHaveAttribute('data-highlighted', 'false');
      expect(await findNode('assurance-service')).toHaveAttribute('data-highlighted', 'true');
      expect(await findEdge('frontend->auth-service')).toHaveAttribute('data-highlighted', 'false');

      await user.keyboard('{Enter}');
      await user.tab();
      expect(await findNode('auth-service')).toHaveAttribute('data-highlighted', 'false');
      await user.tab({ shift: true });
      expect(second).toHaveFocus();

      await user.keyboard('{Escape}');
      expect(second).toHaveAttribute('aria-pressed', 'false');
      expect(await findNode('auth-service')).toHaveAttribute('data-highlighted', 'true');
      expect(await findEdge('frontend->auth-service')).toHaveAttribute('data-highlighted', 'true');

      await user.keyboard('{ArrowUp}');
      expect(first).toHaveFocus();
      expect(first).toHaveAttribute('aria-pressed', 'true');
      expect(await findNode('assurance-service')).toHaveAttribute('data-highlighted', 'false');
    });

    it('hovering a Route highlights only its nodes and edges, then restores all matches on leave', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<ExplorerPage />);
      const [, second] = await routeButtons();
      if (!second) throw new Error('Expected a second Route');

      await user.hover(second);

      expect(await findNode('frontend')).toHaveAttribute('data-highlighted', 'true');
      expect(await findNode('assurance-service')).toHaveAttribute('data-highlighted', 'true');
      expect(await findNode('auth-service')).toHaveAttribute('data-highlighted', 'false');
      expect(await findNode('prod-postgresdb')).toHaveAttribute('data-highlighted', 'false');
      expect(await findEdge('frontend->assurance-service')).toHaveAttribute('data-highlighted', 'true');
      expect(await findEdge('frontend->auth-service')).toHaveAttribute('data-highlighted', 'false');
      expect(await findEdge('auth-service->prod-postgresdb')).toHaveAttribute('data-highlighted', 'false');

      await user.unhover(second);

      expect(await findNode('auth-service')).toHaveAttribute('data-highlighted', 'true');
      expect(await findEdge('frontend->auth-service')).toHaveAttribute('data-highlighted', 'true');
    });
  });

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

  describe('node details', () => {
    it('clicking a node shows all its data in the details panel', async () => {
      renderWithQueryClient(<ExplorerPage />);
      expect(screen.queryByRole('region', { name: /node details/i })).not.toBeInTheDocument();

      await clickNode('auth-service');

      const details = nodeDetails();
      expect(within(details).getByRole('heading', { name: 'auth-service' })).toBeInTheDocument();
      expect(detailRows(details)).toEqual({ Kind: 'service', Language: 'java', Path: 'services/auth', Public: 'no', Inferred: 'no' });
      const vulnerabilities = within(details).getAllByRole('listitem').map((li) => li.textContent);
      expect(vulnerabilities).toEqual([
        expect.stringMatching(/medium.*SQL injection.*Auth\.java.*CWE-89/),
        expect.stringMatching(/high.*Path traversal.*Auth\.java.*CWE-22/),
      ]);
      expect(await findNode('auth-service')).toHaveAttribute('data-selected', 'true');
    });

    it('shows an Inferred Node with no vulnerabilities as such', async () => {
      renderWithQueryClient(<ExplorerPage />);

      await clickNode('assurance-service');

      const details = nodeDetails();
      expect(detailRows(details)).toMatchObject({ Kind: 'service', Public: 'no', Inferred: 'yes' });
      expect(within(details).getByText(/no vulnerabilities/i)).toBeInTheDocument();
    });

    it('selects a node with the keyboard, and closes the panel with its close button', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<ExplorerPage />);
      const canvas = await screen.findByRole('region', { name: /service graph/i });

      within(canvas).getByRole('group', { name: 'frontend' }).focus();
      await user.keyboard('{Enter}');

      const details = nodeDetails();
      expect(within(details).getByRole('heading', { name: 'frontend' })).toBeInTheDocument();
      expect(detailRows(details)).toMatchObject({ Public: 'yes' });

      await user.click(within(details).getByRole('button', { name: /close node details/i }));
      expect(screen.queryByRole('region', { name: /node details/i })).not.toBeInTheDocument();
    });
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
      for (const name of ['startsAtEntry', 'startsAtPublic', 'passesThrough']) {
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

      await user.click(await screen.findByRole('checkbox', { name: 'passesThrough' }));
      await user.type(screen.getByRole('textbox', { name: 'node' }), 'auth-service');
      await user.click(screen.getByRole('button', { name: /run/i }));

      await screen.findByText('2 Routes');
      await vi.waitFor(() => expect(requests.at(-1)?.get('filters')).toBe('passesThrough'));
      expect(requests.at(-1)?.get('passesThrough.node')).toBe('auth-service');
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

    it('offers maxLength with a number input for hops, sending it namespaced by Filter', async () => {
      const user = userEvent.setup();
      const requests = recordRoutesRequests();
      renderWithQueryClient(<ExplorerPage />);

      await user.click(await screen.findByRole('checkbox', { name: 'maxLength' }));
      await user.type(screen.getByRole('spinbutton', { name: 'hops' }), '2');
      await user.click(screen.getByRole('button', { name: /run/i }));

      await vi.waitFor(() => expect(requests.at(-1)?.get('filters')).toBe('maxLength'));
      expect(requests.at(-1)?.get('maxLength.hops')).toBe('2');
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

    it('"Show Routes through here" adds passesThrough for the selected node to the current Query and runs it', async () => {
      const user = userEvent.setup();
      const requests = recordRoutesRequests((params) =>
        params.get('filters')?.includes('passesThrough') ? [['frontend', 'auth-service', 'prod-postgresdb']] : entryRoutes,
      );
      renderWithQueryClient(<ExplorerPage />);
      await user.click(await screen.findByRole('checkbox', { name: 'startsAtPublic' }));
      await user.click(screen.getByRole('button', { name: /run/i }));
      await vi.waitFor(() => expect(requests.at(-1)?.get('filters')).toBe('startsAtPublic'));

      await clickNode('auth-service');
      await user.click(within(nodeDetails()).getByRole('button', { name: /show routes through here/i }));

      const list = await routeList();
      expect(await within(list).findByText('1 Route')).toBeInTheDocument();
      expect(requests.at(-1)?.get('filters')).toBe('startsAtPublic,passesThrough');
      expect(requests.at(-1)?.get('passesThrough.node')).toBe('auth-service');
      expect(screen.getByRole('checkbox', { name: 'passesThrough' })).toBeChecked();
      expect(screen.getByRole('textbox', { name: 'node' })).toHaveValue('auth-service');
    });

    it('"Show Routes through here" replaces the node, never repeating passesThrough, even without the Filter Catalog', async () => {
      const user = userEvent.setup();
      server.use(http.get('*/api/filters', () => HttpResponse.json({ title: 'boom' }, { status: 500 })));
      const requests = recordRoutesRequests();
      renderWithQueryClient(<ExplorerPage />);
      const showRoutesThrough = () => within(nodeDetails()).getByRole('button', { name: /show routes through here/i });

      await clickNode('auth-service');
      await user.click(showRoutesThrough());
      await vi.waitFor(() => expect(requests.at(-1)?.get('passesThrough.node')).toBe('auth-service'));
      await clickNode('frontend');
      await user.click(showRoutesThrough());

      await vi.waitFor(() => expect(requests.at(-1)?.get('passesThrough.node')).toBe('frontend'));
      expect(requests.at(-1)?.get('filters')).toBe('passesThrough');
    });

    it('"Show Routes through here" runs the Query again when it is unchanged, so a failed Query can be retried', async () => {
      const user = userEvent.setup();
      let failing = true;
      server.use(
        http.get('*/api/routes', ({ request }) =>
          failing && new URL(request.url).searchParams.has('passesThrough.node')
            ? HttpResponse.json({ type: 'about:blank', title: 'Internal Server Error', status: 500 }, { status: 500 })
            : HttpResponse.json(routesFixture(entryRoutes)),
        ),
      );
      renderWithQueryClient(<ExplorerPage />);
      const list = await routeList();
      await within(list).findByText('2 Routes');

      await clickNode('auth-service');
      await user.click(within(nodeDetails()).getByRole('button', { name: /show routes through here/i }));
      await within(list).findByRole('alert');

      failing = false;
      await user.click(within(nodeDetails()).getByRole('button', { name: /show routes through here/i }));

      expect(await within(list).findByText('2 Routes')).toBeInTheDocument();
      expect(within(list).queryByRole('alert')).not.toBeInTheDocument();
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
              errors: [{ filter: 'passesThrough', param: 'node', message: 'Too small' }],
            },
            { status: 400, headers: { 'Content-Type': 'application/problem+json' } },
          ),
        ),
      );
      renderWithQueryClient(<ExplorerPage />);

      const alert = await within(await routeList()).findByRole('alert');
      expect(alert).toHaveTextContent('The Query is invalid.');
      expect(alert).toHaveTextContent('passesThrough.node: Too small');
    });
  });
});
