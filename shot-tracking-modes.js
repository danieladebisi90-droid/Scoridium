/* ApexVision Shot Tracking: one interface, two existing workflows.
   UI only: forwards to postgame-guided.js handlers. Does not create events. */
(() => {
  'use strict';
  if (window.apexPostgame?.mode !== 'shot') return;
  const byId = (id) => document.getElementById(id);
  const free = byId('pg-guided-free');
  const guided = byId('pg-guided-enable');
  const section = byId('post-shot-section');
  if (!free || !guided || !section) return;
  if (byId('av-shot-mode-switch')) return;

  const bar = document.createElement('div');
  bar.id = 'av-shot-mode-switch';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Shot tracking mode');
  bar.innerHTML = '<button type="button" data-mode="free">Free Tracking</button>' +
                  '<button type="button" data-mode="guided">Guided Tracking</button>';
  section.prepend(bar);

  function sync() {
    const isGuided = document.body.classList.contains('pg-guided-on');
    document.body.classList.toggle('av-shot-free', !isGuided);
    document.body.classList.toggle('av-shot-guided', isGuided);
    for (const button of bar.querySelectorAll('button')) {
      button.setAttribute('aria-pressed', String((button.dataset.mode === 'guided') === isGuided));
    }
    const status = byId('pg-shot-unified-status');
    if (status) status.textContent = isGuided ? 'Select a recorded play, then tap its shot location' : 'Free Tracking · Record a shot or free throw';
  }
  bar.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-mode]');
    if (!button) return;
    const target = button.dataset.mode === 'guided' ? guided : free;
    target.click();  // Let the existing guided controller enforce busy-state safety.
    requestAnimationFrame(sync);
  });

  const observer = new MutationObserver(sync);
  observer.observe(document.body, {attributes: true, attributeFilter: ['class']});
  observer.observe(free, {attributes: true, attributeFilter: ['aria-pressed']});
  observer.observe(guided, {attributes: true, attributeFilter: ['aria-pressed']});
  window.addEventListener('apex:postgame-ready', sync);
  window.addEventListener('apex:guided-shot-selected', sync);
  sync();
})();
