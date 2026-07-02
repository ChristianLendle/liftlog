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
  await page.goto('/');
  await page.waitForSelector('#login-gate', { state: 'hidden' });
  await page.waitForSelector('#fab-pill');
}

const PROFILE = {
  sex: 'm', birthYear: 1995, heightCm: 182, goal: 'maintain', goalIntensity: 'moderate',
  dietType: null, activityBaseline: 1.3, startWeight: 90, startKfa: null,
  startDate: TODAY, calibrationFactor: 1.0, lastCalibrationDate: null,
};

// Baut 21 Tage Gewichts- + Meal-Log-Fixtures relativ zu "heute" (Europe/Berlin),
// damit das Kalibrierungsfenster immer voll ist, egal wann der Test läuft.
function buildWindow({ startKg, endKg, dailyKcal }) {
  const days = 21;
  const addDays = (n) => { const d = new Date(TODAY + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const weight = [];
  const meals = [];
  for (let i = 0; i <= days; i++) {
    const date = addDays(-days + i);
    const kg = startKg + (endKg - startKg) * (i / days);
    weight.push({ date, kg: Math.round(kg * 10) / 10, kfa: null });
    meals.push({
      id: 'm' + i, date, time: '12:00', mealType: 'lunch',
      items: [{ foodId: 'f1', name: 'Fixture', grams: 100, kcal: dailyKcal, protein: 0, carbs: 0, fat: 0 }],
      totals: { kcal: dailyKcal, protein: 0, carbs: 0, fat: 0 }, confidence: 0.7, source: 'fooddb',
    });
  }
  return { weight, meals };
}

test.describe('Kalibrierung (§4.7) — Rechenfunktion', () => {

  test('Zu wenig Gewichtseinträge (<4): kein Update', async ({ page }) => {
    await setup(page, { profile: PROFILE, weight: [{ date: TODAY, kg: 90, kfa: null }] });
    const r = await page.evaluate(() => window.calibrateProfile());
    expect(r).toBeNull();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_cfg_v1')).profile.calibrationFactor);
    expect(stored).toBe(1.0);
  });

  test('Zu wenig geloggte Tage (<7 Mahlzeiten): kein Update trotz genug Gewichtsdaten', async ({ page }) => {
    const { weight } = buildWindow({ startKg: 90, endKg: 88, dailyKcal: 2000 });
    await setup(page, { profile: PROFILE, weight }); // keine Meals geseedet
    const r = await page.evaluate(() => window.calibrateProfile());
    expect(r).toBeNull();
  });

  test('Fenster noch nicht voll seit letzter Kalibrierung: kein Update', async ({ page }) => {
    const { weight, meals } = buildWindow({ startKg: 90, endKg: 88, dailyKcal: 2000 });
    const recentDate = TODAY; // "gerade eben" kalibriert
    await setup(page, { profile: { ...PROFILE, lastCalibrationDate: recentDate }, weight, meals });
    const r = await page.evaluate(() => window.calibrateProfile());
    expect(r).toBeNull();
  });

  test('Mehr abgenommen als erwartet (Bilanz zu konservativ): Faktor steigt', async ({ page }) => {
    // Sehr niedrige Zufuhr (starkes Defizit) UND deutlich mehr Gewicht verloren, als das
    // reine Formel-BMR×Aktivität-Defizit erklären würde → realer Verbrauch war höher.
    // loadApp() ruft calibrateProfile() automatisch beim Laden auf (kein manueller Trigger nötig).
    const { weight, meals } = buildWindow({ startKg: 92, endKg: 86, dailyKcal: 1400 });
    await setup(page, { profile: PROFILE, weight, meals });

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_cfg_v1')).profile);
    expect(stored.calibrationFactor).toBeGreaterThan(1.0);
    expect(stored.calibrationFactor).toBeLessThanOrEqual(1.05); // gedämpft auf max. calibrationMaxStep (5%)
    expect(stored.lastCalibrationDate).toBe(TODAY);
  });

  test('Weniger abgenommen als erwartet (Bilanz zu optimistisch): Faktor sinkt', async ({ page }) => {
    // Formel sagt anhand der Zufuhr ein Defizit (~Verlust) voraus, das Gewicht bleibt aber
    // flach → realer Verbrauch war niedriger als die Formel annimmt.
    const { weight, meals } = buildWindow({ startKg: 90, endKg: 90, dailyKcal: 1600 });
    await setup(page, { profile: PROFILE, weight, meals });

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_cfg_v1')).profile);
    expect(stored.calibrationFactor).toBeLessThan(1.0);
    expect(stored.calibrationFactor).toBeGreaterThanOrEqual(0.95);
  });

  test('Bilanz-Screen zeigt Kalibrierungsstatus nach Update', async ({ page }) => {
    // loadApp() kalibriert automatisch beim Laden (kein manueller Trigger nötig).
    const { weight, meals } = buildWindow({ startKg: 92, endKg: 86, dailyKcal: 1400 });
    await setup(page, { profile: PROFILE, weight, meals });

    await page.click('#nav-gesundheit');
    await expect(page.locator('#bz-calib-note')).toContainText('Kalibriert');
    await expect(page.locator('#bz-calib-note')).not.toContainText('Noch nicht kalibriert');
  });

});
