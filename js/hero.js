/* TOLVYN — hero.js: "the gate". Canvas 2D, no library. Everything shown is example data.
   A ledger-paper dot grid covers the hero and gives way around the pointer. In the scene, calls stream
   along four lanes to the providers. At the TOLVYN line each call is checked in the product's order:
   a killed agent is refused with 451, a call that would cross the budget limit with 429; a refused call
   reaches no provider, is never charged and never written to the ledger. An allowed call is charged,
   lands on its provider and is written to the ledger, each row carrying the previous row's hash.
   Runs at 768px and wider without reduced motion, while on screen and the tab is visible; otherwise
   css/hero.css keeps a static frame. */
(function () {
  'use strict';
  var mount = document.querySelector('[data-gate]');
  var hero = mount && mount.closest('.hero');
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext && canvas.getContext('2d');
  if (!mount || !hero || !ctx || !window.requestAnimationFrame) return;

  var wide = matchMedia('(min-width: 768px)');
  var calm = matchMedia('(prefers-reduced-motion: reduce)');
  var MAX = 5, KILL = 'agent/sdr', GRID = 22;
  var PROVIDERS = ['OpenAI', 'Anthropic', 'Google', 'DeepSeek'];
  var SCOPES = ['support-bot', 'search-svc', KILL, 'agent/coder', 'billing-etl', 'chat-api', KILL];
  var MONO = '"JetBrains Mono", ui-monospace, monospace';
  var SANS = 'Inter, system-ui, sans-serif';
  var css = getComputedStyle(document.documentElement);
  function tok(n, d) { return css.getPropertyValue(n).trim() || d; }
  var C = {
    accent: tok('--accent', '#00D9A3'), amber: tok('--amber', '#F59E0B'), text: tok('--text', '#E6E9EF'),
    text2: tok('--text-secondary', '#A6ADBB'), muted: tok('--text-muted', '#828A9B'),
    border: tok('--border', '#232937'), strong: tok('--border-strong', '#3A4254'), bg: tok('--bg', '#0B0F1A')
  };

  // Controls: a slider handle for the limit, and a kill switch for one agent. Both work by keyboard.
  function node(tag, cls, text) {
    var e = document.createElement(tag);
    e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  var ui = node('div', 'gate-ui'), track = node('div', 'gate-track'), handle = node('div', 'gate-handle'),
    hint = node('span', 'gate-hint', '‹ drag the limit ›'), killBtn = node('button', 'gate-kill', 'Kill ' + KILL);
  handle.setAttribute('role', 'slider');
  handle.tabIndex = 0;
  handle.setAttribute('aria-label', 'Example budget limit');
  handle.setAttribute('aria-valuemin', '0.5');
  handle.setAttribute('aria-valuemax', '5');
  hint.setAttribute('aria-hidden', 'true');
  killBtn.type = 'button';
  track.appendChild(handle);
  ui.append(track, hint, killBtn);
  canvas.className = 'gate-canvas';
  canvas.setAttribute('aria-hidden', 'true');

  var W = 0, H = 0, dpr = 1, S = {}, G = {}, dots = [];
  var calls = [], bits = [], pulses = [], notes = [], lands = [], rows = [], queue = [], rowIn = 0, flash = [0, 0, 0, 0];
  var limit = 3.5, spent = 0, shown = 0, refused = 0, saved = 0, shownSaved = 0, atLimit = 0, newPeriod = 0;
  var killed = false, used = false, dragging = false;
  var seq = 18240 + Math.floor(Math.random() * 900), lastHash = hash();
  var spawnIn = 0, burstIn = 4, burst = 0, burstLane = 0, burstScope = KILL;
  var ptr = null, live = false, running = false, visible = true, last = 0, raf = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function money(v) { return '$' + v.toFixed(2); }
  function hex(n) { var s = ''; while (s.length < n) s += Math.floor(Math.random() * 16).toString(16); return s; }
  function hash() { return hex(4) + '…' + hex(4); }

  // ── layout: everything in hero pixels; the scene is the mount's box ──────────────────────────────
  function layout() {
    var hr = hero.getBoundingClientRect(), mr = mount.getBoundingClientRect();
    W = Math.round(hr.width); H = Math.round(hr.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    S = { x: Math.round(mr.left - hr.left), y: Math.round(mr.top - hr.top), w: Math.round(mr.width), h: Math.round(mr.height) };
    G.barY = S.y + 98;
    G.top = S.y + 176;
    G.ledgerY = S.y + S.h - 128;
    G.bot = G.ledgerY - 26;
    G.gate = S.x + Math.round(S.w * 0.4);
    ctx.font = '500 14px ' + SANS;
    var lw = 0;
    PROVIDERS.forEach(function (p) { lw = Math.max(lw, ctx.measureText(p).width); });
    G.port = Math.round(S.x + S.w - lw - 20);
    G.lanes = PROVIDERS.map(function (_, i) { return Math.round(G.top + (i + 0.5) * (G.bot - G.top) / 4); });
    // ledger columns, in characters; the narrowest scenes drop the time and provider columns
    ctx.font = '400 13px ' + MONO;
    G.cw = ctx.measureText('0').width;
    var cols = [['seq', 7], ['time', 8], ['scope', 11], ['prov', 9], ['cost', 7], ['prev', 9, 4], ['hash', 9]];
    var fit = function () { return cols.reduce(function (s, c) { return s + c[1] + (c[2] || 2); }, -2) * G.cw <= S.w; };
    if (!fit()) cols.splice(1, 1);
    if (!fit()) cols.splice(2, 1);
    G.cols = []; var x = S.x;
    cols.forEach(function (c) { G.cols.push({ key: c[0], x: x, w: c[1] * G.cw }); x += (c[1] + (c[2] || 2)) * G.cw; });
    dots = [];
    for (var y = GRID / 2; y < H; y += GRID) {
      for (var gx = (W % GRID) / 2; gx < W; gx += GRID) {
        var inside = gx > S.x - 8 && gx < S.x + S.w + 8 && y > S.y - 8 && y < S.y + S.h + 8;
        dots.push({ x: gx, y: y, ox: 0, oy: 0, vx: 0, vy: 0, b: 0, in: inside });
      }
    }
    track.style.width = S.w + 'px';
    track.style.top = (G.barY - S.y - 22) + 'px';
    place();
  }

  function place() {
    var hx = S.w * limit / MAX;
    handle.style.left = hx + 'px';
    var right = hx > S.w - 160;
    hint.style.top = (G.barY - S.y - 30) + 'px';
    hint.style.left = right ? '' : (hx + 16) + 'px';
    hint.style.right = right ? (S.w - hx + 16) + 'px' : '';
    handle.setAttribute('aria-valuenow', limit.toFixed(2));
    handle.setAttribute('aria-valuetext', money(limit) + ' of an example budget of ' + money(MAX));
  }

  // ── the simulation ──────────────────────────────────────────────────────────────────────────────
  function spawn(lane, scope) {
    lane = lane == null ? Math.floor(Math.random() * 4) : lane;
    calls.push({
      x: S.x - 4, lane: lane, dy: rand(-7, 7), ph: rand(0, 6.28), bend: 0, y: G.lanes[lane],
      v: rand(150, 290), cost: rand(0.01, 0.05), scope: scope || SCOPES[Math.floor(Math.random() * SCOPES.length)],
      state: 0, t: 0, vx: 0
    });
  }

  function kick(x, y, force) {   // a refusal shakes the paper around the impact
    dots.forEach(function (d) {
      var dx = d.x - x, dy = d.y - y, dd = dx * dx + dy * dy;
      if (dd < 4900 && dd > 0) { var dist = Math.sqrt(dd), f = (1 - dist / 70) * force; d.vx += dx / dist * f; d.vy += dy / dist * f; d.b = Math.max(d.b, 0.2); }
    });
  }

  function refuse(c, code) {
    c.state = 2; c.t = 0; c.x = G.gate - 3; c.vx = -rand(170, 250);
    refused++; saved += c.cost;
    pulses.push({ y: c.y, t: 0, ok: false });
    notes.push({ y: c.y, t: 0, s: code === 451 ? '451 ' + KILL : '429' });
    kick(G.gate, c.y, 110);
  }

  function decide(c) {
    if (killed && c.scope === KILL) return refuse(c, 451);       // the kill switch is checked first
    if (spent + c.cost > limit + 1e-9) return refuse(c, 429);    // then the budget
    spent += c.cost; c.state = 1;
    pulses.push({ y: c.y, t: 0, ok: true });
  }

  function land(c) {
    flash[c.lane] = 1;
    lands.push({ lane: c.lane, t: 0 });
    queue.push(c);
    if (queue.length > 3) queue.shift();
  }

  // The strip writes one row at a readable pace from the calls that just landed; each row carries the
  // hash of the row before it, and the sequence stays unbroken.
  function write(c) {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    var h = hash();
    rows.push({
      seq: '#' + ('000000' + (++seq)).slice(-6), time: p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()),
      scope: c.scope, prov: PROVIDERS[c.lane].toLowerCase(), cost: '$' + c.cost.toFixed(4), prev: lastHash, hash: h, t: 0, y: null
    });
    lastHash = h;
    if (rows.length > 6) rows.shift();
  }

  function step(dt) {
    spawnIn -= dt; burstIn -= dt;
    if (spawnIn <= 0) { spawn(); spawnIn = rand(0.04, 0.11); }
    if (burstIn <= 0) { burst = 9; burstLane = Math.floor(Math.random() * 4); burstScope = Math.random() < 0.6 ? KILL : 'agent/coder'; burstIn = rand(6, 10); }
    if (burst > 0 && Math.random() < dt * 14) { spawn(burstLane, burstScope); burst--; }

    // a new budget period once the limit has held for a while
    atLimit = spent > limit - 0.05 ? atLimit + dt : 0;
    if (atLimit > 5) { spent = 0; atLimit = 0; newPeriod = 2; }
    newPeriod = Math.max(0, newPeriod - dt);
    shown += (spent - shown) * Math.min(1, dt * 8);
    shownSaved += (saved - shownSaved) * Math.min(1, dt * 8);

    for (var i = calls.length - 1; i >= 0; i--) {
      var c = calls[i];
      if (c.state === 2) {                       // refused: recoil from the line, then break up
        c.t += dt; c.x += c.vx * dt; c.vx *= Math.pow(0.004, dt);
        if (c.t > 0.24) {
          for (var k = 0; k < 5; k++) bits.push({ x: c.x, y: c.y, vx: rand(-150, -40), vy: rand(-45, 45), t: 0 });
          calls.splice(i, 1);
        }
        continue;
      }
      c.x += c.v * (c.state === 1 ? 1.9 : 1) * dt;
      var base = G.lanes[c.lane] + c.dy + Math.sin(c.x * 0.03 + c.ph) * 1.2, want = 0;
      if (ptr) {
        var dx = c.x - ptr.x, dy = base - ptr.y, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 90) want = (dy >= 0 ? 1 : -1) * Math.pow(1 - dist / 90, 1.5) * 14;
      }
      c.bend += (want - c.bend) * Math.min(1, dt * 9);
      c.y = base + c.bend;
      if (c.state === 0 && c.x >= G.gate - 2) decide(c);
      else if (c.state === 1 && c.x >= G.port) { land(c); calls.splice(i, 1); }
    }
    for (i = bits.length - 1; i >= 0; i--) {
      var b = bits[i]; b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vx *= Math.pow(0.05, dt); b.vy *= Math.pow(0.05, dt);
      if (b.t > 0.7) bits.splice(i, 1);
    }
    [pulses, notes, lands].forEach(function (list) {
      for (var j = list.length - 1; j >= 0; j--) { list[j].t += dt; if (list[j].t > 1.6) list.splice(j, 1); }
    });
    rows.forEach(function (r) { r.t += dt; });
    rowIn -= dt;
    if (rowIn <= 0 && queue.length) { write(queue.shift()); rowIn = 0.42; }
    for (i = 0; i < 4; i++) flash[i] = Math.max(0, flash[i] - dt * 2.5);

    // the dot grid settles after a refusal shakes it; the pointer does not move or light it
    for (i = 0; i < dots.length; i++) {
      var d = dots[i];
      if (d.b < 0.002 && Math.abs(d.ox) + Math.abs(d.oy) + Math.abs(d.vx) + Math.abs(d.vy) < 0.03) {
        d.ox = d.oy = d.vx = d.vy = d.b = 0; continue;
      }
      d.vx += (-150 * d.ox - 13 * d.vx) * dt; d.ox += d.vx * dt;
      d.vy += (-150 * d.oy - 13 * d.vy) * dt; d.oy += d.vy * dt;
      d.b -= d.b * Math.min(1, dt * 3);
    }
  }

  // ── drawing ─────────────────────────────────────────────────────────────────────────────────────
  function text(s, x, y, font, color, align, alpha) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align || 'left';
    ctx.globalAlpha = alpha == null ? 1 : alpha; ctx.fillText(s, x, y); ctx.globalAlpha = 1;
  }
  function segs(x, y, font, parts) {             // one line in several colours
    ctx.font = font; ctx.textAlign = 'left';
    parts.forEach(function (p) { ctx.fillStyle = p[1]; ctx.fillText(p[0], x, y); x += ctx.measureText(p[0]).width; });
  }

  function drawDots() {
    ctx.fillStyle = C.text2;
    [[false, 0.17], [true, 0.07]].forEach(function (pass) {
      ctx.globalAlpha = pass[1]; ctx.beginPath();
      dots.forEach(function (d) { if (d.in === pass[0] && d.b < 0.04) ctx.rect(d.x + d.ox - 0.75, d.y + d.oy - 0.75, 1.5, 1.5); });
      ctx.fill();
    });
    dots.forEach(function (d) {
      if (d.b < 0.04) return;
      ctx.globalAlpha = d.in ? 0.07 + d.b * 0.25 : 0.17 + d.b * 0.6;
      var s = 1.5 + d.b * (d.in ? 0.4 : 1); ctx.fillRect(d.x + d.ox - s / 2, d.y + d.oy - s / 2, s, s);
    });
    ctx.globalAlpha = 1;
  }

  function drawNumbers() {
    var small = '500 12px ' + MONO, over = spent > limit - 0.05;
    ctx.save(); if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
    text('EXAMPLE DATA', S.x, S.y + 12, small, C.muted); ctx.restore();
    segs(S.x, S.y + 44, '500 26px ' + MONO, [['Spent ', C.text2], [money(shown), over ? C.amber : C.text], [' of ' + money(MAX), C.text2]]);
    segs(S.x, S.y + 68, '400 15px ' + MONO, [['Refused ', C.text2], [refused + (refused === 1 ? ' call' : ' calls'), refused ? C.amber : C.text2],
      [' · ', C.muted], [money(shownSaved), refused ? C.amber : C.text2], [' never charged', C.text2]]);
    // the meter: spend, the limit, and the part beyond the limit where calls are refused
    var bx = S.x, bw = S.w, by = G.barY, lx = bx + bw * limit / MAX;
    ctx.fillStyle = C.strong; ctx.fillRect(bx, by - 3, bw, 6);
    ctx.save(); ctx.beginPath(); ctx.rect(lx, by - 3, bx + bw - lx, 6); ctx.clip();
    ctx.fillStyle = C.bg; ctx.fillRect(lx, by - 3, bx + bw - lx, 6);
    ctx.strokeStyle = C.amber; ctx.lineWidth = 1.5; ctx.beginPath();
    for (var hx = lx - 6; hx < bx + bw; hx += 5) { ctx.moveTo(hx, by + 3); ctx.lineTo(hx + 6, by - 3); }
    ctx.stroke(); ctx.restore();
    ctx.fillStyle = over ? C.amber : C.accent; ctx.fillRect(bx, by - 3, bw * clamp(shown / MAX, 0, 1), 6);
    var f = '400 12px ' + MONO, ly = by + 34, lt = 'limit ' + money(limit);   // clear of the handle, which reaches 19px below
    ctx.font = f; var half = ctx.measureText(lt).width / 2 + 6, cx = clamp(lx, bx + half, bx + bw - half);
    text(lt, cx, ly, '500 12px ' + MONO, C.text, 'center');
    if (cx - half > bx + 30) text('$0', bx, ly, f, C.muted);
    if (newPeriod > 0) text('new period', bx + bw, ly, f, C.text, 'right', Math.min(1, newPeriod));
    else if (cx + half < bx + bw - 44) text(money(MAX), bx + bw, ly, f, C.muted, 'right');
  }

  function drawFlow() {
    var gx = G.gate, i;
    text('apps and agents →', S.x, G.top - 18, '400 12px ' + MONO, C.muted);
    ctx.save(); ctx.font = '800 12px ' + SANS; ctx.fillStyle = C.accent; ctx.textAlign = 'center';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2.5px';
    ctx.fillText('TOLVYN', gx + 1, G.top - 18); ctx.restore();
    ctx.strokeStyle = C.strong; ctx.lineWidth = 1; ctx.setLineDash([2, 6]);
    G.lanes.forEach(function (y) { ctx.beginPath(); ctx.moveTo(S.x, y + 0.5); ctx.lineTo(G.port - 10, y + 0.5); ctx.stroke(); });
    ctx.setLineDash([]);
    for (i = 0; i < 4; i++) {
      var y = G.lanes[i];
      ctx.fillStyle = C.strong; ctx.fillRect(G.port, y - 6, 2, 12);
      text(PROVIDERS[i], S.x + S.w, y + 5, '500 14px ' + SANS, flash[i] > 0.05 ? C.text : C.text2, 'right');
    }
    lands.forEach(function (l) {
      if (l.t > 0.45) return;
      ctx.globalAlpha = 1 - l.t / 0.45; ctx.fillStyle = C.accent;
      ctx.fillRect(G.port - 1, G.lanes[l.lane] - 9, 4, 18); ctx.globalAlpha = 1;
    });
    // the line itself, 2px, and a brief pulse wherever a call meets it
    ctx.fillStyle = C.accent; ctx.fillRect(gx - 1, G.top - 12, 2, G.bot - G.top + 24);
    pulses.forEach(function (p) {
      var life = p.ok ? 0.32 : 0.5; if (p.t > life) return;
      var a = 1 - p.t / life, h = p.ok ? 22 : 30;
      ctx.globalAlpha = a; ctx.fillStyle = p.ok ? C.accent : C.amber; ctx.fillRect(gx - 3, p.y - h / 2, 6, h);
      ctx.globalAlpha = a * 0.7; ctx.fillStyle = p.ok ? C.text : C.amber; ctx.fillRect(gx - 1, p.y - h / 2 + 4, 2, h - 8);
      ctx.globalAlpha = 1;
    });
    calls.forEach(function (c) {
      var col = c.state === 1 ? C.accent : c.state === 2 ? C.amber : C.text2;
      var a = clamp((c.x - S.x) / 40, 0, 1) * (c.state === 2 ? clamp(1 - c.t / 0.3, 0, 1) : 1);
      var len = c.state === 1 ? 46 : c.state === 2 ? 10 : 26;
      if (c.state !== 2) {
        var g = ctx.createLinearGradient(c.x - len, 0, c.x, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, col);
        ctx.globalAlpha = a * 0.75; ctx.strokeStyle = g; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(Math.max(S.x, c.x - len), c.y); ctx.lineTo(c.x, c.y); ctx.stroke();
      }
      ctx.globalAlpha = a; ctx.fillStyle = c.state === 2 && c.t < 0.08 ? C.text : col;
      ctx.beginPath(); ctx.arc(c.x, c.y, c.state === 2 ? 3.4 : 2.6, 0, 6.2832); ctx.fill();
    });
    ctx.fillStyle = C.amber;
    bits.forEach(function (b) { ctx.globalAlpha = clamp(1 - b.t / 0.7, 0, 1); ctx.fillRect(b.x - 1, b.y - 1, 2.2, 2.2); });
    ctx.globalAlpha = 1;
    var taken = [];                                // one label per band, newest first
    for (i = notes.length - 1; i >= 0; i--) {
      var n = notes[i];
      if (taken.some(function (y) { return Math.abs(y - n.y) < 18; })) continue;
      taken.push(n.y);
      text(n.s, gx + 10, n.y - 8, '500 12px ' + MONO, C.amber, 'left', clamp(1.6 - n.t, 0, 1));
    }
  }

  function drawLedger() {
    var y0 = G.ledgerY, col = {}, f = '400 13px ' + MONO;
    G.cols.forEach(function (c) { col[c.key] = c; });
    ctx.fillStyle = C.border; ctx.fillRect(S.x, y0, S.w, 1);
    text('LEDGER · example data', S.x, y0 + 18, '500 12px ' + MONO, C.muted);
    text('prev', col.prev.x, y0 + 18, '400 12px ' + MONO, C.muted);
    text('hash', col.hash.x, y0 + 18, '400 12px ' + MONO, C.muted);
    var list = rows.slice(-4), n = list.length;
    list.forEach(function (r, i) {
      var target = y0 + 44 + (4 - n + i) * 24;
      r.y = r.y == null ? target + 16 : r.y + (target - r.y) * 0.22;
    });
    // the chain: each row's prev is the row above's hash, drawn as a link between the two cells
    ctx.lineWidth = 1;
    for (var i = 1; i < n; i++) {
      var a = list[i - 1], b = list[i], p = ease((b.t - 0.12) / 0.4);
      var x1 = col.hash.x - 3, y1 = a.y - 4, x2 = col.prev.x + col.prev.w + 3, y2 = b.y - 9;
      ctx.strokeStyle = C.accent; ctx.globalAlpha = i === n - 1 ? 0.95 : 0.4; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 + (x2 - x1) * p, y1 + (y2 - y1) * p); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    list.forEach(function (r, i) {
      var age = n - 1 - i, a = (age === 0 ? 1 : 0.86 - age * 0.16) * clamp(r.t * 5, 0, 1);
      var fresh = r.t < 1.4, linkHot = i < n - 1 && list[i + 1].t < 1.4;
      G.cols.forEach(function (c) {
        var color = c.key === 'cost' ? C.accent : c.key === 'seq' || c.key === 'time' ? C.muted : c.key === 'scope' || c.key === 'hash' ? C.text : C.text2;
        if ((c.key === 'prev' && fresh && i > 0) || (c.key === 'hash' && linkHot)) color = C.accent;
        text(r[c.key], c.x, r.y, f, color, 'left', a);
      });
    });
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.textBaseline = 'alphabetic';
    drawDots(); drawNumbers(); drawFlow(); drawLedger();
  }

  // ── running, pausing, and the static fallback ─────────────────────────────────────────────────────
  function frame(now) {
    raf = 0;
    if (!running) return;
    var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    step(dt); draw();
    raf = requestAnimationFrame(frame);
  }
  function update() {
    var go = live && visible && !document.hidden;
    if (go && !running) { running = true; last = performance.now(); raf = requestAnimationFrame(frame); }
    if (!go && running) { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  }
  function start() {
    if (live) return;
    live = true;
    hero.classList.add('is-live');
    hero.insertBefore(canvas, hero.firstChild);
    mount.appendChild(ui);
    layout();
    if (!calls.length) for (var i = 0; i < 285; i++) step(1 / 30);   // arrive mid-stream, as the limit starts to bite
    draw(); update();
  }
  function stop() {
    if (!live) return;
    live = false; update();
    hero.classList.remove('is-live');
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if (ui.parentNode) ui.parentNode.removeChild(ui);
  }
  function decideMode() { if (wide.matches && !calm.matches) start(); else stop(); }

  function setLimit(v) { limit = clamp(Math.round(v * 20) / 20, 0.5, MAX); place(); if (!running && live) draw(); }
  function firstUse() { if (!used) { used = true; hint.classList.add('is-gone'); } }
  function fromPointer(e) { var r = track.getBoundingClientRect(); setLimit((e.clientX - r.left) / r.width * MAX); }
  track.addEventListener('pointerdown', function (e) {
    dragging = true; firstUse(); ui.classList.add('is-dragging');
    if (track.setPointerCapture) track.setPointerCapture(e.pointerId);
    fromPointer(e); e.preventDefault();
  });
  track.addEventListener('pointermove', function (e) { if (dragging) fromPointer(e); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) {
    track.addEventListener(t, function () { dragging = false; ui.classList.remove('is-dragging'); });
  });
  handle.addEventListener('keydown', function (e) {
    var k = e.key, d = { ArrowLeft: -0.1, ArrowDown: -0.1, ArrowRight: 0.1, ArrowUp: 0.1, PageDown: -0.5, PageUp: 0.5 }[k];
    if (d) setLimit(limit + d); else if (k === 'Home') setLimit(0.5); else if (k === 'End') setLimit(MAX); else return;
    firstUse(); e.preventDefault();
  });
  killBtn.addEventListener('click', function () {
    killed = !killed;
    killBtn.textContent = (killed ? 'Release ' : 'Kill ') + KILL;
    killBtn.classList.toggle('is-on', killed);
  });
  hero.addEventListener('pointermove', function (e) {
    if (!live) return;
    var r = hero.getBoundingClientRect();
    ptr = { x: e.clientX - r.left, y: e.clientY - r.top };
  }, { passive: true });
  hero.addEventListener('pointerleave', function () { ptr = null; });
  document.addEventListener('visibilitychange', update);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; update(); }).observe(hero);
  }
  var relayout = function () { if (live) { layout(); draw(); } };
  if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(hero);
  else window.addEventListener('resize', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
  [wide, calm].forEach(function (m) {
    if (m.addEventListener) m.addEventListener('change', decideMode); else if (m.addListener) m.addListener(decideMode);
  });
  decideMode();
})();
