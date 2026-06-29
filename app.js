// ─────────────────────────────────────────────────────
//  CHART.JS GLOBAL DEFAULTS
// ─────────────────────────────────────────────────────
if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = "'Helvetica Neue', Helvetica, Arial, sans-serif";
  Chart.defaults.color = '#A8B4CC';
}

// ─────────────────────────────────────────────────────
//  TRAINING PLANS
// ─────────────────────────────────────────────────────
const DEFAULT_PLANS = {};

const PLANS_KEY = 'liftlog_plans_v1';
const getPlans = () => { try { return JSON.parse(localStorage.getItem(PLANS_KEY)) || DEFAULT_PLANS; } catch { return DEFAULT_PLANS; } };
const savePlansToStorage = p => { localStorage.setItem(PLANS_KEY, JSON.stringify(p)); syncAllUserData(); };

// LOC_LABEL is computed dynamically from stored locations (see buildLocLabel())
// Static fallback for backward compat with old keys
const LOC_LABEL_STATIC = { 'haidhof': 'Sportpark Haidhof', 'modern-coach': 'Modern Coach Deggendorf' };
const LOC_KEY   = { 'Sportpark Haidhof': 'haidhof', 'Modern Coach': 'modern-coach', 'Modern Coach Deggendorf': 'modern-coach' };
// Helper: resolve a location key to its display label
function locLabel(key) {
  const dyn = buildLocLabel();
  return dyn[key] || LOC_LABEL_STATIC[key] || key;
}

const MOOD_LABEL = { 'great': '😁 Großartig', 'good': '🙂 Gut', 'ok': '😴 Ok', 'bad': '🤒 Schlecht' };
const MOOD_KEY   = { '😁 Großartig': 'great', '🙂 Gut': 'good', '😴 Ok': 'ok', '🤒 Schlecht': 'bad' };

// ─────────────────────────────────────────────────────
//  CATEGORIES
// ─────────────────────────────────────────────────────
const CATEGORIES_KEY      = 'liftlog_categories_v1';
const DEFAULT_CATEGORIES  = [];

function getCategories() {
  try {
    const stored = JSON.parse(localStorage.getItem(CATEGORIES_KEY));
    if (stored && Array.isArray(stored)) return stored;
  } catch {}
  return DEFAULT_CATEGORIES.map(name => ({ name, enabled: true }));
}

function saveCategories(cats) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
  syncAllUserData();
}

function getEnabledCategories() {
  return getCategories().filter(c => c.enabled).map(c => c.name);
}

// ─────────────────────────────────────────────────────
//  LOCATIONS
// ─────────────────────────────────────────────────────
const LOCATIONS_KEY = 'liftlog_locations_v1';
const DEFAULT_LOCATIONS = [];

function getLocations() {
  try {
    const stored = JSON.parse(localStorage.getItem(LOCATIONS_KEY));
    if (stored && Array.isArray(stored)) return stored;
  } catch {}
  return DEFAULT_LOCATIONS.map(l => ({ ...l }));
}

function saveLocations(locs) {
  localStorage.setItem(LOCATIONS_KEY, JSON.stringify(locs));
  syncAllUserData();
}

function getEnabledLocations() {
  return getLocations().filter(l => l.enabled);
}

// Build LOC_LABEL dynamically from stored locations (keeps backward compat keys)
function buildLocLabel() {
  const out = {};
  getLocations().forEach(l => { out[l.key] = l.label; });
  return out;
}

function populateLocationSelects() {
  const all     = getLocations();
  const enabled = all.filter(l => l.enabled);

  const buildOpts = (el, locs) => {
    const val = el.value;
    el.innerHTML = '<option value="">— auswählen —</option>' +
      locs.map(l => `<option value="${l.key}"${l.key === val ? ' selected' : ''}>${l.label}</option>`).join('');
  };

  buildOpts(document.getElementById('log-loc'),  enabled);
  buildOpts(document.getElementById('plan-loc'), all);
}

// Populate all category <select> elements dynamically
function populateCategorySelects() {
  const all     = getCategories();
  const enabled = all.filter(c => c.enabled).map(c => c.name);

  // Log modal
  const logCat = document.getElementById('log-cat');
  const logVal = logCat.value;
  logCat.innerHTML = '<option value="">— auswählen —</option>' +
    enabled.map(n => `<option${n === logVal ? ' selected' : ''}>${n}</option>`).join('');

  // Plan editor (show all, incl. disabled)
  const planCat = document.getElementById('plan-cat');
  const planVal = planCat.value;
  planCat.innerHTML = '<option value="">— auswählen —</option>' +
    all.map(c => `<option${c.name === planVal ? ' selected' : ''}>${c.name}</option>`).join('');
}

// ─────────────────────────────────────────────────────
//  UTILS
// ─────────────────────────────────────────────────────
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);

// Escape for HTML text / attribute context
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
// Escape for a single-quoted JS string embedded inside an inline handler attribute
function escAttr(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function toast(msg, err = false) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.background = err ? '#cc2222' : 'var(--accent)';
  el.style.color = err ? '#fff' : '#ffffff';
  el.style.pointerEvents = 'none';
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2400);
}

// Toast with an inline "Rückgängig" (undo) action (Item 11)
let _undoFn = null;
function toastUndo(msg, undoFn) {
  const el = document.getElementById('toast');
  _undoFn = undoFn;
  el.style.background = 'var(--accent)';
  el.style.color = '#ffffff';
  el.style.pointerEvents = 'auto';
  el.innerHTML = `<span>${msg}</span><button data-act="doUndo" style="background:none;border:none;color:#fff;font:inherit;font-weight:700;text-decoration:underline;cursor:pointer;margin-left:12px;text-transform:uppercase;letter-spacing:.08em">Rückgängig</button>`;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.classList.remove('show'); el.style.pointerEvents = 'none'; _undoFn = null; }, 5000);
}
function doUndo() {
  const fn = _undoFn; _undoFn = null;
  const el = document.getElementById('toast');
  el.classList.remove('show');
  el.style.pointerEvents = 'none';
  clearTimeout(el._t);
  if (fn) fn();
}

function openM(id)  { document.getElementById(id).classList.add('open'); }
function closeM(id) { document.getElementById(id).classList.remove('open'); }
document.querySelectorAll('.overlay').forEach(o =>
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); })
);

// Timestamp helpers (Europe/Berlin)
function nowBerlin() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }).replace(' ', 'T');
}

// hh:mm for session detail (rounded to whole minutes)
function formatDurationHM(totalMinutes) {
  if (totalMinutes == null || totalMinutes <= 0) return null;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

// minutes from timestamps (strength)
function durationMinutes(startedAt, finishedAt) {
  if (!startedAt || !finishedAt) return null;
  const diffMs = new Date(finishedAt) - new Date(startedAt);
  return diffMs > 0 ? Math.round(diffMs / 60000) : null;
}

// unified: cardio → manual duration_min, strength → timestamps
function sessionDurationMinutes(s) {
  if (s.type === 'cardio' || /cardio/i.test(s.category)) {
    return s.cardio?.duration_min ? Math.round(s.cardio.duration_min) : null;
  }
  return durationMinutes(s.startedAt, s.finishedAt);
}

// ─────────────────────────────────────────────────────
//  STORAGE
// ─────────────────────────────────────────────────────
const DB_KEY     = 'liftlog_db_v1';
const CFG_KEY    = 'liftlog_cfg_v1';
const ACTIVE_KEY = 'liftlog_active_v1';
const WEIGHT_KEY  = 'liftlog_weight_v1';
const getWeightEntries  = () => JSON.parse(localStorage.getItem(WEIGHT_KEY) || '[]');
const saveWeightEntries = (entries) => { localStorage.setItem(WEIGHT_KEY, JSON.stringify(entries)); syncAllUserData(); };


// ─── SUPABASE ─────────────────────────────────────────────────────────────────
const _SB = supabase.createClient(
  'https://tijeptnrwerfpjsfzqrt.supabase.co',
  'sb_publishable_8-pGUpzwqco3bKWemcdAhg_y3Cd6IDU'
);

const getCfg = () => {
  const stored = JSON.parse(localStorage.getItem(CFG_KEY) || '{}');
  return { streakMin: stored.streakMin || 3 };
};
const setCfg  = c  => { localStorage.setItem(CFG_KEY, JSON.stringify(c)); syncAllUserData(); };
const loadDB  = () => { try { return JSON.parse(localStorage.getItem(DB_KEY)) || { sessions: [] }; } catch { return { sessions: [] }; } };
const writeDB = db => { localStorage.setItem(DB_KEY, JSON.stringify(db)); syncAllUserData(); };

const loadActive  = () => { try { return JSON.parse(localStorage.getItem(ACTIVE_KEY)); } catch { return null; } };
const clearActive = () => { localStorage.removeItem(ACTIVE_KEY); updateStartBtn(); };

async function syncAllUserData() {
  try {
    const { data: { user } } = await _SB.auth.getUser();
    if (!user) return;
    const payload = {
      sessions:   loadDB().sessions,
      weightLog:  getWeightEntries(),
      plans:      getPlans(),
      categories: getCategories(),
      locations:  getLocations(),
      cfg:        getCfg(),
    };
    await _SB.from('liftlog_data').upsert(
      { user_id: user.id, data: payload, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  } catch {}
}

// Alias für Abwärtskompatibilität
const syncSupabase = () => syncAllUserData();

/**
 * Stellt den vollständigen User-Datenstand aus dem Cloud-Snapshot wieder her.
 * Sessions werden per ID gemerged (kein Datenverlust bei Offline-Nutzung).
 * Pläne, Kategorien, Standorte, Config: Remote gewinnt (Config ist nicht additiv).
 * Gewicht: Merge per Datum, Remote gewinnt bei Konflikt.
 */
function restoreFromRemote(remote) {
  if (!remote) return;

  // ── Sessions: ID-basierter Merge ──────────────────────
  if (Array.isArray(remote.sessions)) {
    const local = loadDB();
    const byId  = {};
    for (const s of (local.sessions || [])) byId[s.id] = s;
    for (const s of remote.sessions)        byId[s.id] = s; // remote überschreibt bei gleicher ID
    const merged = Object.values(byId).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    localStorage.setItem(DB_KEY, JSON.stringify({ sessions: merged }));
  }

  // ── Gewicht: Merge per Datum ──────────────────────────
  if (Array.isArray(remote.weightLog)) {
    const localW = getWeightEntries();
    const byDate = {};
    for (const e of localW)           byDate[e.date] = e;
    for (const e of remote.weightLog) byDate[e.date] = e; // remote gewinnt
    const merged = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
    localStorage.setItem(WEIGHT_KEY, JSON.stringify(merged));
  }

  // ── Konfiguration: Remote gewinnt direkt ──────────────
  if (remote.plans      !== undefined) localStorage.setItem(PLANS_KEY,      JSON.stringify(remote.plans));
  if (remote.categories !== undefined) localStorage.setItem(CATEGORIES_KEY, JSON.stringify(remote.categories));
  if (remote.locations  !== undefined) localStorage.setItem(LOCATIONS_KEY,  JSON.stringify(remote.locations));
  if (remote.cfg        !== undefined) localStorage.setItem(CFG_KEY,        JSON.stringify(remote.cfg));
}

async function fetchSupabase() {
  try {
    const { data: { user } } = await _SB.auth.getUser();
    if (!user) return null;
    const { data } = await _SB.from('liftlog_data').select('data').eq('user_id', user.id).single();
    return data?.data || null;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────
//  ACTIVE SESSION AUTO-SAVE
// ─────────────────────────────────────────────────────
let autoSaveTimer = null;

function triggerAutoSave() {
  if (editingId) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(saveActiveSession, 600);
}

function saveActiveSession() {
  if (editingId) return;
  const date   = document.getElementById('log-date').value;
  const cat    = document.getElementById('log-cat').value;
  const locKey = document.getElementById('log-loc').value;
  const mood   = document.getElementById('log-mood').value;
  if (!date || !cat) return;

  const isCardio = cat === 'Cardio';
  const existing = loadActive();
  // Preserve startedAt from existing active session (don't reset on re-save)
  const active = { startedAt: existing?.startedAt || nowBerlin(), date, cat, locKey, mood, isCardio };

  if (isCardio) {
    active.cardio = {
      type:   document.getElementById('log-cardio-type').value,
      dur:    document.getElementById('log-dur').value,
      dist:   document.getElementById('log-dist').value,
      floors: document.getElementById('log-floors').value,
      kcal:   document.getElementById('log-kcal').value,
    };
  } else {
    active.exercises = [];
    document.querySelectorAll('#log-ex-list .log-ex').forEach(block => {
      const name = block.querySelector('.log-ex-name').value.trim();
      const sets = [];
      block.querySelectorAll('.sets-grid').forEach(row => {
        sets.push({ w: row.querySelector('.set-w').value, r: row.querySelector('.set-r').value });
      });
      active.exercises.push({ name, sets });
    });
  }

  localStorage.setItem(ACTIVE_KEY, JSON.stringify(active));
  updateStartBtn();
}

let _fabTimer = null;

// MM:SS aus (jetzt − startedAt); beide via nowBerlin-Format → tz-neutral
function fabElapsed(startedAt) {
  if (!startedAt) return null;
  const diffMs = new Date(nowBerlin()) - new Date(startedAt);
  if (!(diffMs > 0)) return '00:00';
  const totalSec = Math.floor(diffMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function startFabTimer(startedAt) {
  const wrapEl = document.getElementById('fab-timer-wrap');
  // Altdaten ohne Startzeit → nur "Läuft" ohne Timer
  if (!startedAt) { if (wrapEl) wrapEl.style.display = 'none'; return; }
  if (wrapEl) wrapEl.style.display = '';
  const render = () => {
    const el = document.getElementById('fab-timer');
    if (el) el.textContent = fabElapsed(startedAt);
  };
  render();
  _fabTimer = setInterval(render, 1000);
}

function updateStartBtn() {
  const wrap   = document.getElementById('fab-wrap');
  const active = loadActive();
  const bar    = document.getElementById('resume-bar');
  clearInterval(_fabTimer); _fabTimer = null;
  if (active) {
    wrap.classList.add('fab-active');
    startFabTimer(active.startedAt);
    if (bar) {
      const detail = active.isCardio
        ? (active.cat || 'Cardio')
        : ((active.exercises || []).length + ' Übungen');
      document.getElementById('resume-bar-text').textContent = 'Training läuft · ' + detail;
      bar.style.display = 'flex';
    }
  } else {
    wrap.classList.remove('fab-active');
    if (bar) bar.style.display = 'none';
  }
  closeFabMenu();
}

// ── FAB Speed-Dial ──
let _fabOpen = false;

function onFabClick() {
  const active = loadActive();
  if (active) { openLog(); return; }
  _fabOpen ? closeFabMenu() : openFabMenu();
}

function openFabMenu() {
  _fabOpen = true;
  document.getElementById('fab-wrap').classList.add('open');
  document.getElementById('fab-backdrop').style.display = 'block';
}

function closeFabMenu() {
  _fabOpen = false;
  document.getElementById('fab-wrap').classList.remove('open');
  document.getElementById('fab-backdrop').style.display = 'none';
}

function startTrainingFromMenu() {
  closeFabMenu();
  openLog();
}

function openWeightModal() {
  closeFabMenu();
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById('wt-modal-title').textContent = 'Gewicht eintragen';
  document.getElementById('wt-date').value    = today;
  document.getElementById('wt-date').disabled = false;
  document.getElementById('wt-kg').value      = '';
  document.getElementById('wt-kfa').value     = '';
  document.getElementById('wt-delete-btn').style.display = 'none';
  renderWtDelta();
  openM('m-weight');
}

function editWeightEntry(date) {
  const entry = getWeightEntries().find(e => e.date === date);
  if (!entry) return;
  document.getElementById('wt-modal-title').textContent = 'Eintrag bearbeiten';
  document.getElementById('wt-date').value    = entry.date;
  document.getElementById('wt-date').disabled = true;
  document.getElementById('wt-kg').value      = entry.kg;
  document.getElementById('wt-kfa').value     = entry.kfa ?? '';
  document.getElementById('wt-delete-btn').style.display = '';
  renderWtDelta();
  openM('m-weight');
}

// Δ between an entry and the chronologically previous weigh-in (shared: modal + feed)
function weightDelta(entries, entry) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const i = sorted.findIndex(e => e.date === entry.date);
  if (i <= 0) return { kg: null, kfa: null };
  const prev = sorted[i - 1];
  const dKg = +(entry.kg - prev.kg).toFixed(1);
  const dKfa = (entry.kfa != null && prev.kfa != null)
    ? +(entry.kfa - prev.kfa).toFixed(1) : null;
  return {
    kg:  { val: dKg,  down: dKg  < 0, prev: prev.kg  },
    kfa: dKfa == null ? null : { val: dKfa, down: dKfa < 0, prev: prev.kfa }
  };
}

// down (Abnahme) = grün + Pfeil runter; up (Zunahme) = dezent rot + Pfeil hoch
function deltaHtml(d, unit) {
  if (!d) return '';
  const color = d.down ? 'var(--up)' : 'var(--down)';
  const arrow = d.down ? '↓' : '↑';
  const sign  = d.val > 0 ? '+' : '';
  return `<span style="color:${color}">${arrow} ${sign}${d.val} ${unit}</span>`
       + `<span class="wt-delta-prev">vs. ${d.prev} ${unit}</span>`;
}

// Live delta preview in the weight modal (compares current input vs. previous weigh-in)
function renderWtDelta() {
  const date   = document.getElementById('wt-date').value;
  const kgRaw  = document.getElementById('wt-kg').value;
  const kfaRaw = document.getElementById('wt-kfa').value;
  const kg     = parseFloat(kgRaw);
  const kfa    = kfaRaw === '' ? null : parseFloat(kfaRaw);

  const today  = new Date().toISOString().slice(0, 10);
  const ctxEl  = document.getElementById('wt-ctx-text');
  if (ctxEl) {
    let label = 'heute';
    if (date && date !== today) { const [y,mo,dd] = date.split('-'); label = `${dd}.${mo}.${y.slice(2)}`; }
    ctxEl.textContent = date ? `Körpergewicht · ${label}` : 'Körpergewicht';
  }

  const kgBox  = document.getElementById('wt-delta-kg');
  const kfaBox = document.getElementById('wt-delta-kfa');
  if (kgBox)  kgBox.innerHTML  = '';
  if (kfaBox) kfaBox.innerHTML = '';
  if (!date || isNaN(kg)) return;

  const others = getWeightEntries().filter(e => e.date !== date);
  const entry  = { date, kg, kfa };
  const d      = weightDelta([...others, entry], entry);
  if (kgBox  && d.kg)  kgBox.innerHTML  = deltaHtml(d.kg, 'kg');
  if (kfaBox && d.kfa) kfaBox.innerHTML = deltaHtml(d.kfa, '%');
}

function deleteWeightEntry() {
  const date    = document.getElementById('wt-date').value;
  const all     = getWeightEntries();
  const removed = all.find(e => e.date === date);
  saveWeightEntries(all.filter(e => e.date !== date));
  closeM('m-weight');
  applyFilters();
  renderWeightChart();
  if (removed) toastUndo('Eintrag gelöscht', () => {
    const cur = getWeightEntries();
    cur.push(removed);
    saveWeightEntries(cur);
    applyFilters();
    renderWeightChart();
    toast('Wiederhergestellt');
  });
}

// Attach auto-save listener to the log modal
document.getElementById('view-training').addEventListener('input',  triggerAutoSave);
document.getElementById('view-training').addEventListener('change', triggerAutoSave);

// ─── Exercise name autocomplete ───────────────────────
let _activeExInput = null;

document.getElementById('log-ex-list').addEventListener('input', e => {
  if (!e.target.classList.contains('log-ex-name')) return;
  _activeExInput = e.target;
  const val = e.target.value.trim();
  const dd  = document.getElementById('log-ex-dropdown');
  if (!val) { dd.style.display = 'none'; return; }
  const q       = val.toLowerCase();
  const matches = allExNames.filter(n => n.toLowerCase().includes(q)).slice(0, 7);
  if (!matches.length) { dd.style.display = 'none'; return; }
  const escaped = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  dd.innerHTML  = matches.map(n => {
    const hi = n.replace(new RegExp(escaped, 'gi'), m => `<mark>${m}</mark>`);
    return `<div class="ex-dropdown-item" onmousedown="selectExName('${n.replace(/'/g,"\\'")}')"> ${hi}</div>`;
  }).join('');
  const rect     = e.target.getBoundingClientRect();
  dd.style.left  = rect.left  + 'px';
  dd.style.top   = (rect.bottom + 2) + 'px';
  dd.style.width = rect.width + 'px';
  dd.style.display = 'block';
});

document.getElementById('log-ex-list').addEventListener('focusout', e => {
  if (e.target.classList.contains('log-ex-name')) {
    setTimeout(() => { document.getElementById('log-ex-dropdown').style.display = 'none'; }, 160);
  }
});

function selectExName(name) {
  if (_activeExInput) {
    _activeExInput.value = name;
    _activeExInput.classList.remove('field-error');
    // Update the prominent "Letztes Mal" line for the picked exercise
    const card = _activeExInput.closest('.log-ex');
    if (card) updateLastBadge(card, name);
  }
  document.getElementById('log-ex-dropdown').style.display = 'none';
  triggerAutoSave();
}

// Render/refresh the ".log-ex-prev" (Letztes Mal) line for a log-ex card and
// sync the ghost-placeholder dataset (phW/phR) used by addLogSet.
function updateLastBadge(card, name) {
  const last = lastSetFor(name);
  let prev = card.querySelector('.log-ex-prev');
  if (!last || !last.sets || !last.sets.length) {
    if (prev) prev.remove();
    card.dataset.phW = '';
    card.dataset.phR = '';
    return;
  }
  const valText = last.sets.length === 1
    ? `${last.sets[0].weight} kg × ${last.sets[0].reps}`
    : last.sets.map((s, i) => i === 0 ? `${s.weight} kg×${s.reps}` : `${s.weight}×${s.reps}`).join(' · ');
  if (!prev) {
    prev = document.createElement('div');
    prev.className = 'log-ex-prev';
    prev.innerHTML = `<span class="log-ex-prev-label">Letztes Mal</span><span class="log-ex-prev-val"></span>`;
    card.querySelector('.log-ex-hd').insertAdjacentElement('afterend', prev);
  }
  prev.querySelector('.log-ex-prev-val').textContent = valText;
  // Sync placeholder data for ghost-fill (first set of last session)
  card.dataset.phW = last.sets[0]?.weight || '';
  card.dataset.phR = last.sets[0]?.reps   || '';
}

// ─────────────────────────────────────────────────────
//  LOG MODAL
// ─────────────────────────────────────────────────────
let logExCount = 0;
let editingId  = null;

function updateModalButtons() {
  const isEditing = !!editingId;
  document.getElementById('btn-pause-session').style.display = isEditing ? 'none' : '';
  document.getElementById('btn-abort').textContent = '✕ Abbrechen';
}

// Category color (push/pull/cardio/other) — mirrors typeColor() for live UI
function catColor(cat) {
  if (!cat) return 'var(--accent)';
  if (/cardio/i.test(cat)) return 'var(--cardio)';
  if (/push/i.test(cat))   return 'var(--push)';
  if (/pull/i.test(cat))   return 'var(--pull)';
  return 'var(--other)';
}

// Mood segment selector → writes the same value the old <select> did (#log-mood)
function setLogMood(val) {
  document.getElementById('log-mood').value = val || '';
  syncMoodSeg();
  triggerAutoSave();
}

function syncMoodSeg() {
  const val = document.getElementById('log-mood').value;
  document.querySelectorAll('#log-mood-seg .mood-seg-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.mood === val));
}

// Header context line: colored dot in category color + "<Kategorie> · <Standort>"
function updateLogContext() {
  const catSel = document.getElementById('log-cat');
  const cat    = catSel.value;
  const locKey = document.getElementById('log-loc').value;
  catSel.classList.toggle('val-set', !!cat);
  const ctx = document.getElementById('log-ctx');
  if (!ctx) return;
  if (!cat) { ctx.style.display = 'none'; return; }
  const locName = locKey ? locLabel(LOC_KEY[locKey] || locKey) : '';
  document.getElementById('log-ctx-dot').style.background = catColor(cat);
  document.getElementById('log-ctx-text').textContent = locName ? `${cat} · ${locName}` : cat;
  ctx.style.display = 'flex';
}

// Footer live summary: "<n> Übungen · <m> Sätze" (strength only)
function updateLogSummary() {
  const el = document.getElementById('log-summary');
  if (!el) return;
  if (document.getElementById('log-cat').value === 'Cardio') { el.textContent = ''; return; }
  const exs  = document.querySelectorAll('#log-ex-list .log-ex').length;
  const sets = document.querySelectorAll('#log-ex-list .sets-grid').length;
  el.textContent = exs
    ? `${exs} ${exs === 1 ? 'Übung' : 'Übungen'} · ${sets} ${sets === 1 ? 'Satz' : 'Sätze'}`
    : '';
}

function openLog() {
  const active = loadActive();
  if (active && !editingId) {
    restoreActiveSession(active);
    return;
  }

  editingId = null;
  ['log-date','log-cat','log-loc','log-mood'].forEach(fid => {
    document.getElementById(fid).disabled = false;
  });
  document.getElementById('log-title').textContent = 'Neues Training';
  document.getElementById('log-date').value = new Date().toISOString().slice(0,10);
  document.getElementById('log-cat').value  = '';
  document.getElementById('log-loc').value  = '';
  document.getElementById('log-mood').value = '';
  document.getElementById('log-cardio').style.display   = 'none';
  document.getElementById('log-strength').style.display = 'none';
  document.getElementById('log-dur').value    = '';
  document.getElementById('log-dist').value   = '';
  document.getElementById('log-kcal').value   = '';
  document.getElementById('log-floors').value = '';
  document.getElementById('log-cardio-type').value = '';
  document.getElementById('log-dist-field').style.display   = 'block';
  document.getElementById('log-floors-field').style.display = 'none';
  document.getElementById('log-ex-list').innerHTML = '';
  logExCount = 0;
  syncMoodSeg();
  updateLogContext();
  updateLogSummary();
  updateModalButtons();
  switchView('training');
}

function pauseSession() {
  saveActiveSession();
  switchView('dashboard');
  toast('Training pausiert — klicke "Fortsetzen" zum Weitermachen');
}

function restoreActiveSession(active) {
  document.getElementById('log-date').value = active.date;
  document.getElementById('log-cat').value  = active.cat;
  document.getElementById('log-loc').value  = active.locKey || '';
  document.getElementById('log-mood').value = active.mood || '';
  document.getElementById('log-title').textContent = 'Training fortsetzen';

  ['log-date','log-cat','log-loc','log-mood'].forEach(fid => {
    document.getElementById(fid).disabled = false;
  });

  const isCardio = active.isCardio;
  document.getElementById('log-cardio').style.display   = isCardio ? 'block' : 'none';
  document.getElementById('log-strength').style.display = !isCardio ? 'block' : 'none';

  if (isCardio && active.cardio) {
    const c = active.cardio;
    if (c.type) { document.getElementById('log-cardio-type').value = c.type; onCardioTypeChange(); }
    document.getElementById('log-dur').value    = c.dur    || '';
    document.getElementById('log-dist').value   = c.dist   || '';
    document.getElementById('log-floors').value = c.floors || '';
    document.getElementById('log-kcal').value   = c.kcal   || '';
  } else if (!isCardio && active.exercises) {
    document.getElementById('log-ex-list').innerHTML = '';
    logExCount = 0;
    active.exercises.forEach(ex => {
      addLogEx(ex.name);
      const exEls = document.querySelectorAll('#log-ex-list .log-ex');
      const exEl  = exEls[exEls.length - 1];
      const setsId = 'sr-' + exEl.id;
      document.getElementById(setsId).innerHTML = '';
      if (ex.sets && ex.sets.length) {
        ex.sets.forEach(set => {
          addLogSet(setsId);
          const rows = document.getElementById(setsId).querySelectorAll('.sets-grid');
          const row  = rows[rows.length - 1];
          row.querySelector('.set-w').value = set.w || '';
          row.querySelector('.set-r').value = set.r || '';
        });
      } else {
        addLogSet(setsId);
      }
    });
  }

  syncMoodSeg();
  updateLogContext();
  updateLogSummary();
  updateModalButtons();
  switchView('training');
}

function abortTraining() {
  // Editing an existing session, or no active draft → just close, no confirmation needed
  if (editingId) { editingId = null; switchView('sessions'); return; }
  const active = loadActive();
  if (!active) { switchView('dashboard'); return; }
  openM('m-abort'); // styled confirm in place of native confirm() (Item 11)
}

function confirmAbort() {
  clearActive();
  editingId = null;
  closeM('m-abort');
  switchView('dashboard');
  toast('Training abgebrochen');
}

function onLogChange() {
  const cat = document.getElementById('log-cat').value;
  const loc = document.getElementById('log-loc').value;
  const isCardio = cat === 'Cardio';
  document.getElementById('log-cardio').style.display   = isCardio ? 'block' : 'none';
  document.getElementById('log-strength').style.display = (!isCardio && cat) ? 'block' : 'none';
  if (!isCardio && cat && loc) loadPlan(cat, loc);
  updateLogContext();
  updateLogSummary();
  triggerAutoSave();
}

function onCardioTypeChange() {
  const type = document.getElementById('log-cardio-type').value;
  if (type === 'stairmaster') {
    document.getElementById('log-dist-field').style.display   = 'none';
    document.getElementById('log-floors-field').style.display = 'block';
  } else {
    document.getElementById('log-dist-field').style.display   = 'block';
    document.getElementById('log-floors-field').style.display = 'none';
  }
}

function loadPlan(cat, loc) {
  const plans     = getPlans();
  const exercises = plans[cat]?.[loc] || plans[cat]?.['haidhof'] || [];
  document.getElementById('log-ex-list').innerHTML = '';
  logExCount = 0;
  if (exercises.length) exercises.forEach(name => addLogEx(name));
  else addLogEx('');
}

function addLogEx(name = '') {
  logExCount++;
  const id = 'lex' + uid();
  const color = catColor(document.getElementById('log-cat').value);
  const el = document.createElement('div');
  el.className = 'log-ex';
  el.id = id;
  el.innerHTML = `
    <div class="log-ex-hd">
      <span class="log-ex-chip log-ex-num" style="background:${color}">${logExCount}</span>
      <input type="text" class="log-ex-name" placeholder="Übungsname" value="${name.replace(/"/g,'&quot;')}">
      <button class="log-ex-del" data-act="removeLogEx" data-arg="${id}" title="Übung entfernen">✕</button>
    </div>
    <div class="sets-hd">
      <span class="set-n-lbl">#</span><span>kg</span><span>Wdh</span><span>✓</span>
    </div>
    <div class="sets-rows" id="sr-${id}"></div>
    <button class="log-add-set" data-act="addLogSet" data-arg="sr-${id}">＋ Satz</button>
  `;
  document.getElementById('log-ex-list').appendChild(el);
  // "Letztes Mal" line + ghost-placeholder source (dataset.phW/phR) for empty sets
  if (name) updateLastBadge(el, name);
  addLogSet('sr-' + id);
  updateLogSummary();
}

function addLogSet(rowsId) {
  const wrap     = document.getElementById(rowsId);
  const existing = wrap.querySelectorAll('.sets-grid');
  const n        = existing.length + 1;
  const card     = wrap.closest('.log-ex');
  // Ghost placeholders = last training's values for this exercise
  const phW = (card && card.dataset.phW) || '0';
  const phR = (card && card.dataset.phR) || '0';
  // Added sets (not the first) copy the previous set's values as a real value — one-tap entry.
  // The first set stays empty so the ghost placeholder shows the last-time values.
  let prevW = '', prevR = '';
  if (existing.length) {
    const lastRow = existing[existing.length - 1];
    prevW = lastRow.querySelector('.set-w')?.value || '';
    prevR = lastRow.querySelector('.set-r')?.value || '';
  }
  const row  = document.createElement('div');
  row.className = 'sets-grid';
  row.innerHTML = `
    <span class="set-n">${n}</span>
    <input type="number" class="set-input set-w" step="0.5" min="0" placeholder="${phW}" value="${prevW}">
    <input type="number" class="set-input set-r" min="0" placeholder="${phR}" value="${prevR}">
    <button type="button" class="set-done" data-act="toggleSetDone" data-pass="this" aria-label="Satz erledigt">✓</button>
  `;
  wrap.appendChild(row);
  updateLogSummary();
}

// ✓ toggle — visual live-logging marker only, does not change saved data
function toggleSetDone(btn) {
  const on = !btn.classList.contains('done');
  btn.classList.toggle('done', on);
  const row = btn.closest('.sets-grid');
  if (row) row.classList.toggle('done', on);
}

// All logged sets of the most recent session for an exercise name (Item 06 bonus).
// Returns { sets: [{weight, reps}, ...] } for the prominent "Letztes Mal" line.
function lastSetFor(name) {
  const key = (name || '').toLowerCase().trim();
  if (!key) return null;
  const sessions = loadDB().sessions.slice().sort((a, b) => b.date.localeCompare(a.date));
  for (const s of sessions) {
    const ex = (s.exercises || []).find(e => (e.name || '').toLowerCase().trim() === key);
    if (ex && ex.sets && ex.sets.length) {
      const sets = ex.sets.filter(x => x.weight || x.reps);
      if (sets.length) return { sets };
    }
  }
  return null;
}

function removeLogSet(btn, rowsId) {
  const row = btn.closest('.sets-grid');
  const w = row.querySelector('.set-w')?.value || '';
  const r = row.querySelector('.set-r')?.value || '';
  row.remove();
  document.getElementById(rowsId).querySelectorAll('.set-n').forEach((el,i) => el.textContent = i+1);
  triggerAutoSave();
  toastUndo('Satz entfernt', () => {
    const wrap = document.getElementById(rowsId);
    if (!wrap) return;
    addLogSet(rowsId);
    const rows = wrap.querySelectorAll('.sets-grid');
    const last = rows[rows.length - 1];
    if (last) { last.querySelector('.set-w').value = w; last.querySelector('.set-r').value = r; }
    triggerAutoSave();
  });
}

function removeLogEx(id) {
  document.getElementById(id).remove();
  document.querySelectorAll('#log-ex-list .log-ex .log-ex-num').forEach((el,i) => el.textContent = i+1);
  logExCount = document.querySelectorAll('#log-ex-list .log-ex').length;
  updateLogSummary();
  triggerAutoSave();
}

// Detect new personal records contained in a freshly saved session.
// For every strength exercise in `newSession`, the best set (highest weight,
// on tie the higher rep count) is compared against the all-time best from all
// OTHER sessions. Returns [{ exName, weight, reps }] for each exercise whose
// best set beats the previous record. A first-ever exercise (no prior data)
// is NOT counted as a PR to avoid spamming on brand-new movements.
function detectNewPRs(newSession, allSessions) {
  if (!newSession || newSession.type === 'cardio') return [];

  const bestSet = ex => {
    let best = null;
    (ex.sets || []).forEach(set => {
      const w = parseFloat(set.weight), r = parseInt(set.reps, 10);
      if (!w || !r) return;
      if (!best || w > best.weight || (w === best.weight && r > best.reps)) best = { weight: w, reps: r };
    });
    return best;
  };
  // Same keying as calcPRs so Big3 name variants (e.g. Bankdrücken / Bench Press) share a record
  const prKey = name => {
    const big3 = BIG3_PATTERNS.find(p => p.re.test(name));
    return big3 ? 'big3:' + big3.label : 'ex:' + name.trim().toLowerCase();
  };

  // Historical best per exercise across all other sessions
  const prevMax = {};
  (allSessions || []).forEach(s => {
    if (s.id === newSession.id) return;
    (s.exercises || []).forEach(ex => {
      if (ex.type === 'cardio') return;
      const name = (ex.name || '').trim();
      if (!name) return;
      const best = bestSet(ex);
      if (!best) return;
      const key = prKey(name);
      const cur = prevMax[key];
      if (!cur || best.weight > cur.weight || (best.weight === cur.weight && best.reps > cur.reps)) prevMax[key] = best;
    });
  });

  const prs = [];
  (newSession.exercises || []).forEach(ex => {
    if (ex.type === 'cardio') return;
    const name = (ex.name || '').trim();
    if (!name) return;
    const best = bestSet(ex);
    if (!best) return;
    const prev = prevMax[prKey(name)];
    if (prev && (best.weight > prev.weight || (best.weight === prev.weight && best.reps > prev.reps))) {
      prs.push({ exName: ex.name, weight: best.weight, reps: best.reps });
    }
  });
  return prs;
}

// Celebratory multi-line toast for one or more new PRs. Falls back to the
// standard save confirmation if no PRs were detected.
function toastPR(prs) {
  const el = document.getElementById('toast');
  el.style.background = 'var(--accent)';
  el.style.color = '#ffffff';
  el.style.pointerEvents = 'none';
  el.style.textTransform = 'none';
  el.style.textAlign = 'left';
  const lines = prs.map(p => `<div style="font-size:.8rem">🏆 PR! ${escapeHtml(p.exName)} ${p.weight}kg × ${p.reps}</div>`).join('');
  el.innerHTML = lines + `<div style="opacity:.85;font-weight:600;margin-top:3px">Training gespeichert ✓</div>`;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.classList.remove('show');
    el.style.textTransform = '';
    el.style.textAlign = '';
  }, 4500);
}

function saveLog() {
  // Clear previous validation errors
  document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));

  const dateEl = document.getElementById('log-date');
  const catEl  = document.getElementById('log-cat');
  const date   = dateEl.value;
  const cat    = catEl.value;
  const locKey = document.getElementById('log-loc').value;
  const mood   = document.getElementById('log-mood').value;

  let hasError = false;
  if (!date) { dateEl.classList.add('field-error'); hasError = true; }
  if (!cat)  { catEl.classList.add('field-error');  hasError = true; }
  if (hasError) { toast('Pflichtfelder ausfüllen', true); return; }

  const isCardio  = cat === 'Cardio';
  const parts     = date.split('-');
  const finishedAt = nowBerlin();

  // For new sessions pick up startedAt from active session, otherwise use finishedAt as fallback
  const active = loadActive();

  const session = {
    id: editingId || uid(),
    date,
    dateDisplay: `${parts[2]}.${parts[1]}.${parts[0].slice(2)}`,
    type: isCardio ? 'cardio' : 'strength',
    category: cat,
    location: locKey,
    mood,
    startedAt:  editingId ? undefined : (active?.startedAt || finishedAt),
    finishedAt: editingId ? undefined : finishedAt,
    exercises: [],
    cardio: null
  };

  if (isCardio) {
    const durEl    = document.getElementById('log-dur');
    const distEl   = document.getElementById('log-dist');
    const floorsEl = document.getElementById('log-floors');
    const kcal     = document.getElementById('log-kcal').value;
    if (!durEl.value && !distEl.value && !floorsEl.value) {
      durEl.classList.add('field-error');
      toast('Dauer oder Distanz eingeben', true);
      return;
    }
    session.cardio = { duration_min: durEl.value ? +durEl.value : null, distance_km: distEl.value ? +distEl.value : null, floors: floorsEl.value ? +floorsEl.value : null, calories: kcal ? +kcal : null };
  } else {
    let nameError = false;
    document.querySelectorAll('#log-ex-list .log-ex').forEach(block => {
      const nameEl = block.querySelector('.log-ex-name');
      const name   = nameEl.value.trim();
      if (!name) { nameEl.classList.add('field-error'); nameError = true; return; }
      const sets = [];
      block.querySelectorAll('.sets-grid').forEach(row => {
        const w = parseFloat(row.querySelector('.set-w').value) || 0;
        const r = parseInt(row.querySelector('.set-r').value)   || null;
        if (w > 0 || r) sets.push({ weight: w, reps: r });
      });
      session.exercises.push({ name, sets });
    });
    if (nameError) { toast('Übungsnamen ausfüllen', true); return; }
    if (!session.exercises.length) { toast('Mindestens eine Übung eingeben', true); return; }
  }

  // Remove undefined keys
  Object.keys(session).forEach(k => session[k] === undefined && delete session[k]);

  const db = loadDB();
  const isEdit = !!editingId;
  if (editingId) {
    const idx = db.sessions.findIndex(s => s.id === editingId);
    if (idx !== -1) {
      // Preserve original timestamps on edit
      session.startedAt  = db.sessions[idx].startedAt;
      session.finishedAt = db.sessions[idx].finishedAt;
      db.sessions[idx] = session;
    }
    editingId = null;
  } else {
    db.sessions.push(session);
    clearActive();
  }
  db.sessions.sort((a,b) => b.date.localeCompare(a.date));
  writeDB(db);
  // Detect PRs only for newly added (non-edited) strength sessions
  const newPRs = isEdit ? [] : detectNewPRs(session, db.sessions);

  renderAll();
  switchView('dashboard');
  if (newPRs.length) toastPR(newPRs);
  else toast('Training gespeichert ✓');
}

// ─────────────────────────────────────────────────────
//  PARSER (Import)
// ─────────────────────────────────────────────────────
function parseHeader(line) {
  const m = line.match(/^(\d{1,2})\.(\d{2})\.?\s+(.+)$/);
  if (!m) return null;
  const [, day, month, rest] = m;
  let category, location;
  if (rest.includes('/')) {
    const idx = rest.lastIndexOf('/');
    category = rest.slice(0, idx).trim().replace(/^[-–]\s*/, '');
    location = rest.slice(idx + 1).trim();
  } else {
    const parts = rest.split(/\s+-\s+/);
    category = parts[0].trim().replace(/^[-–]\s*/, '');
    location = parts.length > 1 ? parts[parts.length - 1].trim() : '';
  }
  const now  = new Date();
  let year   = now.getFullYear();
  if (parseInt(month) > now.getMonth() + 1) year--;
  return { date: `${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`, dateDisplay: `${day}.${month}.${String(year).slice(2)}`, category, location, type: /cardio/i.test(category) ? 'cardio' : 'strength' };
}

function parseSet(str) {
  str = str.trim();
  const wr = str.match(/^([\d.,]+)\s*kg\s*x\s*(\d*)$/i);
  if (wr) return { weight: parseFloat(wr[1].replace(',','.')), reps: wr[2] ? parseInt(wr[2]) : null };
  const ro = str.match(/^(\d+)$/);
  if (ro) return { weight: 0, reps: parseInt(ro[1]) };
  return null;
}

function parseSets(str) {
  return str.split('|').flatMap(p => p.split(/\s+SS\s+/i).map(s => parseSet(s.trim()))).filter(Boolean);
}

function parseText(raw) {
  const sessions = [];
  let cur = null;
  for (const line of raw.split('\n').map(l => l.trim()).filter(Boolean)) {
    const hdr = parseHeader(line);
    if (hdr) { if (cur) sessions.push(cur); cur = { id: uid(), ...hdr, exercises: [], cardio: null }; continue; }
    if (!cur) continue;
    const c1 = line.match(/^(\d+)min\s*x\s*([\d.,]+)km(?:\s*x\s*(\d+)kcal)?/i);
    if (c1) { cur.cardio = { duration_min: +c1[1], distance_km: parseFloat(c1[2].replace(',','.')), calories: c1[3] ? +c1[3] : null }; continue; }
    const c2 = line.match(/^([\d.,]+)km\s*[-–]\s*(\d+)\s*min/i);
    if (c2) { cur.cardio = { distance_km: parseFloat(c2[1].replace(',','.')), duration_min: +c2[2], calories: null }; continue; }
    const ex = line.match(/^(.+?)\s*-\s*(.+)$/);
    if (ex) cur.exercises.push({ name: ex[1].trim(), sets: parseSets(ex[2]) });
  }
  if (cur) sessions.push(cur);
  return sessions;
}

function runImport() {
  const raw = document.getElementById('import-txt').value.trim();
  if (!raw) { toast('Kein Text eingefügt', true); return; }
  const newS = parseText(raw);
  if (!newS.length) { toast('Keine Sessions erkannt', true); return; }
  const db = loadDB();
  db.sessions.push(...newS);
  db.sessions.sort((a,b) => b.date.localeCompare(a.date));
  writeDB(db);
  document.getElementById('import-txt').value = '';
  switchView('dashboard');
  renderAll();
  toast(`${newS.length} Sessions importiert`);
}

// ─────────────────────────────────────────────────────
//  FILTERS
// ─────────────────────────────────────────────────────
let _sessPage = 0;
let _sessPageSize = 10;
let filterState = { cat: '', loc: '', mood: '' };

function applyFilters(resetPage = true) {
  filterState.cat  = document.getElementById('filter-cat').value;
  filterState.loc  = document.getElementById('filter-loc').value;
  filterState.mood = document.getElementById('filter-mood').value;
  if (resetPage) _sessPage = 0;

  const db = loadDB();
  let sessions = db.sessions;
  if (filterState.cat)  sessions = sessions.filter(s => s.category === filterState.cat);
  if (filterState.loc)  sessions = sessions.filter(s => (LOC_KEY[s.location] || s.location) === filterState.loc);
  if (filterState.mood) sessions = sessions.filter(s => (MOOD_KEY[s.mood] || s.mood) === filterState.mood);
  const weightEntries = (filterState.cat || filterState.loc || filterState.mood) ? [] : getWeightEntries();

  const allItems = [
    ...sessions.map(s => ({ _type: 'session', date: s.date, s })),
    ...weightEntries.map(w => ({ _type: 'weight', date: w.date, w }))
  ].sort((a, b) => b.date.localeCompare(a.date));

  const total      = allItems.length;
  const totalPages = Math.max(1, Math.ceil(total / _sessPageSize));
  _sessPage        = Math.min(_sessPage, totalPages - 1);
  const pageItems  = allItems.slice(_sessPage * _sessPageSize, (_sessPage + 1) * _sessPageSize);

  if (!total) {
    renderList([], [], document.getElementById('session-list'));
  } else {
    renderList(pageItems.filter(i=>i._type==='session').map(i=>i.s),
               pageItems.filter(i=>i._type==='weight').map(i=>i.w),
               document.getElementById('session-list'));
  }

  const pgDiv = document.getElementById('sess-pagination');
  if (pgDiv) {
    pgDiv.style.display = totalPages > 1 ? 'block' : 'none';
    const info = document.getElementById('sess-page-info');
    if (info) info.textContent = `Seite ${_sessPage + 1} / ${totalPages}`;
    const prev = document.getElementById('sess-prev');
    const next = document.getElementById('sess-next');
    if (prev) prev.disabled = _sessPage === 0;
    if (next) next.disabled = _sessPage >= totalPages - 1;
  }
}

function sessChangePage(delta) {
  _sessPage += delta;
  applyFilters(false);
  document.getElementById('session-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function sessSetPageSize(val) {
  _sessPageSize = parseInt(val, 10) || 10;
  _sessPage = 0;
  applyFilters(false);
}

function renderFilters(sessions) {
  const catSel  = document.getElementById('filter-cat');
  const locSel  = document.getElementById('filter-loc');
  const moodSel = document.getElementById('filter-mood');

  const cats  = [...new Set(sessions.map(s => s.category).filter(Boolean))].sort();
  const locs  = [...new Set(sessions.map(s => LOC_KEY[s.location] || s.location).filter(Boolean))].sort();
  const moods = [...new Set(sessions.map(s => MOOD_KEY[s.mood]    || s.mood).filter(Boolean))];
  const moodOrder = ['great','good','ok','bad'];
  moods.sort((a,b) => moodOrder.indexOf(a) - moodOrder.indexOf(b));

  const cv = catSel.value, lv = locSel.value, mv = moodSel.value;

  catSel.innerHTML  = '<option value="">Alle Kategorien</option>' +
    cats.map(c  => `<option value="${c}"${c === cv ? ' selected' : ''}>${c}</option>`).join('');
  locSel.innerHTML  = '<option value="">Alle Standorte</option>'  +
    locs.map(l  => `<option value="${l}"${l === lv ? ' selected' : ''}>${locLabel(l)}</option>`).join('');
  moodSel.innerHTML = '<option value="">Alle Stimmungen</option>' +
    moods.map(m => `<option value="${m}"${m === mv ? ' selected' : ''}>${MOOD_LABEL[m] || m}</option>`).join('');
}

// ─────────────────────────────────────────────────────
//  STATS + RENDER
// ─────────────────────────────────────────────────────
function calcStats(sessions) {
  let vol = 0; const names = new Set();
  for (const s of sessions) for (const ex of s.exercises) {
    names.add(ex.name.toLowerCase());
    for (const st of ex.sets) if (st.weight && st.reps) vol += st.weight * st.reps;
  }

  // Sessions this week (Mon–Sun, Europe/Berlin)
  const todayBerlin = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(0, 10);
  const today = new Date(todayBerlin);
  const dow   = (today.getDay() + 6) % 7; // Mon=0
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - dow);
  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekSessions = sessions.filter(s => s.date >= weekStartStr).length;

  // Sessions this month vs last month
  const ym = todayBerlin.slice(0, 7);
  const lastMonthDate = new Date(today); lastMonthDate.setDate(1); lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  const ymPrev = lastMonthDate.toISOString().slice(0, 7);
  const monthSessions     = sessions.filter(s => s.date.startsWith(ym)).length;
  const prevMonthSessions = sessions.filter(s => s.date.startsWith(ymPrev)).length;

  return { sessions: sessions.length, exercises: names.size, tonnage: (vol / 1000).toFixed(1), weekSessions, monthSessions, prevMonthSessions };
}

// Wochen-Streak: aufeinander folgende abgeschlossene Wochen mit >= minSessions
function calcStreak(sessions) {
  const cfg = getCfg();
  const minN = parseInt(cfg.streakMin || 3, 10);
  function isoWeek(dateStr) {
    const d = new Date(dateStr + 'T12:00:00Z');
    const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const wn = Math.ceil((((tmp - yearStart) / 86400000) + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(wn).padStart(2,'0')}`;
  }
  const weekMap = {};
  sessions.forEach(s => { const w = isoWeek(s.date); weekMap[w] = (weekMap[w] || 0) + 1; });
  const todayStr = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(0, 10);
  let streak = 0;
  const checkDate = new Date(todayStr + 'T12:00:00Z');
  checkDate.setUTCDate(checkDate.getUTCDate() - 7); // start from previous week
  for (let i = 0; i < 104; i++) {
    const wk = isoWeek(checkDate.toISOString().slice(0, 10));
    if ((weekMap[wk] || 0) >= minN) { streak++; checkDate.setUTCDate(checkDate.getUTCDate() - 7); }
    else break;
  }
  return { streak, minN };
}

// 30-Tage Gewicht-Delta (fix)
function calcWeightDelta30() {
  const entries = getWeightEntries().sort((a, b) => a.date.localeCompare(b.date));
  if (entries.length === 0) return null;
  const latest = entries[entries.length - 1];
  const cutoff = new Date(latest.date + 'T12:00:00Z');
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const older = entries.filter(e => e.date <= cutoffStr);
  if (older.length === 0) return null;
  const ref = older[older.length - 1];
  return { diff: Math.round((latest.kg - ref.kg) * 10) / 10, latest: latest.kg };
}

// ── TRAINING CALENDAR ────────────────────────────────
function catClass(session) {
  if (!session) return '';
  const c = session.category || '';
  const t = session.type || '';
  if (t === 'cardio' || /cardio/i.test(c)) return 'cal-cardio';
  if (/push/i.test(c))  return 'cal-push';
  if (/pull/i.test(c))  return 'cal-pull';
  return 'cal-other';
}

function buildHeatmap(sessions, year, month) {
  const grid = document.getElementById('hm-grid');
  if (!grid) return;
  grid.innerHTML = '';

  // Build date → first session map (one training per day max)
  const dayMap = {};
  sessions.forEach(s => { if (!dayMap[s.date]) dayMap[s.date] = s; });

  const todayStr = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(0, 10);
  const mm = String(month).padStart(2, '0');
  const monthPrefix = `${year}-${mm}`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // Day-of-week headers: Mo Di Mi Do Fr Sa So
  const DOW_LABELS = ['Mo','Di','Mi','Do','Fr','Sa','So'];
  DOW_LABELS.forEach(d => {
    const el = document.createElement('div');
    el.className = 'cal-dow';
    el.textContent = d;
    grid.appendChild(el);
  });

  // First day of month: which column? (Mon=0)
  const firstDow = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;

  // Empty cells before day 1
  for (let i = 0; i < firstDow; i++) {
    const el = document.createElement('div');
    el.className = 'cal-day cal-empty';
    grid.appendChild(el);
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr  = `${monthPrefix}-${String(day).padStart(2, '0')}`;
    const isFuture = dateStr > todayStr;
    const isToday  = dateStr === todayStr;
    const session  = dayMap[dateStr];

    const el = document.createElement('div');
    el.className = 'cal-day';
    el.textContent = day;

    if (isFuture)      el.classList.add('cal-future');
    else if (session)  { el.classList.add('cal-trained', catClass(session)); }
    if (isToday)       el.classList.add('cal-today');

    if (session) el.title = `${dateStr} — ${session.category || 'Training'}`;
    grid.appendChild(el);
  }
}

function initHeatmapFilter(sessions) {
  const todayStr = new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(0, 10);
  const curYear  = parseInt(todayStr.slice(0, 4));
  const curMonth = parseInt(todayStr.slice(5, 7));

  const yearSel  = document.getElementById('hm-year-sel');
  const monthSel = document.getElementById('hm-month-sel');
  if (!yearSel || !monthSel) return;

  // Preserve user selection across renderAll calls; on first load year select is empty
  const isFirstLoad = yearSel.options.length === 0;
  const prevYear  = !isFirstLoad ? parseInt(yearSel.value)  : curYear;
  const prevMonth = !isFirstLoad ? parseInt(monthSel.value) : curMonth;

  // Collect all years with sessions + current year
  const years = new Set([curYear]);
  sessions.forEach(s => years.add(parseInt(s.date.slice(0, 4))));
  const sortedYears = [...years].sort((a, b) => a - b);

  yearSel.innerHTML = sortedYears
    .map(y => `<option value="${y}">${y}</option>`)
    .join('');

  yearSel.value  = sortedYears.includes(prevYear) ? String(prevYear) : String(curYear);
  monthSel.value = String(prevMonth);
}

function onHeatmapFilterChange() {
  const yearSel  = document.getElementById('hm-year-sel');
  const monthSel = document.getElementById('hm-month-sel');
  if (!yearSel || !monthSel) return;
  const year  = parseInt(yearSel.value);
  const month = parseInt(monthSel.value);
  const db = loadDB();
  buildHeatmap(db.sessions, year, month);
}

function typeColor(s) {
  if (s.type === 'cardio' || /cardio/i.test(s.category)) return 'var(--cardio)';
  if (/push/i.test(s.category)) return 'var(--push)';
  if (/pull/i.test(s.category)) return 'var(--pull)';
  return 'var(--other)';
}

// Category chip text + background tint (Item 16) — same palette as the calendar
function typeChip(s) {
  if (s.type === 'cardio' || /cardio/i.test(s.category)) return { color: '#A8740A', bg: 'rgba(212,134,10,.12)' };
  if (/push/i.test(s.category)) return { color: '#2E4A7A', bg: 'rgba(46,74,122,.10)' };
  if (/pull/i.test(s.category)) return { color: '#3a64a0', bg: 'rgba(74,122,191,.14)' };
  return { color: 'var(--muted)', bg: 'var(--surface2)' };
}


// ─── PERSONAL RECORDS ────────────────────────────────
// Big 3 matcher — case-insensitive contains
const BIG3_PATTERNS = [
  { label: 'Bankdrücken', re: /bank|bench/i },
  { label: 'Kreuzheben',  re: /kreuz|deadlift/i },
  { label: 'Kniebeuge',   re: /knie|squat/i },
];

// All-time PR per strength exercise across every session.
// Best = highest weight; on a tie the higher rep count wins.
// Exercises are keyed case-insensitively; the display name is the most
// recently logged spelling. Big3 entries are normalised to their canonical
// label so e.g. "Bankdrücken" and "Bench Press" collapse into one card.
function calcPRs(sessions) {
  const prMap = {}; // key -> { label, weight, reps, date, exName, isBig3, big3Order }
  sessions.forEach(s => {
    (s.exercises || []).forEach(ex => {
      if (ex.type === 'cardio') return;
      const name = (ex.name || '').trim();
      if (!name) return;
      const big3Idx = BIG3_PATTERNS.findIndex(p => p.re.test(name));
      const isBig3  = big3Idx !== -1;
      const label   = isBig3 ? BIG3_PATTERNS[big3Idx].label : name;
      const key     = isBig3 ? 'big3:' + label : 'ex:' + name.toLowerCase();
      (ex.sets || []).forEach(set => {
        const w = parseFloat(set.weight), r = parseInt(set.reps, 10);
        if (!w || !r) return;
        const cur = prMap[key];
        if (!cur || w > cur.weight || (w === cur.weight && r > cur.reps)) {
          prMap[key] = { label, weight: w, reps: r, date: s.date, exName: name, isBig3, big3Order: isBig3 ? big3Idx : 99 };
        }
      });
    });
  });

  const found = Object.values(prMap);
  // Big3 first (in canonical order), then all other exercises alphabetically
  const others = found.filter(p => !p.isBig3).sort((a, b) => a.label.localeCompare(b.label, 'de'));
  const big3   = BIG3_PATTERNS.map((p, i) => {
    const hit = found.find(f => f.isBig3 && f.label === p.label);
    return hit || { label: p.label, weight: null, reps: null, date: null, exName: null, isBig3: true, big3Order: i };
  });
  return [...big3, ...others];
}

function renderPRs(sessions) {
  const grid  = document.getElementById('pr-grid');
  const empty = document.getElementById('pr-empty');
  if (!grid) return;
  const prs = calcPRs(sessions);
  if (empty) empty.style.display = 'none';
  grid.innerHTML = prs.map(p => {
    if (!p.weight) {
      return `<div class="pr-card" style="opacity:.45">
        <div class="pr-ex-name">${p.label}</div>
        <div class="pr-weight" style="font-size:1.3rem;color:var(--muted)">—</div>
        <div class="pr-detail">Noch keine Daten</div>
      </div>`;
    }
    const d = p.date ? p.date.slice(2).split('-').reverse().join('.') : '—';
    return `<div class="pr-card">
      <div class="pr-ex-name">${p.label}</div>
      <div class="pr-weight">${p.weight} kg</div>
      <div class="pr-detail">× ${p.reps} &nbsp;·&nbsp; ${d}</div>
    </div>`;
  }).join('');
}

function renderAll() {
  const db = loadDB();
  const st = calcStats(db.sessions);

  // Header stats
  document.getElementById('s-sessions').textContent  = st.sessions;
  document.getElementById('s-exercises').textContent = st.exercises;
  document.getElementById('s-volume').textContent    = st.tonnage;

  // Dashboard tiles
  const dashMonth = document.getElementById('dash-month');
  if (dashMonth) {
    dashMonth.textContent = st.monthSessions;
    const delta = st.monthSessions - st.prevMonthSessions;
    const deltaEl = document.getElementById('dash-month-delta');
    if (deltaEl) {
      if (delta > 0)      { deltaEl.textContent = '↑ +' + delta + ' vs. letzten Monat'; deltaEl.className = 'dash-tile-delta up'; }
      else if (delta < 0) { deltaEl.textContent = '↓ ' + delta + ' vs. letzten Monat'; deltaEl.className = 'dash-tile-delta down'; }
      else                { deltaEl.textContent = '= wie letzten Monat'; deltaEl.className = 'dash-tile-delta neutral'; }
    }
  }
  const dashWeek = document.getElementById('dash-week');
  if (dashWeek) {
    dashWeek.textContent = st.weekSessions + '×';
    const sub = document.getElementById('dash-week-sub');
    if (sub) sub.textContent = 'seit Montag';
  }
  const { streak, minN } = calcStreak(db.sessions);
  const dashStreak = document.getElementById('dash-streak');
  if (dashStreak) {
    dashStreak.textContent = streak;
    const sub = document.getElementById('dash-streak-sub');
    if (sub) sub.textContent = streak === 0 ? 'noch kein Streak' : (streak === 1 ? '1 Woche' : streak + ' Wochen') + ' (min. ' + minN + '/Woche)';
  }
  const wtDelta = calcWeightDelta30();
  const dashWtVal = document.getElementById('dash-wt-delta-val');
  if (dashWtVal) {
    if (wtDelta === null) {
      dashWtVal.textContent = '—';
      const sub = document.getElementById('dash-wt-delta-sub');
      if (sub) { sub.textContent = 'keine Daten'; sub.className = 'dash-tile-delta neutral'; }
    } else {
      dashWtVal.textContent = wtDelta.latest + ' kg';
      const sub = document.getElementById('dash-wt-delta-sub');
      if (sub) {
        const d = wtDelta.diff;
        if (d < 0)      { sub.textContent = '↓ ' + Math.abs(d) + ' kg (30 Tage)'; sub.className = 'dash-tile-delta up'; }
        else if (d > 0) { sub.textContent = '↑ +' + d + ' kg (30 Tage)'; sub.className = 'dash-tile-delta down'; }
        else            { sub.textContent = '= unverändert (30 Tage)'; sub.className = 'dash-tile-delta neutral'; }
      }
    }
  }

  initHeatmapFilter(db.sessions);
  const _hmYear  = parseInt((document.getElementById('hm-year-sel')  || {}).value  || new Date().getFullYear());
  const _hmMonth = parseInt((document.getElementById('hm-month-sel') || {}).value  || (new Date().getMonth() + 1));
  buildHeatmap(db.sessions, _hmYear, _hmMonth);
  renderFilters(db.sessions);
  applyFilters();
  renderExSearch(db.sessions);
  renderDist(db.sessions);
  renderPRs(db.sessions);
  updateStartBtn();
}

// ─── VIEW SWITCHING ──────────────────────────────────
const VIEWS = ['dashboard', 'progress', 'body', 'sessions', 'settings', 'training'];

function switchView(name) {
  // Nav + FAB während Training ausblenden/einblenden
  const isTraining = name === 'training';
  const topNav     = document.querySelector('.top-nav');
  const bottomNav  = document.getElementById('bottom-nav');
  const fabWrap    = document.getElementById('fab-wrap');
  const resumeBar  = document.getElementById('resume-bar');
  const mobileTabs = document.querySelector('.mobile-tabs');
  if (topNav)     topNav.style.display     = isTraining ? 'none' : '';
  if (bottomNav)  bottomNav.style.display  = isTraining ? 'none' : '';
  if (fabWrap)    fabWrap.style.display    = isTraining ? 'none' : '';
  if (resumeBar)  resumeBar.style.display  = 'none'; // immer ausblenden beim View-Wechsel
  if (mobileTabs) mobileTabs.style.display = isTraining ? 'none' : '';

  VIEWS.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.classList.toggle('active', v === name);
    const top = document.getElementById('nav-' + v);
    if (top) top.classList.toggle('active', v === name);
    const bot = document.getElementById('bnav-' + v);
    if (bot) bot.classList.toggle('active', v === name);
  });
  // Trigger chart renders on first visit
  if (name === 'progress') { renderDurChart(); init1RMSelect(); initProgressDefaults(); }
  if (name === 'body')     { renderWeightChart(); }
  if (name === 'settings') { setTimeout(loadCfgUI, 0); }

}

// Legacy compat – some event handlers still reference this
function switchMobileTab(tab) {
  const map = { progress: 'progress', sessions: 'sessions', body: 'body', dashboard: 'dashboard' };
  switchView(map[tab] || tab);
}

// ─── DATUM / WOCHEN-GRUPPIERUNG (Sessions) ──────────────────────────────
// Erwartet Datum als "YYYY-MM-DD".

function _parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);                 // lokale Zeit, 00:00
}

// Montag als Wochenstart; gibt den Montag-Date der Woche zurück
function _weekStart(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;             // Mo=0 … So=6
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

const _MONTHS = ['Januar','Februar','März','April','Mai','Juni',
                 'Juli','August','September','Oktober','November','Dezember'];
const _WEEKDAYS = ['So','Mo','Di','Mi','Do','Fr','Sa'];

// Gruppen-Überschrift: "Diese Woche" / "Letzte Woche" / "Mai 2025"
function groupLabel(dateStr) {
  const d        = _parseDate(dateStr);
  const thisWeek = _weekStart(new Date());
  const lastWeek = new Date(thisWeek); lastWeek.setDate(lastWeek.getDate() - 7);
  const wkStart  = _weekStart(d);

  if (wkStart.getTime() === thisWeek.getTime()) return 'Diese Woche';
  if (wkStart.getTime() === lastWeek.getTime()) return 'Letzte Woche';
  return _MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}

// Relatives Label auf der Karte: "Heute" / "Gestern" / "Do, 05.06."
function relDateLabel(dateStr) {
  const d     = _parseDate(dateStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff  = Math.round((today - d) / 86400000);   // ganze Tage

  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return _WEEKDAYS[d.getDay()] + ', ' + dd + '.' + mm + '.';
}

// Items (Sessions + Gewicht) → [{ label, items: [...] }], chronologisch absteigend.
function groupByWeek(items) {
  const sorted = [...items].sort((a, b) => b.date.localeCompare(a.date));
  const groups = [];
  let cur = null;
  sorted.forEach(it => {
    const label = groupLabel(it.date);
    if (!cur || cur.label !== label) { cur = { label, items: [] }; groups.push(cur); }
    cur.items.push(it);
  });
  return groups;
}

function weightRowHTML(w, allEntries) {
  const right = w.kfa != null ? `${w.kg} kg · ${w.kfa}%` : `${w.kg} kg`;
  const d     = weightDelta(allEntries, w);   // { kg:{val,down,prev}|null, kfa:{…}|null }
  let delta = '';
  if (d.kg && d.kg.val !== 0) {
    const dir   = d.kg.down ? 'down' : 'up';
    const kgTxt = (d.kg.val > 0 ? '+' : '') + d.kg.val;
    const kfaTxt = d.kfa ? ` · ${(d.kfa.val > 0 ? '+' : '') + d.kfa.val}%` : '';
    delta = `<span class="w-delta ${dir}">${kgTxt}${kfaTxt}</span>`;
  }
  return `<div class="s-card" style="border-left:3px solid #4a9eff" data-act="editWeightEntry" data-arg="${w.date}">
    <div class="s-left">
      <div class="s-date">${relDateLabel(w.date)}</div>
      <div class="s-sub">⚖ Körpergewicht</div>
    </div>
    <div class="s-right">${right}${delta}</div>
  </div>`;
}

function sessionCardHTML(s) {
  const col  = typeColor(s);
  const chip = typeChip(s);
  const info = s.type === 'cardio' && s.cardio
    ? `${s.cardio.distance_km || s.cardio.floors || '–'} · ${s.cardio.duration_min || '–'}min`
    : `${(s.exercises || []).length} Übungen`;
  const dateLabel = s.date ? relDateLabel(s.date) : (s.dateDisplay || '—');
  const locSub = s.location ? locLabel(LOC_KEY[s.location] || s.location) : '';
  return `<div class="s-card" style="border-left:3px solid ${col}" data-act="showDetail" data-arg="${s.id}">
    <div class="s-left">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="s-date">${dateLabel}</span>
        <span style="font-size:0.55rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${chip.color};background:${chip.bg};border-radius:4px;padding:2px 6px">${s.category}</span>
      </div>
      ${locSub ? `<div class="s-sub">${locSub}</div>` : ''}
    </div>
    <div class="s-right">${info}</div>
  </div>`;
}

function renderList(sessions, weightEntries = [], targetEl = null) {
  const el = targetEl || document.getElementById('session-list');

  // Build combined items
  const items = [
    ...sessions.map(s => ({ _type: 'session', date: s.date, s })),
    ...weightEntries.map(w => ({ _type: 'weight', date: w.date, w }))
  ];

  if (!items.length) {
    el.innerHTML = '<div class="empty">Keine Daten vorhanden, <br>um neuen Daten hinzuzufügen klicke auf<br>"＋ Training" oder "↑ Import".</div>';
    return;
  }

  // Vollständige Gewichts-Historie für korrekte Deltas (auch über Seitengrenzen)
  const allWeights = getWeightEntries();

  const groups = groupByWeek(items);
  el.innerHTML = groups.map(g => `
    <div class="sess-group-hd">${g.label}</div>
    ${g.items.map(it => it._type === 'weight'
      ? weightRowHTML(it.w, allWeights)
      : sessionCardHTML(it.s)).join('')}
  `).join('');
}

let allExNames = [];

function renderExSearch(sessions) {
  allExNames = [...new Set(sessions.flatMap(s => (s.exercises || []).map(e => e.name)))].sort((a,b) => a.localeCompare(b));
}

function onExSearch(val) {
  const dropdown = document.getElementById('ex-dropdown');
  if (!val.trim()) { dropdown.style.display = 'none'; return; }
  const q       = val.toLowerCase();
  const matches = allExNames.filter(n => n.toLowerCase().includes(q)).slice(0, 8);
  if (!matches.length) { dropdown.style.display = 'none'; return; }
  const escaped = val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  dropdown.innerHTML = matches.map(n => {
    const hi = n.replace(new RegExp(escaped, 'gi'), m => `<mark>${m}</mark>`);
    return `<div class="ex-dropdown-item" onmousedown="selectFromDropdown('${n.replace(/'/g,"\\'")}')">${hi}</div>`;
  }).join('');
  dropdown.style.display = 'block';
}

function closeExDropdown() {
  const dd = document.getElementById('ex-dropdown');
  if (dd) dd.style.display = 'none';
}

let _currentChartEx = null;

function selectFromDropdown(name) {
  _currentChartEx = name;
  document.getElementById('ex-search').value = name;
  closeExDropdown();
  selectExByName(name);
}

function rechartProgression() {
  if (_currentChartEx) selectExByName(_currentChartEx);
}

function selectExByName(name) {
  const fromVal = document.getElementById('prog-from')?.value || '';
  const toVal   = document.getElementById('prog-to')?.value   || '';
  const pts = loadDB().sessions
    .filter(s => (!fromVal || s.date >= fromVal) && (!toVal || s.date <= toVal))
    .slice().sort((a,b) => a.date.localeCompare(b.date)).flatMap(s => {
    const ex = s.exercises.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (!ex) return [];
    const ws = ex.sets.map(st => st.weight).filter(w => w > 0);
    return ws.length ? [{ label: s.dateDisplay || s.date, val: Math.round(Math.max(...ws) * 100) / 100 }] : [];
  });
  document.getElementById('chart-empty').style.display = pts.length ? 'none' : 'flex';
  document.getElementById('chart-wrap').style.display  = pts.length ? 'block' : 'none';
  if (!pts.length) return;
  const ctx = document.getElementById('prog-chart').getContext('2d');
  if (progChart) progChart.destroy();
  progChart = new Chart(ctx, {
    type: 'line',
    data: { labels: pts.map(p => p.label), datasets: [{ label: name, data: pts.map(p => p.val), borderColor: '#2E4A7A', backgroundColor: 'rgba(46,74,122,.07)', pointBackgroundColor: '#2E4A7A', pointBorderColor: '#ffffff', pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 7, tension: 0.35, fill: true }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: '#ffffff', borderColor: '#DDE2EE', borderWidth: 1, titleColor: '#2E4A7A', bodyColor: '#1A2035', callbacks: { label: c => (Math.round(c.parsed.y * 100) / 100) + ' kg' } } }, scales: { x: { ticks: { color: '#A8B4CC', font: { size: 11, family: 'Helvetica Neue' }, autoSkip: true, maxTicksLimit: 6, maxRotation: 0 }, grid: { display: false }, border: { color: '#EEF1F7' } }, y: { ticks: { color: '#A8B4CC', font: { size: 11 }, stepSize: 0.5, callback: v => (Math.round(v * 100) / 100) + ' kg' }, grid: { color: '#EEF1F7' }, border: { color: '#EEF1F7' } } } }
  });
}

let progChart = null;
let durChart  = null;
let distChart = null;

function switchChartTab(tab) {
  ['prog','dur','1rm'].forEach(t => {
    const btn = document.getElementById(`ctab-${t}`);
    if (btn) btn.classList.toggle('active', tab === t);
  });
  document.getElementById('chart-prog-view').style.display = tab === 'prog' ? '' : 'none';
  document.getElementById('chart-dur-view').style.display  = tab === 'dur'  ? '' : 'none';
  document.getElementById('chart-1rm-view').style.display  = tab === '1rm'  ? '' : 'none';
  if (tab === 'dur') renderDurChart();
  if (tab === '1rm') init1RMSelect();
}

function renderDurChart() {
  const sessions = loadDB().sessions
    .slice().sort((a,b) => a.date.localeCompare(b.date));
  const durEmpty = document.getElementById('dur-chart-empty');
  const durWrap  = document.getElementById('dur-chart-wrap');
  const pts = sessions.map(s => ({
    label: s.dateDisplay || s.date,
    val: sessionDurationMinutes(s)
  })).filter(p => p.val !== null);
  if (!pts.length) { durEmpty.style.display = 'flex'; durWrap.style.display = 'none'; return; }
  durEmpty.style.display = 'none';
  durWrap.style.display  = 'block';
  const avg = Math.round(pts.reduce((a,b) => a + b.val, 0) / pts.length);
  const ctx = document.getElementById('dur-chart').getContext('2d');
  if (durChart) durChart.destroy();
  durChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: pts.map(p => p.label),
      datasets: [
        { label: 'Dauer (min)', data: pts.map(p => p.val), backgroundColor: 'rgba(46,74,122,.18)', borderColor: '#2E4A7A', borderWidth: 1.5, borderRadius: 3 },
        { label: `Ø ${avg} min`, data: pts.map(() => avg), type: 'line', borderColor: 'rgba(46,74,122,.4)', borderDash: [5,4], borderWidth: 1.5, pointRadius: 0, fill: false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, labels: { color: '#6070A0', font: { size: 10, family: 'Helvetica Neue' }, boxWidth: 12 } },
        tooltip: { backgroundColor: '#ffffff', borderColor: '#DDE2EE', borderWidth: 1, titleColor: '#2E4A7A', bodyColor: '#1A2035',
          callbacks: { label: c => c.dataset.label.startsWith('Ø') ? c.dataset.label : `${c.dataset.label}: ${c.parsed.y} min` }
        }
      },
      scales: {
        x: { ticks: { color: '#A8B4CC', font: { size: 10, family: 'Helvetica Neue' }, autoSkip: true, maxTicksLimit: 6, maxRotation: 0 }, grid: { display: false }, border: { color: '#EEF1F7' } },
        y: { beginAtZero: true, ticks: { color: '#A8B4CC', font: { size: 11 }, callback: v => v + ' min' }, grid: { color: '#EEF1F7' }, border: { color: '#EEF1F7' } }
      }
    }
  });
}

function renderDist(sessions) {
  const counts = { Push: 0, Pull: 0, Legs: 0, Cardio: 0, Andere: 0 };
  for (const s of sessions) {
    if (/cardio/i.test(s.category) || s.type === 'cardio') counts.Cardio++;
    else if (/push/i.test(s.category)) counts.Push++;
    else if (/pull/i.test(s.category)) counts.Pull++;
    else if (/leg|bein/i.test(s.category)) counts.Legs++;
    else counts.Andere++;
  }
  const colors = ['#2E4A7A','#4a7abf','#3d7a6e','#D4860A','#A8B4CC'];
  const labels = Object.keys(counts);
  const data   = Object.values(counts);
  const ctx    = document.getElementById('dist-chart').getContext('2d');
  if (distChart) distChart.destroy();
  distChart = new Chart(ctx, { type: 'doughnut', data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#ffffff', borderWidth: 3, hoverOffset: 4 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#ffffff', borderColor: '#DDE2EE', borderWidth: 1, titleColor: '#2E4A7A', bodyColor: '#1A2035' } } } });
  document.getElementById('dist-legend').innerHTML = labels.map((l,i) => `<div class="dist-row"><div class="dist-chip" style="background:${colors[i]}"></div><span class="dist-name">${l}</span><span class="dist-count">${data[i]}</span></div>`).join('');
}

// ─────────────────────────────────────────────────────
//  SESSION DETAIL
// ─────────────────────────────────────────────────────
function showDetail(id) {
  const s = loadDB().sessions.find(s => s.id === id);
  if (!s) return;

  const locKey      = LOC_KEY[s.location]  || s.location  || '';
  const moodKey     = MOOD_KEY[s.mood]     || s.mood       || '';
  const locDisplay  = locLabel(locKey) || s.location || '';
  const moodDisplay = MOOD_LABEL[moodKey]  || s.mood       || '';

  // Full date with year
  const [y, mo, d] = (s.date || '').split('-');
  const fullDate = y ? `${d}.${mo}.${y}` : (s.dateDisplay || '');

  // Duration as hh:mm
  const duration = formatDurationHM(sessionDurationMinutes(s));

  let meta = [locDisplay, moodDisplay, duration ? `⏱ ${duration}` : ''].filter(Boolean).join(' · ');

  let body = `<div class="det-hd">
    <div class="det-title" style="color:${typeColor(s)}">${fullDate} ${s.category}</div>
    <div class="det-meta">${meta}</div>
  </div>`;

  if (s.type === 'cardio' && s.cardio) {
    const c = s.cardio;
    body += `<div class="cardio-row">
      ${c.duration_min ? `<div class="c-stat"><div class="c-val">${c.duration_min}</div><div class="c-lbl">Min</div></div>` : ''}
      ${c.distance_km  ? `<div class="c-stat"><div class="c-val">${c.distance_km}</div><div class="c-lbl">km</div></div>`   : ''}
      ${c.floors       ? `<div class="c-stat"><div class="c-val">${c.floors}</div><div class="c-lbl">Stockwerke</div></div>` : ''}
      ${c.calories     ? `<div class="c-stat"><div class="c-val">${c.calories}</div><div class="c-lbl">kcal</div></div>`     : ''}
    </div>`;
  } else {
    body += (s.exercises||[]).map(ex => {
      const setsLine = ex.sets
        .map(st => [st.weight > 0 ? st.weight + ' kg' : '', st.reps ? '× ' + st.reps : ''].filter(Boolean).join(' '))
        .filter(Boolean)
        .join(' · ');
      return `<div class="det-ex">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px">
          <div class="det-ex-name">${ex.name}</div>
          <span class="det-ex-count">${ex.sets.length} Sätze</span>
        </div>
        <div class="det-ex-sets">${setsLine || '—'}</div>
      </div>`;
    }).join('');
  }

  body += `<div class="det-footer" style="display:flex;justify-content:flex-end;gap:8px;margin-top:18px">
    <button class="btn btn-danger" data-act="delSession" data-arg="${id}">Session löschen</button>
    <button class="btn-fill" data-act="editSession" data-arg="${id}">Edit</button>
  </div>`;

  document.getElementById('det-body').innerHTML = body;
  openM('m-detail');
}

function editSession(id) {
  editingId = id;
  const s = loadDB().sessions.find(s => s.id === id);
  if (!s) return;
  document.getElementById('log-title').textContent = 'Session bearbeiten';
  document.getElementById('log-date').value  = s.date  || '';
  document.getElementById('log-cat').value   = s.category || '';
  document.getElementById('log-loc').value   = LOC_KEY[s.location] || s.location || '';
  document.getElementById('log-mood').value  = MOOD_KEY[s.mood] || s.mood || '';
  onLogChange();
  syncMoodSeg();
  if (s.type === 'cardio' && s.cardio) {
    const c = s.cardio;
    if (c.type) document.getElementById('log-cardio-type').value = c.type;
    onCardioTypeChange();
    if (c.duration_min) document.getElementById('log-dur').value = c.duration_min;
    if (c.distance_km)  document.getElementById('log-dist').value = c.distance_km;
    if (c.floors)       document.getElementById('log-floors').value = c.floors;
    if (c.calories)     document.getElementById('log-kcal').value = c.calories;
  } else {
    document.getElementById('log-ex-list').innerHTML = '';
    logExCount = 0;
    (s.exercises || []).forEach(ex => {
      addLogEx(ex.name);
      const rows = document.getElementById('log-ex-list').lastElementChild;
      const rowsId = rows?.querySelector('[id^="sr-"]')?.id;
      if (!rowsId) return;
      document.getElementById(rowsId).innerHTML = '';
      (ex.sets || []).forEach(st => {
        addLogSet(rowsId);
        const lastRow = document.getElementById(rowsId).lastElementChild;
        if (!lastRow) return;
        const [wIn, rIn] = lastRow.querySelectorAll('.set-input');
        if (wIn) wIn.value = st.weight || '';
        if (rIn) rIn.value = st.reps   || '';
      });
    });
  }
  updateLogSummary();
  document.getElementById('btn-pause-session').style.display = 'none';
  closeM('m-detail');
  switchView('training');
}

function delSession(id) {
  const db  = loadDB();
  const idx = db.sessions.findIndex(s => s.id === id);
  if (idx === -1) return;
  const removed = db.sessions[idx];
  db.sessions.splice(idx, 1);
  writeDB(db);
  closeM('m-detail');
  renderAll();
  toastUndo('Session gelöscht', () => {
    const d = loadDB();
    d.sessions.push(removed);
    writeDB(d);
    renderAll();
    toast('Wiederhergestellt');
  });
}

// ── Settings ─────────────────────────────────────────
function showStab(tab) {
  ['general','plans','cats','locs','import','sync'].forEach(t => {
    const el  = document.getElementById('stab-' + t);
    const btn = document.getElementById('stab-btn-' + t);
    if (el)  el.style.display  = t === tab ? 'block' : 'none';
    if (btn) btn.classList.toggle('active', t === tab);
  });
  const sel = document.getElementById('stabs-select');
  if (sel && sel.value !== tab) sel.value = tab;
  if (tab === 'cats') loadCatEditor();
  if (tab === 'locs') loadLocEditor();
}

function saveGeneralSettings() {
  const minVal = parseInt(document.getElementById('cfg-streak-min').value, 10) || 3;
  const cfg = getCfg();
  setCfg({ ...cfg, streakMin: minVal });
  toast('Gespeichert ✓');
  renderAll();
}

function loadCfgUI() {
  try {
    const cfg = getCfg();
    const sel = document.getElementById('cfg-streak-min');
    if (sel) sel.value = cfg.streakMin || 3;
    const sv = document.getElementById('set-streak-val');
    if (sv) sv.textContent = (cfg.streakMin || 3) + ' / Woche';
    settingsNav('hub');           // immer auf der Übersicht starten
    populateCategorySelects();
    populateLocationSelects();
    loadCatEditor();
    loadLocEditor();
    renderSyncPanel();
    renderProfileSection();
  } catch(e) {
    console.error('loadCfgUI error:', e);
  }
}

// ─── SETTINGS HUB / SUB-SCREEN NAVIGATION ─────────────────────────────────────
let _setCur = 'hub';
function settingsNav(id) {
  document.querySelectorAll('#view-settings .set-screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('set-scr-' + id);
  if (!el) { id = 'hub'; document.getElementById('set-scr-hub').classList.add('active'); }
  else el.classList.add('active');
  _setCur = id;
  // Inhalte beim Öffnen aktualisieren
  if (id === 'creds')  renderSyncPanel();
  if (id === 'cats')   loadCatEditor();
  if (id === 'locs')   loadLocEditor();
  if (id === 'streak') { const c = getCfg(); const s = document.getElementById('cfg-streak-min'); if (s) s.value = c.streakMin || 3; }
  if (id === 'invite') {
    const inp = document.getElementById('invite-link');
    if (inp) inp.value = location.origin + location.pathname;
  }
  if (id === 'del') {
    const di = document.getElementById('del-confirm-input');
    if (di) di.value = '';
    updateDelConfirm();
  }
  // an den Anfang scrollen
  const inner = document.querySelector('#view-settings .view-inner');
  if (inner) inner.scrollTop = 0;
  try { window.scrollTo(0, 0); } catch {}
}
function settingsBack() {
  const cur = document.getElementById('set-scr-' + _setCur);
  const parent = (cur && cur.dataset.parent) || 'hub';
  settingsNav(parent);
}

// ─── FREUND EINLADEN (App-Link teilen) ────────────────────────────────────────
function inviteLinkValue() {
  const inp = document.getElementById('invite-link');
  return (inp && inp.value) || (location.origin + location.pathname);
}
function copyInviteLink() {
  const link = inviteLinkValue();
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(link).then(() => toast('Link kopiert ✓'), () => fallbackCopyInvite(link));
  } else {
    fallbackCopyInvite(link);
  }
}
function fallbackCopyInvite(link) {
  const inp = document.getElementById('invite-link');
  if (inp) { inp.removeAttribute('readonly'); inp.select(); try { document.execCommand('copy'); toast('Link kopiert ✓'); } catch { toast('Kopieren nicht möglich', true); } inp.setAttribute('readonly', ''); }
}
function shareInviteLink() {
  const link = inviteLinkValue();
  if (navigator.share) {
    navigator.share({ title: 'PRSONAL', text: 'Trainier mit mir auf PRSONAL 💪', url: link }).catch(() => {});
  } else {
    copyInviteLink();
  }
}

// ─── DATEN LÖSCHEN (Bestätigung per Tippen) ───────────────────────────────────
function updateDelConfirm() {
  const inp = document.getElementById('del-confirm-input');
  const btn = document.getElementById('del-confirm-btn');
  if (!inp || !btn) return;
  const ok = inp.value.trim().toUpperCase() === 'LÖSCHEN';
  btn.disabled = !ok;
  btn.style.opacity = ok ? '1' : '.5';
  btn.style.pointerEvents = ok ? 'auto' : 'none';
}
function confirmDeleteData() {
  const inp = document.getElementById('del-confirm-input');
  if (!inp || inp.value.trim().toUpperCase() !== 'LÖSCHEN') return;
  confirmClearAll();   // löscht lokalen Speicher + lädt App neu (bestehende Funktion)
}

// ─── SUPABASE AUTH ────────────────────────────────────────────────────────────
async function renderSyncPanel() {
  const el = document.getElementById('sync-panel-body');
  if (!el) return;
  const { data: { user } } = await _SB.auth.getUser();
  if (user) {
    el.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--surface2);border-radius:var(--radius);margin-bottom:12px">
        <span style="font-size:.82rem;color:var(--up)">✓ Angemeldet als</span>
        <span style="font-size:.82rem;font-weight:600;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${user.email}</span>
      </div>
      <button class="btn btn-danger" data-act="supabaseSignOut">Abmelden</button>`;
  } else {
    el.innerHTML = `
      <div class="field"><label>E-Mail</label><input type="email" id="sb-email" placeholder="deine@email.de" autocomplete="email"></div>
      <div class="field"><label>Passwort</label><input type="password" id="sb-pw" placeholder="Mindestens 6 Zeichen" autocomplete="current-password"></div>
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn-fill" data-act="supabaseSignIn">Anmelden</button>
        <button class="btn" data-act="supabaseSignUp">Registrieren</button>
      </div>
      <div id="sb-msg" style="font-size:.74rem;margin-top:10px;color:var(--muted2)"></div>`;
  }
}

async function supabaseSignIn() {
  const email = document.getElementById('sb-email').value.trim();
  const pw    = document.getElementById('sb-pw').value;
  const msg   = document.getElementById('sb-msg');
  msg.textContent = 'Anmelden…';
  const { error } = await _SB.auth.signInWithPassword({ email, password: pw });
  if (error) { msg.textContent = '✗ ' + error.message; return; }
  renderSyncPanel();
  const remote = await fetchSupabase();
  restoreFromRemote(remote);
  populateCategorySelects();
  populateLocationSelects();
  renderAll();
  toast('Angemeldet ✓');
}

async function supabaseSignUp() {
  const email = document.getElementById('sb-email').value.trim();
  const pw    = document.getElementById('sb-pw').value;
  const msg   = document.getElementById('sb-msg');
  msg.textContent = 'Registrieren…';
  const { error } = await _SB.auth.signUp({ email, password: pw });
  if (error) { msg.textContent = '✗ ' + error.message; return; }
  msg.style.color = 'var(--up)';
  msg.textContent = '✓ Bestätigungsmail gesendet – bitte E-Mail prüfen!';
}

async function supabaseSignOut() {
  await _SB.auth.signOut();
  // Alle user-spezifischen Daten aus localStorage löschen
  // damit der nächste Nutzer auf diesem Gerät einen leeren Stand hat
  [DB_KEY, WEIGHT_KEY, PLANS_KEY, CATEGORIES_KEY, LOCATIONS_KEY, CFG_KEY, ACTIVE_KEY]
    .forEach(k => localStorage.removeItem(k));
  showLoginGate();
}
function exportJSON() {
  try {
    const db = loadDB();
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'liftlog-backup-' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('JSON heruntergeladen ✓');
  } catch(e) { toast('Export fehlgeschlagen', true); }
}

function exportCSV() {
  try {
    const { sessions } = loadDB();
    const rows = [['Datum','Kategorie','Standort','Übung','Satz','Gewicht (kg)','Wdh']];
    (sessions || []).forEach(s => {
      if (!s.exercises || !s.exercises.length) {
        rows.push([s.date||'', s.category||'', s.location||'', '', '', '', '']);
      } else {
        s.exercises.forEach(ex => {
          const sets = ex.sets || [];
          if (!sets.length) { rows.push([s.date||'', s.category||'', s.location||'', ex.name||'', '', '', '']); return; }
          sets.forEach((set, i) => rows.push([s.date||'', s.category||'', s.location||'', ex.name||'', i+1, set.weight||'', set.reps||'']));
        });
      }
    });
    const esc = v => '"' + String(v).replace(/"/g,'""') + '"';
    const csv = rows.map(r => r.map(esc).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'liftlog-sessions-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('CSV heruntergeladen ✓');
  } catch(e) { toast('Export fehlgeschlagen', true); }
}

function exportPDF() {
  window.print();
}

function shareStats() {
  try {
    const el = id => document.getElementById(id);
    const sessions = el('s-sessions') ? el('s-sessions').textContent : '?';
    const volume   = el('s-volume')   ? el('s-volume').textContent   : '?';
    const text = `🏋️ LiftLog
📅 ${sessions} Sessions · ⚖️ ${volume} Tonnen Volumen`;
    if (navigator.share) {
      navigator.share({ title: 'LiftLog Stats', text });
    } else {
      navigator.clipboard.writeText(text).then(() => toast('In Zwischenablage kopiert ✓')).catch(() => toast('Teilen nicht verfügbar', true));
    }
  } catch(e) { toast('Fehler beim Teilen', true); }
}


function loadCatEditor() {
  const cats = getCategories();
  const el   = document.getElementById('cat-list');
  el.innerHTML = cats.map(c => `
    <div class="toggle-row${c.enabled ? '' : ' off'}">
      <span class="tr-name">${escapeHtml(c.name)}</span>
      <button class="tr-del" title="Löschen" data-act="deleteCat" data-arg="${escapeHtml(c.name)}">✕</button>
      <button class="tr-switch${c.enabled ? '' : ' off'}" role="switch" aria-checked="${c.enabled}" aria-label="${escAttr(c.name)} ${c.enabled ? 'aktiv' : 'deaktiviert'}" data-act="toggleCat" data-arg="${escapeHtml(c.name)}"><span class="knob"></span></button>
    </div>`).join('');
}

function toggleCat(name) {
  const cats = getCategories();
  const idx  = cats.findIndex(c => c.name === name);
  if (idx >= 0) cats[idx].enabled = !cats[idx].enabled;
  saveCategories(cats);
  loadCatEditor();
  populateCategorySelects();
}

function deleteCat(name) {
  if (!confirm('Kategorie wirklich löschen?')) return;
  saveCategories(getCategories().filter(c => c.name !== name));
  loadCatEditor();
  populateCategorySelects();
}

function addCategory() {
  const inp  = document.getElementById('new-cat-input');
  const name = inp.value.trim();
  if (!name) return;
  const cats = getCategories();
  if (cats.some(c => c.name === name)) { toast('Existiert bereits', true); return; }
  cats.push({ name, enabled: true });
  saveCategories(cats);
  inp.value = '';
  loadCatEditor();
  populateCategorySelects();
}

function loadLocEditor() {
  const locs = getLocations();
  const el   = document.getElementById('loc-list');
  el.innerHTML = locs.map(l => `
    <div class="toggle-row${l.enabled ? '' : ' off'}">
      <span class="tr-name">${escapeHtml(l.label)}</span>
      <button class="tr-del" title="Löschen" data-act="deleteLoc" data-arg="${escapeHtml(l.key)}">✕</button>
      <button class="tr-switch${l.enabled ? '' : ' off'}" role="switch" aria-checked="${l.enabled}" aria-label="${escAttr(l.label)} ${l.enabled ? 'aktiv' : 'deaktiviert'}" data-act="toggleLoc" data-arg="${escapeHtml(l.key)}"><span class="knob"></span></button>
    </div>`).join('');
}

function toggleLoc(key) {
  const locs = getLocations();
  const idx  = locs.findIndex(l => l.key === key);
  if (idx >= 0) locs[idx].enabled = !locs[idx].enabled;
  saveLocations(locs);
  loadLocEditor();
  populateLocationSelects();
}

function deleteLoc(key) {
  if (!confirm('Standort wirklich löschen?')) return;
  saveLocations(getLocations().filter(l => l.key !== key));
  loadLocEditor();
  populateLocationSelects();
}

function addLocation() {
  const label = document.getElementById('new-loc-label').value.trim();
  if (!label) return;
  const key   = label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const locs  = getLocations();
  if (locs.some(l => l.key === key)) { toast('Existiert bereits', true); return; }
  locs.push({ key, label, enabled: true });
  saveLocations(locs);
  document.getElementById('new-loc-label').value = '';
  loadLocEditor();
  populateLocationSelects();
}

// Plan editor
function loadPlanEditor() {
  const cat = document.getElementById('plan-cat').value;
  const loc = document.getElementById('plan-loc').value;
  const listEl = document.getElementById('plan-ex-list');
  const addBtn = document.getElementById('plan-add-btn');
  const savBtn = document.getElementById('plan-save-btn');
  if (!cat || !loc) { listEl.innerHTML = ''; addBtn.style.display='none'; savBtn.style.display='none'; return; }
  const plans = getPlans();
  const exs   = (plans[cat] && plans[cat][loc]) ? plans[cat][loc] : [];
  listEl.innerHTML = exs.map((e,i) => `
    <div class="plan-ex-row">
      <input type="text" value="${e}" data-input="markPlanDirty" data-plan-idx="${i}">
      <button class="btn btn-danger" data-act="removeParentDirty">✕</button>
    </div>`).join('');
  addBtn.style.display = '';
  savBtn.style.display = '';
}

let planDirty = false;
function markPlanDirty() { planDirty = true; }

function addPlanEx() {
  const row = document.createElement('div');
  row.className = 'plan-ex-row';
  row.innerHTML = `<input type="text" placeholder="Übungsname" data-input="markPlanDirty"><button class="btn btn-danger" data-act="removeParentDirty">✕</button>`;
  document.getElementById('plan-ex-list').appendChild(row);
}

function savePlanEditor() {
  const cat = document.getElementById('plan-cat').value;
  const loc = document.getElementById('plan-loc').value;
  if (!cat || !loc) return;
  const inputs = document.querySelectorAll('#plan-ex-list .plan-ex-row input');
  const exs    = [...inputs].map(i => i.value.trim()).filter(Boolean);
  const plans  = getPlans();
  if (!plans[cat]) plans[cat] = {};
  plans[cat][loc] = exs;
  savePlansToStorage(plans);
  toast('Plan gespeichert ✓');
}

function showClearConfirm() {
  document.getElementById('m-clear').classList.add('open');
}
function confirmClearAll() {
  closeM('m-clear');
  localStorage.clear();
  location.reload();
}

// ── Weight chart ──────────────────────────────────────
let wtChart = null;

function addWeightEntry() {
  const date = document.getElementById('wt-date').value;
  const kg   = parseFloat(document.getElementById('wt-kg').value);
  const kfa  = parseFloat(document.getElementById('wt-kfa').value) || null;
  if (!date || isNaN(kg)) { toast('Datum und Gewicht erforderlich', true); return; }
  const entries = getWeightEntries().filter(e => e.date !== date);
  entries.push({ date, kg, kfa });
  entries.sort((a, b) => a.date.localeCompare(b.date));
  saveWeightEntries(entries);
  document.getElementById('wt-date').disabled = false;
  closeM('m-weight');
  applyFilters();
  renderWeightChart();
  renderAll();
  toast('Gewicht gespeichert ✓');
}

function renderWeightChart() {
  const allEntries = getWeightEntries();

  // Set default dates if not set: Von = 1st of current month, Bis = today
  const todayStr = new Date().toLocaleString('sv-SE',{timeZone:'Europe/Berlin'}).slice(0,10);
  const firstOfMonth = todayStr.slice(0,8) + '01';
  const fromInput = document.getElementById('wt-from');
  const toInput   = document.getElementById('wt-to');
  if (fromInput && !fromInput.value) fromInput.value = firstOfMonth;
  if (toInput   && !toInput.value)   toInput.value   = todayStr;

  const fromVal = fromInput?.value || '';
  const toVal   = toInput?.value   || '';
  const entries = allEntries.filter(e =>
    (!fromVal || e.date >= fromVal) && (!toVal || e.date <= toVal)
  ).sort((a,b) => a.date.localeCompare(b.date));

  // Update stats tiles
  const statCurrent = document.getElementById('wt-stat-current');
  const statDelta   = document.getElementById('wt-stat-delta');
  const statKfa     = document.getElementById('wt-stat-kfa');
  const statLbm     = document.getElementById('wt-stat-lbm');
  if (entries.length) {
    const latest  = entries[entries.length - 1];
    const earliest = entries[0];
    const diff    = Math.round((latest.kg - earliest.kg) * 10) / 10;
    const lbm     = latest.kfa != null ? Math.round((latest.kg * (1 - latest.kfa/100)) * 10)/10 : null;
    if (statCurrent) statCurrent.textContent = latest.kg + ' kg';
    if (statDelta) {
      statDelta.textContent = (diff > 0 ? '+' : '') + diff + ' kg';
      statDelta.style.color = diff < 0 ? 'var(--accent)' : diff > 0 ? 'var(--down)' : 'var(--muted2)';
    }
    if (statKfa)  statKfa.textContent  = latest.kfa != null ? latest.kfa + ' %' : '—';
    if (statLbm)  statLbm.textContent  = lbm !== null ? lbm + ' kg' : '—';
  } else {
    [statCurrent, statDelta, statKfa, statLbm].forEach(el => { if(el) el.textContent = '—'; });
  }

  const emptyEl = document.getElementById('wt-chart-empty');
  const wrapEl  = document.getElementById('wt-chart-wrap');
  if (!entries.length) {
    if (emptyEl) emptyEl.style.display = '';
    if (wrapEl)  wrapEl.style.display  = 'none';
    if (wtChart) { wtChart.destroy(); wtChart = null; }
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  if (wrapEl)  wrapEl.style.display  = '';

  const labels = entries.map(e => { const [y,mo,d]=e.date.split('-'); return `${d}.${mo}.`; });
  const kgData  = entries.map(e => e.kg);
  const kfaData = entries.map(e => e.kfa);
  const hasKfa  = kfaData.some(v => v != null);

  // legacy delta el (still exists elsewhere)
  renderWeightDelta(entries);

  const datasets = [
    { label: 'Gewicht (kg)', data: kgData, borderColor: '#2E4A7A', backgroundColor: 'rgba(46,74,122,.07)', pointBackgroundColor: '#2E4A7A', pointRadius: 4, tension: 0.35, fill: true, yAxisID: hasKfa ? 'y' : 'y' }
  ];
  if (hasKfa) {
    datasets.push({ label: 'KFA (%)', data: kfaData, borderColor: '#4a7abf', backgroundColor: 'rgba(74,122,191,.05)', pointBackgroundColor: '#4a7abf', pointRadius: 4, tension: 0.35, fill: false, yAxisID: 'y2', spanGaps: true });
  }

  const scales = {
    x: { ticks: { color: '#A8B4CC', font: { family: 'Helvetica Neue', size: 11 }, autoSkip: true, maxTicksLimit: 6, maxRotation: 0 }, grid: { display: false } },
    y: { position: 'left', ticks: { color: '#2E4A7A', font: { family: 'Helvetica Neue', size: 11 } }, grid: { color: '#EEF1F7' } }
  };
  if (hasKfa) scales.y2 = { position: 'right', ticks: { color: '#4a7abf', font: { family: 'Helvetica Neue', size: 11 }, callback: v => v + '%' }, grid: { display: false } };

  const ctx = document.getElementById('wt-chart').getContext('2d');
  if (wtChart) wtChart.destroy();
  wtChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales
    }
  });
  renderWeightLegend(datasets);
}

function renderWeightDelta(entries) {
  const el = document.getElementById('wt-delta');
  if (!el) return;
  // Fixed 30-day delta
  const wtDelta = calcWeightDelta30();
  if (!wtDelta) { el.innerHTML = ''; return; }
  const d = wtDelta.diff;
  if (d === 0) { el.innerHTML = ''; return; }
  el.innerHTML = d > 0
    ? `<span style="color:#ff6b35">▲ ${Math.abs(d).toFixed(1)} kg (30 Tage)</span>`
    : `<span style="color:var(--accent)">▼ ${Math.abs(d).toFixed(1)} kg (30 Tage)</span>`;
}

function renderWeightLegend(datasets) {
  const el = document.getElementById('wt-legend');
  if (!el) return;
  const colors = ['#2E4A7A', '#4a7abf'];
  el.innerHTML = datasets.map((ds, i) => `
    <div data-act="toggleWtDataset" data-argn="${i}" id="wt-leg-${i}"
      style="display:flex;align-items:center;gap:7px;cursor:pointer;user-select:none;-webkit-user-select:none">
      <div style="width:12px;height:12px;border-radius:3px;background:${colors[i]};flex-shrink:0"></div>
      <span style="font-size:0.72rem;color:var(--muted2);font-weight:600;letter-spacing:.04em">${ds.label}</span>
    </div>
  `).join('');
}

function toggleWtDataset(index) {
  if (!wtChart) return;
  const meta = wtChart.getDatasetMeta(index);
  meta.hidden = !meta.hidden;

  const showKg  = !wtChart.getDatasetMeta(0).hidden;
  const showKfa = wtChart.data.datasets.length > 1 && !wtChart.getDatasetMeta(1).hidden;

  const yScale  = wtChart.options.scales.y;
  const y2Scale = wtChart.options.scales.y2;
  if (yScale)  yScale.display  = showKg;
  if (y2Scale) {
    y2Scale.display   = showKfa;
    y2Scale.position  = showKg ? 'right' : 'left';
  }

  wtChart.update();
  const el = document.getElementById('wt-leg-' + index);
  if (el) el.style.opacity = meta.hidden ? '0.35' : '1';
}

// ── Auth + Init ───────────────────────────────────────
let _PROFILE = null;

function showLoginGate() {
  const gate = document.getElementById('login-gate');
  gate.style.display = 'flex';
  gateShowA();
}
function hideLoginGate() {
  document.getElementById('login-gate').style.display = 'none';
}

// Gate screen navigation
function gateShowA() {
  document.getElementById('gate-a').style.display = '';
  document.getElementById('gate-b').style.display = 'none';
  document.getElementById('gate-c').style.display = 'none';
}
function gateShowB() {
  document.getElementById('gate-a').style.display = 'none';
  document.getElementById('gate-b').style.display = '';
  document.getElementById('gate-c').style.display = 'none';
  const msg = document.getElementById('gate-msg');
  if (msg) msg.textContent = '';
}
function gateShowC() {
  document.getElementById('gate-a').style.display = 'none';
  document.getElementById('gate-b').style.display = 'none';
  document.getElementById('gate-c').style.display = '';
  _regAvatarFile = null;   // frische Registrierung → evtl. altes Bild verwerfen
  regGotoStep(1);
}

// Register step navigation
let _regStep = 1;
function regGotoStep(n) {
  _regStep = n;
  [1, 2, 3].forEach(i => {
    const panel = document.getElementById('reg-step-' + i);
    const dot   = document.getElementById('reg-step-dot-' + i);
    const line  = document.getElementById('reg-step-line-' + i);
    if (panel) panel.style.display = i === n ? '' : 'none';
    if (dot)   dot.className = 'reg-step' + (i < n ? ' done' : '') + (i === n ? ' active' : '');
    if (line)  line.className = 'reg-step-line' + (i < n ? ' done' : '');
  });
}

const _EYE_OPEN   = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const _EYE_CLOSED = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';

function togglePwVis(inputId, btnId) {
  const inp = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (inp.type === 'password') { inp.type = 'text';     btn.innerHTML = _EYE_CLOSED; }
  else                         { inp.type = 'password'; btn.innerHTML = _EYE_OPEN; }
}

const _PW_RULES = [
  { id: 'rule-len',  test: v => v.length >= 10,                              text: 'Mindestens 10 Zeichen' },
  { id: 'rule-case', test: v => /[a-z]/.test(v) && /[A-Z]/.test(v),          text: 'Groß- und Kleinbuchstabe' },
  { id: 'rule-num',  test: v => /[0-9]/.test(v),                             text: 'Mindestens 1 Zahl' },
  { id: 'rule-spec', test: v => /[!@#$%^&*()\\_+\-=\[\]{};':"\\|<>?,./`~]/.test(v), text: 'Mindestens 1 Sonderzeichen (!@#$%…)' },
];

function regPwCheck(val) {
  _PW_RULES.forEach(({ id, test, text }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const ok = test(val);
    el.classList.toggle('ok', ok);
    el.textContent = (ok ? '✓ ' : '○ ') + text;
  });
}

function validatePw(pw) {
  for (const { test, text } of _PW_RULES) {
    if (!test(pw)) return '✗ Anforderung nicht erfüllt: ' + text + '.';
  }
  return null;
}

function regStep1Next() {
  const email = document.getElementById('reg-email').value.trim();
  const pw    = document.getElementById('reg-pw').value;
  const pw2   = document.getElementById('reg-pw2').value;
  const msg   = document.getElementById('reg-msg-1');
  msg.textContent = '';
  if (!email || !/\S+@\S+\.\S+/.test(email)) { msg.textContent = '✗ Bitte gültige E-Mail eingeben.'; return; }
  const pwErr = validatePw(pw);
  if (pwErr) { msg.textContent = pwErr; return; }
  if (pw !== pw2) { msg.textContent = '✗ Passwörter stimmen nicht überein.'; return; }
  regGotoStep(2);
}

let _usernameCheckTimer = null;
async function checkUsernameAvail(val) {
  const msg = document.getElementById('reg-username-msg');
  if (!msg) return;
  const v = val.trim().toLowerCase();
  if (!v) { msg.textContent = ''; return; }
  if (!/^[a-z0-9_]{3,30}$/.test(v)) {
    msg.textContent = '✗ Nur Kleinbuchstaben, Zahlen, Underscore (3–30 Zeichen).';
    msg.style.color = '#cc4444'; return;
  }
  msg.textContent = '… prüfe Verfügbarkeit'; msg.style.color = 'var(--muted2)';
  clearTimeout(_usernameCheckTimer);
  _usernameCheckTimer = setTimeout(async () => {
    const { data } = await _SB.from('profiles').select('username').eq('username', v).maybeSingle();
    if (data) { msg.textContent = '✗ Username bereits vergeben.'; msg.style.color = '#cc4444'; }
    else      { msg.textContent = '✓ Username verfügbar.';        msg.style.color = 'var(--up)'; }
  }, 500);
}

let _usernameEditTimer = null;
async function checkUsernameEditAvail(val) {
  const msg = document.getElementById('profile-edit-username-msg');
  if (!msg) return;
  const v = val.trim().toLowerCase();
  if (!v) { msg.textContent = ''; return; }
  if (_PROFILE && v === _PROFILE.username) { msg.textContent = ''; return; }
  if (!/^[a-z0-9_]{3,30}$/.test(v)) {
    msg.textContent = '✗ Nur Kleinbuchstaben, Zahlen, Underscore (3–30 Zeichen).';
    msg.style.color = '#cc4444'; return;
  }
  msg.textContent = '… prüfe Verfügbarkeit'; msg.style.color = 'var(--muted2)';
  clearTimeout(_usernameEditTimer);
  _usernameEditTimer = setTimeout(async () => {
    const { data } = await _SB.from('profiles').select('username').eq('username', v).maybeSingle();
    if (data) { msg.textContent = '✗ Username bereits vergeben.'; msg.style.color = '#cc4444'; }
    else      { msg.textContent = '✓ Username verfügbar.';        msg.style.color = 'var(--up)'; }
  }, 500);
}

// ── Avatar-Auswahl mit Crop/Zoom ──────────────────────
let _regAvatarFile  = null;   // zugeschnittene Datei aus der Registrierung
let _editAvatarFile = null;   // zugeschnittene Datei aus dem Profil-Dialog

function previewRegAvatar(input) {
  const file = input.files[0]; if (!file) return;
  openCropper(file, (cropped, dataUrl) => {
    _regAvatarFile = cropped;
    const prev = document.getElementById('reg-avatar-preview');
    if (prev) prev.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  });
}

function previewEditAvatar(input) {
  const file = input.files[0]; if (!file) return;
  openCropper(file, (cropped, dataUrl) => {
    _editAvatarFile = cropped;
    const prev = document.getElementById('profile-edit-avatar-preview');
    if (prev) prev.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
  });
}

// ── Cropper-Engine (Canvas, ohne externe Library) ─────
const _crop = { img: null, base: 1, zoom: 1, offX: 0, offY: 0, view: 280, out: 512, drag: null, onDone: null };

function openCropper(file, onDone) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      _crop.img  = img;
      _crop.base = Math.max(_crop.view / img.naturalWidth, _crop.view / img.naturalHeight); // "cover"
      _crop.zoom = 1; _crop.offX = 0; _crop.offY = 0; _crop.onDone = onDone;
      const z = document.getElementById('cropper-zoom'); if (z) z.value = 1;
      openM('m-cropper');
      _cropDraw();
    };
    img.src = e.target.result;   // data: URL → CSP-konform
  };
  reader.readAsDataURL(file);
}

function _cropScale() { return _crop.base * _crop.zoom; }
function _cropClamp() {
  const s = _cropScale(), v = _crop.view;
  const iw = _crop.img.naturalWidth * s, ih = _crop.img.naturalHeight * s;
  _crop.offX = Math.min(0, Math.max(v - iw, _crop.offX));
  _crop.offY = Math.min(0, Math.max(v - ih, _crop.offY));
}
function _cropDraw() {
  if (!_crop.img) return;
  const c = document.getElementById('cropper-canvas'); if (!c) return;
  const ctx = c.getContext('2d'), v = _crop.view, s = _cropScale();
  _cropClamp();
  ctx.clearRect(0, 0, v, v);
  ctx.drawImage(_crop.img, _crop.offX, _crop.offY, _crop.img.naturalWidth * s, _crop.img.naturalHeight * s);
}
function cropperZoom(val) { _crop.zoom = parseFloat(val) || 1; _cropDraw(); }

function _cropDragStart(e) { const p = e.touches ? e.touches[0] : e; _crop.drag = { x: p.clientX, y: p.clientY, ox: _crop.offX, oy: _crop.offY }; }
function _cropDragMove(e) {
  if (!_crop.drag) return;
  const p = e.touches ? e.touches[0] : e;
  _crop.offX = _crop.drag.ox + (p.clientX - _crop.drag.x);
  _crop.offY = _crop.drag.oy + (p.clientY - _crop.drag.y);
  _cropDraw();
  if (e.cancelable) e.preventDefault();
}
function _cropDragEnd() { _crop.drag = null; }

function cropperConfirm() {
  const out = _crop.out, r = out / _crop.view, s = _cropScale() * r;
  const cv = document.createElement('canvas'); cv.width = out; cv.height = out;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, out, out);
  ctx.drawImage(_crop.img, _crop.offX * r, _crop.offY * r, _crop.img.naturalWidth * s, _crop.img.naturalHeight * s);
  const dataUrl = cv.toDataURL('image/jpeg', 0.9);
  cv.toBlob(blob => {
    const file = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
    closeM('m-cropper');
    if (_crop.onDone) _crop.onDone(file, dataUrl);
  }, 'image/jpeg', 0.9);
}

(function bindCropper() {
  const stage = document.getElementById('cropper-stage');
  if (!stage) return;
  stage.addEventListener('mousedown', _cropDragStart);
  window.addEventListener('mousemove', _cropDragMove);
  window.addEventListener('mouseup', _cropDragEnd);
  stage.addEventListener('touchstart', _cropDragStart, { passive: true });
  stage.addEventListener('touchmove', _cropDragMove, { passive: false });
  stage.addEventListener('touchend', _cropDragEnd);
})();

async function regStep2Next() {
  const username = document.getElementById('reg-username').value.trim().toLowerCase();
  const msg = document.getElementById('reg-msg-2');
  msg.textContent = '';
  if (!username) { msg.textContent = '✗ Username ist erforderlich.'; return; }
  if (!/^[a-z0-9_]{3,30}$/.test(username)) { msg.textContent = '✗ Ungültiger Username.'; return; }
  msg.textContent = '… prüfe Username'; msg.style.color = 'var(--muted2)';
  const { data } = await _SB.from('profiles').select('username').eq('username', username).maybeSingle();
  if (data) { msg.textContent = '✗ Username bereits vergeben.'; msg.style.color = '#cc4444'; return; }
  msg.textContent = '';
  regGotoStep(3);
}

async function regSubmit() {
  const msg = document.getElementById('reg-msg-3');
  msg.textContent = 'Konto erstellen…'; msg.style.color = 'var(--muted2)';
  const email       = document.getElementById('reg-email').value.trim();
  const pw          = document.getElementById('reg-pw').value;
  const username    = document.getElementById('reg-username').value.trim().toLowerCase();
  const displayName = document.getElementById('reg-displayname').value.trim();
  const goals       = document.getElementById('reg-goals').value.trim();
  const hobbies     = document.getElementById('reg-hobbies').value.trim();
  const lifestyle   = document.getElementById('reg-lifestyle').value.trim();
  const heightCm    = document.getElementById('reg-height').value.trim();
  const fitnessLvl  = document.getElementById('reg-fitness-level').value;
  const avatarFile  = _regAvatarFile;   // zugeschnittenes Bild aus dem Cropper
  // Profilfelder als Auth-Metadaten mitgeben → der DB-Trigger handle_new_user()
  // legt daraus die profiles-Zeile an. Funktioniert auch ohne Session (E-Mail-
  // Bestätigung aktiv), weil der Trigger serverseitig läuft.
  const profileMeta = {
    username,
    display_name:  displayName || null,
    goals:         goals     || null,
    hobbies:       hobbies   || null,
    lifestyle:     lifestyle || null,
    height_cm:     heightCm ? parseInt(heightCm, 10) : null,
    fitness_level: fitnessLvl || null,
  };
  const { data: signUpData, error: signUpErr } = await _SB.auth.signUp({ email, password: pw, options: { data: profileMeta } });
  if (signUpErr) { msg.textContent = '✗ ' + signUpErr.message; msg.style.color = '#cc4444'; return; }
  const userId = signUpData.user?.id;
  if (!userId) {
    msg.textContent = '✓ Bestätigungsmail gesendet – bitte E-Mail prüfen.';
    msg.style.color = 'var(--up)'; return;
  }
  // Nur mit aktiver Session (E-Mail-Bestätigung aus) lassen sich Avatar-Upload und
  // ein direkter Profil-Upsert authentifiziert ausführen. Ohne Session hat der
  // Trigger die Zeile bereits erstellt; das Avatar kann nach dem Login gesetzt werden.
  if (signUpData.session) {
    let avatarUrl = null;
    if (avatarFile) {
      const ext  = (avatarFile.name.split('.').pop() || 'jpg').toLowerCase();
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await _SB.storage.from('avatars').upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
      if (!upErr) {
        const { data: urlData } = _SB.storage.from('avatars').getPublicUrl(path);
        if (urlData?.publicUrl) avatarUrl = urlData.publicUrl + '?t=' + Date.now();
      } else { console.warn('Avatar-Upload bei Registrierung fehlgeschlagen:', upErr.message); }
    }
    const { error: profileErr } = await _SB.from('profiles').upsert({ id: userId, ...profileMeta, avatar_url: avatarUrl });
    if (profileErr) {
      msg.textContent = '✗ Konto erstellt, aber Profil nicht gespeichert: ' + profileErr.message + ' — später unter Einstellungen → Profil anpassen ergänzbar.';
      msg.style.color = '#cc4444';
      return;
    }
    hideLoginGate();
    await loadApp();
  } else {
    msg.textContent = '✓ Konto erstellt! Bitte E-Mail bestätigen und dann anmelden.';
    msg.style.color = 'var(--up)';
  }
}

async function gateForgotPw() {
  const email = document.getElementById('gate-email').value.trim();
  const msg   = document.getElementById('gate-msg');
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    msg.textContent = '✗ Bitte zuerst E-Mail eingeben.'; msg.style.color = '#cc4444'; return;
  }
  msg.textContent = 'Sende Reset-Link…'; msg.style.color = 'var(--muted2)';
  const { error } = await _SB.auth.resetPasswordForEmail(email);
  if (error) { msg.textContent = '✗ ' + error.message; msg.style.color = '#cc4444'; return; }
  msg.textContent = '✓ Reset-Link gesendet – bitte E-Mail prüfen.'; msg.style.color = 'var(--up)';
}

async function gateSignIn() {
  const email = document.getElementById('gate-email').value.trim();
  const pw    = document.getElementById('gate-pw').value;
  const msg   = document.getElementById('gate-msg');
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    msg.textContent = '✗ Bitte gültige E-Mail eingeben.'; msg.style.color = '#cc4444'; return;
  }
  if (!pw) { msg.textContent = '✗ Bitte Passwort eingeben.'; msg.style.color = '#cc4444'; return; }
  msg.textContent = 'Anmelden…'; msg.style.color = 'var(--muted2)';
  const { error } = await _SB.auth.signInWithPassword({ email, password: pw });
  if (error) { msg.textContent = '✗ E-Mail oder Passwort ungültig.'; msg.style.color = '#cc4444'; return; }
  hideLoginGate();
  await loadApp();
}

function initGate() {
  init();
}

async function init() {
  const { data: { user } } = await _SB.auth.getUser();
  if (!user) { showLoginGate(); return; }
  hideLoginGate();
  await loadApp();
}

async function loadProfile() {
  try {
    const { data: { user } } = await _SB.auth.getUser();
    if (!user) return;
    const { data } = await _SB.from('profiles').select('*').eq('id', user.id).single();
    _PROFILE = data || null;
  } catch {}
}

function renderProfileSection() {
  const dn = document.getElementById('settings-display-name');
  const un = document.getElementById('settings-username');
  const av = document.getElementById('settings-avatar');
  if (!_PROFILE) return;
  if (dn) dn.textContent = _PROFILE.display_name || _PROFILE.username || '—';
  if (un) un.textContent = '@' + (_PROFILE.username || '—');
  if (av && _PROFILE.avatar_url) {
    const ph = '<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>';
    const img = document.createElement('img');
    img.src = _PROFILE.avatar_url;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover';
    img.onerror = () => { av.innerHTML = ph; };   // Datei fehlt → Platzhalter statt kaputtem Bild
    av.innerHTML = '';
    av.appendChild(img);
  }
}

async function loadApp() {
  switchView('dashboard');
  await loadProfile();
  const remote = await fetchSupabase();
  restoreFromRemote(remote);
  // Selects nach Restore befüllen, damit User-Kategorien und -Standorte geladen sind
  populateCategorySelects();
  populateLocationSelects();
  renderAll();
  initBodyDates();
  renderSyncPanel();
  renderProfileSection();
}

// ── Profile edit ──────────────────────────────────────
function openProfileEditModal() {
  if (!_PROFILE) return;
  document.getElementById('profile-edit-username').value           = _PROFILE.username || '';
  document.getElementById('profile-edit-displayname').value        = _PROFILE.display_name || '';
  document.getElementById('profile-edit-goals').value              = _PROFILE.goals || '';
  document.getElementById('profile-edit-hobbies').value            = _PROFILE.hobbies || '';
  document.getElementById('profile-edit-lifestyle').value          = _PROFILE.lifestyle || '';
  document.getElementById('profile-edit-height').value             = _PROFILE.height_cm || '';
  document.getElementById('profile-edit-fitness-level').value      = _PROFILE.fitness_level || '';
  document.getElementById('profile-edit-msg').textContent          = '';
  document.getElementById('profile-edit-avatar-file').value        = '';
  _editAvatarFile = null;   // evtl. zuvor gewähltes Bild verwerfen
  const prev = document.getElementById('profile-edit-avatar-preview');
  if (prev) prev.innerHTML = _PROFILE.avatar_url
    ? `<img src="${_PROFILE.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--muted2)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>';
  openM('m-profile-edit');
}

async function saveProfileEdit() {
  const msg = document.getElementById('profile-edit-msg');
  msg.textContent = 'Speichern…'; msg.style.color = 'var(--muted2)';
  const { data: { user } } = await _SB.auth.getUser();
  if (!user) { msg.textContent = '✗ Nicht angemeldet.'; msg.style.color = '#cc4444'; return; }
  const username    = _PROFILE?.username || null;   // fest – nach der Registrierung nicht änderbar
  const displayName = document.getElementById('profile-edit-displayname').value.trim();
  const goals       = document.getElementById('profile-edit-goals').value.trim();
  const hobbies     = document.getElementById('profile-edit-hobbies').value.trim();
  const lifestyle   = document.getElementById('profile-edit-lifestyle').value.trim();
  const heightCm    = document.getElementById('profile-edit-height').value.trim();
  const fitnessLvl  = document.getElementById('profile-edit-fitness-level').value;
  const avatarFile  = _editAvatarFile;   // zugeschnittenes Bild aus dem Cropper
  let avatarUrl = _PROFILE?.avatar_url || null;
  if (avatarFile) {
    const ext  = (avatarFile.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${user.id}/avatar.${ext}`;
    const { error: upErr } = await _SB.storage.from('avatars').upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
    if (upErr) { msg.textContent = '✗ Bild-Upload fehlgeschlagen: ' + upErr.message; msg.style.color = '#cc4444'; return; }
    const { data: urlData } = _SB.storage.from('avatars').getPublicUrl(path);
    if (urlData?.publicUrl) avatarUrl = urlData.publicUrl + '?t=' + Date.now();  // Cache-Buster, damit das neue Bild sofort erscheint
  }
  const updates = { id: user.id, username, display_name: displayName || null, avatar_url: avatarUrl,
    goals: goals || null, hobbies: hobbies || null, lifestyle: lifestyle || null,
    height_cm: heightCm ? parseInt(heightCm, 10) : null, fitness_level: fitnessLvl || null };
  const { error } = await _SB.from('profiles').upsert(updates);
  if (error) { msg.textContent = '✗ ' + error.message; msg.style.color = '#cc4444'; return; }
  _PROFILE = { ..._PROFILE, ...updates };
  renderProfileSection();
  msg.textContent = '✓ Gespeichert'; msg.style.color = 'var(--up)';
  setTimeout(() => closeM('m-profile-edit'), 700);
  toast('Profil aktualisiert ✓');
}

// ── Account changes ───────────────────────────────────
function openEmailChangeModal() {
  document.getElementById('email-change-new').value      = '';
  document.getElementById('email-change-msg').textContent = '';
  openM('m-email-change');
}

async function saveEmailChange() {
  const newEmail = document.getElementById('email-change-new').value.trim();
  const msg      = document.getElementById('email-change-msg');
  if (!newEmail || !/\S+@\S+\.\S+/.test(newEmail)) {
    msg.textContent = '✗ Bitte gültige E-Mail eingeben.'; msg.style.color = '#cc4444'; return;
  }
  msg.textContent = 'Speichern…'; msg.style.color = 'var(--muted2)';
  const { error } = await _SB.auth.updateUser({ email: newEmail });
  if (error) { msg.textContent = '✗ ' + error.message; msg.style.color = '#cc4444'; return; }
  msg.textContent = '✓ Bestätigungsmail an neue Adresse gesendet.'; msg.style.color = 'var(--up)';
  setTimeout(() => closeM('m-email-change'), 1500);
  toast('Bestätigungsmail gesendet ✓');
}

function openPasswordChangeModal() {
  document.getElementById('pw-change-new').value         = '';
  document.getElementById('pw-change-confirm').value     = '';
  document.getElementById('pw-change-msg').textContent   = '';
  openM('m-password-change');
}

async function savePasswordChange() {
  const newPw  = document.getElementById('pw-change-new').value;
  const confPw = document.getElementById('pw-change-confirm').value;
  const msg    = document.getElementById('pw-change-msg');
  if (newPw.length < 8) { msg.textContent = '✗ Passwort muss mindestens 8 Zeichen haben.'; msg.style.color = '#cc4444'; return; }
  if (newPw !== confPw) { msg.textContent = '✗ Passwörter stimmen nicht überein.'; msg.style.color = '#cc4444'; return; }
  msg.textContent = 'Speichern…'; msg.style.color = 'var(--muted2)';
  const { error } = await _SB.auth.updateUser({ password: newPw });
  if (error) { msg.textContent = '✗ ' + error.message; msg.style.color = '#cc4444'; return; }
  msg.textContent = '✓ Passwort geändert.'; msg.style.color = 'var(--up)';
  setTimeout(() => closeM('m-password-change'), 700);
  toast('Passwort geändert ✓');
}

// Redirect to login gate when session expires
_SB.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') showLoginGate();
});

// ─── TOOLTIP (hover desktop / tap mobile) ────────────────────────────────────
function toggleTooltip(e, id) {
  e.stopPropagation();
  const wrap = document.getElementById(id);
  if (!wrap) return;
  const isOpen = wrap.classList.contains('open');
  // Close all open tooltips first
  document.querySelectorAll('.tooltip-wrap.open').forEach(el => el.classList.remove('open'));
  if (!isOpen) wrap.classList.add('open');
}
document.addEventListener('click', () => {
  document.querySelectorAll('.tooltip-wrap.open').forEach(el => el.classList.remove('open'));
});


// ─── 1RM RECHNER ─────────────────────────────────────────────────────────────
function init1RMSelect() {
  const sel = document.getElementById('rm-ex-select');
  if (!sel) return;
  // Populate with all known exercise names from DB
  const db = loadDB();
  const names = [...new Set(
    db.sessions.flatMap(s => (s.exercises || []).filter(e => e.type !== 'cardio').map(e => e.name))
  )].sort((a,b) => a.localeCompare(b));
  // Only rebuild if changed
  const current = [...sel.options].slice(1).map(o => o.value);
  if (JSON.stringify(current) === JSON.stringify(names)) return;
  sel.innerHTML = '<option value="">— Übung auswählen —</option>';
  names.forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; sel.appendChild(o); });
}

function calc1RM() {
  const ex      = document.getElementById('rm-ex-select').value;
  const weight  = parseFloat(document.getElementById('rm-weight').value);
  const reps    = parseInt(document.getElementById('rm-reps').value, 10);
  const result  = document.getElementById('rm-result');
  const empty   = document.getElementById('rm-empty');
  const histEl  = document.getElementById('rm-history');

  if (!weight || !reps || reps < 1) {
    result.style.display = 'none';
    empty.style.display  = 'block';
    histEl.innerHTML     = '';
    return;
  }
  empty.style.display = 'none';
  result.style.display = 'block';

  // Epley formula: 1RM = w × (1 + r/30)
  const oneRM = Math.round(weight * (1 + reps / 30) * 2) / 2; // round to 0.5
  document.getElementById('rm-result-val').textContent = oneRM + ' kg';

  // Percentage table
  const pcts = [95, 90, 85, 80, 75, 70];
  document.getElementById('rm-pct-grid').innerHTML = pcts.map(p => {
    const val = Math.round(oneRM * p / 100 * 2) / 2;
    return `<div style="background:var(--surface);border-radius:8px;padding:10px;text-align:center">
      <div style="font-size:1rem;font-weight:800">${val} kg</div>
      <div style="font-size:.62rem;color:var(--muted);margin-top:2px">${p}%</div>
    </div>`;
  }).join('');

  // Show best sets from history for this exercise
  if (ex) {
    const db = loadDB();
    const best = [];
    db.sessions.forEach(s => {
      (s.exercises || []).filter(e => e.name === ex).forEach(e => {
        (e.sets || []).forEach(set => {
          if (set.weight && set.reps) {
            const est = Math.round(set.weight * (1 + set.reps / 30) * 2) / 2;
            best.push({ date: s.dateDisplay || s.date, weight: set.weight, reps: set.reps, est });
          }
        });
      });
    });
    best.sort((a, b) => b.est - a.est);
    const top5 = best.slice(0, 5);
    if (top5.length) {
      histEl.innerHTML = `<div class="sec-label" style="margin-bottom:8px">Beste Sätze — ${ex}</div>` +
        top5.map((r, i) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:.9rem;font-weight:800;color:var(--muted);min-width:18px">${i+1}</div>
          <div style="flex:1">
            <div style="font-size:.8rem;font-weight:700">${r.weight} kg × ${r.reps}</div>
            <div style="font-size:.7rem;color:var(--muted2)">${r.date}</div>
          </div>
          <div style="font-size:.8rem;font-weight:700;color:var(--accent)">≈ ${r.est} kg</div>
        </div>`).join('');
    } else {
      histEl.innerHTML = '';
    }
  } else {
    histEl.innerHTML = '';
  }
}




// Exercise (non-cardio) with the most logged sets — for sensible defaults (Item 09)
function mostTrainedExercise() {
  const counts = {};
  loadDB().sessions.forEach(s => {
    (s.exercises || []).forEach(e => {
      if (e.type === 'cardio' || !e.name) return;
      counts[e.name] = (counts[e.name] || 0) + ((e.sets || []).length || 1);
    });
  });
  let best = null, bestN = 0;
  for (const [name, n] of Object.entries(counts)) {
    if (n > bestN) { bestN = n; best = name; }
  }
  return best;
}

// ─── FORTSCHRITT DEFAULT STATE ────────────────────────────────────────────────
function initProgressDefaults() {
  const todayStr     = new Date().toLocaleString('sv-SE', {timeZone: 'Europe/Berlin'}).slice(0, 10);
  const firstOfMonth = todayStr.slice(0, 8) + '01';
  const fromInput    = document.getElementById('prog-from');
  const toInput      = document.getElementById('prog-to');
  if (fromInput && !fromInput.value) fromInput.value = firstOfMonth;
  if (toInput   && !toInput.value)   toInput.value   = todayStr;
  // Auto-select the most-trained exercise if none selected (Item 09)
  if (!_currentChartEx && allExNames.length > 0) {
    const pick = mostTrainedExercise() || allExNames[0];
    const searchInput = document.getElementById('ex-search');
    if (searchInput) searchInput.value = pick;
    selectExByName(pick);
  } else if (_currentChartEx) {
    rechartProgression();
  }
  init1RMDefault();
}

// Prefill the 1RM calculator with the most-trained exercise's heaviest set (Item 09)
function init1RMDefault() {
  const sel = document.getElementById('rm-ex-select');
  const wEl = document.getElementById('rm-weight');
  const rEl = document.getElementById('rm-reps');
  if (!sel || !wEl || !rEl) return;
  if (sel.value || wEl.value || rEl.value) return; // respect any user input
  const pick = mostTrainedExercise();
  if (!pick) return;
  // Find the heaviest set for that exercise
  let best = null;
  loadDB().sessions.forEach(s => {
    (s.exercises || []).filter(e => e.name === pick).forEach(e => {
      (e.sets || []).forEach(st => {
        if (st.weight && st.reps && (!best || st.weight > best.weight)) best = { weight: st.weight, reps: st.reps };
      });
    });
  });
  if (!best) return;
  sel.value = pick;
  wEl.value = best.weight;
  rEl.value = best.reps;
  calc1RM();
}



// ─── INIT KÖRPER DEFAULT DATES ───────────────────────────────────────────────
function initBodyDates() {
  const todayStr     = new Date().toLocaleString('sv-SE', {timeZone: 'Europe/Berlin'}).slice(0, 10);
  const firstOfMonth = todayStr.slice(0, 8) + '01';
  const fromInput    = document.getElementById('wt-from');
  const toInput      = document.getElementById('wt-to');
  if (fromInput && !fromInput.value) fromInput.value = firstOfMonth;
  if (toInput   && !toInput.value)   toInput.value   = todayStr;
}


// ─────────────────────────────────────────────────────
//  EVENT WIRING (CSP-safe – ersetzt frühere Inline-Handler)
//  Inline onclick/onchange/oninput/onkeydown/onblur wurden entfernt, damit die
//  CSP ohne 'unsafe-inline' für script-src auskommt. Stattdessen Delegation
//  über data-Attribute. Konvention auf dem Element:
//    data-act / data-change / data-input  = Name der globalen Funktion
//    data-arg / data-arg2                 = String-Argument(e)
//    data-argn                            = numerisches Argument
//    data-pass="this|value|event"         = Element / .value / Event übergeben
//    data-enter                           = Funktion bei Enter-Taste
//    data-blur                            = Funktion bei focusout
// ─────────────────────────────────────────────────────

// Pseudo-Aktionen für die wenigen Fälle, die nicht "fn(arg)" sind.
const SPECIAL_ACTIONS = {
  selectThis:             (el)     => el.select(),
  focusExSearch:          ()       => { const s = document.getElementById('ex-search'); if (s) s.focus(); },
  tooltipRm:              (el, ev) => toggleTooltip(ev, 'rm-tooltip-wrap'),
  removeParentDirty:      (el)     => { el.parentElement.remove(); markPlanDirty(); },
  closeExDropdownDelayed: ()       => setTimeout(() => closeExDropdown(), 150),
};

function runAction(name, el, ev) {
  if (!name) return;
  if (SPECIAL_ACTIONS[name]) return SPECIAL_ACTIONS[name](el, ev);
  const fn = window[name];
  if (typeof fn !== 'function') { console.warn('[action] keine Funktion:', name); return; }
  const d = el.dataset;
  if (d.pass === 'this')  return fn.call(el, el);
  if (d.pass === 'value') return fn.call(el, el.value);
  if (d.pass === 'event') return fn.call(el, ev);
  if ('argn' in d) return fn.call(el, Number(d.argn));
  if ('arg2' in d) return fn.call(el, d.arg, d.arg2);
  if ('arg'  in d) return fn.call(el, d.arg);
  return fn.call(el);
}

// Klick in der CAPTURE-Phase: läuft vor dem globalen "Tooltip schließen"-Listener,
// damit toggleTooltip()'s stopPropagation() das Schließen weiterhin verhindern kann.
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el) runAction(el.dataset.act, el, e);
}, true);

document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el) runAction(el.dataset.change, el, e);
});

document.addEventListener('input', e => {
  const el = e.target.closest('[data-input]');
  if (el) runAction(el.dataset.input, el, e);
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const el = e.target.closest('[data-enter]');
  if (!el) return;
  const fn = window[el.dataset.enter];
  if (typeof fn === 'function') fn();
});

document.addEventListener('focusout', e => {
  const el = e.target.closest('[data-blur]');
  if (el) runAction(el.dataset.blur, el, e);
});

initGate();
