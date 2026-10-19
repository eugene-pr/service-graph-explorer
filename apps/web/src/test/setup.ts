import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { useUiStore } from '../store/uiStore';
import { stubReactFlowDom } from './reactFlowStubs';
import { server } from './server';

stubReactFlowDom();

const initialUiState = useUiStore.getState();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/');
  server.resetHandlers();
  useUiStore.setState(initialUiState, true);
});
afterAll(() => server.close());
