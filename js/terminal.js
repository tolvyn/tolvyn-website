/* TOLVYN — terminal.js
   The integration section's live terminal: `tolvyn tail` output, typed one row at a time while on
   screen. The header and every row are cells of one grid (css/main.css), so the columns share one set
   of widths; dividers are CSS borders, numbers are right-aligned. Reduced motion: everything at once.
*/
'use strict';

(function initTerminal() {
  const container = document.getElementById('terminal-lines');
  if (!container) return;

  const COMMAND = '$ tolvyn tail --service chatbot-api';
  const HEADER = ['TIME', 'TEAM/SERVICE', 'MODEL', 'TOKENS', 'COST', 'LATENCY'];
  const ROWS = [
    ['14:23:01', 'eng/chatbot-api', 'gpt-4o',           '1,247',  '$0.0089', '340ms'],
    ['14:23:02', 'eng/search-svc',  'claude-opus-4-6',  '2,104',  '$0.0252', '890ms'],
    ['14:23:03', 'support/bot',     'gpt-4o-mini',      '456',    '$0.0003', '120ms'],
    ['14:23:05', 'mktg/content',    'gpt-4o',           '3,847',  '$0.0312', '1.2s'],
    ['14:23:07', 'eng/chatbot-api', 'gpt-4o',           '892',    '$0.0071', '280ms'],
    ['14:23:09', 'data/pipeline',   'claude-haiku-4-5', '12,450', '$0.0094', '2.1s'],
  ];
  const CLASSES = ['tl-time', 'tl-team', 'tl-model', 'tl-row tl-num', 'tl-cost tl-num', 'tl-latency tl-num'];

  const PAUSE_AFTER_LAST = 3000;
  const LINE_DELAY       = 380;

  let table = null;
  let step_ = 0;            // 0 = command, 1 = header, 2.. = rows
  let timer = null;

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function addRow(cells, head) {
    const tr = el('div', head ? 'tl-tr tl-head' : 'tl-tr');
    tr.setAttribute('role', 'row');
    cells.forEach((text, i) => {
      const td = el('span', head ? (i > 2 ? 'tl-hdr tl-num' : 'tl-hdr') : CLASSES[i], text);
      td.setAttribute('role', head ? 'columnheader' : 'cell');
      tr.appendChild(td);
    });
    table.appendChild(tr);
  }

  function next() {
    if (step_ === 0) {
      container.appendChild(el('div', 'tl-cmd', COMMAND));
      table = el('div', 'tl-table');
      table.setAttribute('role', 'table');
      table.setAttribute('aria-label', 'tolvyn tail output');
      container.appendChild(table);
    } else if (step_ === 1) {
      addRow(HEADER, true);
    } else {
      addRow(ROWS[step_ - 2], false);
    }
    step_++;
  }

  function clear() {
    container.textContent = '';
    table = null;
    step_ = 0;
  }

  function step() {
    if (step_ < ROWS.length + 2) {
      next();
      timer = setTimeout(step, LINE_DELAY);
    } else {
      timer = setTimeout(() => {
        clear();
        timer = setTimeout(step, LINE_DELAY);
      }, PAUSE_AFTER_LAST);
    }
  }

  // Reduced motion: show every line at once and stop there.
  if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) {
    while (step_ < ROWS.length + 2) next();
    return;
  }

  // Types while on screen; pauses (and resumes where it was) when scrolled away.
  const wrap = document.getElementById('terminal-screen');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          if (!timer) step();
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      });
    },
    { threshold: 0.3 }
  );
  if (wrap) observer.observe(wrap);
})();
