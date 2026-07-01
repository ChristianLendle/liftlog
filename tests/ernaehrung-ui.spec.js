// @ts-check
const { test, expect } = require('@playwright/test');
const { sbMock } = require('./sb-mock');

async function setup(page) {
  await page.addInitScript(sbMock);
  await page.addInitScript(() => {
    localStorage.removeItem('liftlog_meals_v1');
    localStorage.removeItem('liftlog_fooddb_v1');
  });
  await page.setViewportSize({ width: 1000, height: 820 });   // Desktop → Top-Nav
  await page.goto('/');
  await page.waitForSelector('#login-gate', { state: 'hidden' });
  await page.waitForSelector('#fab-pill');
}

test.describe('Ernährung-UI + Nav-Umbau', () => {

  test('Nav: Training-Tab bündelt Sessions | Fortschritt via Segmented Control', async ({ page }) => {
    await setup(page);
    await page.click('#nav-train');
    await expect(page.locator('#view-sessions')).toBeVisible();
    await expect(page.locator('#train-seg')).toBeVisible();
    await expect(page.locator('.tseg[data-seg="sessions"]')).toHaveClass(/active/);
    await expect(page.locator('#nav-train')).toHaveClass(/active/);

    await page.click('.tseg[data-seg="progress"]');
    await expect(page.locator('#view-progress')).toBeVisible();
    await expect(page.locator('#nav-train')).toHaveClass(/active/);   // Tab bleibt „Training"
  });

  test('Essen-Tab: Mahlzeit manuell anlegen, loggen, erscheint im Tageslog', async ({ page }) => {
    await setup(page);
    await page.click('#nav-ernaehrung');
    await expect(page.locator('#view-ernaehrung')).toBeVisible();
    await expect(page.locator('#meal-day-label')).toHaveText('Heute');

    // Frühstück → hinzufügen
    await page.click('[data-act="openMealAdd"][data-arg="breakfast"]');
    await expect(page.locator('#m-meal-add')).toBeVisible();

    // Manuell anlegen
    await page.click('[data-act="mealAddShowManual"]');
    await page.fill('#mm-name', 'Testbowl');
    await page.fill('#mm-kcal', '200');
    await page.fill('#mm-p', '10');
    await page.fill('#mm-c', '20');
    await page.fill('#mm-f', '5');
    await page.click('[data-act="mealAddCreateManual"]');

    // Menge-Modus: 100 g → 200 kcal
    await expect(page.locator('#meal-add-selname')).toHaveText('Testbowl');
    await page.fill('#meal-add-grams', '100');
    await expect(page.locator('#meal-add-kcal')).toHaveText('200');
    await page.click('[data-act="mealAddConfirm"]');

    // Modal zu, Eintrag im Log
    await expect(page.locator('#m-meal-add')).not.toBeVisible();
    await expect(page.locator('#meal-log')).toContainText('Testbowl');
    await expect(page.locator('#meal-log')).toContainText('200 kcal');

    // persistiert (eingefrorene Werte)
    const meals = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_meals_v1') || '[]'));
    expect(meals).toHaveLength(1);
    expect(meals[0].mealType).toBe('breakfast');
    expect(meals[0].totals.kcal).toBe(200);

    // Löschen
    await page.click('#meal-log .meal-del');
    await expect(page.locator('#meal-log')).not.toContainText('Testbowl');
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_meals_v1') || '[]'));
    expect(after).toHaveLength(0);
  });

  test('Essen-Tab: bestehendes Food aus der Liste wählen', async ({ page }) => {
    await setup(page);
    // Food vorab anlegen
    await page.evaluate(() => window.upsertFood(window.makeFood({ name: 'Skyr', per100: { kcal: 63, protein: 11, carbs: 4, fat: 0.2 } })));
    await page.click('#nav-ernaehrung');
    await page.click('[data-act="openMealAdd"][data-arg="snack"]');
    await page.fill('#meal-add-search', 'sky');
    await page.click('.meal-food-row');                         // Skyr wählen
    await expect(page.locator('#meal-add-selname')).toHaveText('Skyr');
    await page.fill('#meal-add-grams', '200');
    await expect(page.locator('#meal-add-kcal')).toHaveText('126');   // 63 × 2
    await page.click('[data-act="mealAddConfirm"]');
    await expect(page.locator('#meal-log')).toContainText('Skyr · 200 g');
  });

});
