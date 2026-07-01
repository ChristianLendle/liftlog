// @ts-check
const { test, expect } = require('@playwright/test');
const { sbMock } = require('./sb-mock');

// Bootet die App hinters Auth-Gate (Supabase gemockt) mit leerem cfg/weight.
async function setup(page) {
  await page.addInitScript(sbMock);
  await page.addInitScript(() => {
    localStorage.removeItem('liftlog_cfg_v1');
    localStorage.removeItem('liftlog_weight_v1');
  });
  await page.setViewportSize({ width: 1000, height: 820 }); // Desktop → Top-Nav sichtbar
  await page.goto('/');
  await page.waitForSelector('#login-gate', { state: 'hidden' });
  await page.waitForSelector('#fab-pill');
  await page.click('#nav-settings');                         // Tab „Profil"
  await expect(page.locator('#set-scr-hub')).toBeVisible();
}

test.describe('Profil — Grunddaten & Ziel', () => {

  test('Tab heißt „Profil" und Hub zeigt Körper & Ziel', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#nav-settings')).toHaveText('Profil');
    await expect(page.locator('#set-scr-hub .set-hub-title')).toHaveText('Profil');
    await expect(page.locator('[data-act="settingsNav"][data-arg="grunddaten"]')).toBeVisible();
    await expect(page.locator('[data-act="settingsNav"][data-arg="ziel"]')).toBeVisible();
  });

  test('Grunddaten: BMR rechnet live und wird gespeichert', async ({ page }) => {
    await setup(page);
    await page.click('[data-act="settingsNav"][data-arg="grunddaten"]');
    await expect(page.locator('#set-scr-grunddaten')).toBeVisible();
    await expect(page.locator('#gd-bmr')).toHaveText('—');           // noch keine Daten

    await page.selectOption('#gd-sex', 'm');
    await page.fill('#gd-birthyear', '1995');
    await page.fill('#gd-height', '182');
    await page.fill('#gd-startweight', '84');

    // Live-BMR (Mifflin-St Jeor) zeigt jetzt einen Wert
    await expect(page.locator('#gd-bmr')).toContainText('kcal');
    await expect(page.locator('#gd-bmr')).not.toHaveText('—');

    await page.click('[data-act="saveGrunddaten"]');
    await expect(page.locator('#set-scr-hub')).toBeVisible();         // zurück auf Hub
    await expect(page.locator('#set-bmr-val')).toContainText('kcal'); // Hub-Summary aktualisiert

    // persistiert in cfg.profile + Startgewicht als Weight-Eintrag (§3)
    const stored = await page.evaluate(() => ({
      profile: JSON.parse(localStorage.getItem('liftlog_cfg_v1')).profile,
      weight:  JSON.parse(localStorage.getItem('liftlog_weight_v1') || '[]'),
    }));
    expect(stored.profile.sex).toBe('m');
    expect(stored.profile.heightCm).toBe(182);
    expect(stored.profile.startWeight).toBe(84);
    expect(stored.weight.some(w => w.note === 'Startgewicht' && w.weight === 84)).toBe(true);
  });

  test('Ziel: Tagesziel + Makros erscheinen und werden gespeichert', async ({ page }) => {
    await setup(page);
    // Grunddaten vorab setzen (Ziel braucht BMR)
    await page.click('[data-act="settingsNav"][data-arg="grunddaten"]');
    await page.selectOption('#gd-sex', 'm');
    await page.fill('#gd-birthyear', '1995');
    await page.fill('#gd-height', '182');
    await page.fill('#gd-startweight', '84');
    await page.click('[data-act="saveGrunddaten"]');

    await page.click('[data-act="settingsNav"][data-arg="ziel"]');
    await expect(page.locator('#set-scr-ziel')).toBeVisible();
    await page.selectOption('#z-goal', 'cut');

    await expect(page.locator('#z-target')).not.toHaveText('—');
    await expect(page.locator('#z-mp')).not.toHaveText('—');        // Protein
    await expect(page.locator('#z-mf')).not.toHaveText('—');        // Fett

    await page.click('[data-act="saveZiel"]');
    await expect(page.locator('#set-goal-val')).toHaveText('Abnehmen');

    const goal = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_cfg_v1')).profile.goal);
    expect(goal).toBe('cut');
  });

  test('Konto & Login: Gefahrenzone öffnet Löschen, Passwort-Modal verlangt aktuelles Passwort', async ({ page }) => {
    await setup(page);
    await page.click('[data-act="settingsNav"][data-arg="creds"]');
    await expect(page.locator('#set-scr-creds')).toBeVisible();

    // Gefahrenzone (Daten löschen) liegt jetzt unter Konto & Login
    await page.click('#set-scr-creds [data-act="settingsNav"][data-arg="del"]');
    await expect(page.locator('#set-scr-del')).toBeVisible();
    await page.click('#set-scr-del [data-act="settingsBack"]');
    await expect(page.locator('#set-scr-creds')).toBeVisible();      // zurück auf Konto & Login (nicht Chooser)

    // Passwort-ändern-Modal hat das neue Feld "Aktuelles Passwort"
    await page.click('[data-act="openPasswordChangeModal"]');
    await expect(page.locator('#m-password-change')).toBeVisible();
    await expect(page.locator('#pw-change-current')).toBeVisible();
  });

});
