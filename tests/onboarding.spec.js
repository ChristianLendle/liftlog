// @ts-check
const { test, expect } = require('@playwright/test');
const { sbMock } = require('./sb-mock');

// Simuliert "gerade registriert" über den Marker aus regSubmit(), statt die volle
// Registrierungs-UI (E-Mail/Passwort/Cropper) durchzuklicken — der Wizard selbst
// ist unabhängig vom Registrierungsformular testbar.
async function setup(page, { pending = true } = {}) {
  await page.addInitScript(sbMock);
  await page.addInitScript((pending) => {
    localStorage.removeItem('liftlog_cfg_v1');
    localStorage.removeItem('liftlog_weight_v1');
    if (pending) localStorage.setItem('liftlog_pending_onboarding', '1');
    else localStorage.removeItem('liftlog_pending_onboarding');
  }, pending);
  await page.goto('/');
  await page.waitForSelector('#login-gate', { state: 'hidden' });
  await page.waitForSelector('#fab-pill');
}

test.describe('Onboarding-Wizard (§3)', () => {

  test('Öffnet sich automatisch nach Registrierung (Pending-Marker), sonst nicht', async ({ page }) => {
    await setup(page, { pending: true });
    await expect(page.locator('#m-onboarding')).toBeVisible();
    // Marker konsumiert sich selbst
    const pending = await page.evaluate(() => localStorage.getItem('liftlog_pending_onboarding'));
    expect(pending).toBeNull();
  });

  test('Erscheint NICHT bei normalem Login ohne Marker', async ({ page }) => {
    await setup(page, { pending: false });
    await expect(page.locator('#m-onboarding')).toBeHidden();
  });

  test('Alle 5 Schritte sind vollständig überspringbar (nur "Weiter" klicken)', async ({ page }) => {
    await setup(page);
    for (let i = 1; i <= 5; i++) {
      await expect(page.locator(`#ob-step-${i}`)).toBeVisible();
      await page.click('#ob-next-btn');
    }
    await expect(page.locator('#m-onboarding')).toBeHidden();
    const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_cfg_v1') || '{}').profile);
    expect(profile?.sex ?? null).toBeNull();
    expect(profile?.goal ?? null).toBeNull();
  });

  test('Zurück-Button navigiert zwischen Schritten, ist auf Schritt 1 versteckt', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#ob-back-btn')).toBeHidden();
    await page.click('#ob-next-btn');
    await expect(page.locator('#ob-step-2')).toBeVisible();
    await expect(page.locator('#ob-back-btn')).toBeVisible();
    await page.click('#ob-back-btn');
    await expect(page.locator('#ob-step-1')).toBeVisible();
  });

  test('Ausgefüllte Schritte werden gespeichert; Startgewicht legt Weight-Eintrag an (§3)', async ({ page }) => {
    await setup(page);
    // Schritt 1: Basis
    await page.selectOption('#ob-sex', 'm');
    await page.fill('#ob-birthyear', '1995');
    await page.fill('#ob-height', '182');
    await page.click('#ob-next-btn');
    // Schritt 2: Startgewicht
    await page.fill('#ob-weight', '84');
    await page.fill('#ob-kfa', '18');
    await page.click('#ob-next-btn');
    // Schritt 3: Ziel
    await page.selectOption('#ob-goal', 'cut');
    await page.click('#ob-next-btn');
    // Schritt 4: Ernährung
    await page.selectOption('#ob-diet', 'vegan');
    await page.click('#ob-next-btn');
    // Schritt 5: Aktivität
    await page.selectOption('#ob-activity', '1.375');
    await expect(page.locator('#ob-next-btn')).toHaveText('Fertig ✓');
    await page.click('#ob-next-btn');

    await expect(page.locator('#m-onboarding')).toBeHidden();
    const stored = await page.evaluate(() => ({
      profile: JSON.parse(localStorage.getItem('liftlog_cfg_v1')).profile,
      weight:  JSON.parse(localStorage.getItem('liftlog_weight_v1') || '[]'),
    }));
    expect(stored.profile.sex).toBe('m');
    expect(stored.profile.heightCm).toBe(182);
    expect(stored.profile.startWeight).toBe(84);
    expect(stored.profile.goal).toBe('cut');
    expect(stored.profile.dietType).toBe('vegan');
    expect(stored.profile.activityBaseline).toBe(1.375);
    expect(stored.weight.some(w => w.kg === 84 && w.kfa === 18)).toBe(true);
  });

  test('Vorzeitiges Schließen (✕) behält bereits ausgefüllte Schritte', async ({ page }) => {
    await setup(page);
    await page.selectOption('#ob-sex', 'f');
    await page.fill('#ob-birthyear', '1990');
    await page.fill('#ob-height', '168');
    await page.click('[data-act="obClose"]');

    await expect(page.locator('#m-onboarding')).toBeHidden();
    const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_cfg_v1')).profile);
    expect(profile.sex).toBe('f');
    expect(profile.heightCm).toBe(168);
  });

});
