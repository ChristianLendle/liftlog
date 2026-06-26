// @ts-check
const { test, expect } = require('@playwright/test');
const { sbMock } = require('./sb-mock');

// Clears active session and DB before each test.
async function setup(page) {
  await page.addInitScript(sbMock); // bypass Supabase auth gate
  await page.addInitScript(() => {
    localStorage.removeItem('liftlog_active_v1');
    // Keep DB intact so we can verify saved sessions later
  });
  await page.goto('/');
  await page.waitForSelector('#login-gate', { state: 'hidden' });
  await page.waitForSelector('#fab-btn');
}

// Opens the training modal via the FAB menu.
async function openTrainingModal(page) {
  await page.click('#fab-btn');
  await page.click('text=Training starten');
  await expect(page.locator('#m-log')).toBeVisible();
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
  await page.selectOption('#log-mood', mood);
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
    await expect(page.locator('#m-log')).not.toBeVisible();

    // Session in der Sessions-Ansicht prüfen
    await page.click('#nav-sessions');
    // Mindestens eine Session-Karte sollte erscheinen
    await expect(page.locator('#s-sessions')).toHaveText('1');
  });

  test('Training pausieren — Modal schließt, Toast erscheint', async ({ page }) => {
    await setup(page);
    await openTrainingModal(page);
    await fillTrainingHeader(page);
    await expect(page.locator('#log-ex-list')).not.toBeEmpty();

    // "Training fortsetzen"-Button pausiert die Session und schließt das Modal
    await expect(page.locator('#btn-pause-session')).toBeVisible();
    await page.click('#btn-pause-session');

    await expect(page.locator('#m-log')).not.toBeVisible();

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
    await expect(page.locator('#m-log')).not.toBeVisible();

    // FAB-Badge signalisiert aktive Session — FAB-Klick öffnet direkt das Modal
    await page.click('#fab-btn');
    await expect(page.locator('#m-log')).toBeVisible();

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
    await page.click('#fab-btn');
    await expect(page.locator('#m-log')).toBeVisible();

    // Abschließen
    await page.click('text=Abschließen');
    await expect(page.locator('#m-log')).not.toBeVisible();
  });

  test('Training abbrechen schließt Modal', async ({ page }) => {
    await setup(page);
    await openTrainingModal(page);
    await fillTrainingHeader(page);

    // Abbrechen (kein confirm-Dialog weil auto-save noch nicht gelaufen)
    await page.click('#btn-abort');
    await expect(page.locator('#m-log')).not.toBeVisible();
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
    await expect(page.locator('#m-log')).not.toBeVisible();
  });

});
