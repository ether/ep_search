import {expect, test} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.goto('http://localhost:9001/');
});

test.describe('ep_search', () => {
  test('index page renders the search panel', async ({page}) => {
    await expect(page.locator('#ep-search-panel')).toBeVisible();
    await expect(page.locator('#ep-search-input')).toBeVisible();
  });

  test('renders search results as a proper list of links', async ({page}) => {
    await page.route('**/search/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(['pad:first', 'pad:second']),
      });
    });

    await expect(page.locator('#ep-search-input')).toBeVisible();
    await page.locator('#ep-search-input').fill('needle');
    await page.locator('#ep-search-submit').click();

    const items = page.locator('#ep-search-results li');
    await expect(items).toHaveCount(2);
    await expect(items.nth(0).locator('a')).toHaveAttribute('href', '/p/first');
    await expect(items.nth(0).locator('a')).toHaveText('first');
    await expect(items.nth(1).locator('a')).toHaveAttribute('href', '/p/second');
    await expect(page.locator('#ep-search-status')).toContainText('Matching pads: 2');
  });
});
