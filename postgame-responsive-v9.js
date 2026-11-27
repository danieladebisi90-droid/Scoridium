/* Film Room v9 — phone/tablet court gestures and orientation layout.
   No new shot coordinates or stat controls: existing SVG & Quick Track remain authoritative. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const court=$('postgame-court'),api=window.apexPostgame;
if(!court||!api||api.mode==='stat')return;
const compact=window.matchMedia('(orientation: portrait) and (max-width: 1100px)');
const ipad=window.matchMedia('(orientation: portrait) and (min-width: 701px) and (max-width: 1100px)');
const area=document.querySelector('.pg-shot-court-area');
const wrap=document.querySelector('.postgame-court-workspace');
const original=document.createComment('Original iPad court view control');
let picker=null,pickerParent=null,active=null;
function deviceSetup(){
 if(ipad.matches&&api.mode==='combined'){
  const group=$('pg-court-full')?.closest('.pg-court-modes');
  if(group&&area&&!picker){
   picker=group;pickerParent=group.parentNode;
   pickerParent.insertBefore(original,picker);
   area.insertBefore(picker,wrap||area.firstChild);
  }
 }else if(picker){
  if(original.parentNode)original.replaceWith(picker);
  else pickerParent?.appendChild(picker);
  picker=null;
 }
}
function labels(){
 const current=$('pg-court-team-label');
 if(!current)return;
 const ctl=window.apexFilmCourtView;
 const g=api.getGame?.()||{};
 const name=ctl?.currentTeam?.()==='opponent'?(g.opponent||'Opponent'):(g.team_name||'Tracked Team');
 current.textContent=ctl?.isHalf?.()?name+' OFFENSE':'FULL COURT';
}
function courtSwipable(){
 return compact.matches&&window.apexFilmCourtView?.isHalf?.()&&
 !window.apexCourtReview?.isBusy?.()&&
 !(window.apexPostgameQuick?.hasPending?.());
}
function start(e){
 if(!courtSwipable()||!e.isPrimary)return;
 active={id:e.pointerId,x:e.clientX,y:e.clientY};
}
function finish(e){
 if(!active||e.pointerId!==active.id)return;
 const dx=e.clientX-active.x,dy=e.clientY-active.y;
 active=null;
 if(Math.abs(dx)<52||Math.abs(dx)<Math.abs(dy)*1.35)return;
 if(!courtSwipable())return;
 const ctl=window.apexFilmCourtView;
 const selected=ctl.currentTeam();
 const filter=document.getElementById('av-cn-shot-filter')?.value;
 const selectedQuarter=filter&&filter!=='all'?Number(filter):Number(api.getPeriod?.()||1);
 const currentIsTrackedLeft=(selectedQuarter<=2)!==
  Boolean(document.getElementById('post-switch-direction')?.getAttribute('aria-pressed')==='true');
 const currentLeft=selected==='us'?currentIsTrackedLeft:!currentIsTrackedLeft;
 // Swipe left to reveal the physical right half; swipe right to reveal the left.
 const towardsOther=currentLeft?dx<0:dx>0;
 if(!towardsOther)return;
 window.__apexCourtSwipeUntil=Date.now()+500;
 ctl.swipeTo(selected==='us'?'opponent':'us');
}
court.addEventListener('pointerdown',start,{passive:true});
court.addEventListener('pointerup',finish,{passive:true});
court.addEventListener('pointercancel',()=>{active=null;},{passive:true});
court.addEventListener('click',e=>{if(Date.now()<(window.__apexCourtSwipeUntil||0)){e.preventDefault();e.stopImmediatePropagation();}},true);
ipad.addEventListener('change',deviceSetup);
window.addEventListener('apex:postgame-ready',()=>{deviceSetup();labels();});
window.addEventListener('apex:court-view-updated',labels);
window.addEventListener('apex:review-direction-changed',labels);
$('post-period')?.addEventListener('change',()=>queueMicrotask(labels));
deviceSetup();
// iPad portrait: one shared quarter / Next Quarter / Finish Review / More bar,
// using the original buttons (not clones) so all action listeners remain intact.
const screen=$('postgame-screen');
const toolbar=screen?.querySelector('.pg-review-toolbar');
const steps=screen?.querySelector('.pg-floating-steps');
const more=$('pg-mobile-more'),drawer=$('pg-mobile-extra');
const actions=toolbar?.querySelector('.pg-review-tools');
const moved=new Map();
let ipadToolbarActive=false;
function insertWithMarker(el,parent){
 if(!el||!parent||moved.has(el))return;
 const marker=document.createComment('restore original review action');
 el.parentNode?.insertBefore(marker,el);
 moved.set(el,marker);
 parent.appendChild(el);
}
function resetIpadToolbar(){
 if(!ipadToolbarActive)return;
 for(const [el,marker] of moved){
  if(marker.parentNode)marker.replaceWith(el);
  else marker.remove();
 }
 moved.clear();ipadToolbarActive=false;
 if(drawer)drawer.hidden=true;
 if(more){more.textContent='More';more.setAttribute('aria-expanded','false');}
}
function updateIpadToolbar(){
 if(!toolbar||!steps||!actions||!more||!drawer)return;
 if(!ipad.matches){resetIpadToolbar();return;}
 if(ipadToolbarActive)return;
 ipadToolbarActive=true;
 insertWithMarker(steps,toolbar);
 insertWithMarker(more,toolbar);
 for(const child of Array.from(actions.children))insertWithMarker(child,drawer);
 drawer.hidden=true;
 more.textContent='More';more.setAttribute('aria-expanded','false');
}
more?.addEventListener('click',()=>{
 if(!ipad.matches)return;
 const open=drawer.hidden;
 drawer.hidden=!open;more.textContent=open?'Close':'More';
 more.setAttribute('aria-expanded',String(open));
});
drawer?.addEventListener('click',e=>{
 if(!ipad.matches||!e.target.closest('button'))return;
 drawer.hidden=true;more.textContent='More';more.setAttribute('aria-expanded','false');
});
document.addEventListener('click',e=>{
 if(!ipad.matches||drawer.hidden||drawer.contains(e.target)||e.target===more)return;
 drawer.hidden=true;more.textContent='More';more.setAttribute('aria-expanded','false');
});
ipad.addEventListener('change',updateIpadToolbar);
window.addEventListener('apex:postgame-ready',updateIpadToolbar);
updateIpadToolbar();
})();
