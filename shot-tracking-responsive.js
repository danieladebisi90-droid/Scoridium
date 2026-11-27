/* Wider screens use the phone's court-first structure, without duplicating the court or input handlers. */
(()=>{
 'use strict';
 const api=window.apexPostgame;
 if(!api||api.mode!=='shot')return;
 const $=id=>document.getElementById(id);
 const wide=matchMedia('(min-width:701px), (orientation:landscape)');
 const screen=$('postgame-screen');
 const workspace=document.querySelector('#post-shot-section .pg-shot-workspace');
 const courtArea=workspace?.querySelector('.pg-shot-court-area');
 const sidebar=workspace?.querySelector('.pg-shot-sidebar');
 const toolbar=screen?.querySelector('.pg-review-toolbar');
 const more=$('pg-mobile-more'), drawer=$('pg-mobile-extra');
 if(!workspace||!courtArea||!sidebar||!toolbar||!more||!drawer)return;
 const origins=new Map();let stage=null, info=null, dock=null,ft=null,installed=false;
 const wideColumns=matchMedia('(min-width: 980px) and (min-aspect-ratio: 11/10) and (min-height: 550px)');
 let stageObserver=null;
 const move=(el,parent)=>{
   if(!el||!parent)return;
   if(!origins.has(el)){const marker=document.createComment('Shot Tracking original location');el.before(marker);origins.set(el,marker);}
   parent.append(el);
 };
 const view=()=>window.apexFilmCourtView;
 const canFull=()=>{
   const rect=workspace.getBoundingClientRect();
   return rect.width>=850 && window.innerWidth>=850;
 };
 // Size the court first; the action dock receives all unused width.
 
function sizeWideColumns() {
  if (!stage || !installed) return;

  if (!wideColumns.matches) {
    stage.style.removeProperty('--av-court-column');
    return;
  }

  const width = stage.clientWidth;
  const height = stage.clientHeight;

  // Only reserve space for a visible full-width banner.
  const infoVisible = info &&
    getComputedStyle(info).display !== 'none';

  const headerHeight = infoVisible
    ? info.getBoundingClientRect().height
    : 0;

  const gap = Math.max(8, Math.min(16, width * 0.01));

  // Preserve enough room for usable controls.
  const minDock = Math.max(
    205,
    Math.min(250, width * 0.21)
  );

  const availableHeight = Math.max(
    0,
    height - headerHeight - (infoVisible ? gap : 0)
  );

  // Actual FIBA court proportions.
  const ratio = view()?.isHalf?.()
    ? 420 / 450
    : 860 / 470;

  // Give the court the largest width that fits.
  const courtWidth = Math.max(
    0,
    Math.min(
      availableHeight * ratio,
      width - minDock - gap
    )
  );

  stage.style.setProperty(
    '--av-court-column',
    Math.floor(courtWidth) + 'px'
  );
}

 function refreshView(){
   if(!installed)return;
   const full=$('pg-court-full'),half=$('pg-court-half');
   if(full){full.hidden=!canFull();full.disabled=!canFull();}
   if(half)half.hidden=false;
   sizeWideColumns();
   const hint=$('pg-guided-hint');
   if(info){const status=info.querySelector('#pg-shot-unified-status');
     if(status)status.hidden=Boolean(hint?.textContent?.trim())&&hint?.hidden!==true;}
 }
 function restore(){
   if(!installed)return;
   for(const [el,marker] of origins){if(marker.parentNode)marker.replaceWith(el);else marker.remove();}
   origins.clear();stageObserver?.disconnect();stageObserver=null;stage?.remove();sidebar.hidden=false;
   document.body.classList.remove('pg-shot-unified');
   installed=false;stage=info=dock=ft=null;
 }
 function makeFt(){
   const row=document.createElement('div');row.className='pg-shot-unified-ft';
   row.innerHTML='<select aria-label="Free throw team"><option value="us">Tracked</option><option value="opponent">Opponent</option></select><button class="pg-shot-ft-make" type="button">FT Made</button><button class="pg-shot-ft-miss" type="button">FT Miss</button>';
   const save=async(made)=>{
     if(row.dataset.busy==='1'||window.apexCourtReview?.isBusy?.())return;
     const team=row.querySelector('select').value;
     const period=api.getPeriod();
     const prior=api.getEvents().filter(e=>e.type==='free_throw'&&e.team===team&&Number(e.period)===Number(period));
     if(!confirm('Record an ADDITIONAL '+(made?'MADE':'MISSED')+' free throw for '+(team==='us'?'tracked team':'opponent')+' in Q'+period+'? Do not duplicate existing attempts.'))return;
     if(prior.length&&!confirm(prior.length+' free throws already exist for this team in this quarter. Add one more?'))return;
     row.dataset.busy='1';row.querySelectorAll('button').forEach(b=>b.disabled=true);
     try{
       const result=await api.saveEvent({type:'free_throw',team,playerId:null,points:1,made},$('post-review-save-anchor'));
       if(result){await api.refresh();document.dispatchEvent(new CustomEvent('apex:postgame-events-updated'));}
     }catch(e){api.notify?.('Unable to save free throw: '+e.message);}
     finally{row.dataset.busy='0';row.querySelectorAll('button').forEach(b=>b.disabled=false);}
   };
   row.querySelector('.pg-shot-ft-make').addEventListener('click',()=>save(true));
   row.querySelector('.pg-shot-ft-miss').addEventListener('click',()=>save(false));
   window.addEventListener('apex:guided-shot-selected',e=>{if(e.detail?.team)row.querySelector('select').value=e.detail.team;});
   return row;
 }
 function install(){
   if(installed||!wide.matches||screen.hidden)return;
   const courtWrap=courtArea.querySelector('.postgame-court-workspace');
   if(!courtWrap)return;
   installed=true;
   document.body.classList.add('pg-shot-unified');
   stage=document.createElement('div');stage.className='pg-shot-unified-stage';workspace.prepend(stage);
   info=document.createElement('div');info.className='pg-shot-unified-info';stage.append(info);
   const status=document.createElement('span');status.id='pg-shot-unified-status';status.textContent='Tap the court to place a shot';info.append(status);
   move($('pg-guided-hint'),info);
   move(courtArea,stage);
   dock=document.createElement('div');dock.className='pg-shot-unified-dock';stage.append(dock);
   move(sidebar.querySelector('.pg-guided-navigation'),dock);
   move(sidebar.querySelector('.pg-insert-actions'),dock);
   ft=makeFt();dock.append(ft);
   move(sidebar.querySelector('.pg-court-modes'),drawer);
   move(sidebar.querySelector('.pg-guided-options'),drawer);
   move($('pg-guided-status'),drawer);
   move($('pg-shot-sequence'),drawer);
   move(sidebar.querySelector('#pg-add-shot-form'),courtWrap);
   move($('pg-half-toggle'),dock);
   move(screen.querySelector('.pg-floating-steps'),toolbar);
   move(more,toolbar);
   move(drawer,toolbar);
   for(const el of Array.from(toolbar.querySelectorAll('.pg-review-tools > button')))move(el,drawer);
   drawer.hidden=true;more.setAttribute('aria-expanded','false');more.textContent='More';
   sidebar.hidden=true;
   stageObserver=new ResizeObserver(sizeWideColumns);stageObserver.observe(stage);
   refreshView();
 }
 function layout(){if(wide.matches){install();refreshView();}else restore();}
 more.addEventListener('click',()=>{if(!installed)return;drawer.hidden=!drawer.hidden;more.textContent=drawer.hidden?'More':'Close';more.setAttribute('aria-expanded',String(!drawer.hidden));});
 drawer.addEventListener('click',e=>{if(installed&&e.target.closest('button')){drawer.hidden=true;more.textContent='More';more.setAttribute('aria-expanded','false');}});
 let layoutFrame = 0;

function scheduleLayout() {
  cancelAnimationFrame(layoutFrame);

  layoutFrame = requestAnimationFrame(() => {
    layout();
    sizeWideColumns();
  });
}

window.addEventListener('resize', scheduleLayout);
 wideColumns.addEventListener('change',sizeWideColumns);
 wide.addEventListener('change', () => {
  if (!wide.matches) {
    restore();
  } else {
    scheduleLayout();
  }
});
 window.addEventListener('apex:postgame-ready',layout);
 window.addEventListener('apex:court-view-updated',refreshView);
 layout();
})();


/* Move Guided banner into the right controls panel
   on wide landscape screens. */

(() => {
  const query = window.matchMedia(
    '(min-width: 980px) and (orientation: landscape)'
  );

  function placeGuidedBanner() {
    const banner = document.getElementById('pg-guided-hint');
    const dock = document.querySelector('.pg-shot-unified-dock');

    if (!banner || !dock) return;

    if (!banner.dataset.originalPositionSaved) {
      const placeholder = document.createComment('Guided banner position');
      banner.parentNode.insertBefore(placeholder, banner);
      banner._originalPlaceholder = placeholder;
      banner.dataset.originalPositionSaved = 'true';
    }

    if (query.matches) {
      dock.prepend(banner);
      banner.classList.add('pg-guided-hint-docked');
    } else {
      const placeholder = banner._originalPlaceholder;
      if (placeholder?.parentNode) {
        placeholder.parentNode.insertBefore(banner, placeholder);
      }
      banner.classList.remove('pg-guided-hint-docked');
    }
  }

  window.addEventListener('resize', placeGuidedBanner);
  window.addEventListener('apex:postgame-ready', placeGuidedBanner);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', placeGuidedBanner);
  } else {
    placeGuidedBanner();
  }
})();
