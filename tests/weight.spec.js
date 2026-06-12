// @ts-check
const { test, expect } = require('@playwright/test');

// Bypasses the password gate and clears leftover data before each test.
async function setup(page, { seedWeight = null } = {}) {
  await page.addInitScript((entry) => {
    sessionStorage.setItem('liftlog_auth', '1');
    localStorage.removeItem('liftlog_active_v1');
    localStorage.removeItem('liftlog_weight_v1');
    if (entry) {
      localStorage.setItem('liftlog_weight_v1', JSON.stringify([entry]));
    }
  }, seedWeight);
  await page.goto('/');
  await page.waitForSelector('#fab-btn');
}

// ─── Gewicht erfassen ──────────────────────────────────────────────────────

test.describe('Gewicht erfassen', () => {

  test('Modal öffnet sich über FAB-Menü', async ({ page }) => {
    await setup(page);

    await page.click('#fab-btn');
    await page.click('text=Gewicht tracken');

    await expect(page.locator('#m-weight')).toBeVisible();
    await expect(page.locator('#wt-modal-title')).toHaveText('Gewicht eintragen');
    // Löschen-Button darf beim Neuanlegen nicht sichtbar sein
    await expect(page.locator('#wt-delete-btn')).not.toBeVisible();
  });

  test('Eintrag speichern — Stat-Kacheln aktualisieren sich', async ({ page }) => {
    await setup(page);

    // Modal öffnen
    await page.click('#fab-btn');
    await page.click('text=Gewicht tracken');

    // Formular ausfüllen
    await page.fill('#wt-date', '2026-06-12');
    await page.fill('#wt-kg', '82.5');
    await page.fill('#wt-kfa', '14.2');
    await page.locator('#m-weight').getByRole('button', { name: 'Speichern' }).click();

    // Modal geschlossen
    await expect(page.locator('#m-weight')).not.toBeVisible();

    // Zur Körper-Ansicht wechseln
    await page.click('#nav-body');
    await expect(page.locator('#wt-stat-current')).toHaveText('82.5 kg');
    await expect(page.locator('#wt-stat-kfa')).toHaveText('14.2 %');
  });

  test('Eintrag ohne KFA speichern', async ({ page }) => {
    await setup(page);

    await page.click('#fab-btn');
    await page.click('text=Gewicht tracken');
    await page.fill('#wt-date', '2026-06-12');
    await page.fill('#wt-kg', '80.0');
    // KFA leer lassen
    await page.locator('#m-weight').getByRole('button', { name: 'Speichern' }).click();

    await page.click('#nav-body');
    await expect(page.locator('#wt-stat-current')).toHaveText('80 kg');
    await expect(page.locator('#wt-stat-kfa')).toHaveText('—');
  });

  test('Bestehenden Eintrag bearbeiten — Löschen-Button erscheint', async ({ page }) => {
    await setup(page, {
      seedWeight: { id: 'test-1', date: '2026-06-10', kg: 83.0, kfa: 15.0 },
    });

    // Zur Körper-Ansicht wechseln damit der Eintrag geladen wird
    await page.click('#nav-body');
    // Eintrag über JS-Funktion im Edit-Modus öffnen
    await page.evaluate(() => window.editWeightEntry('2026-06-10'));

    await expect(page.locator('#m-weight')).toBeVisible();
    await expect(page.locator('#wt-modal-title')).toHaveText('Eintrag bearbeiten');
    await expect(page.locator('#wt-delete-btn')).toBeVisible();
    await expect(page.locator('#wt-kg')).toHaveValue('83');
  });

  test('Eintrag löschen', async ({ page }) => {
    await setup(page, {
      seedWeight: { id: 'test-1', date: '2026-06-10', kg: 83.0, kfa: null },
    });

    await page.click('#nav-body');
    await expect(page.locator('#wt-stat-current')).toHaveText('83 kg');

    // Edit-Modal öffnen und löschen
    await page.evaluate(() => window.editWeightEntry('2026-06-10'));
    page.on('dialog', d => d.accept());
    await page.click('#wt-delete-btn');

    // Kein Eintrag mehr
    await expect(page.locator('#wt-stat-current')).toHaveText('—');
  });

  test('Abbrechen schließt Modal ohne zu speichern', async ({ page }) => {
    await setup(page);

    await page.click('#fab-btn');
    await page.click('text=Gewicht tracken');
    await page.fill('#wt-kg', '99.9');
    await page.locator('#m-weight').getByRole('button', { name: 'Abbrechen' }).click();

    await expect(page.locator('#m-weight')).not.toBeVisible();

    // Kein Eintrag gespeichert
    await page.click('#nav-body');
    await expect(page.locator('#wt-stat-current')).toHaveText('—');
  });

});
