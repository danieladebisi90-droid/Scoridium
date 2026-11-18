/* Film Room phone v7: compact tools and single-screen responsive tracking.
   Moves original buttons: no cloned controls, no duplicate event handlers. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const screen=$('postgame-screen'),more=$('pg-mobile-more'),drawer=$('pg-mobile-extra');
const toolbar=screen?.querySelector('.pg-review-toolbar'),toolGroup=toolbar?.querySelector('.pg-review-tools');
const combined=location.search.includes('mode=combined');
if(!screen||!more||!drawer||!toolGroup||!toolbar)return;
const media=window.matchMedia('(max-width:700px) and (orientation:portrait)');
let toolsMoved=false;
const toolButtons=Array.from(toolGroup.children);
const closeDrawer=()=>{drawer.hidden=true;more.setAttribute('aria-expanded','false');more.textContent='More tools'};
function layout(){
 if(media.matches){
  if(more.parentElement!==toolbar)toolbar.appendChild(more);
  if(!toolsMoved){for(const child of toolButtons)drawer.appendChild(child);toolsMoved=true;}
  if(combined&&!document.body.classList.contains('pg-mobile-stats'))document.body.classList.add('pg-mobile-court');
 }else{
  closeDrawer();
  if(more.parentElement!==screen)screen.insertBefore(more,screen.firstChild);
  if(toolsMoved){for(const child of toolButtons)toolGroup.appendChild(child);toolsMoved=false;}
  document.body.classList.remove('pg-mobile-court','pg-mobile-stats');
 }
}
more.addEventListener('click',()=>{
 const open=drawer.hidden;
 drawer.hidden=!open;more.setAttribute('aria-expanded',String(open));more.textContent=open?'Close tools':'More tools';
});
drawer.addEventListener('click',e=>{if(e.target.closest('button'))closeDrawer();});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrawer();});
document.addEventListener('click',e=>{if(!drawer.hidden&&!drawer.contains(e.target)&&e.target!==more)closeDrawer();});
media.addEventListener('change',layout);
layout();
const court=$('pg-mobile-court-tab'),stats=$('pg-mobile-stats-tab');
function setCombinedView(which){
 if(!combined)return;
 document.body.classList.toggle('pg-mobile-court',which==='court');
 document.body.classList.toggle('pg-mobile-stats',which==='stats');
 court?.setAttribute('aria-pressed',String(which==='court'));
 stats?.setAttribute('aria-pressed',String(which==='stats'));
}
court?.addEventListener('click',()=>setCombinedView('court'));
stats?.addEventListener('click',()=>setCombinedView('stats'));
if(combined){
 // Court-first shot: show original jersey/stat controls after the court tap.
 window.addEventListener('apex:postgame-court-shot',()=>{if(media.matches)setCombinedView('stats');});
 // Stat-first shot: location is now required; show the original FIBA court.
 const observer=new MutationObserver(()=>{
  if(media.matches&&document.body.classList.contains('pg-awaiting-location')&&!document.body.classList.contains('pg-mobile-court'))setCombinedView('court');
 });
 observer.observe(document.body,{attributes:true,attributeFilter:['class']});
}
})();