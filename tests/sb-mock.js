// @ts-check
// Supabase test double injected via page.addInitScript() BEFORE any page script runs.
// It intercepts `window.supabase` with a getter/setter so the CDN UMD assignment is
// swallowed and `supabase.createClient()` returns a stub. This lets init()/loadApp()
// run past the auth gate without touching production code or the network.
//
// Defined as a standalone function so Playwright can serialize its source into the page.
function sbMock() {
  const ok = (data = null) => Promise.resolve({ data, error: null });

  // Chainable, awaitable query builder. Every filter/mutation returns the builder;
  // awaiting it (or .single()/.maybeSingle()) resolves to { data: null, error: null }.
  const makeQuery = () => {
    const qb = {
      select: () => qb,
      eq: () => qb,
      order: () => qb,
      limit: () => qb,
      insert: () => qb,
      update: () => qb,
      delete: () => qb,
      upsert: () => qb,
      single: () => ok(null),
      maybeSingle: () => ok(null),
      then: (resolve) => resolve({ data: null, error: null }), // thenable → awaitable
    };
    return qb;
  };

  const client = {
    auth: {
      getUser: () => ok({ user: { id: 'test-user', email: 'test@example.com' } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signInWithPassword: () => ok({ user: { id: 'test-user' } }),
      signUp: () => ok({ user: { id: 'test-user' } }),
      signOut: () => ok(),
      resetPasswordForEmail: () => ok(),
      updateUser: () => ok({ user: { id: 'test-user' } }),
    },
    from: () => makeQuery(),
    storage: {
      from: () => ({
        upload: () => ok({ path: '' }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
      }),
    },
  };

  const stub = { createClient: () => client };
  Object.defineProperty(window, 'supabase', {
    configurable: true,
    get() { return stub; },
    set() { /* swallow the CDN UMD assignment */ },
  });
}

module.exports = { sbMock };
