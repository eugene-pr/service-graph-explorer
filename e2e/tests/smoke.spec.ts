import { expect, test } from '@playwright/test';

test('turning on endsAtSink lists Routes and hovering one highlights its nodes', async ({ page }) => {
  await page.goto('/');

  const nodes = page.locator('[data-node]');
  await expect(nodes.first()).toBeVisible();

  await page.getByRole('checkbox', { name: 'endsAtSink' }).check();
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(page).toHaveURL(/filters=endsAtSink/);

  const routes = page.getByRole('region', { name: 'Routes' }).getByRole('button', { name: /^Route: / });
  await expect(routes.first()).toBeVisible();

  const route = routes.first();
  const label = (await route.getAttribute('aria-label')) ?? '';
  const routeNodes = label.replace(/^Route: /, '').split(' → ');
  expect(routeNodes.length).toBeGreaterThan(1);

  await route.hover();
  for (const name of routeNodes) {
    await expect(page.locator(`[data-node="${name}"]`)).toHaveAttribute('data-highlighted', 'true');
  }
  const offRoute = nodes.and(page.locator('[data-highlighted="false"]'));
  await expect(offRoute.first()).toBeAttached();
});
