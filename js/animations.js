/* TOLVYN — animations.js
   Counters and the sidebar highlight. Nothing is hidden waiting for a scroll position
   (.reveal is a plain hook now). Respects prefers-reduced-motion.
*/
'use strict';

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

(function initCounters() {
  const counters = document.querySelectorAll('[data-counter]');
  if (!counters.length || reduced) {
    counters.forEach(c => { c.textContent = c.dataset.counter; });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = parseFloat(el.dataset.counter);
        const duration = parseInt(el.dataset.duration || '1200', 10);
        const start = performance.now();

        function tick(now) {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = Math.round(target * eased).toLocaleString();
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        observer.unobserve(el);
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach(el => observer.observe(el));
})();

(function initSidebarHighlight() {
  const sidebar = document.querySelector('.docs-sidebar');
  if (!sidebar) return;
  const links = [...sidebar.querySelectorAll('a[href^="#"]')];
  if (!links.length) return;

  const sections = links
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = '#' + entry.target.id;
        links.forEach(a => a.classList.toggle('active', a.getAttribute('href') === id));
      });
    },
    { rootMargin: '-30% 0px -55% 0px', threshold: 0 }
  );

  sections.forEach(s => observer.observe(s));
})();
