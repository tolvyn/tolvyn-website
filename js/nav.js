/* TOLVYN — nav.js
   Navigation behavior: scroll styling, mobile menu, active page,
   in-page smooth scroll for hash links.
*/
'use strict';

(function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;
  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();

(function initMobile() {
  const btn  = document.querySelector('.nav__hamburger');
  const menu = document.querySelector('.mobile-menu');
  if (!btn || !menu) return;

  btn.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
  });

  menu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      menu.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    });
  });
})();

(function initActiveLink() {
  const path = window.location.pathname;
  const links = document.querySelectorAll('.nav__links a, .mobile-menu a');
  links.forEach(a => {
    const href = a.getAttribute('href');
    if (!href || href.startsWith('http')) return;
    const normalized = href.replace(/^\.\.\//, '/').replace(/^\.\//, '/');
    if (path === normalized || path.endsWith(normalized.replace(/^\//, ''))) {
      a.classList.add('active');
    }
  });
})();

(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const id = this.getAttribute('href');
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', id);
    });
  });
})();
