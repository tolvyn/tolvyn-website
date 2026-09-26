/* TOLVYN — pricing.js
   Pricing page interactions: code tabs, contact scroll.
*/
'use strict';

// Code tabs (Python / Node / curl)
(function initCodeTabs() {
  document.querySelectorAll('.code-tabs').forEach(tabs => {
    const buttons = tabs.querySelectorAll('.code-tabs__tab');
    const panels  = tabs.querySelectorAll('.code-tabs__panel');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.tab;
        buttons.forEach(b => b.classList.toggle('active', b === btn));
        panels.forEach(p => p.classList.toggle('active', p.dataset.tab === id));
      });
    });
  });
})();

// Smooth-scroll to contact section
(function initContactScroll() {
  const links = document.querySelectorAll('[data-scroll-to]');
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      const id = link.dataset.scrollTo;
      const target = document.getElementById(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
})();
