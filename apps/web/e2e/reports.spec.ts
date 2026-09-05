import { test, expect } from '@playwright/test';
import { setupMockApi } from './fixtures/mock-api';
import { SEED_PORTFOLIOS } from './fixtures/seed-data';

test.describe('Reporting Engine Journeys (PDF & CSV)', () => {
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

  test('submits async PDF report generation request and polls for completion', async ({ page }) => {
    await page.goto('/portfolios');
    await expect(page.getByText(SEED_PORTFOLIOS[0].name)).toBeVisible();

    // Trigger PDF generation API from page context
    const response = await page.evaluate(async (portfolioId) => {
      const res = await fetch('/api/v1/reports/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioId,
          reportType: 'PORTFOLIO_SUMMARY',
        }),
      });
      return { status: res.status, data: await res.json() };
    }, SEED_PORTFOLIOS[0].id);

    expect(response.status).toBe(202);
    expect(response.data.data.status).toBe('PENDING');
    const reportId = response.data.data.reportId;

    // Poll status endpoint
    const statusResponse = await page.evaluate(async (id) => {
      const res = await fetch(`/api/v1/reports/${id}/status`);
      return res.json();
    }, reportId);

    expect(statusResponse.data.status).toBe('COMPLETED');
  });

  test('downloads synchronous RFC 4180 CSV report stream', async ({ page }) => {
    await page.goto('/portfolios');

    // Trigger CSV export request
    const csvResponse = await page.evaluate(async (portfolioId) => {
      const res = await fetch('/api/v1/reports/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portfolioId,
          reportType: 'PORTFOLIO_SUMMARY',
        }),
      });
      return {
        status: res.status,
        contentType: res.headers.get('content-type'),
        text: await res.text(),
      };
    }, SEED_PORTFOLIOS[0].id);

    expect(csvResponse.status).toBe(200);
    expect(csvResponse.contentType).toContain('text/csv');
    // Confirm CSV headers and content
    expect(csvResponse.text).toContain('Symbol');
    expect(csvResponse.text).toContain('Quantity');
    expect(csvResponse.text).toContain('RELIANCE');
  });
});
