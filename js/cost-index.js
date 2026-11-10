(function () {
  'use strict';

  const API = 'https://api.tolvyn.io/v1/public/cost-index';
  const TIMEOUT_MS = 12000; // a hung request shows the error text instead of loading forever

  // ── Chart palette ────────────────────────────────────────────
  const PALETTE = ['#00D9A3','#E6E9EF','#A6ADBB','#5FB8A0','#828A9B'];

  // Every value from the API reaches the page as text (textContent, text nodes), never as markup.
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = String(text);
    return e;
  }

  // ── Provider badge ───────────────────────────────────────────
  function providerBadge(p) {
    const cls = {openai:'provider-openai',anthropic:'provider-anthropic',google:'provider-google'}[p] || 'provider-other';
    return el('span', 'provider-badge ' + cls, p);
  }

  // ── Format helpers ───────────────────────────────────────────
  function fmtCost(v) {
    const n = parseFloat(v);
    if (isNaN(n)) return '—';
    if (n < 0.001) return '$' + n.toFixed(6);
    if (n < 0.01)  return '$' + n.toFixed(5);
    return '$' + n.toFixed(4);
  }

  function fmtReqs(n) {
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  function trendEl(pct) {
    if (pct === null || pct === undefined) return el('span', 'trend-flat', '—');
    const sign = pct > 0 ? '+' : '';
    const cls  = pct > 0 ? 'trend-up' : pct < 0 ? 'trend-down' : 'trend-flat';
    const arrow = pct > 0 ? '↑' : pct < 0 ? '↓' : '→';
    return el('span', cls, arrow + sign + pct.toFixed(1) + '%');
  }

  // ── Load and render ──────────────────────────────────────────
  async function fetchIndex() {
    const ctl = new AbortController();
    const timer = setTimeout(function () { ctl.abort(); }, TIMEOUT_MS);
    try {
      const r = await fetch(API + '?days=90', { signal: ctl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function init() {
    let resp;
    try {
      resp = await fetchIndex();
    } catch (e) {
      // A genuine fetch failure (or a timeout), distinct from a successful empty response.
      document.getElementById('ci-generated-at').textContent = 'The index could not be loaded right now.';
      setError('ci-headline-grid', 'The cost index could not be loaded. This is a problem on our side, not an empty index.');
      setError('ci-table-wrap',    'The cost index could not be loaded.');
      document.getElementById('ci-chart-loading').textContent = 'The cost index could not be loaded.';
      return;
    }

    const { generated_at, data, summary } = resp;

    // Generated-at banner
    // "Last updated" over an empty index reads as "fresh figures were published
    // today", when what happened is that a collection ran and published nothing.
    // Only claim an update when there is something that was updated.
    const genEl = document.getElementById('ci-generated-at');
    const hasData = Array.isArray(summary) && summary.length > 0;
    if (generated_at && hasData) {
      const d = new Date(generated_at);
      genEl.replaceChildren('Last updated: ', el('span', '', d.toUTCString()));
    } else if (generated_at) {
      const d = new Date(generated_at);
      genEl.replaceChildren('Last checked: ', el('span', '', d.toUTCString()),
        ' — no bucket reached three contributing organisations.');
    } else {
      genEl.hidden = true;
    }

    renderHeadline(summary);
    renderTable(data);
    renderChart(data, summary);
  }

  // An empty index is the privacy floor working as designed; a failed fetch is our problem.
  // The two states carry different messages.
  function notice(title, msg) {
    const box = el('div', 'ci-empty');
    box.append(el('strong', '', title), msg);
    return box;
  }

  function setError(id, msg) {
    const target = document.getElementById(id);
    if (target) target.replaceChildren(notice('Could not load the index', msg));
  }

  // ── Headline cards ───────────────────────────────────────────
  function renderHeadline(summary) {
    const grid = document.getElementById('ci-headline-grid');
    const top5 = (summary || []).slice(0, 5);

    if (!top5.length) {
      grid.replaceChildren(notice('Nothing published yet — by design',
        'No model has yet been used by three or more organisations in a way that clears the '
        + 'privacy floor, so publishing anything would mean narrowing the figures toward '
        + 'individual customers. The collection runs nightly and publishes only what clears it.'));
      return;
    }

    grid.replaceChildren(...top5.map(s => {
      const label = s.model_id.replace(/-/g, '‑'); // non-breaking hyphen for display
      const cost = el('div', 'headline-card__cost', fmtCost(s.avg_30d_cost_usd));
      cost.append(el('span', 'headline-card__unit', '/req'));
      const meta = el('div', 'headline-card__meta');
      meta.append(trendEl(s.mom_change_pct),
        ' vs last month  ·  Based on ' + fmtReqs(s.total_requests_30d) + ' requests');
      const card = el('div', 'headline-card');
      card.append(el('div', 'headline-card__model', label), cost, meta);
      return card;
    }));
  }

  // ── Sortable table ───────────────────────────────────────────
  let tableData = [];
  let sortCol   = 'avg_cost_usd';
  let sortAsc   = true;

  function p95Label() {
    const wrap = el('span', 'tooltip-wrap', 'P95 Cost');
    wrap.append(el('span', 'tooltip-text', '95% of requests cost less than this amount'));
    return wrap;
  }

  const COLS = [
    { key: 'model_id',      label: 'Model',          render: r => el('span', 'ci-model', r.model_id) },
    { key: 'provider',      label: 'Provider',       render: r => providerBadge(r.provider) },
    { key: 'avg_cost_usd',  label: 'Avg Cost/Req',   render: r => el('span', 'mono', fmtCost(r.avg_cost_usd)) },
    { key: 'p50_cost_usd',  label: 'P50 Cost',       render: r => el('span', 'mono', fmtCost(r.p50_cost_usd)) },
    {
      key: 'p95_cost_usd',
      label: p95Label,
      sortKey: 'p95_cost_usd',
      render: r => el('span', 'mono', fmtCost(r.p95_cost_usd))
    },
    { key: 'trend',         label: '30d Trend',      render: r => trendEl(r._mom) },
    { key: 'total_requests',label: 'Requests (30d)', render: r => fmtReqs(r.total_requests) },
  ];

  function renderTable(data) {
    const wrap = document.getElementById('ci-table-wrap');

    // Aggregate per model (take last 30 days, average per model_id)
    const byModel = {};
    const now = new Date();
    const cutoff = new Date(now - 30 * 864e5);

    data.forEach(row => {
      const d = new Date(row.date);
      const key = row.provider + '|' + row.model_id;
      if (!byModel[key]) {
        byModel[key] = {
          model_id: row.model_id,
          provider: row.provider,
          model_family: row.model_family,
          avg_cost_usd: 0,
          p50_cost_usd: null,
          p95_cost_usd: null,
          total_requests: 0,
          _count: 0,
          _mom: null,
        };
      }
      const m = byModel[key];
      if (d >= cutoff) {
        m.avg_cost_usd  += parseFloat(row.avg_cost_usd || 0);
        if (row.p50_cost_usd) m.p50_cost_usd = (m.p50_cost_usd || 0) + parseFloat(row.p50_cost_usd);
        if (row.p95_cost_usd) m.p95_cost_usd = (m.p95_cost_usd || 0) + parseFloat(row.p95_cost_usd);
        m.total_requests += row.total_requests;
        m._count++;
      }
    });

    tableData = Object.values(byModel).map(m => {
      if (m._count > 0) {
        m.avg_cost_usd = m.avg_cost_usd / m._count;
        if (m.p50_cost_usd !== null) m.p50_cost_usd /= m._count;
        if (m.p95_cost_usd !== null) m.p95_cost_usd /= m._count;
      }
      return m;
    });

    if (!tableData.length) {
      wrap.replaceChildren(notice('Nothing published yet — by design',
        'A per-model breakdown needs at least three contributing organisations per row. '
        + 'None currently qualifies.'));
      return;
    }

    renderTableRows();

    wrap.addEventListener('click', e => {
      const th = e.target.closest('th[data-col]');
      if (!th) return;
      const col = th.dataset.col;
      if (sortCol === col) sortAsc = !sortAsc;
      else { sortCol = col; sortAsc = true; }
      renderTableRows();
    });
  }

  function renderTableRows() {
    const wrap = document.getElementById('ci-table-wrap');
    const sorted = [...tableData].sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va === null) va = sortAsc ? Infinity : -Infinity;
      if (vb === null) vb = sortAsc ? Infinity : -Infinity;
      return sortAsc ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

    const headRow = el('tr');
    COLS.forEach(c => {
      const key = c.sortKey || c.key;
      const th = el('th', sortCol === key ? 'sorted' : '');
      th.dataset.col = key;
      th.append(typeof c.label === 'function' ? c.label() : c.label, ' ',
        el('span', 'sort-icon', sortCol === key ? (sortAsc ? '↑' : '↓') : '↕'));
      headRow.append(th);
    });

    const tbody = el('tbody');
    sorted.forEach(row => {
      const tr = el('tr');
      COLS.forEach(c => {
        const td = el('td');
        td.append(c.render(row));
        tr.append(td);
      });
      tbody.append(tr);
    });

    const thead = el('thead');
    thead.append(headRow);
    const table = el('table', 'ci-table');
    table.setAttribute('role', 'grid');
    table.setAttribute('aria-label', 'AI model cost comparison');
    table.append(thead, tbody);
    wrap.replaceChildren(table);
  }

  // ── Chart ────────────────────────────────────────────────────
  function renderChart(data, summary) {
    const loading = document.getElementById('ci-chart-loading');
    const canvas  = document.getElementById('ci-chart');

    const top5ids = (summary || []).slice(0, 5).map(s => s.provider + '|' + s.model_id);
    if (!top5ids.length || !data.length) {
      loading.textContent = 'No trend published: no model clears the three-organisation floor.';
      return;
    }

    // Group data by model, last 30 days
    const now = new Date();
    const cutoff = new Date(now - 30 * 864e5);
    const byModel = {};

    data.forEach(row => {
      const key = row.provider + '|' + row.model_id;
      if (!top5ids.includes(key)) return;
      const d = new Date(row.date);
      if (d < cutoff) return;
      if (!byModel[key]) byModel[key] = {};
      byModel[key][row.date] = parseFloat(row.avg_cost_usd || 0);
    });

    // Collect all dates, sorted
    const allDates = [...new Set(data.filter(r => new Date(r.date) >= cutoff).map(r => r.date))].sort();

    if (!allDates.length) {
      loading.textContent = 'No trend published: no model clears the three-organisation floor.';
      return;
    }

    const datasets = top5ids.map((key, i) => {
      const mid = key.split('|')[1];
      return {
        label: mid,
        data: allDates.map(d => byModel[key]?.[d] ?? null),
        borderColor: PALETTE[i],
        backgroundColor: PALETTE[i] + '18',
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0.3,
        spanGaps: true,
      };
    });

    loading.hidden = true;
    canvas.hidden  = false;

    // Chart.js is a deferred script that runs before this one; the wait is only a fallback.
    function tryRender() {
      if (typeof Chart === 'undefined') { setTimeout(tryRender, 100); return; }
      new Chart(canvas, {
        type: 'line',
        data: { labels: allDates, datasets },
        options: {
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: {
              labels: {
                color: '#A6ADBB',
                font: { family: "'Inter', sans-serif", size: 12 },
              },
            },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.dataset.label}: $${ctx.parsed.y?.toFixed(6) ?? '—'}`,
              },
            },
          },
          scales: {
            x: {
              ticks: { color: '#828A9B', font: { size: 11 } },
              grid:  { color: 'rgba(255,255,255,0.04)' },
            },
            y: {
              ticks: {
                color: '#828A9B',
                font: { size: 11 },
                callback: v => '$' + v.toFixed(5),
              },
              grid: { color: 'rgba(255,255,255,0.04)' },
            },
          },
        },
      });
    }
    tryRender();
  }

  init();
})();
