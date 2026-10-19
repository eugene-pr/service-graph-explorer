import { defineConfig, devices } from '@playwright/test';

// Runs against the production build: the root `pnpm e2e` builds first.
// Ports away from the dev defaults, so a running `pnpm dev` is never reused.
const apiPort = 3100;
const webPort = 4180;
const apiUrl = `http://127.0.0.1:${apiPort}`;
const webUrl = `http://127.0.0.1:${webPort}`;

export default defineConfig({
  testDir: 'tests',
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: { baseURL: webUrl },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @sge/api start',
      env: { PORT: String(apiPort) },
      url: `${apiUrl}/health`,
      reuseExistingServer: false,
    },
    {
      // `vite preview` reuses the dev server's /api proxy, pointed at the API above.
      command: `pnpm --filter @sge/web preview --port ${webPort} --strictPort --host 127.0.0.1`,
      env: { API_URL: apiUrl },
      url: webUrl,
      reuseExistingServer: false,
    },
  ],
});
