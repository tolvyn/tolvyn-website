/* TOLVYN — main.js */
'use strict';

/* ─── Nav: transparent → solid on scroll ───────────────────────────── */
(function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

/* ─── Mobile hamburger menu ─────────────────────────────────────────── */
(function initMobile() {
  const btn  = document.querySelector('.nav__hamburger');
  const menu = document.querySelector('.mobile-menu');
  if (!btn || !menu) return;

  btn.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
  });

  // Close on link click
  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  });
})();

/* ─── Scroll-triggered reveal (Intersection Observer) ──────────────── */
(function initReveal() {
  const targets = document.querySelectorAll('.reveal');
  if (!targets.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  targets.forEach(el => observer.observe(el));
})();

/* ─── Smooth scroll for in-page anchor links ───────────────────────── */
(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();

/* ─── Live terminal animation (index.html only) ─────────────────────── */
(function initTerminal() {
  const container = document.getElementById('terminal-lines');
  if (!container) return;

  const LINES = [
    { cls: 'tl-cmd',   text: '$ tolvyn tail' },
    { cls: 'tl-hdr',   text: 'TIME      | TEAM/SERVICE      | MODEL       | TOKENS | COST    | LATENCY' },
    { cls: 'tl-row',   text: '14:23:01  | eng/chatbot-api   | gpt-4o      | 1,247  | $0.0089 | 340ms' },
    { cls: 'tl-row',   text: '14:23:02  | eng/search-svc    | claude-son  | 2,104  | $0.0252 | 890ms' },
    { cls: 'tl-row',   text: '14:23:03  | support/bot       | gpt-4o-mini | 456    | $0.0003 | 120ms' },
    { cls: 'tl-alert', text: '[ALERT] eng/chatbot-api cost/req jumped 47x (model: gpt-4o-mini \u2192 gpt-4o)' },
    { cls: 'tl-row',   text: '14:23:05  | mktg/content      | gpt-4o      | 3,847  | $0.0312 | 1.2s' },
  ];

  const PAUSE_AFTER_LAST = 2200; // ms before clearing and restarting
  const LINE_DELAY       = 320;  // ms between each line appearing

  let lineIndex = 0;
  let timer     = null;

  function appendLine(line) {
    const el = document.createElement('div');
    el.className = line.cls;
    el.textContent = line.text;
    container.appendChild(el);
  }

  function clearLines() {
    container.innerHTML = '';
  }

  function step() {
    if (lineIndex < LINES.length) {
      appendLine(LINES[lineIndex]);
      lineIndex++;
      timer = setTimeout(step, LINE_DELAY);
    } else {
      // pause, then restart
      timer = setTimeout(() => {
        clearLines();
        lineIndex = 0;
        timer = setTimeout(step, LINE_DELAY);
      }, PAUSE_AFTER_LAST);
    }
  }

  // Start only when the terminal scrolls into view
  const wrap = document.getElementById('terminal-screen');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          observer.unobserve(entry.target);
          step();
        }
      });
    },
    { threshold: 0.3 }
  );
  if (wrap) observer.observe(wrap);
})();

/* ─── Docs redirect (docs.html only) ───────────────────────────────── */
(function initDocsRedirect() {
  const countdown = document.getElementById('redirect-countdown');
  if (!countdown) return;

  let seconds = 3;
  countdown.textContent = seconds;

  const timer = setInterval(() => {
    seconds -= 1;
    countdown.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(timer);
      window.location.href = 'https://docs.tolvyn.io';
    }
  }, 1000);
})();
