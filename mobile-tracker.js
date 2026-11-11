/* Scoridium mobile landscape tracker V3: persistent left roster,
   central court, right stat strip; existing click handlers remain intact. */
(() => {
  'use strict';
  const query = '(orientation: landscape) and (max-height: 650px)';
  const media = matchMedia(query);
  const shell = document.querySelector('.tracker-shell');
  const score = shell?.querySelector('.scoreboard');
  if (!shell || !score) return;

  const mobile = document.createElement('section');
  mobile.id = 'mobile-tracker';
  mobile.setAttribute('aria-label', 'Mobile landscape basketball tracker');
  mobile.innerHTML = `
    <aside class="mobile-left-rail" aria-label="Players and period controls">
      <a class="mobile-back-button" href="gamehub.html" aria-label="Back to Game Hub">← BACK</a>
      <div class="mobile-left-actions" id="mobile-game-actions"></div>
      <div class="mobile-player-list" id="mobile-player-slot"></div>
    </aside>
    <section class="mobile-court-center" aria-label="Full basketball court">
      <div id="mobile-court-slot"></div>
    </section>
    <aside class="mobile-right-rail" aria-label="Scrollable game stats">
      <div id="mobile-stat-slot"></div>
    </aside>`;
  score.after(mobile);

  const target = [
    [document.getElementById('game-controls'), '#mobile-game-actions'],
    [document.querySelector('.player-panel'), '#mobile-player-slot'],
    [document.getElementById('tracker-controls'), '#mobile-court-slot'],
    [document.querySelector('.stats-panel'), '#mobile-stat-slot']
  ].filter(([node]) => !!node);
  const restorePoints = new Map();
  for (const [node] of target) {
    const marker = document.createComment('restore ' + (node.id || node.className));
    node.before(marker);
    restorePoints.set(node, marker);
  }

  const courtWrap = document.querySelector('#tracker-controls .court-wrap');
  if (!courtWrap) return;
  const overlay = document.createElement('div');
  overlay.id = 'mobile-start-overlay';
  overlay.setAttribute('role', 'group');
  overlay.setAttribute('aria-label', 'Start game and choose attacking direction');
  overlay.innerHTML = `
    <div class="mobile-start-card">
      <strong id="mobile-start-title">Ready to start?</strong>
      <span class="mobile-start-help">Which basket does HOME attack first?</span>
      <div class="mobile-direction-select" role="group" aria-label="Home first-half attack direction">
        <button type="button" data-home-direction="left" aria-pressed="true">← LEFT</button>
        <button type="button" data-home-direction="right" aria-pressed="false">RIGHT →</button>
      </div>
      <button type="button" id="mobile-start-action" class="primary">START GAME</button>
      <small id="mobile-start-note" aria-live="polite"></small>
    </div>`;
  courtWrap.appendChild(overlay);
  const startAction = overlay.querySelector('#mobile-start-action');
  const startNote = overlay.querySelector('#mobile-start-note');
  const originalStart = document.getElementById('start-game');
  const statusElement = document.getElementById('game-status');
  const directionButtons = [...overlay.querySelectorAll('[data-home-direction]')];
  const direction = window.scoridiumTrackerDirection;
  let active = false;

  function showDirection() {
    const selected = direction?.get() || 'left';
    for (const btn of directionButtons) {
      const chosen = btn.dataset.homeDirection === selected;
      btn.classList.toggle('active', chosen);
      btn.setAttribute('aria-pressed', String(chosen));
    }
  }
  for (const btn of directionButtons) {
    btn.addEventListener('click', () => {
      if (direction?.set(btn.dataset.homeDirection) === false) {
        startNote.textContent = 'Direction is locked after recording begins.';
      } else {
        startNote.textContent = '';
      }
      showDirection();
    });
  }

  function refreshStartOverlay() {
    if (!active) return;
    const status = statusElement?.textContent?.trim().toUpperCase() || '';
    const done = status === 'LIVE' || status === 'COMPLETED' || status === 'FINAL';
    overlay.hidden = done;
    if (done) return;
    startAction.textContent = originalStart?.textContent || 'START GAME';
    startAction.disabled = !originalStart || originalStart.disabled;
    if (status === 'PAUSED') {
      overlay.querySelector('.mobile-start-help').textContent = 'Resume the game to continue tracking.';
    } else {
      overlay.querySelector('.mobile-start-help').textContent = 'Which basket does HOME attack first?';
    }
    showDirection();
  }
  startAction.addEventListener('click', () => {
    if (!originalStart || originalStart.disabled) return;
    startNote.textContent = 'Starting game…';
    originalStart.click(); // Reuses original Supabase RPC + synchronization checks.
  });
  const observer = new MutationObserver(() => {
    if (active) {
      refreshStartOverlay();
      if (overlay.hidden) startNote.textContent = '';
    }
  });
  if (statusElement) observer.observe(statusElement, {childList:true, characterData:true, subtree:true});

  function sync() {
    const enabled = media.matches;
    if (enabled === active) return;
    active = enabled;
    if (enabled) {
      for (const [node, selector] of target) mobile.querySelector(selector).appendChild(node);
      document.documentElement.classList.add('mobile-tracker-active');
      refreshStartOverlay();
    } else {
      document.documentElement.classList.remove('mobile-tracker-active');
      for (const [node] of target) restorePoints.get(node).after(node);
    }
  }
  media.addEventListener?.('change', sync);
  sync();
})();
