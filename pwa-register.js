/* Register only at top level so iframe pages do not compete to install. */
(() => {
  if (window !== window.top) return;
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', {scope:'./'})
      .catch(err => console.warn('Scoridium app registration unavailable:', err));
  });
})();
