import { screen, within } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
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

  it('shows the load warnings in a banner', async () => {
    renderWithQueryClient(<ExplorerPage />);

    const banner = await screen.findByRole('region', { name: /data warnings/i });
    expect(within(banner).getByText(/"assurance-service" is referenced by an edge/)).toBeInTheDocument();
  });

  it('shows no warnings banner when the data has none', async () => {
    server.use(
      http.get('*/api/graph', () => HttpResponse.json({ nodes: [], edges: [], meta: { warnings: [] } })),
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
});
