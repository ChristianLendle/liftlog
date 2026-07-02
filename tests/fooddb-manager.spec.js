// @ts-check
const { test, expect } = require('@playwright/test');
const { sbMock } = require('./sb-mock');

async function setup(page, { foodDb = [] } = {}) {
  await page.addInitScript(sbMock);
  await page.addInitScript((foodDb) => {
    localStorage.removeItem('liftlog_fooddb_v1');
    localStorage.removeItem('liftlog_meals_v1');
    if (foodDb.length) localStorage.setItem('liftlog_fooddb_v1', JSON.stringify(foodDb));
  }, foodDb);
  await page.goto('/');
  await page.waitForSelector('#login-gate', { state: 'hidden' });
  await page.waitForSelector('#fab-pill');
  await page.click('#nav-ernaehrung');
}

const FOOD_A = { id: 'f1', name: 'Haferflocken', brand: 'Kölln', per100: { kcal: 372, protein: 13.5, carbs: 59, fat: 7 }, servingG: 40, source: 'manual', barcode: null, confidence: 0.7, favorite: false, createdAt: '2026-06-29' };
const FOOD_B = { id: 'f2', name: 'Skyr', brand: null, per100: { kcal: 63, protein: 11, carbs: 4, fat: 0.2 }, servingG: null, source: 'off', barcode: '111', confidence: 0.9, favorite: true, createdAt: '2026-06-29' };

test.describe('Food-DB-Verwaltung (Spec §9: Liste, bearbeiten, Favoriten)', () => {

  test('Modal öffnet sich über "Lebensmittel verwalten", zeigt Liste + Anzahl', async ({ page }) => {
    await setup(page, { foodDb: [FOOD_A, FOOD_B] });
    await page.click('[data-act="openFoodDbManager"]');
    await expect(page.locator('#m-fooddb')).toBeVisible();
    await expect(page.locator('#fooddb-count-text')).toHaveText('2 Einträge');
    await expect(page.locator('.fooddb-row')).toHaveCount(2);
    // Favorit zuerst (Skyr), dann alphabetisch
    await expect(page.locator('.fooddb-row').first()).toContainText('Skyr');
  });

  test('Leerer Zustand ohne Einträge', async ({ page }) => {
    await setup(page);
    await page.click('[data-act="openFoodDbManager"]');
    await expect(page.locator('#fooddb-empty')).toBeVisible();
    await expect(page.locator('#fooddb-count-text')).toHaveText('0 Einträge');
  });

  test('Suche filtert nach Name und Marke', async ({ page }) => {
    await setup(page, { foodDb: [FOOD_A, FOOD_B] });
    await page.click('[data-act="openFoodDbManager"]');
    await page.fill('#fooddb-search', 'kölln');
    await expect(page.locator('.fooddb-row')).toHaveCount(1);
    await expect(page.locator('.fooddb-row')).toContainText('Haferflocken');
  });

  test('Favorit umschalten aktualisiert Sortierung sofort', async ({ page }) => {
    await setup(page, { foodDb: [FOOD_A, FOOD_B] });
    await page.click('[data-act="openFoodDbManager"]');
    await expect(page.locator('.fooddb-row').first()).toContainText('Skyr'); // f2 ist Favorit

    await page.click('.fooddb-row:has-text("Haferflocken") [data-act="toggleFoodDbFavorite"]');
    await expect(page.locator('.fooddb-row').first()).toContainText('Haferflocken'); // jetzt auch Favorit, alphabetisch vor Skyr

    const db = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_fooddb_v1')));
    expect(db.find(f => f.id === 'f1').favorite).toBe(true);
  });

  test('Bearbeiten: Name + Nährwerte ändern, wird persistiert', async ({ page }) => {
    await setup(page, { foodDb: [FOOD_A] });
    await page.click('[data-act="openFoodDbManager"]');
    await page.click('[data-act="editFoodDbEntry"]');
    await page.fill('#fde-name', 'Haferflocken Fein');
    await page.fill('#fde-kcal', '380');
    await page.click('[data-act="saveFoodDbEntry"]');

    await expect(page.locator('.fooddb-row')).toContainText('Haferflocken Fein');
    const db = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_fooddb_v1')));
    expect(db[0].name).toBe('Haferflocken Fein');
    expect(db[0].per100.kcal).toBe(380);
  });

  test('Bearbeiten abbrechen verwirft Änderungen', async ({ page }) => {
    await setup(page, { foodDb: [FOOD_A] });
    await page.click('[data-act="openFoodDbManager"]');
    await page.click('[data-act="editFoodDbEntry"]');
    await page.fill('#fde-name', 'Sollte nicht gespeichert werden');
    await page.click('[data-act="cancelEditFoodDbEntry"]');

    await expect(page.locator('.fooddb-row')).toContainText('Haferflocken');
    await expect(page.locator('.fooddb-row')).not.toContainText('Sollte nicht gespeichert werden');
  });

  test('Löschen entfernt sofort, Undo stellt wieder her; alte Meal-Logs bleiben unberührt (§2.2 Freeze)', async ({ page }) => {
    const meal = { id: 'm1', date: '2026-06-29', time: '08:00', mealType: 'breakfast', items: [{ foodId: 'f1', name: 'Haferflocken', grams: 80, kcal: 298, protein: 10.8, carbs: 47.2, fat: 5.6 }], totals: { kcal: 298, protein: 10.8, carbs: 47.2, fat: 5.6 }, confidence: 0.7, source: 'fooddb' };
    await setup(page, { foodDb: [FOOD_A] });
    await page.evaluate((m) => { localStorage.setItem('liftlog_meals_v1', JSON.stringify([m])); }, meal);

    await page.click('[data-act="openFoodDbManager"]');
    await page.click('[data-act="deleteFoodDbEntry"]');
    await expect(page.locator('.fooddb-row')).toHaveCount(0);
    let db = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_fooddb_v1')));
    expect(db).toHaveLength(0);

    // Meal-Log-Eintrag unverändert trotz gelöschtem Food (eingefrorene Werte)
    const mealTotals = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_meals_v1'))[0].totals.kcal);
    expect(mealTotals).toBe(298);

    // Undo stellt das Lebensmittel wieder her
    await page.click('[data-act="doUndo"]');
    db = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_fooddb_v1')));
    expect(db).toHaveLength(1);
    expect(db[0].id).toBe('f1');
  });

});
