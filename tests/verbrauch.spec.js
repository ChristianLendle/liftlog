// @ts-check
const { test, expect } = require('@playwright/test');
const { sbMock } = require('./sb-mock');

const TODAY = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(0, 10);

const SEED = {
  categories: [
    { id: 'cat-okpush', name: 'OK-Push', enabled: true },
    { id: 'cat-cardio', name: 'Cardio',  enabled: true },
  ],
  locations: [{ key: 'haidhof', label: 'Sportpark Haidhof', enabled: true }],
  plans: { 'cat-okpush': { 'haidhof': ['Brustpresse'] }, 'cat-cardio': { 'haidhof': [] } },
};

async function setup(page, { profile = null, weight = [], sessions = [] } = {}) {
  await page.addInitScript(sbMock);
  await page.addInitScript(({ seed, profile, weight, sessions }) => {
    localStorage.removeItem('liftlog_active_v1');
    localStorage.removeItem('liftlog_cfg_v1');
    localStorage.removeItem('liftlog_weight_v1');
    localStorage.removeItem('liftlog_db_v1');
    localStorage.setItem('liftlog_categories_v1', JSON.stringify(seed.categories));
    localStorage.setItem('liftlog_locations_v1',  JSON.stringify(seed.locations));
    localStorage.setItem('liftlog_plans_v1',      JSON.stringify(seed.plans));
    if (profile) localStorage.setItem('liftlog_cfg_v1', JSON.stringify({ profile }));
    if (weight.length)   localStorage.setItem('liftlog_weight_v1', JSON.stringify(weight));
    if (sessions.length) localStorage.setItem('liftlog_db_v1', JSON.stringify({ sessions }));
  }, { seed: SEED, profile, weight, sessions });
  await page.setViewportSize({ width: 1000, height: 820 });
  await page.goto('/');
  await page.waitForSelector('#login-gate', { state: 'hidden' });
  await page.waitForSelector('#fab-pill');
}

const PROFILE = {
  sex: 'm', birthYear: 1995, heightCm: 182, goal: 'cut', goalIntensity: 'moderate',
  dietType: null, activityBaseline: 1.3, startWeight: 80, startKfa: null,
  startDate: TODAY, calibrationFactor: 1.0,
};

test.describe('Verbrauch-Engine — Rechenfunktionen (§4.3/§4.4/§4.5)', () => {

  test('strengthKcalNet: netto (MET-1)-Formel je Intensität', async ({ page }) => {
    await setup(page);
    const r = await page.evaluate(() => ({
      low:  window.strengthKcalNet(60, 80, 'low'),
      mod:  window.strengthKcalNet(60, 80, 'mod'),
      high: window.strengthKcalNet(60, 80, 'high'),
      none: window.strengthKcalNet(0, 80, 'mod'),
    }));
    expect(r.low).toBe(210);   // (3.5-1)*3.5*80/200*60
    expect(r.mod).toBe(336);   // (5.0-1)*3.5*80/200*60
    expect(r.high).toBe(420);  // (6.0-1)*3.5*80/200*60
    expect(r.none).toBeNull();
  });

  test('cardioKcalNet: Geräte-kcal > Laufen-Distanz > Dauer-MET-Fallback', async ({ page }) => {
    await setup(page);
    const r = await page.evaluate(() => ({
      device:   window.cardioKcalNet({ calories: 450, distance_km: 10, type: 'laufen' }, 80),
      laufen:   window.cardioKcalNet({ type: 'laufen', distance_km: 10 }, 80),
      fallback: window.cardioKcalNet({ type: 'radfahren', duration_min: 60 }, 80),
      empty:    window.cardioKcalNet({ type: 'radfahren' }, 80),
      none:     window.cardioKcalNet(null, 80),
    }));
    expect(r.device).toEqual({ kcal: 450, confidence: 0.5, source: 'device' });
    expect(r.laufen).toEqual({ kcal: 800, confidence: 0.8, source: 'distance' }); // 80kg * 10km
    expect(r.fallback).toEqual({ kcal: 336, confidence: 0.6, source: 'met-fallback' }); // (5-1)*3.5*80/200*60
    expect(r.empty).toBeNull();
    expect(r.none).toBeNull();
  });

  test('sessionKcalNet: Kraft- und Cardio-Session liefern konsistente Werte', async ({ page }) => {
    await setup(page);
    const r = await page.evaluate(() => {
      const strength = { type: 'strength', intensity: 'high', startedAt: '2026-06-01T10:00:00.000Z', finishedAt: '2026-06-01T11:00:00.000Z' };
      const cardio    = { type: 'cardio', cardio: { type: 'laufen', distance_km: 5 } };
      return { s: window.sessionKcalNet(strength, 80), c: window.sessionKcalNet(cardio, 80) };
    });
    expect(r.s).toEqual({ kcal: 420, confidence: 0.6, source: 'strength' });
    expect(r.c).toEqual({ kcal: 400, confidence: 0.8, source: 'distance' });
  });

  test('getDayTrainingKcal + actualDailyExpenditure: BMR + Trainings-Summe des Tages', async ({ page }) => {
    const sessions = [
      { id: 's1', date: TODAY, type: 'strength', category: 'OK-Push', intensity: 'mod', startedAt: `${TODAY}T10:00:00.000Z`, finishedAt: `${TODAY}T11:00:00.000Z`, exercises: [] },
      { id: 's2', date: TODAY, type: 'cardio', category: 'Cardio', cardio: { type: 'laufen', distance_km: 5 } },
      { id: 's3', date: '2026-01-01', type: 'strength', category: 'OK-Push', intensity: 'high', startedAt: '2026-01-01T10:00:00.000Z', finishedAt: '2026-01-01T11:00:00.000Z', exercises: [] }, // anderer Tag
    ];
    await setup(page, { profile: PROFILE, weight: [{ date: TODAY, kg: 80, kfa: null }], sessions });

    const r = await page.evaluate((today) => ({
      day: window.getDayTrainingKcal(today),
      actual: window.actualDailyExpenditure(today),
      bmr: window.calcBMR(),
    }), TODAY);

    // s1: (5-1)*3.5*80/200*60=336 · s2: 80*5=400 → Summe 736
    expect(r.day.kcal).toBe(736);
    expect(r.actual).toBe(r.bmr + 736);
  });

});

test.describe('Verbrauch-Engine — UI-Integration', () => {

  test('Intensität wird an der Kraft-Session gespeichert', async ({ page }) => {
    await setup(page);
    await page.click('#fab-pill');
    await page.click('text=Neues Training');
    await page.fill('#log-date', TODAY);
    await page.selectOption('#log-cat', 'OK-Push');
    await page.selectOption('#log-loc', 'Sportpark Haidhof');
    await page.click('#log-mood-seg .mood-seg-btn[data-mood="good"]');
    await expect(page.locator('#log-ex-list')).not.toBeEmpty();

    await page.click('#log-intensity-seg .mood-seg-btn[data-int="high"]');
    await page.click('text=Abschließen');

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_db_v1')).sessions[0]);
    expect(saved.intensity).toBe('high');
  });

  test('Cardio-Art (Laufen/Radfahren/Stairmaster) wird jetzt korrekt gespeichert (Regressionstest)', async ({ page }) => {
    await setup(page);
    await page.click('#fab-pill');
    await page.click('text=Neues Training');
    await page.fill('#log-date', TODAY);
    await page.selectOption('#log-cat', 'Cardio');
    await page.selectOption('#log-cardio-type', 'laufen');
    await page.fill('#log-dist', '8');
    await page.fill('#log-dur', '40');
    await page.click('text=Abschließen');

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_db_v1')).sessions[0]);
    expect(saved.cardio.type).toBe('laufen');
    expect(saved.cardio.distance_km).toBe(8);
  });

  test('Verbrauch wird beim Speichern eingefroren (§2.3) und bleibt bei späterer Gewichtsänderung stabil', async ({ page }) => {
    await setup(page, { weight: [{ date: TODAY, kg: 80, kfa: null }] });
    await page.click('#fab-pill');
    await page.click('text=Neues Training');
    await page.fill('#log-date', TODAY);
    await page.selectOption('#log-cat', 'Cardio');
    await page.selectOption('#log-cardio-type', 'laufen');
    await page.fill('#log-dist', '10');
    await page.fill('#log-dur', '50');
    await page.click('text=Abschließen');

    const first = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_db_v1')).sessions[0]);
    expect(first.burnedKcal).toBe(800); // 80kg * 10km
    expect(first.burnConfidence).toBe(0.8);

    // Gewicht ändert sich massiv NACH dem Speichern — die historische Session darf nicht driften.
    const dayKcal = await page.evaluate((today) => {
      const w = JSON.parse(localStorage.getItem('liftlog_weight_v1'));
      w.push({ date: today, kg: 150, kfa: null });
      localStorage.setItem('liftlog_weight_v1', JSON.stringify(w));
      return window.getDayTrainingKcal(today).kcal;
    }, TODAY);
    expect(dayKcal).toBe(800);
  });

  test('Set-Häkchen (§7 Eingabe-Vereinfachung) wurde entfernt', async ({ page }) => {
    await setup(page);
    await page.click('#fab-pill');
    await page.click('text=Neues Training');
    await page.fill('#log-date', TODAY);
    await page.selectOption('#log-cat', 'OK-Push');
    await page.selectOption('#log-loc', 'Sportpark Haidhof');
    await expect(page.locator('#log-ex-list')).not.toBeEmpty();
    await expect(page.locator('.set-done')).toHaveCount(0);
  });

  test('Dashboard-Bilanz-Balken zeigt BMR + Training, nicht nur die Baseline', async ({ page }) => {
    const session = { id: 's1', date: TODAY, type: 'cardio', category: 'Cardio', cardio: { type: 'laufen', distance_km: 10 } };
    await setup(page, { profile: PROFILE, weight: [{ date: TODAY, kg: 80, kfa: null }], sessions: [session] });

    const bmr = await page.evaluate(() => window.calcBMR());
    await page.click('#nav-dashboard');
    const verbrauchTxt = await page.locator('#dash-bal-verbrauch-val').textContent();
    const verbrauch = parseInt(verbrauchTxt.replace(/\D/g, ''), 10);
    // BMR + 80kg*10km = BMR + 800, muss deutlich über dem reinen BMR liegen
    expect(verbrauch).toBeGreaterThanOrEqual(bmr + 800);
  });

});
