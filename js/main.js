/* TOLVYN — main.js
   Shared behaviour. Page-specific logic lives in nav.js, terminal.js, animations.js,
   pricing.js and hero.js.
*/
'use strict';

// Panels: the hairline brightens near the pointer (css/components.css reads --mx and --my).
// Mouse and pen only; nothing runs on touch screens.
(function initPanelHighlight() {
  if (!window.matchMedia || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var SEL = '.card, .diff-tile, .plan, .migration, .pricing-teaser, .code-tabs, .discount-banner';
  document.addEventListener('pointermove', function (e) {
    var el = e.target && e.target.closest ? e.target.closest(SEL) : null;
    if (!el) return;
    var r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });
})();
