// @ts-check
// Verifiziert die Verwaltung von Kategorien, Standorten und Plänen unter
// Einstellungen: konsistente Hinzufügen-Logik, Bearbeiten-Subseiten und die
// Plan-Übersicht. Kategorien haben stabile IDs, Pläne sind nach ID verschlüsselt.
const { test, expect } = require('@playwright/test');
const { sbMock } = require('./sb-mock');

const SEED = {
  categories: [
    { id: 'cat-okpush', name: 'OK-Push', enabled: true },
    { id: 'cat-cardio', name: 'Cardio',  enabled: true },
  ],
  locations: [
    { key: 'haidhof',      label: 'Sportpark Haidhof',       enabled: true },
    { key: 'modern-coach', label: 'Modern Coach Deggendorf', enabled: true },
  ],
  plans: {
    'cat-okpush': { 'haidhof': ['Brustpresse', 'Schrägbank', 'Flys Kabel'] },
  },
};

async function gotoSettings(page) {
  await page.addInitScript(sbMock);
  await page.addInitScript((seed) => {
    localStorage.removeItem('liftlog_active_v1');
    localStorage.setItem('liftlog_categories_v1', JSON.stringify(seed.categories));
    localStorage.setItem('liftlog_locations_v1',  JSON.stringify(seed.locations));
    localStorage.setItem('liftlog_plans_v1',      JSON.stringify(seed.plans));
  }, SEED);
  await page.goto('/');
  await page.waitForSelector('#login-gate', { state: 'hidden' });
  await page.click('#nav-settings');
  await expect(page.locator('#set-scr-hub')).toBeVisible();
}

test('Standorte: konsistenter Hinzufügen-Button + Bearbeiten-Subseite', async ({ page }) => {
  await gotoSettings(page);
  await page.click('#set-scr-hub >> text=Standorte');
  await expect(page.locator('#set-scr-locs')).toBeVisible();
  await expect(page.locator('#set-scr-locs button:has-text("Hinzufügen")')).toBeVisible();

  await page.click('#loc-list .toggle-row:first-child .tr-edit');
  await expect(page.locator('#set-scr-loc-edit')).toBeVisible();
  await expect(page.locator('#loc-edit-name')).toHaveValue('Sportpark Haidhof');
  await page.fill('#loc-edit-name', 'Sportpark Haidhof NEU');
  await page.click('#set-scr-loc-edit button:has-text("Speichern")');
  await expect(page.locator('#set-scr-locs')).toBeVisible();
  await expect(page.locator('#loc-list')).toContainText('Sportpark Haidhof NEU');
});

test('Kategorien: Umbenennen ändert nur den Namen, ID + Plan-Verknüpfung bleiben', async ({ page }) => {
  await gotoSettings(page);
  await page.click('#set-scr-hub >> text=Kategorien');
  await expect(page.locator('#set-scr-cats')).toBeVisible();
  await page.click('#cat-list .toggle-row:first-child .tr-edit');
  await expect(page.locator('#set-scr-cat-edit')).toBeVisible();
  await expect(page.locator('#cat-edit-name')).toHaveValue('OK-Push');
  await page.fill('#cat-edit-name', 'Push Day');
  await page.click('#set-scr-cat-edit button:has-text("Speichern")');
  await expect(page.locator('#set-scr-cats')).toBeVisible();
  await expect(page.locator('#cat-list')).toContainText('Push Day');

  // ID bleibt stabil → Plan bleibt unter derselben ID verknüpft, Name ist aktualisiert
  const state = await page.evaluate(() => ({
    cats:  JSON.parse(localStorage.getItem('liftlog_categories_v1')),
    plans: JSON.parse(localStorage.getItem('liftlog_plans_v1')),
  }));
  const cat = state.cats.find((c) => c.id === 'cat-okpush');
  expect(cat.name).toBe('Push Day');
  expect(state.plans['cat-okpush']).toBeTruthy();          // Plan-Key unverändert
  expect(state.plans['cat-okpush'].haidhof.length).toBe(3);
});

test('Pläne: Übersicht zeigt Pläne mit Kategorienamen, Bearbeiten öffnet Editor', async ({ page }) => {
  await gotoSettings(page);
  await page.click('#set-scr-hub >> text=Trainingspläne');
  await expect(page.locator('#set-scr-plans')).toBeVisible();
  // Anzeige löst die Kategorie-ID zum Namen auf
  await expect(page.locator('#plan-list')).toContainText('OK-Push');
  await expect(page.locator('#plan-list')).toContainText('Sportpark Haidhof');
  await expect(page.locator('#plan-list')).toContainText('3 Übungen');

  await page.click('#plan-list .toggle-row:first-child .tr-edit');
  await expect(page.locator('#set-scr-plan-edit')).toBeVisible();
  await expect(page.locator('#plan-cat')).toHaveValue('cat-okpush');   // Value = ID
  await expect(page.locator('#plan-loc')).toHaveValue('haidhof');
  await expect(page.locator('#plan-ex-list input').first()).toHaveValue('Brustpresse');
});

test('Pläne: neuen Plan anlegen erscheint in der Übersicht', async ({ page }) => {
  await gotoSettings(page);
  await page.click('#set-scr-hub >> text=Trainingspläne');
  await page.click('#set-scr-plans button:has-text("Plan hinzufügen")');
  await expect(page.locator('#set-scr-plan-edit')).toBeVisible();
  await page.selectOption('#plan-cat', 'cat-cardio');
  await page.selectOption('#plan-loc', 'modern-coach');
  await page.click('#plan-add-btn');
  await page.fill('#plan-ex-list .plan-ex-row:last-child input', 'Laufband');
  await page.click('#plan-save-btn');
  await expect(page.locator('#set-scr-plans')).toBeVisible();
  await expect(page.locator('#plan-list')).toContainText('Cardio');
  await expect(page.locator('#plan-list')).toContainText('1 Übung');

  // Plan wurde nach Kategorie-ID gespeichert
  const plans = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_plans_v1')));
  expect(plans['cat-cardio']['modern-coach']).toEqual(['Laufband']);
});
