(function () {
  'use strict';

  // Source of truth: the open-source tolvyn-models pricing DB, served as a static
  // JSON snapshot fetched from GitHub raw (raw.githubusercontent.com). fetchPricing()
  // below is the only data fetch on the page.
  const SOURCE_URL  = 'https://raw.githubusercontent.com/tolvyn/tolvyn-models/main/index.json';
  const REPO_URL    = 'https://github.com/tolvyn/tolvyn-models';
  const MAX_AGE_MS  = 72 * 60 * 60 * 1000; // staleness guard: never show prices older than 72h

  // The single data-access boundary. Returns the parsed DB object, or throws.
  // A request that hangs (headers or body) is aborted after 12 s and treated as a failure, so the page
  // shows its error text instead of loading forever.
  async function fetchPricing() {
    const ctl = new AbortController();
    const timer = setTimeout(function () { ctl.abort(); }, 12000);
    try {
      const r = await fetch(SOURCE_URL, { cache: 'no-store', signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // Every value from the database reaches the page as text (textContent, text nodes), never as markup.
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = String(text);
    return e;
  }

  // ── Formatting — mono numerals, FULL precision (never truncate a rate) ──
  function fmtPrice(v) {
    if (v === null || v === undefined || v === '') return '—';
    const n = Number(v);
    if (!isFinite(n)) return '—';
    // Preserve every decimal the source provides; pad to a minimum of 2.
    const s = String(n);
    const decimals = s.indexOf('.') !== -1 ? s.split('.')[1].length : 0;
    return '$' + n.toFixed(Math.max(2, decimals));
  }

  function providerBadge(p) {
    const key = String(p || '').toLowerCase();
    const cls = { openai: 'provider-openai', anthropic: 'provider-anthropic',
                  google: 'provider-google', deepseek: 'provider-deepseek' }[key] || 'provider-other';
    return el('span', 'provider-badge ' + cls, key || 'other');
  }

  // ── Empty state (also the staleness / failure path) ──
  function showEmpty(msg) {
    document.getElementById('mp-asof').textContent = 'Pricing data temporarily unavailable.';
    const box = el('div', 'mp-empty');
    box.append(el('strong', '', 'Pricing data temporarily unavailable'), msg);
    document.getElementById('mp-table-wrap').replaceChildren(box);
  }

  // ── Sortable table ──
  let rows = [];
  let sortKey = 'provider';
  let sortAsc = true;

  const COLS = [
    { key: 'model_id',  label: 'Model',            num: false },
    { key: 'provider',  label: 'Provider',         num: false },
    { key: 'input',     label: 'Input $/MTok',     num: true },
    { key: 'output',    label: 'Output $/MTok',    num: true },
    { key: 'cached',    label: 'Cached $/MTok',    num: true },
    { key: 'effective', label: 'Effective date',   num: false }
  ];

  function sortRows() {
    rows.sort(function (a, b) {
      let x = a[sortKey], y = b[sortKey];
      // numeric-aware: nulls always sort last
      const xn = (x === null || x === undefined), yn = (y === null || y === undefined);
      if (xn && yn) return 0;
      if (xn) return 1;
      if (yn) return -1;
      if (typeof x === 'number' && typeof y === 'number') return sortAsc ? x - y : y - x;
      x = String(x); y = String(y);
      return sortAsc ? x.localeCompare(y) : y.localeCompare(x);
    });
  }

  function cell(col, cls, content) {
    const td = el('td', cls);
    td.setAttribute('data-label', COLS[col].label);
    td.append(content);
    return td;
  }

  function renderTable() {
    sortRows();
    const head = el('tr');
    COLS.forEach(function (c) {
      const sorted = c.key === sortKey;
      const th = el('th', (c.num ? 'num ' : '') + (sorted ? 'sorted' : ''), c.label);
      th.setAttribute('data-key', c.key);
      th.append(el('span', 'sort-icon', sorted ? (sortAsc ? '▲' : '▼') : '↕'));
      th.addEventListener('click', function () {
        if (c.key === sortKey) { sortAsc = !sortAsc; } else { sortKey = c.key; sortAsc = true; }
        renderTable();
      });
      head.append(th);
    });

    const body = el('tbody');
    rows.forEach(function (r) {
      const model = cell(0, 'mp-model', String(r.model_id));
      if (r.display_name && r.display_name !== r.model_id) model.append(el('small', '', r.display_name));
      const tr = el('tr');
      tr.append(model,
        cell(1, '', providerBadge(r.provider)),
        cell(2, 'num mono', fmtPrice(r.input)),
        cell(3, 'num mono', fmtPrice(r.output)),
        cell(4, 'num mono', fmtPrice(r.cached)),
        cell(5, 'mono', r.effective ? String(r.effective) : '—'));
      body.append(tr);
    });

    const thead = el('thead');
    thead.append(head);
    const table = el('table', 'mp-table');
    table.append(thead, body);
    document.getElementById('mp-table-wrap').replaceChildren(table);
  }

  // ── Boot ──
  async function init() {
    let db;
    try {
      db = await fetchPricing();
    } catch (e) {
      showEmpty('The pricing database could not be reached. Please check back shortly, or view the source at ' +
        'github.com/tolvyn/tolvyn-models.');
      return;
    }

    const generatedAt = db && db.generated_at ? Date.parse(db.generated_at) : NaN;

    // Staleness guard — zero stale prices, enforced here.
    if (!isFinite(generatedAt) || (Date.now() - generatedAt) > MAX_AGE_MS) {
      showEmpty('The pricing database has not synced within the last 72 hours, so prices are withheld to avoid ' +
        'showing stale rates. The latest data is always available at github.com/tolvyn/tolvyn-models.');
      return;
    }

    const models = (db.models || []).filter(function (m) { return m && !m.deprecated; });
    if (!models.length) {
      showEmpty('No active models are currently published in the pricing database.');
      return;
    }

    // Prominent as-of date from generated_at.
    const asof = new Date(generatedAt);
    const link = el('a', '', 'tolvyn-models');
    link.href = REPO_URL;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.getElementById('mp-asof').replaceChildren('Prices as of ', el('strong', '', asof.toUTCString()), ' · source: ', link);

    rows = models.map(function (m) {
      const p = m.pricing || {};
      return {
        model_id:     m.model_id,
        display_name: m.display_name || m.model_id,
        provider:     m.provider,
        input:        p.input_per_mtok  != null ? Number(p.input_per_mtok)  : null,
        output:       p.output_per_mtok != null ? Number(p.output_per_mtok) : null,
        cached:       p.cached_per_mtok != null ? Number(p.cached_per_mtok) : null,
        effective:    m.pricing_updated_at || null
      };
    });

    renderTable();
  }

  init();
})();
