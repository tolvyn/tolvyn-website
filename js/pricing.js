/* TOLVYN — pricing.js
   Pricing page interactions: billing toggle, code tabs, founding-partner counter.
*/
'use strict';

// Billing period toggle (UI-only for now; no annual prices yet)
(function initBillingToggle() {
  const toggle = document.querySelector('.pricing-toggle');
  if (!toggle) return;
  const buttons = toggle.querySelectorAll('button');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.body.dataset.billing = btn.dataset.period;
    });
  });
})();

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
