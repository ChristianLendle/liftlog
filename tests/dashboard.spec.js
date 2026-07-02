// @ts-check
const { test, expect } = require('@playwright/test');
const { sbMock } = require('./sb-mock');

const TODAY = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(0, 10);

async function setup(page, { profile = null, weight = [], sessions = [], meals = [], foodDb = [] } = {}) {
  await page.addInitScript(sbMock);
  await page.addInitScript(({ profile, weight, sessions, meals, foodDb }) => {
    localStorage.removeItem('liftlog_cfg_v1');
    localStorage.removeItem('liftlog_weight_v1');
    localStorage.removeItem('liftlog_db_v1');
    localStorage.removeItem('liftlog_meals_v1');
    localStorage.removeItem('liftlog_fooddb_v1');
    if (profile) localStorage.setItem('liftlog_cfg_v1', JSON.stringify({ profile }));
    if (weight.length)  localStorage.setItem('liftlog_weight_v1', JSON.stringify(weight));
    if (sessions.length) localStorage.setItem('liftlog_db_v1', JSON.stringify({ sessions }));
    if (meals.length)    localStorage.setItem('liftlog_meals_v1', JSON.stringify(meals));
    if (foodDb.length)   localStorage.setItem('liftlog_fooddb_v1', JSON.stringify(foodDb));
  }, { profile, weight, sessions, meals, foodDb });
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

test.describe('Dashboard — Energie-Keyfacts', () => {

  test('Ohne Profil: Empty-State statt Ring', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#dash-energy-empty')).toBeVisible();
    await expect(page.locator('#dash-energy-content')).toBeHidden();
    await page.click('#dash-energy-empty [data-act="switchView"]');
    await expect(page.locator('#nav-settings')).toHaveClass(/active/);
  });

  test('Mit Profil + Meals: Ring, Restbudget, Makros, Bilanz zeigen echte Werte', async ({ page }) => {
    const food = { id: 'f1', name: 'Testfood', brand: null, per100: { kcal: 200, protein: 20, carbs: 20, fat: 5 }, servingG: null, source: 'manual', barcode: null, confidence: 0.7, favorite: false, createdAt: TODAY };
    const meal = { id: 'm1', date: TODAY, time: '08:00', mealType: 'breakfast', items: [{ foodId: 'f1', name: 'Testfood', grams: 300, kcal: 600, protein: 60, carbs: 60, fat: 15 }], totals: { kcal: 600, protein: 60, carbs: 60, fat: 15 }, confidence: 0.7, source: 'fooddb' };
    await setup(page, { profile: PROFILE, weight: [{ date: TODAY, kg: 84, kfa: null }], meals: [meal], foodDb: [food] });

    await expect(page.locator('#dash-energy-content')).toBeVisible();
    await expect(page.locator('#dash-energy-empty')).toBeHidden();

    await expect(page.locator('#dash-kcal-eaten')).toHaveText('600');
    const targetTxt = await page.locator('#dash-kcal-target').textContent();
    expect(parseInt(targetTxt.replace(/\./g, ''), 10)).toBeGreaterThan(0);

    // Restbudget = Ziel - 600, sollte positiv (kein Overshoot bei moderatem Defizit + hohem Ziel) oder zumindest berechnet sein
    const restTxt = await page.locator('#dash-kcal-rest').textContent();
    expect(restTxt).toMatch(/kcal/);

    // Makros: 3 Zeilen (Protein/Carbs/Fett), Protein zeigt "60/"
    await expect(page.locator('#dash-macros .energy-macro-row')).toHaveCount(3);
    await expect(page.locator('#dash-macros')).toContainText('Protein');
    await expect(page.locator('#dash-macros')).toContainText('60/');

    // Bilanz-Balken: Verbrauch + Zufuhr-Werte gefüllt
    await expect(page.locator('#dash-bal-zufuhr-val')).toHaveText('600 kcal');
    await expect(page.locator('#dash-bal-verbrauch-val')).toContainText('kcal');
  });

  test('Letztes Training: Karte zeigt "Heute" + Kategorie, ist klickbar → Detail', async ({ page }) => {
    const session = {
      id: 's1', date: TODAY, category: 'Push', location: 'Home', mood: '',
      startedAt: `${TODAY}T10:00:00.000Z`, finishedAt: `${TODAY}T11:00:00.000Z`,
      exercises: [{ name: 'Bankdrücken', sets: [{ weight: 80, reps: 5 }] }],
    };
    await setup(page, { sessions: [session] });

    await expect(page.locator('#dash-training-content')).toContainText('Heute');
    await expect(page.locator('#dash-training-content')).toContainText('Push');
    await expect(page.locator('#dash-training-card')).toHaveClass(/clickable/);

    await page.click('#dash-training-card');
    await expect(page.locator('#m-detail')).toBeVisible();
  });

  test('Kein Training: Leerer Hinweis statt Karte-Klick', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#dash-training-content')).toContainText('Noch kein Training');
    await expect(page.locator('#dash-training-card')).not.toHaveClass(/clickable/);
  });

  test('Gewichtstrend: Pfeil + Delta über 30 Tage', async ({ page }) => {
    const older = new Date(TODAY + 'T12:00:00Z'); older.setUTCDate(older.getUTCDate() - 40);
    const olderStr = older.toISOString().slice(0, 10);
    await setup(page, { weight: [{ date: olderStr, kg: 90, kfa: null }, { date: TODAY, kg: 88, kfa: null }] });

    await expect(page.locator('#dash-trend-content')).toContainText('88');
    await expect(page.locator('#dash-trend-content')).toContainText('-2');
    await expect(page.locator('.dash-trend-val')).toHaveClass(/down/);
  });

});
