/* Scoridium mobile landscape tracker V1.
   Reuses the ORIGINAL controls and their event listeners; no extra writes or new tracker state.
   Mobile layout is isolated behind media query and device capability checks. */
(() => {
  'use strict';
  const media = window.matchMedia('(orientation: landscape) and (max-height: 650px)');
  const $ = id => document.getElementById(id);
  const shell = document.querySelector('.tracker-shell');
  if (!shell) return;

  // Store original locations to restore desktop DOM if the device rotates or resizes.
  const regions = [
    ['tracker-controls', 'court'],
    ['game-info-panel', 'events'],
    ['game-controls', 'events'],
  ];
  const original = new Map();
  const mobile = document.createElement('section');
  mobile.id = 'mobile-tracker';
  mobile.setAttribute('aria-label','Mobile game tracking');
  mobile.innerHTML = `
    <nav class="mobile-tracker-tabs" aria-label="Tracker view">
      <button type="button" data-mobile-view="court" aria-pressed="true" aria-label="Court view" title="Court"></button>
      <button type="button" data-mobile-view="stats" aria-pressed="false" aria-label="Stats view" title="Stats"></button>
      <button type="button" data-mobile-view="events" aria-pressed="false" aria-label="Events view" title="Events"></button>
    </nav>
    <div class="mobile-tracker-content">
      <div class="mobile-tracker-view" data-mobile-panel="court"></div>
      <div class="mobile-tracker-view" data-mobile-panel="stats" hidden></div>
      <div class="mobile-tracker-view" data-mobile-panel="events" hidden></div>
    </div>
    <footer class="mobile-player-dock" aria-label="Player selection">
      <div class="mobile-player-caption"><strong>SELECT PLAYER</strong><span>Swipe for more players</span></div>
      <div id="mobile-player-slot"></div>
    </footer>`;
  const scoreboard = $('home-score')?.closest('.scoreboard');
  (scoreboard || shell.querySelector('.scoreboard'))?.after(mobile);
  const playerPanel = document.querySelector('.player-panel');
  const statPanel = document.querySelector('.stats-panel');
  const nodes = [
    ...regions.map(([id, view])=>[$(id),view]),
    [statPanel,'stats'],
    [playerPanel,'dock'],
  ].filter(([node])=>node);
  for(const [node] of nodes){
    const marker=document.createComment('Original location of '+(node.id||node.className));
    node.parentNode.insertBefore(marker,node);
    original.set(node,marker);
  }
  let active = false;
  let view = 'court';
  const buttons = [...mobile.querySelectorAll('[data-mobile-view]')];
  const panels = [...mobile.querySelectorAll('[data-mobile-panel]')];
  function showView(next){
    if(!['court','stats','events'].includes(next))return;
    view=next;
    for(const btn of buttons){const selected=btn.dataset.mobileView===next;btn.setAttribute('aria-pressed',String(selected));btn.classList.toggle('active',selected)}
    for(const panel of panels)panel.hidden=panel.dataset.mobilePanel!==next;
  }
  buttons.forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.mobileView)));
  function setMobile(enabled){
    if(active===enabled)return;
    active=enabled;
    if(enabled){
      for(const [node,destination] of nodes){
        const holder=destination==='dock' ? mobile.querySelector('#mobile-player-slot') : mobile.querySelector(`[data-mobile-panel="${destination}"]`);
        holder.appendChild(node);
      }
      document.documentElement.classList.add('mobile-tracker-active');
      showView(view);
    } else {
      document.documentElement.classList.remove('mobile-tracker-active');
      for(const [node] of nodes){original.get(node).after(node)}
    }
  }
  const sync = ()=>setMobile(media.matches);
  media.addEventListener?.('change',sync);
  sync();
  // Swipe between views. On the court, only swipes starting at the
  // left/right edge switch views, preventing accidental shot entries.
  const content = mobile.querySelector('.mobile-tracker-content');
  const order=['court','stats','events'];
  let touchStart=null;
  content.addEventListener('touchstart', event => {
    if(event.touches.length!==1) return;
    const t=event.touches[0];
    const bounds=content.getBoundingClientRect();
    const isEdge=t.clientX<bounds.left+42 || t.clientX>bounds.right-42;
    if(view==='court' && !isEdge){touchStart=null;return;}
    touchStart={x:t.clientX,y:t.clientY};
  },{passive:true});
  content.addEventListener('touchend', event => {
    if(!touchStart || !event.changedTouches.length)return;
    const t=event.changedTouches[0];
    const dx=t.clientX-touchStart.x, dy=t.clientY-touchStart.y;
    touchStart=null;
    if(Math.abs(dx)<55 || Math.abs(dx)<Math.abs(dy)*1.4)return;
    const idx=order.indexOf(view);
    showView(order[Math.max(0,Math.min(order.length-1,idx+(dx<0?1:-1)))]);
  },{passive:true});
})();
