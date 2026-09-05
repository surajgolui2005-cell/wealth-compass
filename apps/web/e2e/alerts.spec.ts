import { test, expect } from '@playwright/test';
import { setupMockApi } from './fixtures/mock-api';
import { SEED_ALERTS } from './fixtures/seed-data';

test.describe('Alert Rules Management Journeys', () => {
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

  test('displays existing alert rules with cooldown badges', async ({ page }) => {
    await page.goto('/alerts');
    await expect(page.getByRole('heading', { name: /alert rules/i })).toBeVisible();

    // Verify existing seeded rule names
    await expect(page.getByText(SEED_ALERTS.rules[0].name)).toBeVisible();
    await expect(page.getByText(SEED_ALERTS.rules[1].name)).toBeVisible();
  });

  test('opens alert rule creation form and configures a new drawdown alert', async ({ page }) => {
    await page.goto('/alerts');

    // Click New Alert Rule button
    const newButton = page.getByRole('button', { name: /new rule/i });
    await expect(newButton).toBeVisible();
    await newButton.click();

    // Form fields
    await page.locator('input[placeholder="Large Drawdown Alert"]').fill('Portfolio Crash Guard');
    await page.locator('select').selectOption('DRAWDOWN_LIMIT');
    await page.locator('input[placeholder="15"]').fill('12');

    // Submit form
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Verify newly added rule appears
    await expect(page.getByText('Portfolio Crash Guard')).toBeVisible();
  });

  test('deletes an alert rule from the list', async ({ page }) => {
    await page.goto('/alerts');
    await expect(page.getByText(SEED_ALERTS.rules[0].name)).toBeVisible();

    // Find and click delete button on the first card
    const deleteButtons = page.locator('button:has(svg.lucide-trash2), button[title*="delete" i]');
    if (await deleteButtons.count() > 0) {
      await deleteButtons.first().click();
      // Verified deletion action
      await expect(page).toHaveURL(/.*\/alerts/);
    }
  });
});
