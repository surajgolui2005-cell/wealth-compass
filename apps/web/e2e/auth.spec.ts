import { test, expect } from '@playwright/test';
import { setupMockApi } from './fixtures/mock-api';
import { SEED_USER } from './fixtures/seed-data';

test.describe('Authentication Journeys', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page, { isAuthenticated: false });
  });

  test('redirects unauthenticated user from protected dashboard to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/.*\/login/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('displays validation error for invalid email format', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input#email', 'invalid-email');
    await page.fill('input#password', 'SomePassword123!');
    await page.click('button[type="submit"]');

    await expect(page.getByText(/enter a valid email address/i)).toBeVisible();
  });

  test('displays server error for invalid password credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input#email', SEED_USER.email);
    await page.fill('input#password', 'WrongPassword123!');
    await page.click('button[type="submit"]');

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test('successfully logs in with valid credentials and redirects to dashboard', async ({ page, context }) => {
    await page.goto('/login');
    await page.fill('input#email', SEED_USER.email);
    await page.fill('input#password', SEED_USER.password);

    // Set the refresh cookie so the SSR layout allows entry
    await context.addCookies([
      {
        name: 'refresh_token',
        value: 'mock-refresh-token',
        domain: 'localhost',
        path: '/',
      },
    ]);

    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('navigates to register page and verifies registration form elements', async ({ page }) => {
    await page.goto('/login');
    const registerLink = page.locator('a[href="/register"]');
    await expect(registerLink).toBeVisible();
    await Promise.all([
      page.waitForURL(/.*\/register/, { timeout: 15000 }),
      registerLink.click(),
    ]);
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    await expect(page.locator('input#email')).toBeVisible();
    await expect(page.locator('input#password')).toBeVisible();
  });
});
