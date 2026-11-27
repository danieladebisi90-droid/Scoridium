/* ApexVision Combined Tracking — reuse original court and Quick Track controls.
   No cloned stat buttons, no duplicate event handlers, no court geometry changes. */
(() => {
  'use strict';
  const api = window.apexPostgame;
  if (!api || api.mode !== 'combined') return;
  const $ = id => document.getElementById(id);
  const section = $('post-shot-section');
  const workspace = section?.querySelector('.pg-shot-workspace');
  const courtArea = workspace?.querySelector('.pg-shot-court-area');
  const sidebar = workspace?.querySelector('.pg-shot-sidebar');
  const court = $('postgame-court');
  const quick = $('post-quick-root');
  const toolbar = document.querySelector('#postgame-screen > .pg-review-toolbar');
  const more = $('pg-mobile-more');
  const drawer = $('pg-mobile-extra');
  if (!section || !workspace || !courtArea || !court || !quick) return;

  const wide = matchMedia('(min-width: 980px) and (min-aspect-ratio: 11/10) and (min-height: 550px)');
  const origins = new Map();
  let stage, courtHost, statsHost, observer, viewObserver, frame = 0, teamToolbarButton;
  let built = false;

  function move(element, parent) {
    if (!element || !parent) return;
    if (!origins.has(element)) {
      const marker = document.createComment('Combined Tracking original position');
      element.before(marker);
      origins.set(element, marker);
    }
    parent.append(element);
  }

  function size() {
    if (!built || !stage) return;
    const width = stage.clientWidth, height = stage.clientHeight;
    if (width <= 0 || height <= 0) return;
    const box = court.viewBox?.baseVal;
    const ratio = box?.width > 0 && box?.height > 0
      ? box.width / box.height
      : (court.classList.contains('pg-half-view') ? 420 / 450 : 860 / 470);
    stage.style.setProperty('--av-combined-ratio', String(ratio));
    if (!wide.matches) {
      stage.style.removeProperty('--av-combined-court-column');
      return;
    }
    const gap = Math.max(8, Math.min(16, width * .01));
    const minStats = Math.max(240, Math.min(340, width * .25));
    const maxCourtWidth = Math.max(1, width - minStats - gap);
    const courtWidth = Math.max(1, Math.min(height * ratio, maxCourtWidth));
    stage.style.setProperty('--av-combined-court-column', `${Math.floor(courtWidth)}px`);
  }

  function scheduleSize() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(size);
  }

  function build() {
    // Existing mobile-v8 code owns the phone portrait arrangement.
    if (built || (innerWidth <= 700 && innerHeight > innerWidth) || section.hidden || !courtArea.querySelector('.postgame-court-workspace')) return;
    stage = document.createElement('div');
    stage.className = 'av-combined-stage';
    courtHost = document.createElement('div');
    courtHost.className = 'av-combined-court';
    statsHost = document.createElement('div');
    statsHost.className = 'av-combined-stats';
    stage.append(courtHost, statsHost);
    workspace.prepend(stage);
    move(courtArea, courtHost);
    move(quick, statsHost);

    // Move the ORIGINAL controls into a single toolbar. Keep their listeners.
    if (toolbar) {
      if (!teamToolbarButton) {
        teamToolbarButton = document.createElement('button');
        teamToolbarButton.type = 'button';
        teamToolbarButton.id = 'av-combined-team-mode';
        teamToolbarButton.textContent = 'Team Mode';
        teamToolbarButton.addEventListener('click', () => {
          const enter = quick.querySelector('[data-qv="teamPlayer"]');
          if (enter && !enter.disabled) { enter.click(); requestAnimationFrame(update); return; }
          const back = quick.querySelector('[data-qv="back"]');
          if (back && !back.disabled) { back.click(); requestAnimationFrame(update); }
        });
      }
      arrangeToolbar();
    }
    if (sidebar) sidebar.hidden = true;
    if (drawer) drawer.hidden = true;
    if (more) more.setAttribute('aria-expanded', 'false');
    document.body.classList.add('av-combined-unified');
    built = true;
    observer = new ResizeObserver(scheduleSize);
    observer.observe(stage);
    viewObserver = new MutationObserver(scheduleSize);
    viewObserver.observe(court, {attributes: true, attributeFilter: ['viewBox', 'class']});
    scheduleSize();
  }

  function arrangeToolbar() {
    if (!toolbar || !built && !stage) return;

    // Fixed order: Q selector, Court, Team Mode, review tools, quarter actions.
    const quarter = toolbar.querySelector('.postgame-controls');
    const modes = $('pg-court-full')?.closest('.pg-court-modes');
    const tools = document.querySelector('#postgame-screen .pg-review-tools');
    const actions = $('post-next-quarter')?.closest('.pg-floating-steps');

    if (quarter) move(quarter, toolbar);
    
if (modes) {
  const combinedModesSlot = document.querySelector(
    '#av-combined-nav .av-cn-modes'
  );

  if (combinedModesSlot) {
    // Keep court controls in the visible Combined toolbar.
    if (modes.parentElement !== combinedModesSlot) {
      combinedModesSlot.appendChild(modes);
    }
  } else if (!document.body.classList.contains('av-cn-active')) {
    // Original layout fallback.
    move(modes, toolbar);
  }
}

    
// Let Combined Navigation own the Team Mode button.

if (teamToolbarButton) {
  const combinedSlot = document.querySelector(
    '#av-combined-nav .av-cn-team-mode'
  );

  if (combinedSlot) {
    // Move the original working button into the new toolbar.
    if (teamToolbarButton.parentElement !== combinedSlot) {
      combinedSlot.appendChild(teamToolbarButton);
    }
  } else if (!document.body.classList.contains('av-cn-active')) {
    // Preserve the original toolbar when Combined Navigation is inactive.
    move(teamToolbarButton, toolbar);
  }
}


    // Some older mobile scripts may have moved individual review buttons.
    // Return them to their ORIGINAL group, not to More.
    
if (tools) {
  const combinedMorePanel = document.getElementById(
    'av-cn-more-panel'
  );

  if (
    document.body.classList.contains('av-cn-active') &&
    combinedMorePanel
  ) {
    // Keep More actions in the visible Combined Tracking popup.
    for (const id of [
      'post-switch-direction',
      'post-shot-links-open',
      'pg-unmatched-open'
    ]) {
      const button = $(id);

      if (button && button.parentElement !== combinedMorePanel) {
        combinedMorePanel.appendChild(button);
      }
    }
  } else {
    // Preserve original behavior outside Combined Navigation.
    for (const id of [
      'post-switch-direction',
      'post-quick-review',
      'post-shot-links-open',
      'pg-unmatched-open'
    ]) {
      const button = $(id);

      if (button && button.parentElement !== tools) {
        move(button, tools);
      }
    }

    move(tools, toolbar);
  }
}

    if (actions) move(actions, toolbar);

    // No More or Free/Guided popup in the wide Combined toolbar.
    if (drawer) drawer.hidden = true;
    if (more) more.setAttribute('aria-expanded', 'false');
  }

  function arrangePortrait() {
    // The existing phone layout creates the stage, review bar and More menu.
    // Keep those controls, but display the ORIGINAL Quick Track below the court.
    if (!document.body.classList.contains('pg-mobile-v8')) return;
    const mobileStage = workspace.querySelector('.pg-v8-stage');
    const dock = mobileStage?.querySelector('.pg-v8-bottom');
    if (!mobileStage || !dock || !courtArea || !quick) return;
    if (quick.parentElement !== mobileStage) dock.before(quick);
    const modes = $('pg-court-full')?.closest('.pg-court-modes');
    if (modes && drawer && modes.parentElement !== drawer) drawer.append(modes);
    document.body.classList.add('av-combined-portrait');
  }

  function update() {
    if (matchMedia('(max-width: 700px) and (orientation: portrait)').matches) {
      // Phone layout is owned by mobile-v8. Do not rebuild or move its toolbar.
      requestAnimationFrame(arrangePortrait);
      return;
    }
    document.body.classList.remove('av-combined-portrait');
    build();
    if (built) arrangeToolbar();
    if (teamToolbarButton) {
      const enter = quick.querySelector('[data-qv="teamPlayer"]');
      const back = quick.querySelector('[data-qv="back"]');
      teamToolbarButton.textContent = enter ? 'Team Mode' : 'Player Mode';
      teamToolbarButton.disabled = !!enter?.disabled || (!enter && !back);
    }
    scheduleSize();
  }

   // Initialize and update Combined Tracking
  window.addEventListener('apex:postgame-ready', () => {
    requestAnimationFrame(() => requestAnimationFrame(update));
  });

  window.addEventListener('apex:court-view-updated', scheduleSize);
  window.addEventListener('resize', update);
  wide.addEventListener('change', scheduleSize);

  requestAnimationFrame(() => requestAnimationFrame(update));
})();