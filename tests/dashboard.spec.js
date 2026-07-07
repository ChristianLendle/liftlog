// @ts-check
const { test, expect } = require('@playwright/test');
const { sbMock } = require('./sb-mock');

const TODAY = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(0, 10);

const CATS = [
  { id: 'cat-push',   name: 'Push',   enabled: true },
  { id: 'cat-pull',   name: 'Pull',   enabled: true },
  { id: 'cat-cardio', name: 'Cardio', enabled: true },
];

async function setup(page, { profile = null, weight = [], sessions = [], meals = [], foodDb = [], categories = null, rotation = null } = {}) {
  await page.addInitScript(sbMock);
  await page.addInitScript((seed) => {
    localStorage.removeItem('liftlog_cfg_v1');
    localStorage.removeItem('liftlog_weight_v1');
    localStorage.removeItem('liftlog_db_v1');
    localStorage.removeItem('liftlog_meals_v1');
    localStorage.removeItem('liftlog_fooddb_v1');
    localStorage.removeItem('liftlog_rotation_v1');
    if (seed.profile) localStorage.setItem('liftlog_cfg_v1', JSON.stringify({ profile: seed.profile }));
    if (seed.weight.length)   localStorage.setItem('liftlog_weight_v1', JSON.stringify(seed.weight));
    if (seed.sessions.length) localStorage.setItem('liftlog_db_v1', JSON.stringify({ sessions: seed.sessions }));
    if (seed.meals.length)    localStorage.setItem('liftlog_meals_v1', JSON.stringify(seed.meals));
    if (seed.foodDb.length)   localStorage.setItem('liftlog_fooddb_v1', JSON.stringify(seed.foodDb));
    if (seed.categories)      localStorage.setItem('liftlog_categories_v1', JSON.stringify(seed.categories));
    if (seed.rotation)        localStorage.setItem('liftlog_rotation_v1', JSON.stringify(seed.rotation));
  }, { profile, weight, sessions, meals, foodDb, categories, rotation });
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

test.describe('Dashboard — Kern-Kacheln (Kalorien · Gewicht · Streak)', () => {

  test('Kalorien-Kachel ohne Profil: 0 kcal + Hinweis statt Restbudget', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#dash-kcal-eaten')).toHaveText('0');
    await expect(page.locator('#dash-kcal-sub')).toHaveText('Kein Ziel — Profil vervollständigen');
  });

  test('Kalorien-Kachel mit Profil + Meal: gegessene kcal + Restbudget', async ({ page }) => {
    const food = { id: 'f1', name: 'Testfood', brand: null, per100: { kcal: 200, protein: 20, carbs: 20, fat: 5 }, servingG: null, source: 'manual', barcode: null, confidence: 0.7, favorite: false, createdAt: TODAY };
    const meal = { id: 'm1', date: TODAY, time: '08:00', mealType: 'breakfast', items: [{ foodId: 'f1', name: 'Testfood', grams: 300, kcal: 600, protein: 60, carbs: 60, fat: 15 }], totals: { kcal: 600, protein: 60, carbs: 60, fat: 15 }, confidence: 0.7, source: 'fooddb' };
    await setup(page, { profile: PROFILE, weight: [{ date: TODAY, kg: 84, kfa: null }], meals: [meal], foodDb: [food] });

    await expect(page.locator('#dash-kcal-eaten')).toHaveText('600');
    await expect(page.locator('#dash-kcal-sub')).toContainText('von');
    await expect(page.locator('#dash-kcal-sub')).toContainText('übrig');
  });

  test('Kalorien-Kachel: Klick navigiert zu Essen', async ({ page }) => {
    await setup(page);
    await page.click('.dash-tile[data-arg="ernaehrung"]');
    await expect(page.locator('#view-ernaehrung')).toHaveClass(/active/);
  });

  test('Gewicht-Kachel ohne Daten: Platzhalter', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#dash-weight-val')).toHaveText('—');
    await expect(page.locator('#dash-weight-sub')).toContainText('keine Gewichtsdaten');
  });

  test('Gewicht-Kachel: zeigt zuletzt getrackten Wert + 30-Tage-Trend', async ({ page }) => {
    const older = new Date(TODAY + 'T12:00:00Z'); older.setUTCDate(older.getUTCDate() - 40);
    const olderStr = older.toISOString().slice(0, 10);
    await setup(page, { weight: [{ date: olderStr, kg: 90, kfa: null }, { date: TODAY, kg: 88, kfa: null }] });

    await expect(page.locator('#dash-weight-val')).toContainText('88');
    await expect(page.locator('#dash-weight-sub')).toContainText('-2');
  });

  test('Gewicht-Kachel: Klick navigiert zu Gesundheit', async ({ page }) => {
    await setup(page);
    await page.click('.dash-tile[data-arg="gesundheit"]');
    await expect(page.locator('#view-gesundheit')).toHaveClass(/active/);
  });

});

test.describe('Dashboard — Nächstes Training (Rotation)', () => {

  test('Ohne Rotation konfiguriert: Hinweis + Link zu den Profil-Einstellungen', async ({ page }) => {
    await setup(page, { categories: CATS });
    await expect(page.locator('#dash-next-content')).toContainText('Reihenfolge deiner Trainings');
    await page.click('#dash-next-content [data-act="openRotationSettings"]');
    await expect(page.locator('#set-scr-rotation')).toHaveClass(/active/);
  });

  test('Mit Rotation, keine Sessions: erste Kategorie ist "als Nächstes" markiert', async ({ page }) => {
    await setup(page, { categories: CATS, rotation: { order: ['cat-push', 'cat-pull', 'cat-cardio'], skip: 0 } });
    await expect(page.locator('.dash-next-name')).toHaveText('Push');
    await expect(page.locator('.rot-pill').first()).toHaveClass(/active/);
  });

  test('Nach geloggtem Training rückt die Rotation zur nächsten Kategorie vor', async ({ page }) => {
    const session = { id: 's1', date: TODAY, category: 'Push', location: 'Home', mood: '', exercises: [{ name: 'Bankdrücken', sets: [{ weight: 80, reps: 5 }] }] };
    await setup(page, { categories: CATS, sessions: [session], rotation: { order: ['cat-push', 'cat-pull', 'cat-cardio'], skip: 0 } });
    await expect(page.locator('.dash-next-name')).toHaveText('Pull');
  });

  test('Überspringen rückt den Zeiger eine Position weiter, ohne eine Session zu loggen', async ({ page }) => {
    await setup(page, { categories: CATS, rotation: { order: ['cat-push', 'cat-pull', 'cat-cardio'], skip: 0 } });
    await expect(page.locator('.dash-next-name')).toHaveText('Push');
    await page.click('[data-act="skipNextWorkout"]');
    await expect(page.locator('.dash-next-name')).toHaveText('Pull');
  });

  test('Starten öffnet das Trainings-Modal mit der nächsten Kategorie vorausgewählt', async ({ page }) => {
    await setup(page, { categories: CATS, rotation: { order: ['cat-push', 'cat-pull', 'cat-cardio'], skip: 0 } });
    await page.click('[data-act="startNextWorkout"]');
    await expect(page.locator('#view-training')).toBeVisible();
    await expect(page.locator('#log-cat')).toHaveValue('Push');
  });

});
