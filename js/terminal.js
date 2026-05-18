/* TOLVYN — terminal.js
   Enhanced live terminal: TOLVYN product features in action.
   Intersection-observer gated, mint green color scheme.
*/
'use strict';

(function initTerminal() {
  const container = document.getElementById('terminal-lines');
  if (!container) return;

  // Each line is a list of {cls, text} spans rendered on one line.
  // Pipe-separated rows are pre-tokenized so each column gets its own color.
  const LINES = [
    [{ cls: 'tl-cmd', text: '$ tolvyn tail --service chatbot-api' }],
    [{ cls: 'tl-hdr', text: 'TIME     | TEAM/SERVICE      | MODEL         | TOKENS | COST    | LATENCY' }],
    row('14:23:01', 'eng/chatbot-api  ', 'gpt-4o       ', ' 1,247', '$0.0089', '340ms'),
    row('14:23:02', 'eng/search-svc   ', 'claude-sonnet', ' 2,104', '$0.0252', '890ms'),
    row('14:23:03', 'support/bot      ', 'gpt-4o-mini  ', '   456', '$0.0003', '120ms'),
    [{ cls: 'tl-alert', text: '[ALERT]  eng/chatbot-api cost/req jumped 47x (model: gpt-4o-mini → gpt-4o)' }],
    row('14:23:05', 'mktg/content     ', 'gpt-4o       ', ' 3,847', '$0.0312', '1.2s'),
    [{ cls: 'tl-budget', text: '[BUDGET] eng/chatbot-api at 87% of $500/mo hard budget' }],
    row('14:23:07', 'eng/chatbot-api  ', 'gpt-4o       ', '   892', '$0.0071', '280ms'),
    [{ cls: 'tl-ledger', text: '[LEDGER] seq=4821 hash=a3f7c2d1 ✓ chain intact' }],
    row('14:23:09', 'data/pipeline    ', 'claude-haiku ', '12,450', '$0.0094', '2.1s'),
    [{ cls: 'tl-save',  text: '[SAVE]   data/pipeline: switch claude-haiku → gemini-flash saves $340/mo' }],
  ];

  function row(time, team, model, tokens, cost, latency) {
    const pipe = (t) => ({ cls: 'tl-pipe', text: t });
    return [
      { cls: 'tl-time',    text: time },
      pipe(' | '),
      { cls: 'tl-team',    text: team },
      pipe(' | '),
      { cls: 'tl-model',   text: model },
      pipe(' | '),
      { cls: 'tl-row',     text: tokens },
      pipe(' | '),
      { cls: 'tl-cost',    text: cost },
      pipe(' | '),
      { cls: 'tl-latency', text: latency },
    ];
  }

  const PAUSE_AFTER_LAST = 3000;
  const LINE_DELAY       = 380;

  let lineIndex = 0;
  let timer     = null;

  function appendLine(spans) {
    const el = document.createElement('div');
    spans.forEach(s => {
      const span = document.createElement('span');
      span.className = s.cls;
      span.textContent = s.text;
      el.appendChild(span);
    });
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
      timer = setTimeout(() => {
        clearLines();
        lineIndex = 0;
        timer = setTimeout(step, LINE_DELAY);
      }, PAUSE_AFTER_LAST);
    }
  }

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
