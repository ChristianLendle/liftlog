// @ts-check
const { test, expect } = require('@playwright/test');
const { sbMock } = require('./sb-mock');

// OFF-Netzwerk mocken – keine echten Calls im Test.
async function mockOff(page) {
  await page.route('**/world.openfoodfacts.org/**', (route) => {
    const url = route.request().url();
    if (url.includes('/cgi/search.pl')) {
      return route.fulfill({ json: { products: [
        { code: '111', product_name: 'Kölln Haferflocken', brands: 'Kölln', serving_size: '40 g',
          nutriments: { 'energy-kcal_100g': 370, proteins_100g: 13, carbohydrates_100g: 60, fat_100g: 7 } },
      ] } });
    }
    if (url.includes('/api/v2/product/')) {
      if (url.includes('/0000000.json')) return route.fulfill({ json: { status: 0 } });
      return route.fulfill({ json: { status: 1, product: {
        code: '4008400202037', product_name: 'Nutella', brands: 'Ferrero',
        nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 } } } });
    }
    return route.fulfill({ json: {} });
  });
}

async function setup(page) {
  await page.addInitScript(sbMock);
  await page.addInitScript(() => {
    localStorage.removeItem('liftlog_meals_v1');
    localStorage.removeItem('liftlog_fooddb_v1');
  });
  await mockOff(page);
  await page.setViewportSize({ width: 1000, height: 820 });
  await page.goto('/');
  await page.waitForSelector('#login-gate', { state: 'hidden' });
  await page.waitForSelector('#fab-pill');
}

test.describe('Open Food Facts', () => {

  test('Textsuche: OFF-Treffer wählen, cachen (Confidence 0.9), loggen', async ({ page }) => {
    await setup(page);
    await page.click('#nav-ernaehrung');
    await page.click('[data-act="openMealAdd"][data-arg="lunch"]');
    await page.fill('#meal-add-search', 'hafer');
    await page.click('[data-act="offSearchUI"]');

    await expect(page.locator('#meal-off-status')).toContainText('Open Food Facts');
    await expect(page.locator('#meal-off-list .meal-food-row')).toHaveCount(1);
    await page.click('#meal-off-list .meal-food-row');

    // Menge-Modus, Standardportion 40 g aus serving_size
    await expect(page.locator('#meal-add-selname')).toHaveText('Kölln Haferflocken');
    await page.fill('#meal-add-grams', '100');
    await expect(page.locator('#meal-add-kcal')).toHaveText('370');
    await page.click('[data-act="mealAddConfirm"]');

    await expect(page.locator('#meal-log')).toContainText('Kölln Haferflocken');
    const db = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_fooddb_v1') || '[]'));
    expect(db).toHaveLength(1);
    expect(db[0].source).toBe('off');
    expect(db[0].confidence).toBe(0.9);
    expect(db[0].barcode).toBe('111');
  });

  test('Barcode-Nummer: Lookup, cachen, Menge-Modus', async ({ page }) => {
    await setup(page);
    await page.click('#nav-ernaehrung');
    await page.click('[data-act="openMealAdd"][data-arg="snack"]');
    await page.click('[data-act="openBarcodeScan"]');
    await expect(page.locator('#m-barcode')).toBeVisible();

    // Fallback: Nummer eingeben (Kamera in headless nicht verfügbar)
    await page.fill('#bc-manual', '4008400202037');
    await page.click('[data-act="barcodeManualLookup"]');

    await expect(page.locator('#m-barcode')).not.toBeVisible();
    await expect(page.locator('#meal-add-selname')).toHaveText('Nutella');
    const db = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_fooddb_v1') || '[]'));
    expect(db[0].barcode).toBe('4008400202037');
    expect(db[0].confidence).toBe(0.9);
  });

  test('offToFood: kJ→kcal-Fallback und Unvollständig-Flag', async ({ page }) => {
    await setup(page);
    const r = await page.evaluate(() => {
      const a = window.offToFood({ product_name: 'X', nutriments: { 'energy-kj_100g': 1000, proteins_100g: 5 } });
      const b = window.offToFood({ product_name: 'Y', nutriments: {} });
      const c = window.offToFood({ nutriments: { 'energy-kcal_100g': 100 } }); // ohne Namen
      return { aKcal: a.kcal ?? a.per100.kcal, aIncomplete: a.incomplete, bKcal: b.per100.kcal, bIncomplete: b.incomplete, c };
    });
    expect(r.aKcal).toBe(239);        // 1000 / 4.184 ≈ 239
    expect(r.aIncomplete).toBe(false);
    expect(r.bKcal).toBe(0);
    expect(r.bIncomplete).toBe(true);
    expect(r.c).toBeNull();           // ohne Namen → null
  });

});
