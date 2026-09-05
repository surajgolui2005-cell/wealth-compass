import { test, expect } from '@playwright/test';
import { setupMockApi } from './fixtures/mock-api';
import { SEED_PORTFOLIOS } from './fixtures/seed-data';

test.describe('Portfolio Management Journeys', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupMockApi(page);
    await context.addCookies([
      {
        name: 'refresh_token',
        value: 'mock-refresh-token',
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('lists all user portfolios with summary stats', async ({ page }) => {
    await page.goto('/portfolios');
    await expect(page.getByRole('heading', { name: /portfolios/i })).toBeVisible();

    // Verify seeded portfolio names
    await expect(page.getByText(SEED_PORTFOLIOS[0].name)).toBeVisible();
    await expect(page.getByText(SEED_PORTFOLIOS[1].name)).toBeVisible();
  });

  test('toggles and submits new portfolio creation form', async ({ page }) => {
    await page.goto('/portfolios');

    // Click New Portfolio button
    const newButton = page.getByRole('button', { name: /new portfolio/i });
    await expect(newButton).toBeVisible();
    await newButton.click();

    // Fill form
    await page.locator('input[placeholder="My Growth Portfolio"]').fill('Alpha Momentum Strategy');
    await page.locator('input[placeholder="INR"]').fill('INR');
    await page.locator('input[placeholder="Long-term equity investments"]').fill('High momentum equity picks');

    // Submit
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Verify created item appears
    await expect(page.getByText('Alpha Momentum Strategy')).toBeVisible();
  });

  test('drills down to portfolio detail and renders holdings table', async ({ page }) => {
    await page.goto('/portfolios');

    // Click on the first portfolio
    const portfolioCard = page.locator(`a[href="/portfolios/${SEED_PORTFOLIOS[0].id}"]`);
    await expect(portfolioCard).toBeVisible();
    await portfolioCard.click();
    await expect(page).toHaveURL(/.*\/portfolios\/p-seed-001/);

    // Verify holdings table symbols
    await expect(page.getByText('RELIANCE')).toBeVisible();
    await expect(page.getByText('TCS')).toBeVisible();
    await expect(page.getByText('HDFCBANK')).toBeVisible();
    await expect(page.getByText('GOLDBEES')).toBeVisible();
  });
});
