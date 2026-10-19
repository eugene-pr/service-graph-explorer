import { act, fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { entryRoutes, graphFixture, routesFixture } from '../test/fixtures';
import { server } from '../test/server';
import { renderWithQueryClient } from '../test/render';
import { resizeElement } from '../test/reactFlowStubs';
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

const nodeGroup = async (name: string) =>
  within(await screen.findByRole('region', { name: /service graph/i })).findByRole('group', { name });

/** jsdom rejects `view` in a MouseEvent init, but the canvas's drag handler (d3-drag) reads it. */
const mouse = (target: Element | Window, type: string, clientX: number, clientY: number) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX, clientY });
  Object.defineProperty(event, 'view', { value: window });
  fireEvent(target, event);
};

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

/** A promise the test resolves by hand, to hold MSW responses back. */
const deferred = () => {
  let release = () => {};
  const released = new Promise<void>((resolve) => (release = resolve));
  return { released, release };
};

describe('ExplorerPage', () => {
  describe('empty results', () => {
    it('explains an empty Query and loads each active Filter count in parallel with its own params and limit', async () => {
      window.history.replaceState(null, '', '/?filters=startsAtPublic,endsAtSink,hasVulnerability&endsAtSink.kinds=rds&hasVulnerability.minSeverity=high&limit=2');
      const requests: URLSearchParams[] = [];
      const { released, release } = deferred();
      server.use(http.get('*/api/routes', async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const filter = params.get('filters');
        if (filter?.includes(',')) return HttpResponse.json(routesFixture([]));
        requests.push(params);
        await released;
        const routes = filter === 'startsAtPublic' ? entryRoutes : filter === 'endsAtSink' ? [entryRoutes[0]!] : [];
        return HttpResponse.json(routesFixture(routes, { limit: 2 }));
      }));
      renderWithQueryClient(<ExplorerPage />);

      try {
        const list = await screen.findByRole('region', { name: 'Routes' });
        expect(await within(list).findByText(/no Routes match this Query/i)).toBeInTheDocument();
        expect(within(list).getByText(/try removing a Filter/i)).toBeInTheDocument();
        // All requests must arrive before any response is released.
        await vi.waitFor(() => expect(requests).toHaveLength(3));
        expect(requests.map((params) => Object.fromEntries(params))).toEqual(expect.arrayContaining([
          { filters: 'startsAtPublic', limit: '2' },
          { filters: 'endsAtSink', 'endsAtSink.kinds': 'rds', limit: '2' },
          { filters: 'hasVulnerability', 'hasVulnerability.minSeverity': 'high', limit: '2' },
        ]));
        release();

        expect(await within(list).findByRole('button', { name: /startsAtPublic only.*2 Routes/ })).toBeInTheDocument();
        expect(await within(list).findByRole('button', { name: /endsAtSink only.*1 Route/ })).toBeInTheDocument();
        expect(await within(list).findByRole('button', { name: /hasVulnerability only, from Entries.*0 Routes/ })).toBeInTheDocument();
        expect(within(list).getByRole('button', { name: /startsAtPublic only:/ })).toBeInTheDocument();
      } finally {
        release();
      }
    });

    it('applies only the chosen Filter, preserving its params, limit and view in the URL and panel', async () => {
      const user = userEvent.setup();
      window.history.replaceState(null, '', '/?filters=endsAtSink,hasVulnerability&endsAtSink.kinds=rds&hasVulnerability.minSeverity=high&limit=5&view=matched');
      const requests: URLSearchParams[] = [];
      server.use(http.get('*/api/routes', ({ request }) => {
        const params = new URL(request.url).searchParams;
        requests.push(params);
        return HttpResponse.json(routesFixture(params.get('filters')?.includes(',') ? [] : [entryRoutes[0]!], { limit: 5 }));
      }));
      renderWithQueryClient(<ExplorerPage />);
      await screen.findByRole('checkbox', { name: 'hasVulnerability' });

      const hint = await screen.findByRole('button', { name: /hasVulnerability only.*1 Route/ });
      await user.click(hint);

      const list = screen.getByRole('region', { name: 'Routes' });
      expect(await within(list).findByText('1 Route')).toBeInTheDocument();
      expect(within(list).getByRole('button', { name: 'Route: frontend → auth-service → prod-postgresdb' })).toBeInTheDocument();
      expect(within(list).queryByText(/no Routes match/i)).not.toBeInTheDocument();
      expect(Object.fromEntries(new URLSearchParams(window.location.search))).toEqual({
        filters: 'hasVulnerability', 'hasVulnerability.minSeverity': 'high', limit: '5', view: 'matched',
      });
      expect(screen.getByRole('checkbox', { name: 'hasVulnerability' })).toBeChecked();
      expect(screen.getByRole('combobox', { name: /minSeverity/ })).toHaveValue('high');
      expect(screen.getByRole('checkbox', { name: 'endsAtSink' })).not.toBeChecked();
      expect(screen.getByRole('spinbutton', { name: 'Limit' })).toHaveValue(5);
      expect(requests.filter((params) => params.get('filters') === 'hasVulnerability')).toHaveLength(1);
    });

    it('labels bounded counts and keeps a failed count distinct from zero', async () => {
      window.history.replaceState(null, '', '/?filters=startsAtPublic,endsAtSink&limit=1');
      server.use(http.get('*/api/routes', ({ request }) => {
        const filter = new URL(request.url).searchParams.get('filters');
        if (filter === 'endsAtSink') return HttpResponse.json({ title: 'Unavailable' }, { status: 500 });
        return HttpResponse.json(routesFixture(filter === 'startsAtPublic' ? [entryRoutes[0]!] : [], {
          truncated: filter === 'startsAtPublic', limit: 1,
        }));
      }));
      renderWithQueryClient(<ExplorerPage />);

      expect(await screen.findByRole('button', { name: /startsAtPublic only.*At least 1 Route/ })).toBeInTheDocument();
      const failed = await screen.findByRole('button', { name: /endsAtSink only.*count unavailable/i });
      expect(failed).not.toHaveTextContent('0 Routes');
      expect(screen.getByText(/no Routes match this Query/i)).toBeInTheDocument();
    });

    const renderEmpty = async (url: string) => {
      window.history.replaceState(null, '', url);
      const requests: URLSearchParams[] = [];
      server.use(http.get('*/api/routes', ({ request }) => {
        requests.push(new URL(request.url).searchParams);
        return HttpResponse.json(routesFixture([]));
      }));
      renderWithQueryClient(<ExplorerPage />);
      expect(await screen.findByText(/no Routes match this Query/i)).toBeInTheDocument();
      return { list: screen.getByRole('region', { name: 'Routes' }), requests };
    };

    it('suggests a start-position Filter when the default Query is empty', async () => {
      const { list, requests } = await renderEmpty('/');
      expect(within(list).queryByRole('button')).not.toBeInTheDocument();
      expect(within(list).getByText(/try choosing a start-position Filter/i)).toBeInTheDocument();
      expect(requests).toHaveLength(1);
    });

    it('suggests changing or removing the only Filter instead of offering it as a hint', async () => {
      const { list, requests } = await renderEmpty('/?filters=hasVulnerability');
      expect(within(list).getByText(/try changing this Filter's parameters or removing it/i)).toBeInTheDocument();
      expect(within(list).queryByRole('button', { name: /only/ })).not.toBeInTheDocument();
      expect(requests).toHaveLength(1);
    });

    it('hides old empty-state hints while a new Query runs and stops showing them when it matches', async () => {
      const user = userEvent.setup();
      window.history.replaceState(null, '', '/?filters=startsAtPublic,endsAtSink');
      const requests: string[] = [];
      const { released, release } = deferred();
      server.use(http.get('*/api/routes', async ({ request }) => {
        const filters = new URL(request.url).searchParams.get('filters') ?? '';
        requests.push(filters);
        if (filters.includes('maxLength')) {
          await released;
          return HttpResponse.json(routesFixture(entryRoutes));
        }
        return HttpResponse.json(routesFixture(filters.includes(',') ? [] : entryRoutes));
      }));
      renderWithQueryClient(<ExplorerPage />);

      try {
        await screen.findByRole('button', { name: /startsAtPublic only.*2 Routes/ });
        await screen.findByRole('button', { name: /endsAtSink only.*2 Routes/ });
        await user.click(screen.getByRole('checkbox', { name: 'maxLength' }));
        await user.type(screen.getByRole('spinbutton', { name: 'hops' }), '2');
        await user.click(screen.getByRole('button', { name: 'Run' }));

        const list = screen.getByRole('region', { name: 'Routes' });
        expect(await within(list).findByRole('status')).toHaveTextContent(/updating/i);
        expect(within(list).queryByText(/no Routes match/i)).not.toBeInTheDocument();
        expect(within(list).queryByRole('button', { name: /only/ })).not.toBeInTheDocument();
        release();
        expect(await within(list).findByText('2 Routes')).toBeInTheDocument();
        expect(within(list).queryByText(/try removing a Filter/i)).not.toBeInTheDocument();
        expect(requests).toEqual(expect.arrayContaining(['startsAtPublic,endsAtSink', 'startsAtPublic', 'endsAtSink', 'startsAtPublic,endsAtSink,maxLength']));
        expect(requests).toHaveLength(4);
      } finally {
        release();
      }
    });
  });

  describe('Query URL', () => {
    it('preserves the active Query and invalid draft until Filter parameters are corrected', async () => {
      const user = userEvent.setup();
      window.history.replaceState(null, '', '/?filters=startsAtPublic&view=matched');
      const requests: URLSearchParams[] = [];
      server.use(http.get('*/api/routes', ({ request }) => {
        requests.push(new URL(request.url).searchParams);
        return HttpResponse.json(routesFixture([entryRoutes[0]!]));
      }));
      renderWithQueryClient(<ExplorerPage />);
      await screen.findByText('1 Route');
      const originalUrl = window.location.href;
      const originalHistoryLength = window.history.length;
      await user.click(screen.getByRole('checkbox', { name: 'maxLength' }));
      await user.type(screen.getByRole('spinbutton', { name: 'hops' }), '0');
      await user.click(screen.getByRole('button', { name: 'Run' }));

      expect(window.location.href).toBe(originalUrl);
      expect(window.history.length).toBe(originalHistoryLength);
      expect(requests).toHaveLength(1);
      expect(screen.getByRole('checkbox', { name: 'startsAtPublic' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'maxLength' })).toBeChecked();
      expect(screen.getByRole('spinbutton', { name: 'hops' })).toHaveValue(0);
      expect(screen.getByRole('checkbox', { name: 'Matched only' })).toBeChecked();
      expect(within(screen.getByRole('form', { name: 'Query' })).getByRole('alert')).toHaveTextContent(/maxLength.hops/);
      expect(screen.queryByText(/URL.*default Query/i)).not.toBeInTheDocument();
      expect(screen.getByText('1 Route')).toBeInTheDocument();

      await user.clear(screen.getByRole('spinbutton', { name: 'hops' }));
      await user.type(screen.getByRole('spinbutton', { name: 'hops' }), '2');
      await user.click(screen.getByRole('button', { name: 'Run' }));
      await vi.waitFor(() => expect(requests.at(-1)?.get('maxLength.hops')).toBe('2'));
      const search = new URLSearchParams(window.location.search);
      expect(search.get('filters')).toBe('startsAtPublic,maxLength');
      expect(search.get('view')).toBe('matched');
      expect(within(screen.getByRole('form', { name: 'Query' })).queryByRole('alert')).not.toBeInTheDocument();
    });

    it('hydrates whitespace-separated Sink kinds consistently and preserves them when another kind changes', async () => {
      const user = userEvent.setup();
      window.history.replaceState(null, '', '/?filters=endsAtSink&endsAtSink.kinds=rds,%20sqs');
      server.use(http.get('*/api/graph', () => HttpResponse.json({
        ...graphFixture,
        meta: { ...graphFixture.meta, kinds: ['service', 'rds', 'sqs'], sinkKinds: ['rds', 'sqs'] },
      })));
      const requests: URLSearchParams[] = [];
      server.use(http.get('*/api/routes', ({ request }) => {
        requests.push(new URL(request.url).searchParams);
        return HttpResponse.json(routesFixture(entryRoutes));
      }));
      renderWithQueryClient(<ExplorerPage />);

      const kinds = await screen.findByRole('group', { name: /kinds/i });
      expect(within(kinds).getByRole('checkbox', { name: 'rds' })).toBeChecked();
      expect(within(kinds).getByRole('checkbox', { name: 'sqs' })).toBeChecked();
      await screen.findByText('2 Routes');
      expect(requests[0]?.get('endsAtSink.kinds')).toBe('rds,sqs');

      await user.click(within(kinds).getByRole('checkbox', { name: 'service' }));
      await user.click(screen.getByRole('button', { name: 'Run' }));
      await vi.waitFor(() => expect(requests.at(-1)?.get('endsAtSink.kinds')).toBe('service,rds,sqs'));
      expect(new URLSearchParams(window.location.search).get('endsAtSink.kinds')).toBe('service,rds,sqs');
    });

    it('keeps unsubmitted Filter edits when only the view mode changes', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<ExplorerPage />);
      await screen.findByText('2 Routes');
      await user.click(screen.getByRole('checkbox', { name: 'hasVulnerability' }));
      await user.selectOptions(screen.getByRole('combobox', { name: /minSeverity/ }), 'high');
      await user.click(screen.getByRole('checkbox', { name: 'Matched only' }));

      expect(screen.getByRole('checkbox', { name: 'hasVulnerability' })).toBeChecked();
      expect(screen.getByRole('combobox', { name: /minSeverity/ })).toHaveValue('high');
      expect(new URLSearchParams(window.location.search).has('filters')).toBe(false);
      await user.click(screen.getByRole('button', { name: 'Run' }));
      expect(new URLSearchParams(window.location.search).get('hasVulnerability.minSeverity')).toBe('high');
    });

    it('restores Queries, parameter controls, results and view mode with Back and Forward', async () => {
      const user = userEvent.setup();
      server.use(http.get('*/api/routes', ({ request }) => HttpResponse.json(routesFixture(
        new URL(request.url).searchParams.has('filters') ? [entryRoutes[0]!] : entryRoutes,
      ))));
      renderWithQueryClient(<ExplorerPage />);
      await screen.findByText('2 Routes');
      await user.click(screen.getByRole('checkbox', { name: 'maxLength' }));
      await user.type(screen.getByRole('spinbutton', { name: 'hops' }), '2');
      await user.click(screen.getByRole('button', { name: 'Run' }));
      await screen.findByText('1 Route');
      await user.click(screen.getByRole('checkbox', { name: 'Matched only' }));

      const navigate = async (direction: 'back' | 'forward') => {
        await act(() => new Promise<void>((resolve) => {
          window.addEventListener('popstate', () => resolve(), { once: true });
          window.history[direction]();
        }));
      };
      await navigate('back');
      expect(screen.getByRole('checkbox', { name: 'Matched only' })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'maxLength' })).toBeChecked();
      await navigate('back');
      await screen.findByText('2 Routes');
      expect(screen.getByRole('checkbox', { name: 'maxLength' })).not.toBeChecked();
      expect(window.location.search).toBe('');
      await navigate('forward');
      await screen.findByText('1 Route');
      expect(screen.getByRole('checkbox', { name: 'maxLength' })).toBeChecked();
      expect(screen.getByRole('spinbutton', { name: 'hops' })).toHaveValue(2);
      await navigate('forward');
      expect(screen.getByRole('checkbox', { name: 'Matched only' })).toBeChecked();
      expect(window.location.search).toContain('view=matched');
    });

    it('runs the default Query from Entries on first load without URL params', async () => {
      const requests: string[] = [];
      server.use(http.get('*/api/routes', ({ request }) => {
        requests.push(new URL(request.url).search);
        return HttpResponse.json(routesFixture(entryRoutes));
      }));
      renderWithQueryClient(<ExplorerPage />);

      await screen.findByText('2 Routes');
      expect(requests).toEqual(['']);
      expect(screen.getByRole('checkbox', { name: 'startsAtPublic' })).not.toBeChecked();
      expect(screen.getByRole('spinbutton', { name: 'Limit' })).toHaveValue(100);
    });

    it('writes a changed Query and view to the URL, restores them on reload, and resets to defaults', async () => {
      const user = userEvent.setup();
      window.history.replaceState(null, '', '/explorer#graph');
      const page = renderWithQueryClient(<ExplorerPage />);
      await user.click(await screen.findByRole('checkbox', { name: 'passesThrough' }));
      await user.type(screen.getByRole('textbox', { name: 'node' }), 'auth-service');
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Limit' }), { target: { value: '7' } });
      await user.click(screen.getByRole('button', { name: 'Run' }));
      await screen.findByText('2 Routes');
      await user.click(screen.getByRole('checkbox', { name: 'Matched only' }));

      const search = new URLSearchParams(window.location.search);
      expect(search.get('filters')).toBe('passesThrough');
      expect(search.get('passesThrough.node')).toBe('auth-service');
      expect(search.get('limit')).toBe('7');
      expect(search.get('view')).toBe('matched');
      expect(window.location.pathname).toBe('/explorer');
      expect(window.location.hash).toBe('#graph');
      page.unmount();
      renderWithQueryClient(<ExplorerPage />);

      expect(await screen.findByRole('textbox', { name: 'node' })).toHaveValue('auth-service');
      expect(screen.getByRole('checkbox', { name: 'Matched only' })).toBeChecked();
      await user.click(screen.getByRole('button', { name: 'Reset' }));
      expect(window.location.search).toBe('');
      expect(screen.getByRole('checkbox', { name: 'passesThrough' })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Matched only' })).not.toBeChecked();
    });

    it('opens a shared Query with Filters, params, limit and matched view, and runs it on first load', async () => {
      window.history.replaceState(null, '', '/?filters=endsAtSink,hasVulnerability,maxLength&endsAtSink.kinds=rds&hasVulnerability.minSeverity=high&maxLength.hops=2&limit=7&view=matched');
      const requests: URLSearchParams[] = [];
      server.use(http.get('*/api/routes', ({ request }) => {
        requests.push(new URL(request.url).searchParams);
        return HttpResponse.json(routesFixture([entryRoutes[0]!], { limit: 7 }));
      }));
      renderWithQueryClient(<ExplorerPage />);

      await screen.findByText('1 Route');
      expect(requests[0]?.get('filters')).toBe('endsAtSink,hasVulnerability,maxLength');
      expect(requests[0]?.get('endsAtSink.kinds')).toBe('rds');
      expect(requests[0]?.get('hasVulnerability.minSeverity')).toBe('high');
      expect(requests[0]?.get('maxLength.hops')).toBe('2');
      expect(requests[0]?.get('limit')).toBe('7');
      expect(requests[0]?.has('view')).toBe(false);
      expect(screen.getByRole('checkbox', { name: 'endsAtSink' })).toBeChecked();
      expect(screen.getByRole('combobox', { name: /minSeverity/ })).toHaveValue('high');
      expect(screen.getByRole('spinbutton', { name: 'Limit' })).toHaveValue(7);
      expect(screen.getByRole('checkbox', { name: 'Matched only' })).toBeChecked();
      expect(screen.queryByRole('group', { name: 'assurance-service' })).not.toBeInTheDocument();
    });

    it.each([
      'filters=retiredFilter',
      'filters=startsAtPublic,startsAtPublic',
      'filters=hasVulnerability&hasVulnerability.minSeverity=urgent',
      'filters=maxLength&maxLength.hops=zero',
      'filters=passesThrough',
      'filters=endsAtSink&endsAtSink.retiredParam=rds',
      'maxLength.hops=2',
      'limit=1001',
      'limit=broken',
      'view=retiredView',
      'filters=startsAtPublic&filters=endsAtSink',
      'filters=maxLength&maxLength.hops=2&maxLength.hops=3',
      'unknown=value',
    ])('falls back to defaults with a non-blocking notice for ?%s', async (search) => {
      window.history.replaceState(null, '', `/?${search}`);
      const requests: string[] = [];
      server.use(http.get('*/api/routes', ({ request }) => {
        requests.push(new URL(request.url).search);
        return HttpResponse.json(routesFixture(entryRoutes));
      }));
      renderWithQueryClient(<ExplorerPage />);

      await screen.findByText('2 Routes');
      expect(requests).toEqual(['']);
      expect(screen.getByRole('status')).toHaveTextContent(/URL.*default Query/i);
      expect(screen.getByRole('checkbox', { name: 'startsAtPublic' })).not.toBeChecked();
      expect(screen.getByRole('spinbutton', { name: 'Limit' })).toHaveValue(100);
      expect(screen.getByRole('checkbox', { name: 'Matched only' })).not.toBeChecked();
      await userEvent.setup().click(screen.getByRole('button', { name: 'Reset' }));
      expect(window.location.search).toBe('');
      expect(screen.queryByText(/URL.*default Query/i)).not.toBeInTheDocument();
    });
  });

  describe('advanced Query tree', () => {
    const toBase64Url = (value: unknown) =>
      btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const fromBase64Url = (value: string): unknown =>
      JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))));

    /** Records POST bodies and answers with the default-wrapped Query as the effective Query. */
    const recordTreeRequests = () => {
      const bodies: unknown[] = [];
      server.use(http.post('*/api/routes/query', async ({ request }) => {
        const body: unknown = await request.json();
        bodies.push(body);
        const query = typeof body === 'object' && body !== null && 'query' in body ? body.query : undefined;
        const response = routesFixture([entryRoutes[0]!]);
        return HttpResponse.json({ ...response, meta: { ...response.meta, effectiveQuery: { and: [{ filter: 'startsAtEntry' }, query] } } });
      }));
      return bodies;
    };

    it('opens a shared `q` tree, posts it, shows the effective Query, and writes an edited tree back to the URL', async () => {
      const user = userEvent.setup();
      const tree = { or: [{ filter: 'passesThrough', params: { node: 'auth-service' } }, { not: { filter: 'hasVulnerability' } }] };
      window.history.replaceState(null, '', `/?q=${toBase64Url(tree)}&limit=5&view=matched`);
      const bodies = recordTreeRequests();
      renderWithQueryClient(<ExplorerPage />);

      await screen.findByText('1 Route');
      expect(bodies).toEqual([{ query: tree, limit: 5 }]);
      expect(screen.getByRole('checkbox', { name: 'Advanced' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Matched only' })).toBeChecked();
      expect(within(screen.getByRole('group', { name: 'passesThrough 1' })).getByRole('textbox', { name: 'node' })).toHaveValue('auth-service');
      expect(screen.getByRole('region', { name: 'Effective Query' })).toHaveTextContent('startsAtEntry');

      const node = within(screen.getByRole('group', { name: 'passesThrough 1' })).getByRole('textbox', { name: 'node' });
      await user.clear(node);
      await user.type(node, 'frontend');
      await user.click(screen.getByRole('button', { name: 'Run' }));

      const edited = { or: [{ filter: 'passesThrough', params: { node: 'frontend' } }, { not: { filter: 'hasVulnerability' } }] };
      await vi.waitFor(() => expect(bodies.at(-1)).toEqual({ query: edited, limit: 5 }));
      const search = new URLSearchParams(window.location.search);
      expect(fromBase64Url(search.get('q') ?? '')).toEqual(edited);
      expect(search.get('limit')).toBe('5');
      expect(search.get('view')).toBe('matched');
      expect(search.has('filters')).toBe(false);
    });

    it('"Show Routes through here" replaces the top-level passesThrough of a tree, keeping the rest', async () => {
      const user = userEvent.setup();
      const tree = { and: [{ filter: 'passesThrough', params: { node: 'frontend' } }, { not: { filter: 'hasVulnerability' } }] };
      window.history.replaceState(null, '', `/?q=${toBase64Url(tree)}`);
      const bodies = recordTreeRequests();
      renderWithQueryClient(<ExplorerPage />);
      await screen.findByText('1 Route');

      await clickNode('auth-service');
      await user.click(within(nodeDetails()).getByRole('button', { name: /show routes through here/i }));

      const expected = { and: [{ filter: 'passesThrough', params: { node: 'auth-service' } }, { not: { filter: 'hasVulnerability' } }] };
      await vi.waitFor(() => expect(bodies.at(-1)).toEqual({ query: expected, limit: 100 }));
      expect(fromBase64Url(new URLSearchParams(window.location.search).get('q') ?? '')).toEqual(expected);
    });

    it('runs the flat Query as an AND tree after switching to advanced, and Reset returns to the flat default', async () => {
      const user = userEvent.setup();
      window.history.replaceState(null, '', '/?filters=startsAtPublic');
      const bodies = recordTreeRequests();
      renderWithQueryClient(<ExplorerPage />);
      await screen.findByText('2 Routes');

      await user.click(screen.getByRole('checkbox', { name: 'Advanced' }));
      await user.click(screen.getByRole('button', { name: 'Run' }));

      await screen.findByText('1 Route');
      expect(bodies).toEqual([{ query: { and: [{ filter: 'startsAtPublic' }] }, limit: 100 }]);
      expect(fromBase64Url(new URLSearchParams(window.location.search).get('q') ?? '')).toEqual({ and: [{ filter: 'startsAtPublic' }] });

      await user.click(screen.getByRole('button', { name: 'Reset' }));
      expect(window.location.search).toBe('');
      expect(screen.getByRole('checkbox', { name: 'Advanced' })).not.toBeChecked();
    });

    it.each([
      ['not base64url', 'q=%%%'],
      ['not JSON', `q=${btoa('{').replace(/=+$/, '')}`],
      ['not a Query', `q=${toBase64Url({ xor: [] })}`],
      ['an unknown Filter', `q=${toBase64Url({ and: [{ filter: 'retiredFilter' }] })}`],
      ['invalid params', `q=${toBase64Url({ and: [{ filter: 'maxLength', params: { hops: 0 } }] })}`],
      ['flat Filters as well', `q=${toBase64Url({ and: [] })}&filters=startsAtPublic`],
    ])('falls back to defaults for a `q` with %s', async (_, search) => {
      window.history.replaceState(null, '', `/?${search}`);
      const bodies = recordTreeRequests();
      const requests: string[] = [];
      server.use(http.get('*/api/routes', ({ request }) => {
        requests.push(new URL(request.url).search);
        return HttpResponse.json(routesFixture(entryRoutes));
      }));
      renderWithQueryClient(<ExplorerPage />);

      await screen.findByText('2 Routes');
      expect(requests).toEqual(['']);
      expect(bodies).toEqual([]);
      expect(screen.getByRole('status')).toHaveTextContent(/URL.*default Query/i);
      expect(screen.getByRole('checkbox', { name: 'Advanced' })).not.toBeChecked();
    });
  });

  describe('Route highlights', () => {
    it('preserves selection after an error removes the hovered row and a retry restores it', async () => {
      const user = userEvent.setup();
      let failing = false;
      server.use(http.get('*/api/routes', () => failing
        ? HttpResponse.json({ type: 'about:blank', title: 'Internal Server Error', status: 500 }, { status: 500 })
        : HttpResponse.json(routesFixture(entryRoutes)),
      ));
      renderWithQueryClient(<ExplorerPage />);
      const [first, second] = await routeButtons();
      if (!first || !second) throw new Error('Expected two Routes');
      await user.click(first);

      const run = screen.getByRole('button', { name: /run/i });
      for (let i = 0; i < 30 && document.activeElement !== run; i++) await user.tab();
      expect(run).toHaveFocus();
      await user.hover(second);
      expect(await findNode('auth-service')).toHaveAttribute('data-highlighted', 'false');

      failing = true;
      await user.keyboard('{Enter}');
      const list = screen.getByRole('region', { name: /^routes/i });
      await within(list).findByRole('alert');
      expect(second).not.toBeInTheDocument();
      await user.hover(within(list).getByRole('heading', { name: 'Routes' }));

      failing = false;
      await user.click(run);

      await within(list).findByText('2 Routes');
      expect(within(list).getByRole('button', { name: 'Route: frontend → auth-service → prod-postgresdb' }))
        .toHaveAttribute('aria-pressed', 'true');
      expect(await findNode('auth-service')).toHaveAttribute('data-highlighted', 'true');
      expect(await findNode('assurance-service')).toHaveAttribute('data-highlighted', 'false');
      expect(await findEdge('frontend->assurance-service')).toHaveAttribute('data-highlighted', 'false');
    });

    it('preserves the selected Route when a hovered Route disappears and returns after Query reset', async () => {
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

      await user.hover(screen.getByRole('heading', { name: 'Routes' }));
      await user.click(screen.getByRole('button', { name: /reset/i }));

      await screen.findByText('3 Routes');
      expect(first).toHaveAttribute('aria-pressed', 'true');
      expect(await findNode('auth-service')).toHaveAttribute('data-highlighted', 'true');
      expect(await findNode('assurance-service')).toHaveAttribute('data-highlighted', 'false');
      expect(await findEdge('frontend->assurance-service')).toHaveAttribute('data-highlighted', 'false');
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
    expect(frontend).toHaveAttribute('data-entry', 'true');
    expect(within(frontend).getByText('public')).toBeInTheDocument();

    const auth = await findNode('auth-service');
    expect(auth).toHaveAttribute('data-entry', 'false');
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
    for (const label of ['public', 'critical', 'high', 'medium', 'low', 'unknown', 'Service', 'Entry', 'Sink', 'Inferred Node']) {
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

  describe('dragging nodes', () => {
    const dragNode = async (name: string, by: { x: number; y: number }) => {
      const group = await nodeGroup(name);
      mouse(group, 'mousedown', 0, 0);
      mouse(window, 'mousemove', by.x / 2, by.y / 2);
      mouse(window, 'mousemove', by.x, by.y);
      // A user releases in a later task. Releasing in this one races React Flow's auto-pan, which then never stops.
      await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
      mouse(window, 'mouseup', by.x, by.y);
    };

    it('keeps a dragged node where it was dropped after a Query change, without selecting it', async () => {
      const user = userEvent.setup();
      renderWithQueryClient(<ExplorerPage />);
      const group = await nodeGroup('auth-service');
      await vi.waitFor(() => expect(group.style.transform).toMatch(/translate/));
      const before = group.style.transform;

      await dragNode('auth-service', { x: 300, y: 200 });

      await vi.waitFor(() => expect(group.style.transform).not.toBe(before));
      const dropped = group.style.transform;
      expect(screen.queryByRole('region', { name: /node details/i })).not.toBeInTheDocument();

      await user.click(await screen.findByRole('checkbox', { name: 'startsAtPublic' }));
      await user.click(screen.getByRole('button', { name: /run/i }));
      await vi.waitFor(() => expect(window.location.search).toContain('startsAtPublic'));

      expect((await nodeGroup('auth-service')).style.transform).toBe(dropped);
    });

    it('shows a MiniMap of the graph and the current viewport', async () => {
      renderWithQueryClient(<ExplorerPage />);
      await nodeGroup('auth-service');

      const minimap = await screen.findByRole('img', { name: /service graph overview/i });
      expect(minimap.querySelectorAll('.react-flow__minimap-node')).toHaveLength(4);
      expect(minimap.querySelector('.react-flow__minimap-mask')).toBeInTheDocument();
    });
  });

  describe('Matched only relayout', () => {
    const viewport = () => {
      const element = screen.getByRole('region', { name: /service graph/i }).querySelector<HTMLElement>('.react-flow__viewport');
      if (!element) throw new Error('No viewport');
      return element;
    };
    /** One Route through a chain: lays out differently from the full graph, where `assurance-service` sits beside `auth-service`. */
    const renderOneRoute = async () => {
      server.use(http.get('*/api/routes', () => HttpResponse.json(routesFixture([entryRoutes[0]!]))));
      renderWithQueryClient(<ExplorerPage />);
      await screen.findByText('1 Route');
      const group = await nodeGroup('auth-service');
      // The canvas is measured in a later frame, which lays the graph out again for its aspect ratio.
      await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      await vi.waitFor(() => expect(group.style.transform).toMatch(/translate/));
      return group;
    };

    it('lays out only the matched nodes and refits the view, then restores the full-graph layout', async () => {
      const user = userEvent.setup();
      const group = await renderOneRoute();
      const full = group.style.transform;
      await vi.waitFor(() => expect(viewport().style.transform).toMatch(/translate/));
      const fullView = viewport().style.transform;

      await user.click(screen.getByRole('checkbox', { name: 'Matched only' }));

      await vi.waitFor(() => expect(group.style.transform).not.toBe(full));
      await vi.waitFor(() => expect(viewport().style.transform).not.toBe(fullView));

      await user.click(screen.getByRole('checkbox', { name: 'Matched only' }));

      await vi.waitFor(async () => expect((await nodeGroup('auth-service')).style.transform).toBe(full));
      await vi.waitFor(() => expect(viewport().style.transform).toBe(fullView));
    });

    it('clears dragged positions when Matched only relayouts, in either direction', async () => {
      const user = userEvent.setup();
      const toggle = () => user.click(screen.getByRole('checkbox', { name: 'Matched only' }));
      const transform = async () => (await nodeGroup('auth-service')).style.transform;
      const drag = async () => {
        const before = await transform();
        mouse(await nodeGroup('auth-service'), 'mousedown', 0, 0);
        mouse(window, 'mousemove', 150, 100);
        mouse(window, 'mousemove', 300, 200);
        await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
        mouse(window, 'mouseup', 300, 200);
        await vi.waitFor(async () => expect(await transform()).not.toBe(before));
      };
      const full = (await renderOneRoute()).style.transform;
      await toggle();
      await vi.waitFor(async () => expect(await transform()).not.toBe(full));
      const matched = await transform();
      await toggle();
      await vi.waitFor(async () => expect(await transform()).toBe(full));

      await drag();
      await toggle();
      await vi.waitFor(async () => expect(await transform()).toBe(matched));

      await drag();
      await toggle();
      await vi.waitFor(async () => expect(await transform()).toBe(full));
    });
  });

  describe('canvas resize', () => {
    const resize = (aspect: number) => act(() => {
      resizeElement(screen.getByRole('region', { name: 'Service graph' }), aspect * 500, 500);
    });
    const renderCanvas = async (matchedOnly = false) => {
      if (matchedOnly) {
        window.history.replaceState(null, '', '/?view=matched');
        const extraNodes = Array.from({ length: 8 }, (_, i) => ({
          id: `extra-${i}`, data: { ...graphFixture.nodes[3]!.data, name: `extra-${i}` },
        }));
        server.use(http.get('*/api/graph', () => HttpResponse.json({
          ...graphFixture,
          nodes: [...graphFixture.nodes, ...extraNodes],
          edges: [...graphFixture.edges, ...extraNodes.map(({ id }) => ({ id: `frontend->${id}`, source: 'frontend', target: id }))],
        })));
      }
      server.use(http.get('*/api/routes', () => HttpResponse.json(routesFixture([entryRoutes[1]!]))));
      renderWithQueryClient(<ExplorerPage />);
      await screen.findByText('1 Route');
      const group = await nodeGroup('assurance-service');
      await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      resize(1);
      return group;
    };

    it('moves handles with the layout direction in both directions', async () => {
      const group = await renderCanvas();
      expect(group.querySelector('.target')).toHaveAttribute('data-handlepos', 'top');
      expect(group.querySelector('.source')).toHaveAttribute('data-handlepos', 'bottom');

      resize(5);
      await vi.waitFor(() => expect(group.querySelector('.target')).toHaveAttribute('data-handlepos', 'left'));
      expect(group.querySelector('.source')).toHaveAttribute('data-handlepos', 'right');

      resize(1);
      await vi.waitFor(() => expect(group.querySelector('.target')).toHaveAttribute('data-handlepos', 'top'));
      expect(group.querySelector('.source')).toHaveAttribute('data-handlepos', 'bottom');
    });

    it('relayouts and refits when only the matched subgraph crosses its direction threshold', async () => {
      const group = await renderCanvas(true);
      const before = group.style.transform;
      const viewport = screen.getByRole('region', { name: 'Service graph' }).querySelector<HTMLElement>('.react-flow__viewport');
      await vi.waitFor(() => expect(viewport?.style.transform).toMatch(/translate/));
      const beforeView = viewport?.style.transform;

      resize(2.5);

      await vi.waitFor(() => expect(group.style.transform).not.toBe(before));
      await vi.waitFor(() => expect(viewport?.style.transform).not.toBe(beforeView));
      expect(group.querySelector('.target')).toHaveAttribute('data-handlepos', 'left');
    });

    it('keeps dragged positions for ordinary resizes and clears them when the layout flips', async () => {
      const group = await renderCanvas();
      const vertical = group.style.transform;
      resize(5);
      await vi.waitFor(() => expect(group.style.transform).not.toBe(vertical));
      const horizontal = group.style.transform;
      resize(1);
      await vi.waitFor(() => expect(group.style.transform).toBe(vertical));

      for (const [aspect, expected] of [[5, horizontal], [1, vertical]] as const) {
        const before = group.style.transform;
        mouse(group, 'mousedown', 0, 0);
        mouse(window, 'mousemove', 150, 100);
        mouse(window, 'mousemove', 300, 200);
        await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
        mouse(window, 'mouseup', 300, 200);
        await vi.waitFor(() => expect(group.style.transform).not.toBe(before));
        const dropped = group.style.transform;
        resize(aspect === 5 ? 1.1 : 5.1);
        expect(group.style.transform).toBe(dropped);

        resize(aspect);
        await vi.waitFor(() => expect(group.style.transform).toBe(expected));
      }
    });

    it('renders a node named __proto__ with finite coordinates before it is dragged', async () => {
      const graph = {
        ...graphFixture,
        nodes: graphFixture.nodes.map((node) => node.id === 'frontend'
          ? { ...node, id: '__proto__', data: { ...node.data, name: '__proto__' } } : node),
        edges: graphFixture.edges.map((edge) => edge.source === 'frontend' ? { ...edge, source: '__proto__' } : edge),
      };
      server.use(http.get('*/api/graph', () => HttpResponse.json(graph)));
      renderWithQueryClient(<ExplorerPage />);

      const group = await nodeGroup('__proto__');
      await vi.waitFor(() => expect(group.style.transform).toMatch(/^translate\(\d+(\.\d+)?px,\s*\d+(\.\d+)?px\)$/));
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
      const { released, release } = deferred();
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
