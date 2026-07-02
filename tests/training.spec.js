// @ts-check
const { test, expect } = require('@playwright/test');
const { sbMock } = require('./sb-mock');

// Seit der User-Daten-Isolation (Commit 20b8ad9) starten neue/leere Nutzer ohne
// Kategorien, Standorte oder Pläne (DEFAULT_* sind leer). Der Test-Mock-User hat
// keine Remote-Daten, daher müssen Kategorien/Standorte/Pläne lokal geseedet
// werden, damit OK-Push/Cardio + Sportpark Haidhof verfügbar sind.
// Kategorien haben stabile IDs; Pläne sind nach Kategorie-ID × Standort-Key
// verschlüsselt. Das Log-Modal wählt weiterhin nach Namen aus (Snapshot).
const SEED = {
  categories: [
    { id: 'cat-okpush',     name: 'OK-Push',    enabled: true },
    { id: 'cat-okpull',     name: 'OK-Pull',    enabled: true },
    { id: 'cat-legs',       name: 'Legs',       enabled: true },
    { id: 'cat-cardio',     name: 'Cardio',     enabled: true },
    { id: 'cat-individual', name: 'Individual', enabled: true },
  ],
  locations: [
    { key: 'haidhof',      label: 'Sportpark Haidhof',      enabled: true },
    { key: 'modern-coach', label: 'Modern Coach Deggendorf', enabled: true },
  ],
  plans: {
    'cat-okpush': {
      'haidhof':      ['Brustpresse', 'Schrägbank', 'Flys Kabel', 'Seitheben Maschine', 'Seitheben Kabel', 'KH Skullcrusher', 'Trizepsstrecker'],
      'modern-coach': ['Frei Bankdrücken', 'Pure Hart Schrägbank', 'Flys Kabel', 'Pull ups', 'TBar', 'KH Skullcrusher', 'Seitheben Kabel', 'Trizepsstrecker'],
    },
    'cat-okpull': {
      'haidhof':      ['Pull ups', 'Lattzug', 'Seitheben KH', 'Schrägbank gym80', 'TBar', 'Triceps Extension', 'Reverse Flys', 'Flys Kabel sitzend', 'Curls Seil'],
      'modern-coach': ['TBar', 'Pull ups', 'Lattzug', 'Schrägbank', 'Überzüge', 'Rudern', 'Hammer Curls', 'Bizeps Curls'],
    },
    'cat-legs': {
      'haidhof':      ['Beinpresse', 'Beinstrecker', 'Bein Curl', 'Wade'],
      'modern-coach': ['Beinpresse', 'Beinstrecker', 'Bein Curl', 'Wade'],
    },
    'cat-individual': {
      'haidhof':      [],
      'modern-coach': [],
    },
  },
};

// Clears active session and seeds categories/locations/plans before each test.
async function setup(page) {
  await page.addInitScript(sbMock); // bypass Supabase auth gate
  await page.addInitScript((seed) => {
    localStorage.removeItem('liftlog_active_v1');
    // Keep DB intact so we can verify saved sessions later
    localStorage.setItem('liftlog_categories_v1', JSON.stringify(seed.categories));
    localStorage.setItem('liftlog_locations_v1',  JSON.stringify(seed.locations));
    localStorage.setItem('liftlog_plans_v1',      JSON.stringify(seed.plans));
  }, SEED);
  await page.goto('/');
  await page.waitForSelector('#login-gate', { state: 'hidden' });
  await page.waitForSelector('#fab-pill');
}

// Opens the training modal via the FAB menu.
async function openTrainingModal(page) {
  await page.click('#fab-pill');
  await page.click('text=Neues Training');
  await expect(page.locator('#view-training')).toBeVisible();
}

// Fills the required header fields (Datum, Kategorie, Standort, Mood).
// Uses OK-Push + Sportpark Haidhof so the default plan has exercises.
async function fillTrainingHeader(page, {
  date     = '2026-06-12',
  category = 'OK-Push',
  location = 'Sportpark Haidhof',
  mood     = 'good',
} = {}) {
  await page.fill('#log-date', date);
  await page.selectOption('#log-cat',  category);
  await page.selectOption('#log-loc',  location);
  // Mood ist jetzt ein Segment-Selektor (Buttons), kein <select> mehr
  await page.click(`#log-mood-seg .mood-seg-btn[data-mood="${mood}"]`);
}

// ─── Training tracken ─────────────────────────────────────────────────────

test.describe('Training tracken', () => {

  test('Modal öffnet sich über FAB-Menü', async ({ page }) => {
    await setup(page);
    await openTrainingModal(page);
    await expect(page.locator('#log-title')).toHaveText('Neues Training');
  });

  test('Übungen laden nach Kategorie + Standort', async ({ page }) => {
    await setup(page);
    await openTrainingModal(page);
    await fillTrainingHeader(page);

    // Kraft-Bereich wird sichtbar
    await expect(page.locator('#log-strength')).toBeVisible();

    // Mindestens eine Übung aus dem OK-Push/Haidhof-Plan geladen
    const exList = page.locator('#log-ex-list');
    await expect(exList).not.toBeEmpty();
    // Erste Übung aus dem Default-Plan
    await expect(page.locator('#log-ex-list input').first()).toHaveValue('Brustpresse');
  });

  test('Cardio-Felder erscheinen bei Kategorie Cardio', async ({ page }) => {
    await setup(page);
    await openTrainingModal(page);
    await page.fill('#log-date', '2026-06-12');
    await page.selectOption('#log-cat', 'Cardio');

    await expect(page.locator('#log-cardio')).toBeVisible();
    await expect(page.locator('#log-strength')).not.toBeVisible();
  });

  test('Training abschließen speichert Session', async ({ page }) => {
    await setup(page);
    await openTrainingModal(page);
    await fillTrainingHeader(page);

    // Auf die geladene Übungsliste warten
    await expect(page.locator('#log-ex-list')).not.toBeEmpty();

    await page.click('text=Abschließen');

    // Modal geschlossen
    await expect(page.locator('#view-training')).not.toBeVisible();

    // Session in der Sessions-Ansicht prüfen (Tab „Training" → Segment Sessions)
    await page.click('#nav-train');
    // Mindestens eine Session-Karte sollte erscheinen
    await expect(page.locator('#session-list .s-card')).toHaveCount(1);
  });

  test('Training pausieren — Modal schließt, Toast erscheint', async ({ page }) => {
    await setup(page);
    await openTrainingModal(page);
    await fillTrainingHeader(page);
    await expect(page.locator('#log-ex-list')).not.toBeEmpty();

    // "Training fortsetzen"-Button pausiert die Session und schließt das Modal
    await expect(page.locator('#btn-pause-session')).toBeVisible();
    await page.click('#btn-pause-session');

    await expect(page.locator('#view-training')).not.toBeVisible();

    // Toast-Meldung
    await expect(page.locator('body')).toContainText('pausiert');
  });

  test('Pausiertes Training fortsetzen', async ({ page }) => {
    await setup(page);
    await openTrainingModal(page);
    await fillTrainingHeader(page);
    await expect(page.locator('#log-ex-list')).not.toBeEmpty();

    // Pausieren
    await page.click('#btn-pause-session');
    await expect(page.locator('#view-training')).not.toBeVisible();

    // Aktive Session — FAB-Klick öffnet direkt das Modal
    await page.click('#fab-pill');
    await expect(page.locator('#view-training')).toBeVisible();

    // Titel zeigt "Training fortsetzen"
    await expect(page.locator('#log-title')).toHaveText('Training fortsetzen');

    // Felder noch befüllt
    await expect(page.locator('#log-cat')).toHaveValue('OK-Push');
  });

  test('Pausiertes Training abschließen', async ({ page }) => {
    await setup(page);
    await openTrainingModal(page);
    await fillTrainingHeader(page);
    await expect(page.locator('#log-ex-list')).not.toBeEmpty();

    // Pausieren dann wieder öffnen
    await page.click('#btn-pause-session');
    await page.click('#fab-pill');
    await expect(page.locator('#view-training')).toBeVisible();

    // Abschließen
    await page.click('text=Abschließen');
    await expect(page.locator('#view-training')).not.toBeVisible();
  });

  test('Training abbrechen schließt Modal', async ({ page }) => {
    await setup(page);
    await openTrainingModal(page);
    await fillTrainingHeader(page);

    // Abbrechen (kein confirm-Dialog weil auto-save noch nicht gelaufen)
    await page.click('#btn-abort');
    await expect(page.locator('#view-training')).not.toBeVisible();
  });

  test('Abbrechen mit aktiver Session — Bestätigungs-Dialog', async ({ page }) => {
    await setup(page);
    await openTrainingModal(page);
    await fillTrainingHeader(page);
    await expect(page.locator('#log-ex-list')).not.toBeEmpty();

    // 700 ms warten bis auto-save die Session in localStorage geschrieben hat
    await page.waitForTimeout(700);

    // Styled confirm modal statt native confirm()
    await page.click('#btn-abort');
    await expect(page.locator('#m-abort')).toBeVisible();
    await page.click('text=Ja, abbrechen');

    await expect(page.locator('#m-abort')).not.toBeVisible();
    await expect(page.locator('#view-training')).not.toBeVisible();
  });

});
