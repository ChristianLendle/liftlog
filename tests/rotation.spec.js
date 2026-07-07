// @ts-check
// Trainings-Rotation: Reihenfolge der Kategorien im Profil festlegen (Editor)
// und die "Nächstes Training"-Kachel auf dem Dashboard (siehe dashboard.spec.js
// für die Dashboard-seitigen Verhaltenstests).
const { test, expect } = require('@playwright/test');
const { sbMock } = require('./sb-mock');

const CATS = [
  { id: 'cat-push', name: 'Push', enabled: true },
  { id: 'cat-pull', name: 'Pull', enabled: true },
];

async function gotoRotation(page, { rotation = null } = {}) {
  await page.addInitScript(sbMock);
  await page.addInitScript((seed) => {
    localStorage.removeItem('liftlog_active_v1');
    localStorage.removeItem('liftlog_rotation_v1');
    localStorage.setItem('liftlog_categories_v1', JSON.stringify(seed.cats));
    if (seed.rotation) localStorage.setItem('liftlog_rotation_v1', JSON.stringify(seed.rotation));
  }, { cats: CATS, rotation });
  await page.goto('/');
  await page.waitForSelector('#login-gate', { state: 'hidden' });
  await page.click('#nav-settings');
  await page.click('#set-scr-hub >> text=Trainings-Rotation');
  await expect(page.locator('#set-scr-rotation')).toBeVisible();
}

test.describe('Profil — Trainings-Rotation Editor', () => {

  test('Leerer Zustand: Hinweistext, alle Kategorien in der Auswahl', async ({ page }) => {
    await gotoRotation(page);
    await expect(page.locator('#rotation-list')).toContainText('Noch keine Rotation');
    const options = await page.locator('#rotation-add-sel option').allTextContents();
    expect(options).toEqual(['— Kategorie wählen —', 'Push', 'Pull']);
  });

  test('Kategorie hinzufügen — erscheint in der Liste, verschwindet aus der Auswahl, persistiert', async ({ page }) => {
    await gotoRotation(page);
    await page.selectOption('#rotation-add-sel', { label: 'Push' });
    await page.click('[data-act="rotationAdd"]');

    await expect(page.locator('#rotation-list .rot-row')).toHaveCount(1);
    await expect(page.locator('#rotation-list')).toContainText('Push');
    const options = await page.locator('#rotation-add-sel option').allTextContents();
    expect(options).toEqual(['— Kategorie wählen —', 'Pull']);

    const rot = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_rotation_v1')));
    expect(rot.order).toEqual(['cat-push']);
  });

  test('Reihenfolge per Pfeil-Buttons ändern', async ({ page }) => {
    await gotoRotation(page, { rotation: { order: ['cat-push', 'cat-pull'], skip: 0 } });
    await page.click('#rotation-list .rot-row:nth-child(2) [data-arg2="-1"]');

    const names = await page.locator('.rot-row-name').allTextContents();
    expect(names).toEqual(['Pull', 'Push']);
    const rot = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_rotation_v1')));
    expect(rot.order).toEqual(['cat-pull', 'cat-push']);
  });

  test('Erste Zeile: Nach-oben deaktiviert; letzte Zeile: Nach-unten deaktiviert', async ({ page }) => {
    await gotoRotation(page, { rotation: { order: ['cat-push', 'cat-pull'], skip: 0 } });
    await expect(page.locator('#rotation-list .rot-row:first-child [data-arg2="-1"]')).toBeDisabled();
    await expect(page.locator('#rotation-list .rot-row:last-child [data-arg2="1"]')).toBeDisabled();
  });

  test('Kategorie entfernen — verschwindet aus der Liste, taucht wieder in der Auswahl auf', async ({ page }) => {
    await gotoRotation(page, { rotation: { order: ['cat-push', 'cat-pull'], skip: 0 } });
    await page.click('#rotation-list .rot-row:first-child .tr-del');

    await expect(page.locator('#rotation-list .rot-row')).toHaveCount(1);
    await expect(page.locator('#rotation-list')).toContainText('Pull');
    await expect(page.locator('#rotation-list')).not.toContainText('Push');

    const rot = await page.evaluate(() => JSON.parse(localStorage.getItem('liftlog_rotation_v1')));
    expect(rot.order).toEqual(['cat-pull']);
  });

});
