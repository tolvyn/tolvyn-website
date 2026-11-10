/* TOLVYN — hero.js: "the gate". Canvas 2D, no library.
   Calls flow from your apps and agents (left) through the TOLVYN line to four providers (right).
   Each call that passes is charged against an example budget and, when the provider answers,
   written to the ledger strip. A call that would cross the limit is refused at the line with a
   429 and never reaches the provider or the ledger, as in the product. Everything shown is
   example data. Runs at 768px and wider, without reduced motion, while on screen and visible;
   otherwise the static frame from css/hero.css stays. */
(function () {
  'use strict';
  var mount = document.querySelector('[data-gate]');
  var hero = mount && mount.closest('.hero');
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext && canvas.getContext('2d');
  if (!mount || !hero || !ctx || !window.requestAnimationFrame) return;

  var wide = matchMedia('(min-width: 768px)');
  var calm = matchMedia('(prefers-reduced-motion: reduce)');
  var MAX = 5;                       // example budget, dollars
  var PROVIDERS = ['OpenAI', 'Anthropic', 'Google', 'DeepSeek'];
  var SCOPES = ['support-bot', 'search-svc', 'agent/sdr', 'agent/coder', 'billing-etl', 'chat-api'];
  var MONO = '"JetBrains Mono", ui-monospace, monospace';
  var SANS = 'Inter, system-ui, sans-serif';

  var css = getComputedStyle(document.documentElement);
  function tok(n, d) { return (css.getPropertyValue(n) || '').trim() || d; }
  var C = {
    accent: tok('--accent', '#00D9A3'), amber: tok('--amber', '#F59E0B'), text: tok('--text', '#E6E9EF'),
    text2: tok('--text-secondary', '#A6ADBB'), muted: tok('--text-muted', '#828A9B'),
    border: tok('--border', '#232937'), border2: tok('--border-strong', '#3A4254'), bg: tok('--bg', '#0B0F1A')
  };

  canvas.setAttribute('aria-hidden', 'true');
  var input = document.createElement('input');
  input.type = 'range'; input.min = '0'; input.max = String(MAX); input.step = '0.05'; input.value = '3.5';
  input.className = 'gate-limit';
  input.setAttribute('aria-label', 'Example budget limit');

  var L = { W: 0, H: 0, x0: 0, mw: 0 };   // layout, in CSS pixels of the canvas
  var calls = [], rows = [], ticks = [];
  var limit = 3.5, spent = 0, shown = 0, seq = 18240 + Math.floor(Math.random() * 900);
  var refusedSince = 0, refusedCount = 0, resetFlash = 0, spawnIn = 0, burstIn = 6, burst = 0, burstY = 0;
  var flash = [0, 0, 0, 0];
  var ptr = null, running = false, live = false, visible = true, last = 0, raf = 0, dpr = 1;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function money(v, d) { return '$' + v.toFixed(d || 2); }
  function hex(n) { var s = ''; while (s.length < n) s += Math.floor(Math.random() * 16).toString(16); return s; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { return t * t * (3 - 2 * t); }

  function layout() {
    var hr = hero.getBoundingClientRect(), mr = mount.getBoundingClientRect();
    var bleed = Math.max(0, Math.round(mr.left - hr.left));
    L.x0 = bleed; L.mw = Math.round(mr.width); L.W = bleed + L.mw; L.H = Math.round(mr.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.left = -bleed + 'px';
    canvas.style.width = L.W + 'px';
    canvas.width = Math.round(L.W * dpr); canvas.height = Math.round(L.H * dpr);
    L.barX = L.x0; L.barW = L.mw - 2; L.barY = 40;
    L.ledgerH = 4 * 19 + 30; L.ledgerY = L.H - L.ledgerH;
    L.top = 104; L.bottom = L.ledgerY - 30;
    L.gate = L.x0 + Math.round(L.mw * 0.44);
    ctx.font = '500 13px ' + SANS;
    var lw = 0; PROVIDERS.forEach(function (p) { lw = Math.max(lw, ctx.measureText(p).width); });
    L.port = L.x0 + L.mw - lw - 16;
    L.lanes = PROVIDERS.map(function (_, i) { return L.top + (i + 0.5) * (L.bottom - L.top) / 4; });
    L.start = bleed > 60 ? -8 : L.x0 - 8;
    input.style.left = (L.barX - L.x0 - 10) + 'px';   // the input lives in the mount; the canvas starts at the bleed
    input.style.width = (L.barW + 20) + 'px';
    input.style.top = (L.barY - 22) + 'px';
  }

  function spawn(y) {
    var lane = Math.floor(Math.random() * 4);
    calls.push({
      x: L.start, y0: y == null ? rand(L.top + 6, L.bottom - 6) : y, lane: lane, bend: 0,
      v: rand(150, 210), cost: rand(0.02, 0.14), scope: SCOPES[Math.floor(Math.random() * SCOPES.length)],
      state: 0, t: 0, y: 0
    });
  }

  function charge(c) {
    if (spent + c.cost <= limit) { spent += c.cost; c.state = 1; ticks.push({ y: c.y, t: 0, ok: true }); return; }
    c.state = 2; c.t = 0; ticks.push({ y: c.y, t: 0, ok: false });
    if (!refusedCount) refusedSince = 0;
    refusedCount++;
  }

  function record(c) {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    seq++;
    rows.push({
      cells: ['#' + ('000000' + seq).slice(-6), p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()),
        c.scope, PROVIDERS[c.lane].toLowerCase(), money(c.cost, 4), hex(4) + '…' + hex(4)],
      t: 0
    });
    if (rows.length > 5) rows.shift();
    flash[c.lane] = 1;
  }

  function step(dt) {
    // arrivals: a steady stream, and now and then an agent loop that sends a burst from one place
    spawnIn -= dt; burstIn -= dt;
    if (spawnIn <= 0) { spawn(); spawnIn = rand(0.1, 0.26); }
    if (burstIn <= 0) { burst = 7; burstY = rand(L.top + 20, L.bottom - 20); burstIn = rand(8, 12); }
    if (burst > 0 && Math.random() < dt * 9) { spawn(clamp(burstY + rand(-8, 8), L.top, L.bottom)); burst--; }

    // a new budget period once the limit has refused calls for a while
    if (refusedCount) {
      refusedSince += dt;
      if (refusedSince > 4.5 && refusedCount > 5) { spent = 0; refusedCount = 0; resetFlash = 1.6; }
    }
    resetFlash = Math.max(0, resetFlash - dt);
    shown += (spent - shown) * Math.min(1, dt * 6);

    for (var i = calls.length - 1; i >= 0; i--) {
      var c = calls[i];
      if (c.state === 2) { c.t += dt; if (c.t > 1.6) calls.splice(i, 1); continue; }
      c.x += c.v * dt;
      var k = ease(clamp((c.x - L.start) / (L.port - L.start), 0, 1));
      var base = c.y0 + (L.lanes[c.lane] - c.y0) * k;
      var want = 0;
      if (ptr) {
        var dx = c.x - ptr.x, dy = base - ptr.y, d = Math.sqrt(dx * dx + dy * dy), R = 84;
        if (d < R) want = (dy >= 0 ? 1 : -1) * Math.pow(1 - d / R, 1.5) * 30;
      }
      c.bend += (want - c.bend) * Math.min(1, dt * 7);
      c.y = base + c.bend;
      if (c.state === 0 && c.x >= L.gate - 3) {
        charge(c);
        if (c.state === 2) { c.x = L.gate - 4; continue; }
      }
      if (c.x >= L.port) { record(c); calls.splice(i, 1); }
    }
    for (i = ticks.length - 1; i >= 0; i--) { ticks[i].t += dt; if (ticks[i].t > (ticks[i].ok ? 0.45 : 1.6)) ticks.splice(i, 1); }
    rows.forEach(function (r) { r.t = Math.min(1, r.t + dt * 4); });
    for (i = 0; i < 4; i++) flash[i] = Math.max(0, flash[i] - dt * 2.5);
  }

  function text(s, x, y, font, color, align, alpha) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align || 'left';
    ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.fillText(s, x, y); ctx.globalAlpha = 1;
  }

  function draw() {
    var W = L.W, x0 = L.x0, mw = L.mw, blocked = refusedCount > 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, L.H);
    ctx.textBaseline = 'alphabetic';

    // meter: example budget, spend, and the limit the visitor can drag
    var f = 'normal 500 10.5px ' + MONO;
    text('EXAMPLE BUDGET', x0, 14, f, C.muted);
    if (resetFlash > 0) text('new period', x0 + mw, 14, f, C.text2, 'right', Math.min(1, resetFlash));
    else if (blocked) text('limit reached · 429', x0 + mw, 14, f, C.amber, 'right');
    else text(money(shown) + ' spent · limit ' + money(limit), x0 + mw, 14, f, C.text2, 'right');
    var bx = L.barX, bw = L.barW, by = L.barY;
    ctx.fillStyle = C.border2; ctx.fillRect(bx, by - 1.5, bw, 3);
    ctx.fillStyle = blocked ? C.amber : C.accent; ctx.fillRect(bx, by - 1.5, bw * clamp(shown / MAX, 0, 1), 3);
    var lx = Math.round(bx + bw * limit / MAX) + 0.5;
    ctx.fillStyle = document.activeElement === input ? C.accent : C.text;
    ctx.fillRect(lx - 1, by - 9, 2, 18);
    ctx.fillRect(lx - 4, by - 9, 8, 2);
    text('limit', clamp(lx, bx + 14, bx + bw - 14), by + 22, f, C.muted, 'center');

    // labels: where calls come from, the TOLVYN line, the providers
    text(L.x0 > 60 ? '← your apps and agents' : 'your apps and agents', x0, L.top - 24, f, C.muted);
    var gx = L.gate + 0.5;
    ctx.fillStyle = C.accent; ctx.globalAlpha = 0.9;
    ctx.fillRect(gx - 0.5, L.top - 16, 1, L.bottom - L.top + 32);
    ctx.globalAlpha = 1;
    ctx.save(); ctx.font = '800 11px ' + SANS; ctx.fillStyle = C.accent; ctx.textAlign = 'center';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    ctx.fillText('TOLVYN', gx, L.top - 24); ctx.restore();
    for (var i = 0; i < 4; i++) {
      var ly = L.lanes[i];
      ctx.fillStyle = C.border2; ctx.fillRect(L.port, ly - 1, 3, 3);
      text(PROVIDERS[i], x0 + mw, ly + 4.5, '500 13px ' + SANS, flash[i] > 0.05 ? C.text : C.text2, 'right');
    }

    // ticks on the line: a short mint mark per pass, an amber mark and "429" per refusal
    var labelled = [];   // one "429" per 16px band, newest first, so a burst stays legible
    for (i = ticks.length - 1; i >= 0; i--) {
      var t = ticks[i], a = clamp(t.ok ? 1 - t.t / 0.45 : Math.min(1, 1.6 - t.t), 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = t.ok ? C.accent : C.amber;
      ctx.fillRect(gx - 4, t.y - 0.5, 8, 1);
      if (!t.ok && !labelled.some(function (y) { return Math.abs(y - t.y) < 16; })) {
        labelled.push(t.y);
        text('429', gx + 7, t.y - 5, 'normal 500 10px ' + MONO, C.amber, 'left', a);
      }
      ctx.globalAlpha = 1;
    }

    // calls: grey until the gate decides, mint once allowed, amber when refused
    calls.forEach(function (c) {
      var behind = c.x < x0;   // behind the headline: faint, so the text keeps its contrast
      var a = behind ? 0.06 + 0.3 * Math.pow(clamp((c.x - L.start) / Math.max(1, x0 - L.start), 0, 1), 2) : 0.95;
      var col = c.state === 1 ? C.accent : c.state === 2 ? C.amber : C.text2;
      if (c.state === 2) a = clamp(1 - c.t / 1.6, 0, 1);
      ctx.globalAlpha = a * 0.35; ctx.strokeStyle = col; ctx.lineWidth = 1;
      if (c.state !== 2 && !behind) { ctx.beginPath(); ctx.moveTo(c.x - 14, c.y); ctx.lineTo(c.x, c.y); ctx.stroke(); }
      ctx.globalAlpha = a; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.state === 2 ? 2.4 : 2, 0, 6.2832); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // ledger strip: one row per call that reached a provider
    var ty = L.ledgerY;
    ctx.fillStyle = C.border; ctx.fillRect(x0, ty, mw, 1);
    text('LEDGER', x0, ty + 18, f, C.muted);
    text('example data', x0 + mw, ty + 18, f, C.muted, 'right');
    ctx.font = 'normal 400 11px ' + MONO;
    var cw = ctx.measureText('0').width, cols = [8, 9, 12, 10, 8, 9], n = cols.length;
    var need = function (k) { var s = 0; for (var j = 0; j < k; j++) s += cols[j] + 1; return s * cw; };
    while (n > 4 && need(n) > mw) n--;
    var shownRows = rows.slice(-4);
    shownRows.forEach(function (r, idx) {
      var age = shownRows.length - 1 - idx;
      var y = ty + 40 + idx * 19 + (1 - ease(r.t)) * 10;
      var a = (age === 0 ? 1 : 0.75 - age * 0.15) * ease(r.t);
      var x = x0;
      for (var j = 0; j < n; j++) {
        text(r.cells[j], x, y, 'normal 400 11px ' + MONO, j === 4 ? C.accent : j === 0 ? C.muted : C.text2, 'left', a);
        x += (cols[j] + 1) * cw;
      }
    });
  }

  function frame(now) {
    raf = 0;
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    step(dt); draw();
    raf = requestAnimationFrame(frame);
  }

  function update() {
    var should = live && visible && !document.hidden;
    if (should && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    if (!should && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  }

  function setLimit() {
    limit = clamp(parseFloat(input.value) || 0, 0.5, MAX);
    if (String(limit) !== input.value) input.value = String(limit);
    input.setAttribute('aria-valuetext', money(limit) + ' of an example budget of ' + money(MAX));
    if (spent < limit) refusedCount = 0;
    if (!running && live) draw();
  }

  function start() {
    if (live) return;
    live = true;
    mount.classList.add('is-live');
    mount.appendChild(canvas); mount.appendChild(input);
    layout();
    if (!calls.length) { for (var i = 0; i < 240; i++) step(1 / 30); }   // arrive mid-stream
    setLimit(); draw(); update();
  }

  function stop() {
    if (!live) return;
    live = false; update();
    mount.classList.remove('is-live');
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if (input.parentNode) input.parentNode.removeChild(input);
  }

  function decide() { if (wide.matches && !calm.matches) start(); else stop(); }

  input.addEventListener('input', setLimit);
  input.addEventListener('focus', function () { if (!running && live) draw(); });
  hero.addEventListener('pointermove', function (e) {
    if (!live || e.pointerType === 'touch') return;
    var r = canvas.getBoundingClientRect();
    ptr = { x: e.clientX - r.left, y: e.clientY - r.top };
  }, { passive: true });
  hero.addEventListener('pointerleave', function () { ptr = null; });
  document.addEventListener('visibilitychange', update);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; update(); }).observe(mount);
  }
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { if (live) { layout(); draw(); } }).observe(hero);
  } else {
    window.addEventListener('resize', function () { if (live) { layout(); draw(); } });
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (live) { layout(); draw(); } });
  [wide, calm].forEach(function (m) {
    if (m.addEventListener) m.addEventListener('change', decide); else if (m.addListener) m.addListener(decide);
  });
  decide();
})();
