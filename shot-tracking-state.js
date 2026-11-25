/* ApexVision Shot Tracking — per-game UI preferences only.
   Does not save or replay game events or unfinished shot transactions. */
(() => {
  'use strict';
  const api = window.apexPostgame;
  if (!api || api.mode !== 'shot' || !api.gameId) return;

  const key = `apexvision:shot-ui:v1:${api.gameId}`;
  let saved = null;
  let ready = false;
  let restoring = false;
  let queued = false;

  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    if (value && value.version === 1) saved = value;
  } catch (error) {
    console.warn('Could not read Shot Tracking preferences:', error);
  }

  const get = id => document.getElementById(id);
  const view = () => window.apexFilmCourtView;
  const guidedPosition = () => window.apexGuidedPosition;

  function snapshot() {
    return {
      version: 1,
      period: String(api.getPeriod()),
      guided: document.body.classList.contains('pg-guided-on'),
      court: view()?.isHalf?.() ? 'half' : 'full',
      halfTeam: view()?.currentTeam?.() === 'opponent' ? 'opponent' : 'us',
      guidedEventId: guidedPosition()?.getEventId?.() || null,
      freeThrowTeam: document.querySelector('.pg-shot-unified-ft select')?.value || 'us'
    };
  }

  function save() {
    if (!ready || restoring) return;
    try {
      saved = snapshot();
      localStorage.setItem(key, JSON.stringify(saved));
    } catch (error) {
      console.warn('Could not save Shot Tracking preferences:', error);
    }
  }

  function scheduleSave() {
    if (!ready || restoring || queued) return;
    queued = true;
    // Allow the existing click/change handlers to finish changing state first.
    setTimeout(() => { queued = false; save(); }, 0);
  }

  function restore() {
    if (ready) return;
    restoring = true;
    try {
      if (saved) {
        const quarter = get('post-period');
        if (quarter && [...quarter.options].some(o => o.value === saved.period) &&
            quarter.value !== saved.period) {
          quarter.value = saved.period;
          quarter.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // Existing Free/Guided button handlers own the actual mode transition.
        if (typeof saved.guided === 'boolean') {
          const current = document.body.classList.contains('pg-guided-on');
          if (current !== saved.guided) {
            get(saved.guided ? 'pg-guided-enable' : 'pg-guided-free')?.click();
          }
        }

        // Restore view AFTER mode: an old Guided handler may switch court view.
        if (saved.court === 'half') {
          view()?.setHalf?.(saved.halfTeam === 'opponent' ? 'opponent' : 'us');
        } else if (saved.court === 'full') {
          view()?.showFull?.();
        }

        if (saved.guided && saved.guidedEventId) {
          guidedPosition()?.setEventId?.(saved.guidedEventId);
        }

        const ft = document.querySelector('.pg-shot-unified-ft select');
        if (ft && (saved.freeThrowTeam === 'us' || saved.freeThrowTeam === 'opponent')) {
          ft.value = saved.freeThrowTeam;
        }
      }
    } finally {
      restoring = false;
      ready = true;
    }
    // If the user has no preferences yet, establish the initial selection once.
    if (!saved) save();
  }

  window.apexShotPreferences = {
    hasSavedMode: () => typeof saved?.guided === 'boolean',
    save,
    restore
  };

  // postgame-guided.js emits this once its asynchronous shot queue has loaded.
  window.addEventListener('apex:guided-ready', restore, { once: true });
  window.addEventListener('apex:court-view-updated', scheduleSave);
  window.addEventListener('apex:guided-shot-selected', scheduleSave);
  document.addEventListener('change', e => {
    if (e.target?.matches?.('#post-period, .pg-shot-unified-ft select')) scheduleSave();
  });
  document.addEventListener('click', e => {
    if (e.target?.closest?.('#pg-guided-free, #pg-guided-enable, #pg-court-full, #pg-court-half, #pg-half-toggle, #pg-guided-previous, #pg-guided-next, #pg-guided-skip')) scheduleSave();
  });
  window.addEventListener('pagehide', save);
})();
