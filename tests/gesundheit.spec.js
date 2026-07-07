// @ts-check
const { test, expect } = require('@playwright/test');
const { sbMock } = require('./sb-mock');

const TODAY = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(0, 10);

async function setup(page, { profile = null, weight = [], meals = [], foodDb = [] } = {}) {
  await page.addInitScript(sbMock);
  await page.addInitScript(({ profile, weight, meals, foodDb }) => {
    localStorage.removeItem('liftlog_cfg_v1');
    localStorage.removeItem('liftlog_weight_v1');
    localStorage.removeItem('liftlog_meals_v1');
    localStorage.removeItem('liftlog_fooddb_v1');
    if (profile) localStorage.setItem('liftlog_cfg_v1', JSON.stringify({ profile }));
    if (weight.length)  localStorage.setItem('liftlog_weight_v1', JSON.stringify(weight));
    if (meals.length)   localStorage.setItem('liftlog_meals_v1', JSON.stringify(meals));
    if (foodDb.length)  localStorage.setItem('liftlog_fooddb_v1', JSON.stringify(foodDb));
  }, { profile, weight, meals, foodDb });
  await page.setViewportSize({ width: 1000, height: 820 });
  await page.goto('/');
  await page.waitForSelector('#login-gate', { state: 'hidden' });
  await page.waitForSelector('#fab-pill');
}

const PROFILE = {
  sex: 'm', birthYear: 1995, heightCm: 182, goal: 'cut', goalIntensity: 'moderate',
  dietType: null, activityBaseline: 1.3, startWeight: 84, startKfa: null,
  startDate: TODAY, calibrationFactor: 1.0,
};

test.describe('Gesundheit — zusammengeführte Ansicht (Gewicht & KFA + Bilanz)', () => {

  test('Nav heißt „Gesundheit", zeigt Gewicht & KFA und Bilanz ohne Tab-Wechsel auf einer Seite', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#nav-gesundheit')).toHaveText('Gesundheit');
    await page.click('#nav-gesundheit');
    await expect(page.locator('#view-gesundheit')).toHaveClass(/active/);
    await expect(page.locator('#nav-gesundheit')).toHaveClass(/active/);

    await expect(page.locator('#view-gesundheit .sec-label').first()).toHaveText('Gewicht & KFA');
    await expect(page.locator('#wt-stat-current')).toBeVisible();
  });

  test('Ohne Profil: Empty-State statt Bilanz-Inhalt, Gewicht & KFA bleibt unabhängig sichtbar', async ({ page }) => {
    await setup(page);
    await page.click('#nav-gesundheit');
    await expect(page.locator('#bilanz-empty')).toBeVisible();
    await expect(page.locator('#bilanz-content')).toBeHidden();
    await expect(page.locator('#wt-stat-current')).toBeVisible();
  });

  test('Mit Profil + Meal: BMR, Tagesziel, Bilanz-Balken zeigen echte Werte', async ({ page }) => {
    const food = { id: 'f1', name: 'Testfood', brand: null, per100: { kcal: 200, protein: 20, carbs: 20, fat: 5 }, servingG: null, source: 'manual', barcode: null, confidence: 0.7, favorite: false, createdAt: TODAY };
    const meal = { id: 'm1', date: TODAY, time: '08:00', mealType: 'breakfast', items: [{ foodId: 'f1', name: 'Testfood', grams: 300, kcal: 600, protein: 60, carbs: 60, fat: 15 }], totals: { kcal: 600, protein: 60, carbs: 60, fat: 15 }, confidence: 0.7, source: 'fooddb' };
    await setup(page, { profile: PROFILE, weight: [{ date: TODAY, kg: 84, kfa: null }], meals: [meal], foodDb: [food] });

    await page.click('#nav-gesundheit');
    await expect(page.locator('#bilanz-content')).toBeVisible();
    await expect(page.locator('#bilanz-empty')).toBeHidden();

    await expect(page.locator('#bz-bmr')).toContainText('kcal');
    await expect(page.locator('#bz-bmr')).not.toHaveText('—');
    await expect(page.locator('#bz-expend')).toContainText('kcal');
    await expect(page.locator('#bz-target')).toContainText('kcal');
    await expect(page.locator('#bz-goal')).toHaveText('Abnehmen');

    await expect(page.locator('#bz-bal-zufuhr-val')).toHaveText('600 kcal');
    await expect(page.locator('#bz-bal-verbrauch-val')).toContainText('kcal');
    await expect(page.locator('#bz-band-note')).toContainText('±');
  });

});
