/* Film Room mobile v8: one shared, single-screen tracking structure.
   Reparents existing controls without cloning listeners or source components. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const body=document.body,screen=$('postgame-screen'),toolbar=screen?.querySelector('.pg-review-toolbar');
if(!screen||!toolbar)return;
const mode=new URLSearchParams(location.search).get('mode');
const mobile=window.matchMedia('(max-width:700px) and (orientation:portrait)');
const more=$('pg-mobile-more'),drawer=$('pg-mobile-extra');
const reviewTools=toolbar.querySelector('.pg-review-tools'),steps=screen.querySelector('.pg-floating-steps');
const shotSection=$('post-shot-section'),workspace=shotSection?.querySelector('.pg-shot-workspace');
const side=shotSection?.querySelector('.pg-shot-sidebar'),courtArea=shotSection?.querySelector('.pg-shot-court-area');
const courtWrap=shotSection?.querySelector('.postgame-court-workspace'),court=$('postgame-court'),quick=$('post-quick-root');
const buttons=reviewTools?[...reviewTools.children]:[];
const original=new Map(),mobileNodes=[];
const remember=el=>{if(el&&!original.has(el)){const mark=document.createComment('original position '+(el.id||el.className||''));el.parentNode?.insertBefore(mark,el);original.set(el,mark);}return el;};
const move=(el,parent)=>{if(el&&parent){remember(el);parent.appendChild(el);}};
function restore(){
 for(const [el,mark] of original){if(mark.parentNode)mark.after(el);mark.remove();}
 original.clear();
 for(const x of mobileNodes)x.remove();mobileNodes.length=0;
 drawer.hidden=true;more.setAttribute('aria-expanded','false');more.textContent='More';
 body.classList.remove('pg-mobile-v8','pg-v8-stat-panel','pg-v8-inserting');
 if(court) court.style.removeProperty('min-height');
}
function make(tag,cls,textValue){const el=document.createElement(tag);el.className=cls;if(textValue)el.textContent=textValue;mobileNodes.push(el);return el;}
let dock=null,info=null,stage=null,statClose=null,statTrigger=null,modeBar=null;
function showStats(open){
 if(mode!=='combined'||!mobile.matches)return;
 body.classList.toggle('pg-v8-stat-panel',open);
 if(statTrigger)statTrigger.setAttribute('aria-expanded',String(open));
 if(statClose)statClose.hidden=!open;
}
function openMore(open){
 if(!mobile.matches)return;
 drawer.hidden=!open;more.setAttribute('aria-expanded',String(open));more.textContent=open?'Close':'More';
}
function updateLastShot(){
 if(!mobile.matches||!info||mode==='stat')return;
 const guided=$('pg-guided-enable')?.getAttribute('aria-pressed')==='true';
 if(mode==='shot'&&guided){
  const hint=$('pg-guided-hint');
  info.hidden=false;
  if(hint)info.replaceChildren(hint);
  return;
 }
 info.hidden=false;
 const events=window.apexPostgame?.getEvents?.()||[];
 const period=window.apexPostgame?.getPeriod?.();
 const shots=events.filter(e=>e.type==='shot'&&Number(e.period)===Number(period));
 const last=shots.at(-1);
 const team=last?.team==='us'?(window.apexPostgame?.getGame?.()?.team_name||'Tracked team'):(window.apexPostgame?.getGame?.()?.opponent||'Opponent');
 const text=mode==='combined'?'Stat & Shot Tracking':last?(team+' · '+(last.made?'Made ':'Missed ')+last.points+'PT'):'No shots recorded in this quarter';
 let target=info.querySelector('.pg-v8-last');
 if(!target){target=make('div','pg-v8-last');info.appendChild(target);}
 target.textContent=text;
}
function layout(){
 if(!mobile.matches){
  if(body.classList.contains('pg-mobile-v8'))restore();
  return;
 }
 if(body.classList.contains('pg-mobile-v8'))return;
 body.classList.add('pg-mobile-v8');
 // Review controls: original elements and event listeners remain attached.
 const bar=make('div','pg-v8-review-bar');
 toolbar.after(bar);
 move(toolbar.querySelector('.postgame-controls'),bar);
 move(steps,bar);
 move(more,bar);
 for(const item of buttons)move(item,drawer);
 drawer.hidden=true;more.textContent='More';more.setAttribute('aria-expanded','false');
 // Stat room retains the existing player and opponent Quick Tracker panels.
 if(mode==='stat')return;
 if(!workspace||!courtArea||!side||!courtWrap)return;
 stage=make('div','pg-v8-stage');
 workspace.prepend(stage);
 info=make('div','pg-v8-shot-info');
 stage.appendChild(info);
 move(courtArea,stage);
 dock=make('div','pg-v8-bottom');
 stage.appendChild(dock);
 // Existing guided/free mode buttons are frequent-use controls.
 if(mode==='shot'){
  modeBar=make('div','pg-v8-mode-bar');
  move(side.querySelector('.pg-guided-options'),modeBar);
  dock.appendChild(modeBar);
  const nav=side.querySelector('.pg-guided-navigation');
  move(nav,dock);
  const add=side.querySelector('.pg-insert-actions');
  move(add,dock);
  // The original add-shot form floats over the court; no second form.
  move($('pg-add-shot-form'),courtWrap);
  move(side.querySelector('.pg-court-modes'),drawer);
  move($('pg-guided-status'),drawer);
  move($('pg-shot-sequence'),drawer);
  move($('pg-guided-hint'),info);
  // Force the existing, precise FIBA half-court view by invoking its original control.
  $('pg-court-half')?.click();
 }else if(mode==='combined'){
  // The original Quick Tracker, including both teams and stat workflows,
  // remains mounted and becomes a contextual overlay on the court.
  move(quick,courtWrap);
  statTrigger=make('button','pg-v8-stat-trigger','Stat Tracker');
  statTrigger.type='button';statTrigger.setAttribute('aria-expanded','false');
  dock.appendChild(statTrigger);
  statClose=make('button','pg-v8-stat-close','Close stats');
  statClose.type='button';statClose.hidden=true;
  courtWrap.appendChild(statClose);
  statTrigger.addEventListener('click',()=>showStats(!body.classList.contains('pg-v8-stat-panel')));
  statClose.addEventListener('click',()=>showStats(false));
  // The existing full/half controls stay in More. Combined shares the court.
  move(side.querySelector('.pg-court-modes'),drawer);
  move($('pg-guided-hint'),info);
  $('pg-court-half')?.click();
  showStats(false);
 }
 updateLastShot();
}
more?.addEventListener('click',()=>openMore(drawer.hidden));
drawer?.addEventListener('click',e=>{if(e.target.closest('button'))openMore(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){openMore(false);if(mode==='combined')showStats(false);}});
document.addEventListener('click',e=>{if(!mobile.matches||drawer.hidden)return;if(!drawer.contains(e.target)&&e.target!==more)openMore(false);});
mobile.addEventListener('change',layout);
window.addEventListener('apex:postgame-ready',()=>{layout();updateLastShot();});
window.addEventListener('apex:postgame-events-updated',updateLastShot);
window.addEventListener('apex:shot-review-saved',()=>{queueMicrotask(updateLastShot);});
window.addEventListener('apex:guided-shot-selected',()=>queueMicrotask(updateLastShot));
$('post-period')?.addEventListener('change',()=>queueMicrotask(updateLastShot));
$('pg-guided-free')?.addEventListener('click',()=>queueMicrotask(updateLastShot));
$('pg-guided-enable')?.addEventListener('click',()=>queueMicrotask(updateLastShot));
if(mode==='combined'){
 // Court-first selection: open the original controls on the court.
 window.addEventListener('apex:postgame-court-shot',()=>{if(mobile.matches)showStats(true);});
 // Stat-first selection requests the next location from the same FIBA court.
 const observer=new MutationObserver(()=>{
  if(mobile.matches&&body.classList.contains('pg-awaiting-location')&&body.classList.contains('pg-v8-stat-panel'))showStats(false);
 });
 observer.observe(body,{attributes:true,attributeFilter:['class']});
}
if(mode==='shot'){
 window.addEventListener('apex:insert-shot-focus',()=>body.classList.add('pg-v8-inserting'));
 window.addEventListener('apex:insert-shot-cancelled',()=>body.classList.remove('pg-v8-inserting'));
 window.addEventListener('apex:shot-review-saved',()=>body.classList.remove('pg-v8-inserting'));
 window.addEventListener('apex:pending-shot-added',()=>body.classList.remove('pg-v8-inserting'));
}
// The layout isn't tied to data arrival; draw it immediately, and refresh on ready.
layout();
})();