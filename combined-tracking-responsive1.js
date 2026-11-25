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

    // Preserve existing Full/Half Court and Free/Guided controls in More,
    // rather than creating duplicate buttons and handlers.
    const modes = sidebar?.querySelector('.pg-court-modes');
    const options = sidebar?.querySelector('.pg-guided-options');
    const status = $('pg-guided-status');
    const sequence = $('pg-shot-sequence');
    if (drawer) {
      // Keep mode options and secondary review tools in More.
      // Full/Half Court stay visible in the quarter toolbar.

      move(options, drawer);
      move(status, drawer);
      move(sequence, drawer);
    }
    if (toolbar) {
      move(modes, toolbar);
      // Use the existing Quick Track TEAM STAT / BACK actions.
      // Never create a second stat recorder or duplicate a stat event.
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
      toolbar.appendChild(teamToolbarButton);
      move(more, toolbar);
      move(drawer, toolbar);
      // Review buttons must stay children of the quarter toolbar.
      move($('post-next-quarter')?.closest('.pg-floating-steps'), toolbar);
      for (const button of toolbar.querySelectorAll('.pg-review-tools > button')) move(button, drawer);
    }
    if (sidebar) sidebar.hidden = true;
    if (more && drawer) {
      drawer.hidden = true;
      more.textContent = 'More';
      more.setAttribute('aria-expanded', 'false');
    }
    document.body.classList.add('av-combined-unified');
    built = true;
    observer = new ResizeObserver(scheduleSize);
    observer.observe(stage);
    viewObserver = new MutationObserver(scheduleSize);
    viewObserver.observe(court, {attributes: true, attributeFilter: ['viewBox', 'class']});
    scheduleSize();
  }

  // In wide Combined Tracking the existing mobile menu handlers are inactive.
  // Toggle the original More menu here; never clone its controls.
  if (more && drawer) {
    more.addEventListener('click', () => {
      if (!built || !wide.matches) return;
      const open = drawer.hidden;
      drawer.hidden = !open;
      more.textContent = open ? 'Close' : 'More';
      more.setAttribute('aria-expanded', String(open));
    });
    drawer.addEventListener('click', event => {
      if (!built || !wide.matches || !event.target.closest('button')) return;
      queueMicrotask(() => {
        drawer.hidden = true;
        more.textContent = 'More';
        more.setAttribute('aria-expanded', 'false');
      });
    });
  }
  function update() {
    build();
    if (built && toolbar) {
      const modes = $('.pg-court-modes') || $('pg-court-full')?.closest('.pg-court-modes');
      if (modes && modes.parentNode !== toolbar) toolbar.appendChild(modes);
    }
    if (teamToolbarButton) {
      const enter = quick.querySelector('[data-qv="teamPlayer"]');
      const back = quick.querySelector('[data-qv="back"]');
      teamToolbarButton.textContent = enter ? 'Team Mode' : 'Player Mode';
      teamToolbarButton.disabled = !!enter?.disabled || (!enter && !back);
    }
    scheduleSize();
  }
  window.addEventListener('apex:postgame-ready', () => requestAnimationFrame(update));
  window.addEventListener('apex:court-view-updated', scheduleSize);
  window.addEventListener('resize', update);
  wide.addEventListener('change', scheduleSize);
  requestAnimationFrame(update);
})();
