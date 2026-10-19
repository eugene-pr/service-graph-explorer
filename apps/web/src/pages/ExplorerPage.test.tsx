import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../test/server';
import { renderWithQueryClient } from '../test/render';
import { ExplorerPage } from './ExplorerPage';

describe('ExplorerPage', () => {
  it("shows the API's health status", async () => {
    server.use(http.get('*/health', () => HttpResponse.json({ status: 'ok' })));

    renderWithQueryClient(<ExplorerPage />);

    expect(await screen.findByText('API: ok')).toBeInTheDocument();
  });
});
