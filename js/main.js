/* TOLVYN — main.js
   Shared utilities. Page-specific behavior lives in nav.js, terminal.js,
   animations.js, and pricing.js — load those alongside as needed.
*/
'use strict';

// Docs redirect (used by pages/docs.html if present)
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
