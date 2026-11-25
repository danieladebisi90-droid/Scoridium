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
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-label','Opening Tip-Off');
  overlay.innerHTML = `
    <div class="mobile-start-card">
      <strong id="mobile-start-title">Tip-Off</strong>
      <span class="mobile-start-help">Who won the opening tip?</span>
      <div class="mobile-tip-winner" role="group" aria-label="Tip winner">
        <button type="button" data-tip-winner="home" aria-pressed="true">Home</button>
        <button type="button" data-tip-winner="away" aria-pressed="false">Away</button>
      </div>
      <span id="mobile-tip-question" class="mobile-start-help">Which basket are they scoring on?</span>
      <div class="mobile-direction-select" role="group" aria-label="Opening scoring basket">
        <button type="button" data-tip-side="left" aria-pressed="true">← LEFT</button>
        <button type="button" data-tip-side="right" aria-pressed="false">RIGHT →</button>
      </div>
      <button type="button" id="mobile-start-action" class="primary">CONFIRM TIP-OFF</button>
      <small id="mobile-start-note" aria-live="polite"></small>
    </div>`;
  courtWrap.appendChild(overlay);
  const tipoff = window.scoridiumTipoff;
  const originalStart = document.getElementById('start-game');
  const statusElement = document.getElementById('game-status');
  const startAction = overlay.querySelector('#mobile-start-action');
  const startNote = overlay.querySelector('#mobile-start-note');
  const winnerButtons = [...overlay.querySelectorAll('[data-tip-winner]')];
  const sideButtons = [...overlay.querySelectorAll('[data-tip-side]')];
  let winner = 'home';
  let side = 'left';
  let submitting = false;
  let active = false;

  function updateTipoffForm() {
    const names = tipoff?.getTeams() || {home:'HOME',away:'AWAY'};
    winnerButtons.forEach(button => {
      button.textContent = names[button.dataset.tipWinner] || button.dataset.tipWinner.toUpperCase();
      const selected = button.dataset.tipWinner === winner;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
    const name = names[winner] || 'the tip-winning team';
    overlay.querySelector('#mobile-tip-question').textContent =
      `Which basket are ${name} scoring on?`;
    sideButtons.forEach(button => {
      const selected = button.dataset.tipSide === side;
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  }
  winnerButtons.forEach(button=>button.addEventListener('click',()=>{
    if(submitting) return;
    winner=button.dataset.tipWinner;
    startNote.textContent='';updateTipoffForm();
  }));
  sideButtons.forEach(button=>button.addEventListener('click',()=>{
    if(submitting) return;
    side=button.dataset.tipSide;
    startNote.textContent='';updateTipoffForm();
  }));

  function refreshStartOverlay() {
    const status = tipoff?.getStatus() || 'not_started';
    const done = status === 'live' || status === 'final';
    overlay.hidden = done;
    if (done) return;
    const paused = status === 'paused';
    overlay.querySelector('#mobile-start-title').textContent = paused ? 'Game Paused' : 'Tip-Off';
    overlay.querySelector('.mobile-start-help').textContent = paused
      ? 'Resume the existing game using its saved direction.'
      : 'Who won the opening tip?';
    overlay.querySelector('.mobile-tip-winner').hidden = paused;
    overlay.querySelector('#mobile-tip-question').hidden = paused;
    overlay.querySelector('.mobile-direction-select').hidden = paused;
    startAction.textContent = paused ? 'RESUME GAME' : 'CONFIRM TIP-OFF';
    startAction.disabled = submitting || !tipoff || (paused && originalStart?.disabled);
    updateTipoffForm();
  }
  startAction.addEventListener('click', async () => {
    if (submitting || !tipoff) return;
    if (tipoff.getStatus() === 'paused') {originalStart?.click();return;}
    submitting = true;
    startAction.disabled = true;
    startNote.textContent = 'Saving official tip-off…';
    try {
      const result = await tipoff.confirm(winner,side);
      startNote.textContent = result.ok ? '' : (result.message || 'Could not start game.');
    } finally {
      submitting=false;
      refreshStartOverlay();
    }
  });
  window.addEventListener('scoridium-request-tipoff',()=>{
    refreshStartOverlay();
    if (!overlay.hidden) overlay.scrollIntoView?.({block:'nearest'});
  });
  window.addEventListener('scoridium-tipoff-teams-loaded',updateTipoffForm);
  window.addEventListener('scoridium-direction-changed',updateTipoffForm);
  if(statusElement) new MutationObserver(refreshStartOverlay)
    .observe(statusElement,{childList:true,characterData:true,subtree:true});
  updateTipoffForm();
  refreshStartOverlay();

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
