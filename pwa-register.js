/* Scoridium PWA: check for updates, never force reload during gameplay. */
(() => {
  if (window !== window.top || !('serviceWorker' in navigator)) return;
  let registration, banner;
  function showUpdate() {
    if (!registration?.waiting || banner || location.pathname.endsWith('/game.html')) return;
    banner=document.createElement('div');
    banner.setAttribute('role','status');
    banner.style.cssText='position:fixed;bottom:75px;left:12px;right:12px;max-width:420px;margin:auto;background:#10233f;color:white;border-radius:10px;padding:12px;z-index:999999;font:14px system-ui;display:flex;align-items:center;gap:10px;box-shadow:0 6px 20px #0004';
    const label=document.createElement('span');label.textContent='Scoridium update available';label.style.flex='1';
    const button=document.createElement('button');button.textContent='Update';button.style.cssText='background:#ffd600;color:#111;border:0;border-radius:7px;padding:9px 12px;font-weight:bold';
    button.addEventListener('click',()=>{registration.waiting?.postMessage({type:'SKIP_WAITING'});});
    const later=document.createElement('button');later.textContent='Later';later.style.cssText='background:transparent;border:0;color:white;padding:9px';later.addEventListener('click',()=>{banner.remove();banner=null;});
    banner.append(label,button,later);document.body.appendChild(banner);
  }
  let refreshOnController=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshOnController) location.reload();});
  window.addEventListener('load',async()=>{
    try {
      registration=await navigator.serviceWorker.register('./service-worker.js',{scope:'./',updateViaCache:'none'});
      if(registration.waiting) showUpdate();
      registration.addEventListener('updatefound',()=>{const w=registration.installing;w?.addEventListener('statechange',()=>{if(w.state==='installed' && navigator.serviceWorker.controller) showUpdate();});});
      const check=()=>{if(document.visibilityState==='visible') registration.update().catch(console.warn);};
      window.addEventListener('focus',check); document.addEventListener('visibilitychange',check);
      // Controller changes only refresh after explicit acceptance (no surprise game interruption).
      document.addEventListener('click',e=>{if(e.target===banner?.querySelector('button')) refreshOnController=true;},true);
      check();
    } catch(err) {console.warn('PWA update check unavailable',err);}
  });
})();
