/* Focused game tracking navigation. No changes to event writes or Supabase sync. */
(() => {
  'use strict';
  const shell=document.querySelector('.tracker-shell');
  const scoreboard=shell?.querySelector('.scoreboard');
  const quick=document.getElementById('quick-track-panel');
  const info=document.getElementById('game-info-panel');
  if(!shell||!scoreboard||!quick||!info)return;
  document.documentElement.classList.add('focus-tracker');
  const nav=document.createElement('nav');
  nav.className='focus-nav';
  nav.setAttribute('aria-label','Game tracking views');
  nav.innerHTML=`<a class="focus-hub" href="gamehub.html">← Game Hub</a>
    <div class="focus-tabs" role="group" aria-label="Tracker screen">
      <button type="button" data-focus-view="track" class="active" aria-pressed="true">Track</button>
      <button type="button" data-focus-view="review" aria-pressed="false">Play-by-play <span id="focus-unassigned-count"></span></button>
      <button type="button" data-focus-view="court" aria-pressed="false">Court</button>
    </div>`;
  shell.before(nav);
  const stage=document.createElement('div');
  stage.className='focus-stage';
  stage.innerHTML=`<section class="focus-track" aria-label="Quick game tracking">
        <div class="focus-quick-slot"></div>
        <div class="focus-game-actions">
          <button type="button" data-original="start-game">Start / Resume</button>
          <button type="button" data-original="end-quarter">End Quarter</button>
          <button type="button" data-original="end-game">End Game</button>
        </div>
      </section>
      <section class="focus-review" aria-label="Game events and statistics">
        <div class="focus-info-slot"></div>
      </section>`;
  scoreboard.after(stage);
  stage.querySelector('.focus-quick-slot').appendChild(quick);
  stage.querySelector('.focus-info-slot').appendChild(info);
  // Existing tab handlers keep the box score, play-by-play and unassigned tools working.
  const buttons=[...nav.querySelectorAll('[data-focus-view]')];
  let view='track';
  function show(next){
    view=next;
    shell.dataset.focusView=next;
    buttons.forEach(b=>{const active=b.dataset.focusView===next;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    if(next==='review'){
      const plays=document.querySelector('[data-info-tab="plays"]');
      if(plays && !info.querySelector('.game-info-tabs .active'))plays.click();
    }
  }
  buttons.forEach(b=>b.addEventListener('click',()=>show(b.dataset.focusView)));
  // Shared, viewport-independent tip-off dialog. Quick Track must not depend
  // on the landscape-only mobile overlay or the hidden legacy court.
  const tipoffDialog=document.createElement('div');
  tipoffDialog.className='focus-tipoff-backdrop';
  tipoffDialog.hidden=true;
  tipoffDialog.innerHTML=`<section class="focus-tipoff-card" role="dialog" aria-modal="true" aria-labelledby="focus-tipoff-title">
    <div class="focus-tipoff-top"><h2 id="focus-tipoff-title">Opening Tip-Off</h2><button type="button" class="focus-tipoff-close" aria-label="Close tip-off">×</button></div>
    <p>Who won the opening tip?</p>
    <div class="focus-tipoff-options" data-tipoff-group="winner">
      <button type="button" data-focus-winner="home">Home</button>
      <button type="button" data-focus-winner="away">Away</button>
    </div>
    <p class="focus-tipoff-direction-label">Which basket is the tip winner attacking?</p>
    <div class="focus-tipoff-options" data-tipoff-group="side">
      <button type="button" data-focus-side="left">← LEFT</button>
      <button type="button" data-focus-side="right">RIGHT →</button>
    </div>
    <p class="focus-tipoff-message" role="status" aria-live="polite"></p>
    <button type="button" class="focus-tipoff-confirm">CONFIRM TIP-OFF</button>
  </section>`;
  document.body.append(tipoffDialog);
  let winner='home', side='left', saving=false;
  const api=()=>window.scoridiumTipoff;
  const message=tipoffDialog.querySelector('.focus-tipoff-message');
  const confirm=tipoffDialog.querySelector('.focus-tipoff-confirm');
  let returnFocus=null;
  function paintTipoff(){
    const teams=api()?.getTeams()||{home:'Home',away:'Away'};
    tipoffDialog.querySelectorAll('[data-focus-winner]').forEach(b=>{
      b.textContent=teams[b.dataset.focusWinner]||b.dataset.focusWinner;
      const on=b.dataset.focusWinner===winner;
      b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));
    });
    tipoffDialog.querySelectorAll('[data-focus-side]').forEach(b=>{
      const on=b.dataset.focusSide===side;
      b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));
    });
    tipoffDialog.querySelector('.focus-tipoff-direction-label').textContent=
      `Which basket is ${(teams[winner]||'the tip winner')} attacking?`;
    confirm.disabled=saving || !api();
    confirm.textContent=saving?'SAVING TIP-OFF…':'CONFIRM TIP-OFF';
  }
  function closeTipoff(){
    if(saving)return;
    tipoffDialog.hidden=true;
    returnFocus?.focus?.();
  }
  function openTipoff(){
    if(api()?.getStatus()!=='not_started')return;
    returnFocus=document.activeElement;
    message.textContent='';
    tipoffDialog.hidden=false;
    paintTipoff();
    tipoffDialog.querySelector('.focus-tipoff-close').focus();
  }
  tipoffDialog.querySelectorAll('[data-focus-winner]').forEach(b=>b.addEventListener('click',()=>{
    if(saving)return;winner=b.dataset.focusWinner;paintTipoff();
  }));
  tipoffDialog.querySelectorAll('[data-focus-side]').forEach(b=>b.addEventListener('click',()=>{
    if(saving)return;side=b.dataset.focusSide;paintTipoff();
  }));
  tipoffDialog.querySelector('.focus-tipoff-close').addEventListener('click',closeTipoff);
  tipoffDialog.addEventListener('click',e=>{if(e.target===tipoffDialog)closeTipoff();});
  tipoffDialog.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();closeTipoff();}
    if(e.key==='Tab'){
      const available=[...tipoffDialog.querySelectorAll('button:not([disabled])')];
      const first=available[0],last=available[available.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  confirm.addEventListener('click',async()=>{
    if(saving||!api())return;
    saving=true;message.textContent='Saving tip-off…';paintTipoff();
    try{
      const result=await api().confirm(winner,side);
      if(result?.ok){
        message.textContent='';
        saving=false;
        closeTipoff();
      }else{
        message.textContent=result?.message||'Unable to start the game. Try again.';
      }
    }catch(error){
      console.error('Tip-off confirmation failed',error);
      message.textContent='Unable to start the game. Check your connection.';
    }finally{saving=false;paintTipoff();}
  });
  window.addEventListener('scoridium-request-tipoff',openTipoff);
  window.addEventListener('scoridium-tipoff-teams-loaded',paintTipoff);
  stage.querySelectorAll('[data-original]').forEach(button=>button.addEventListener('click',()=>{
    const target=document.getElementById(button.dataset.original);
    if(!target)return;
    // The original Start button continues to handle resuming paused games.
    // New games always use the shared confirmation dialog on any viewport.
    if(button.dataset.original==='start-game' && api()?.getStatus()==='not_started'){
      openTipoff();return;
    }
    target.click();
  }));
  const unassigned=document.getElementById('tab-unassigned-count');
  const badge=document.getElementById('focus-unassigned-count');
  if(unassigned&&badge){const paint=()=>{const count=Number(unassigned.textContent||0);badge.textContent=count>0?`(${count})`:'';};new MutationObserver(paint).observe(unassigned,{childList:true,characterData:true,subtree:true});paint();}
  // Swipe right to see plays, swipe left to return to the tracker.
  // Avoid taking over horizontal scrolling inside tables or on the court.
  let touch=null;
  stage.addEventListener('touchstart',event=>{
    const target=event.target;
    if(target.closest('button,select,input,table,svg,.sc-court-workspace,.table-scroll,.event-list')){touch=null;return;}
    if(event.touches.length!==1)return;
    touch={x:event.touches[0].clientX,y:event.touches[0].clientY};
  },{passive:true});
  stage.addEventListener('touchend',event=>{
    if(!touch||event.changedTouches.length!==1)return;
    const dx=event.changedTouches[0].clientX-touch.x,dy=event.changedTouches[0].clientY-touch.y;
    touch=null;
    if(Math.abs(dx)<75||Math.abs(dy)>Math.abs(dx)*0.65)return;
    if(view==='track'&&dx<0)show('review');
    else if(view==='review'&&dx>0)show('track');
  },{passive:true});
  // Quick Track starts immediately. Legacy court remains a separate view.
  shell.classList.add('quick-mode');
  show('track');
})();
