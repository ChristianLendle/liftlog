// @ts-check
const { test, expect } = require('@playwright/test');

// sbMock (sb-mock.js) simuliert einen bereits eingeloggten User und überspringt damit
// das Login-Gate komplett — für die Registrierungs-UI (die INNERHALB des Gates liegt)
// braucht es einen ausgeloggten Zustand, deshalb ein eigener, minimaler Mock hier.
function loggedOutMock() {
  const ok = (data = null) => Promise.resolve({ data, error: null });
  const makeQuery = () => {
    const qb = {
      select: () => qb, eq: () => qb, order: () => qb, limit: () => qb,
      insert: () => qb, update: () => qb, delete: () => qb, upsert: () => qb,
      single: () => ok(null), maybeSingle: () => ok(null),
      then: (resolve) => resolve({ data: null, error: null }),
    };
    return qb;
  };
  const client = {
    auth: {
      getUser: () => ok({ user: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signUp: () => ok({ user: { id: 'new-user' } }), // keine Session → simuliert E-Mail-Bestätigung aktiv
    },
    from: () => makeQuery(),
    storage: { from: () => ({ upload: () => ok({ path: '' }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
  };
  const stub = { createClient: () => client };
  Object.defineProperty(window, 'supabase', { configurable: true, get() { return stub; }, set() {} });
}

async function setup(page) {
  await page.addInitScript(loggedOutMock);
  await page.goto('/');
  await page.click('[data-act="gateShowC"]');
  await expect(page.locator('#reg-step-1')).toBeVisible();
}

async function fillStep1(page, { email = 'neu@example.de', pw = 'Test12345!' } = {}) {
  await page.fill('#reg-email', email);
  await page.fill('#reg-pw', pw);
  await page.fill('#reg-pw2', pw);
  await page.click('[data-act="regStep1Next"]');
  await expect(page.locator('#reg-step-2')).toBeVisible();
}

test.describe('Registrierung — schlanker 2-Schritte-Flow (Konto + Social-Profil)', () => {

  test('Nur 2 Schritte: Konto (E-Mail/Passwort) und Profil (Username/Anzeigename/Bild)', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#reg-step-dot-1')).toBeVisible();
    await expect(page.locator('#reg-step-dot-2')).toBeVisible();
    await expect(page.locator('#reg-step-dot-3')).toHaveCount(0);
    await expect(page.locator('#reg-step-3')).toHaveCount(0);
  });

  test('Schritt 2 fragt weder Trainingsziele, Hobbys, Alltag, Größe noch Fitness-Level ab', async ({ page }) => {
    await setup(page);
    await fillStep1(page);
    await expect(page.locator('#reg-goals')).toHaveCount(0);
    await expect(page.locator('#reg-hobbies')).toHaveCount(0);
    await expect(page.locator('#reg-lifestyle')).toHaveCount(0);
    await expect(page.locator('#reg-height')).toHaveCount(0);
    await expect(page.locator('#reg-fitness-level')).toHaveCount(0);
    // Diese Fragen laufen jetzt separat im Energie-Onboarding-Wizard (§3)
    await expect(page.locator('#reg-username')).toBeVisible();
    await expect(page.locator('#reg-displayname')).toBeVisible();
    await expect(page.locator('#reg-avatar')).toBeAttached();
  });

  test('Schritt 2 ist der letzte Schritt — Button heißt "Registrieren"', async ({ page }) => {
    await setup(page);
    await fillStep1(page);
    await expect(page.locator('[data-act="regStep2Next"]')).toHaveText('Registrieren');
  });

  test('Absenden erstellt das Konto ohne Social-Profil-Fragen (profileMeta nur username/display_name)', async ({ page }) => {
    await setup(page);
    await fillStep1(page);
    await page.fill('#reg-username', 'neuernutzer');
    await page.fill('#reg-displayname', 'Neuer Nutzer');
    await page.click('[data-act="regStep2Next"]');

    // sbMock liefert keine Session zurück (simuliert E-Mail-Bestätigung aktiv)
    await expect(page.locator('#reg-msg-2')).toContainText('Konto erstellt');
  });

});
