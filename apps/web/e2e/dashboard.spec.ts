import { test, expect } from '@playwright/test';
import { setupMockApi } from './fixtures/mock-api';

test.describe('Dashboard Journeys', () => {
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

  test('renders dashboard overview header and stat cards', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /overview/i })).toBeVisible();
    await expect(page.getByText(/your portfolio snapshot at a glance/i)).toBeVisible();

    // Verify presence of KPI cards
    await expect(page.getByText('Total Portfolio Value')).toBeVisible();
    await expect(page.getByText('Day P&L')).toBeVisible();
    await expect(page.getByText('Unrealised Gain')).toBeVisible();
    await expect(page.getByText('Risk Score')).toBeVisible();
  });

  test('navigates via quick links to feature areas', async ({ page }) => {
    await page.goto('/dashboard');

    // Click Portfolios link
    const portfoliosLink = page.locator('main a[href="/portfolios"]');
    await expect(portfoliosLink).toBeVisible();
    await Promise.all([
      page.waitForURL(/.*\/portfolios/, { timeout: 15000 }),
      portfoliosLink.click(),
    ]);

    // Return to dashboard
    await page.goto('/dashboard');
    const riskLink = page.locator('main a[href="/risk"]');
    await expect(riskLink).toBeVisible();
    await Promise.all([
      page.waitForURL(/.*\/risk/, { timeout: 15000 }),
      riskLink.click(),
    ]);
  });

  test('displays recent activity live feed card', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('Recent Activity')).toBeVisible();
    await expect(page.getByText('Live')).toBeVisible();
  });
});
