// @ts-check
const { test, expect } = require('@playwright/test');
const { sbMock } = require('./sb-mock');

async function setup(page) {
  await page.addInitScript(sbMock);
  await page.addInitScript(() => {
    localStorage.removeItem('liftlog_meals_v1');
    localStorage.removeItem('liftlog_fooddb_v1');
  });
  await page.goto('/');
  await page.waitForSelector('#login-gate', { state: 'hidden' });
  await page.waitForSelector('#fab-pill');
}

test.describe('Ernährung — Food-DB & Meal-Log (Backend)', () => {

  test('Food anlegen, skalieren, loggen — Werte werden eingefroren', async ({ page }) => {
    await setup(page);

    const r = await page.evaluate(() => {
      const food = window.upsertFood(window.makeFood({
        name: 'Haferflocken', per100: { kcal: 372, protein: 13.5, carbs: 59, fat: 7 }, servingG: 40,
      }));
      const scaled = window.scaleFood(food, 80);                       // 80 g
      const entry  = window.addMealEntry({ date: '2026-07-01', mealType: 'breakfast', foodId: food.id, grams: 80 });
      return { food, scaled, entry,
        db:    JSON.parse(localStorage.getItem('liftlog_fooddb_v1') || '[]'),
        meals: JSON.parse(localStorage.getItem('liftlog_meals_v1')  || '[]') };
    });

    // Food-DB: manuell → confidence 0.7, gespeichert
    expect(r.food.source).toBe('manual');
    expect(r.food.confidence).toBe(0.7);
    expect(r.db).toHaveLength(1);
    // Skalierung: 80 g Haferflocken = 298 kcal
    expect(r.scaled.kcal).toBe(298);
    expect(r.scaled.protein).toBeCloseTo(10.8, 1);
    // Log-Eintrag trägt eingefrorene Werte
    expect(r.entry.mealType).toBe('breakfast');
    expect(r.entry.totals.kcal).toBe(298);
    expect(r.entry.items[0].foodId).toBe(r.food.id);
    expect(r.meals).toHaveLength(1);
  });

  test('Tagessumme summiert kcal + Makros über Mahlzeiten', async ({ page }) => {
    await setup(page);
    const totals = await page.evaluate(() => {
      const f = window.upsertFood(window.makeFood({ name: 'X', per100: { kcal: 100, protein: 10, carbs: 20, fat: 5 } }));
      window.addMealEntry({ date: '2026-07-01', mealType: 'breakfast', foodId: f.id, grams: 100 }); // 100 kcal
      window.addMealEntry({ date: '2026-07-01', mealType: 'lunch',     foodId: f.id, grams: 200 }); // 200 kcal
      window.addMealEntry({ date: '2026-06-30', mealType: 'dinner',    foodId: f.id, grams: 100 }); // anderer Tag
      const grouped = window.getMealsForDay('2026-07-01');
      return { day: window.getDayTotals('2026-07-01'), bf: grouped.breakfast.length, lu: grouped.lunch.length };
    });
    expect(totals.day.kcal).toBe(300);        // nur 2026-07-01
    expect(totals.day.protein).toBe(30);
    expect(totals.bf).toBe(1);
    expect(totals.lu).toBe(1);
    expect(totals.day.confidence).toBe(0.7);
  });

  test('Food ändern/löschen verzerrt geloggte Einträge NICHT (Freeze-Garantie)', async ({ page }) => {
    await setup(page);
    const r = await page.evaluate(() => {
      const f = window.upsertFood(window.makeFood({ name: 'Reis', per100: { kcal: 130, protein: 2.7, carbs: 28, fat: 0.3 } }));
      window.addMealEntry({ date: '2026-07-01', mealType: 'lunch', foodId: f.id, grams: 100 }); // 130 kcal eingefroren
      // Food nachträglich stark ändern …
      f.per100.kcal = 999; window.upsertFood(f);
      const afterEdit = window.getDayTotals('2026-07-01').kcal;
      // … und ganz löschen
      window.deleteFood(f.id);
      const afterDelete = window.getDayTotals('2026-07-01').kcal;
      return { afterEdit, afterDelete, foods: JSON.parse(localStorage.getItem('liftlog_fooddb_v1') || '[]').length };
    });
    expect(r.afterEdit).toBe(130);            // Log unverändert trotz Food-Edit
    expect(r.afterDelete).toBe(130);          // Log überlebt Food-Löschung
    expect(r.foods).toBe(0);
  });

  test('Favorit umschalten & Meal löschen', async ({ page }) => {
    await setup(page);
    const r = await page.evaluate(() => {
      const f = window.upsertFood(window.makeFood({ name: 'Skyr', per100: { kcal: 63, protein: 11, carbs: 4, fat: 0.2 } }));
      window.toggleFoodFavorite(f.id);
      const fav = window.getFood(f.id).favorite;
      const e = window.addMealEntry({ date: '2026-07-01', mealType: 'snack', foodId: f.id, grams: 150 });
      window.deleteMealEntry(e.id);
      return { fav, mealsAfter: JSON.parse(localStorage.getItem('liftlog_meals_v1') || '[]').length };
    });
    expect(r.fav).toBe(true);
    expect(r.mealsAfter).toBe(0);
  });

});
