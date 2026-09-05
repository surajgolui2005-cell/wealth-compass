import { test, expect } from '@playwright/test';
import { setupMockApi } from './fixtures/mock-api';

test.describe('Analytics and Quantitative Risk Visualization Journeys', () => {
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

  test('renders Analytics page with performance metrics and benchmark charts', async ({ page }) => {
    await page.goto('/analytics');
    await expect(page.getByRole('heading', { name: /analytics/i })).toBeVisible();
    await expect(page.getByText('Quant Engine v1')).toBeVisible();

    // Verify key performance metric cards
    await expect(page.getByText('Time-Weighted Return')).toBeVisible();
    await expect(page.getByText('XIRR (Annualised)')).toBeVisible();
    await expect(page.getByText('Sharpe Ratio')).toBeVisible();
    await expect(page.getByText('Sortino Ratio')).toBeVisible();
    await expect(page.getByText('Alpha vs NIFTY 50')).toBeVisible();
    await expect(page.getByText('Beta vs NIFTY 50')).toBeVisible();

    // Verify chart containers exist
    await expect(page.getByText('Portfolio Equity Curve')).toBeVisible();
    await expect(page.getByText(/Portfolio vs NIFTY 50/i)).toBeVisible();
  });

  test('renders Risk Center with VaR, CVaR, Drawdown, and Diversification charts', async ({ page }) => {
    await page.goto('/risk');
    await expect(page.getByRole('heading', { name: /risk center/i })).toBeVisible();

    // Verify risk metric cards
    await expect(page.getByText('Value at Risk (95%, 1D)')).toBeVisible();
    await expect(page.getByText('CVaR (95%, 1D)')).toBeVisible();
    await expect(page.getByText('Max Drawdown')).toBeVisible();
    await expect(page.getByText('Annualised Volatility')).toBeVisible();
    await expect(page.getByText('Portfolio Risk Score')).toBeVisible();
    await expect(page.getByText('Diversification Score')).toBeVisible();

    // Verify visual chart containers
    await expect(page.getByText('Historical Drawdown')).toBeVisible();
    await expect(page.getByText('Asset Allocation')).toBeVisible();
    await expect(page.getByText('Asset Correlation Matrix')).toBeVisible();
  });
});
