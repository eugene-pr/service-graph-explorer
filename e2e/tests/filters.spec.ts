import { expect, test } from '@playwright/test';
import { RoutesResponse } from '../../packages/domain/src/index.js';

const cases = [
  { filter: 'startsAtEntry', params: {} },
  { filter: 'startsAtPublic', params: {} },
  { filter: 'endsAtSink', params: { 'endsAtSink.kinds': 'rds' } },
  { filter: 'hasVulnerability', params: { 'hasVulnerability.minSeverity': 'high' } },
  { filter: 'passesThrough', params: { 'passesThrough.node': 'auth-service' } },
  { filter: 'maxLength', params: { 'maxLength.hops': '1' } },
] satisfies { filter: string; params: Record<string, string> }[];

// Engine tests establish which Routes match; these checks exercise the real UI/API connection.
for (const { filter, params } of cases) {
  test(`${filter} runs with its parameters, survives reload, and resets`, async ({ page, request }) => {
    const query = new URLSearchParams({ filters: filter, ...params });
    const response = await request.get(`/api/routes?${query.toString()}`);
    expect(response.ok()).toBe(true);
    const expected = RoutesResponse.parse(await response.json());
    expect(expected.routes.length).toBeGreaterThan(0);

    await page.goto('/');
    await page.getByRole('checkbox', { name: filter, exact: true }).check();
    if (filter === 'endsAtSink') {
      await page.getByRole('group', { name: 'kinds (optional)' }).getByRole('checkbox', { name: 'rds', exact: true }).check();
    } else if (filter === 'hasVulnerability') {
      await page.getByRole('combobox', { name: 'minSeverity (optional)' }).selectOption('high');
    } else if (filter === 'passesThrough') {
      await page.getByRole('textbox', { name: 'node', exact: true }).fill('auth-service');
    } else if (filter === 'maxLength') {
      await page.getByRole('spinbutton', { name: 'hops', exact: true }).fill('1');
    }
    await page.getByRole('button', { name: 'Run', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('filters')).toBe(filter);
    for (const [name, value] of Object.entries(params)) {
      expect(new URL(page.url()).searchParams.get(name)).toBe(value);
    }

    const routes = page.getByRole('region', { name: 'Routes', exact: true }).getByRole('button', { name: /^Route: / });
    const labels = expected.routes.map((route) => `Route: ${route.join(' → ')}`);
    const routeLabels = async () => Promise.all((await routes.all()).map((route) => route.getAttribute('aria-label')));
    await expect.poll(routeLabels).toEqual(labels);

    await page.reload();
    await expect(page.getByRole('checkbox', { name: filter, exact: true })).toBeChecked();
    await expect.poll(routeLabels).toEqual(labels);

    await page.getByRole('button', { name: 'Reset', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: filter, exact: true })).not.toBeChecked();
    await expect.poll(() => new URL(page.url()).searchParams.has('filters')).toBe(false);
  });
}

test('invalid maxLength is explained before sending the Query', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('checkbox', { name: 'maxLength', exact: true }).check();
  await page.getByRole('spinbutton', { name: 'hops', exact: true }).fill('0');
  const requests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/routes') requests.push(request.url());
  });
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('maxLength.hops');
  expect(requests).toEqual([]);
  expect(new URL(page.url()).searchParams.has('filters')).toBe(false);
});

test('the three required Filters explain their empty intersection and offer recovery', async ({ page }) => {
  await page.goto('/');
  for (const filter of ['startsAtPublic', 'endsAtSink', 'hasVulnerability']) {
    await page.getByRole('checkbox', { name: filter, exact: true }).check();
  }
  await page.getByRole('button', { name: 'Run', exact: true }).click();
  const results = page.getByRole('region', { name: 'Routes', exact: true });
  await expect(results.getByText('0 Routes', { exact: true })).toBeVisible();
  await expect(results.getByText('No Routes match this Query.', { exact: true })).toBeVisible();
  for (const filter of ['startsAtPublic', 'endsAtSink', 'hasVulnerability']) {
    await expect(results.getByRole('button', { name: new RegExp(`^${filter} only.*: [1-9]\\d* Routes?$`) })).toBeVisible();
  }
  await results.getByRole('button', { name: /^startsAtPublic only:/ }).click();
  await expect(results.getByRole('button', { name: /^Route: / }).first()).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'endsAtSink', exact: true })).not.toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'hasVulnerability', exact: true })).not.toBeChecked();
});
