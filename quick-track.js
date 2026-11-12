/* Scoridium additive quick tracker v1.
   Uses existing game_events, sync queue, roster, scoring and replay. No schema changes.
   Court workflow remains available. Never assign a player when the tracker does not know. */
(() => {
  'use strict';
  const root = document.getElementById('quick-track-root');
  const panel = document.getElementById('quick-track-panel');
  if (!root || !panel || typeof addEvent !== 'function') return;
  const shell = document.querySelector('.tracker-shell');
  const toggle = document.getElementById('quick-view-toggle');
  let quick = true;
  let stage = 'grid';
  let playerId = null;
  let activeShot = null;
  let missedBy = null;
  let reboundTeam = 'us';
  let lastSavedEventId = null;
  let message = '';
  const escape = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const noGame = () => { if (state.status !== 'live') { message = 'Start or resume the game first.'; paint();return true;}return false; };
  const reset = () => { stage='grid'; playerId=null; activeShot=null; missedBy=null; paint(); };
  const buttons = (items, cls='quick-stats') => `<div class="${cls}">${items.map(([key,label])=>`<button type="button" data-quick="${key}">${label}</button>`).join('')}</div>`;
  const rosterGrid = (action='pick') => `<div class="quick-grid">${players.map(p=>`<button type="button" data-quick="${action}" data-player="${escape(p.id)}" ${stage==='assist' && String(playerId)===String(p.id)?'disabled':''}>#${escape(p.number??'?')}</button>`).join('')}</div>`;
  const own = () => players.find(p=>String(p.id)===String(playerId));
  function stored(event) {
    if(noGame()) return null;
    const id = crypto.randomUUID();
    addEvent({...event,id});
    // addEvent saves asynchronously through the existing queue.
    lastSavedEventId=id;
    return id;
  }
  function made(team,points,pid=null,assistFlow=false){
    const id=stored({type:'shot',team,points,made:true,playerId:pid});
    if(!id) return;
    if(assistFlow){activeShot=id;stage='assist';paint();}
    else reset();
  }
  function miss(team,points,pid=null){
    const id=stored({type:'shot',team,points,made:false,playerId:pid});
    if(!id)return;
    activeShot=id;missedBy=team;reboundTeam=team==='us'?'opponent':'us';stage='rebound';paint();
  }
  function related(type,team,pid=null){
    if(!activeShot){reset();return;}
    // Independent stat entry linked to its source shot, never another scoring shot.
    stored({type,team,playerId:pid,linkedEventId:activeShot});reset();
  }
  function paint(){
    if(!quick){root.innerHTML='<p class="quick-note">Original court and detailed stat controls are active.</p>';return;}
    const who = own();
    let html='';
    if(stage==='grid'){
      html=`<div class="quick-step">1 · TAP A JERSEY NUMBER</div>${rosterGrid()}`;
      html+=`<div class="quick-opponent"><h4>TEAM QUICK SCORE (UNASSIGNED)</h4>${buttons([['team-ft','FT +1'],['team-2','TEAM +2'],['team-3','TEAM +3']],'quick-shortcuts')}</div>`;
      html+=`<div class="quick-opponent"><h4>OPPONENT · TEAM STATS</h4>${buttons([['opp-ft','FT +1'],['opp-2','2PT +2'],['opp-3','3PT +3'],['opp-miss2','2PT MISS'],['opp-miss3','3PT MISS'],['opp-to','TO'],['opp-pf','PF'],['opp-reb','REB']])}</div>`;
    }else if(stage==='stats'){
      html=`<div class="quick-step">#${escape(who?.number??'?')} · CHOOSE STAT</div>`;
      html+=buttons([['made-ft','FT +1'],['made-2','2PT MADE'],['made-3','3PT MADE'],['miss-ft','FT MISS'],['miss-2','2PT MISS'],['miss-3','3PT MISS'],['oreb','O REB'],['dreb','D REB'],['ast','AST'],['stl','STL'],['blk','BLK'],['to','TO'],['pf','PF']]);
      html+=buttons([['cancel','CANCEL']],'quick-actions');
    }else if(stage==='assist'){
      html=`<div class="quick-step">MADE SHOT · WHO ASSISTED #${escape(who?.number??'?')}?</div>${rosterGrid('assist-player')}`;
      html+=buttons([['no-assist','NO ASSIST'],['unknown-assist','UNKNOWN / SKIP']],'quick-actions');
    }else if(stage==='rebound'){
      html=`<div class="quick-step">MISSED SHOT · WHO GOT THE REBOUND?</div>`;
      html+=buttons([['reb-us','OUR TEAM'],['reb-opp','OPPONENT']],'quick-actions');
      html+=`<div class="quick-note">${reboundTeam==='us'?'Select one of our players, or use Team REB / Unknown.':'Opponent rebound is recorded at team level.'}</div>`;
      if(reboundTeam==='us') html+=rosterGrid('rebound-player');
      html+=buttons([['team-reb','TEAM REB'],['unknown-reb','UNKNOWN / SKIP']],'quick-actions');
    }else if(stage==='steal'){
      html=`<div class="quick-step">OPPONENT TURNOVER · WHO GOT THE STEAL?</div>${rosterGrid('steal-player')}`;
      html+=buttons([['no-steal','NO STEAL'],['unknown-steal','UNKNOWN / SKIP']],'quick-actions');
    }
    html+=`<div class="quick-status"><strong>${escape(message || 'Quick tracking — court locations optional')}</strong></div>`;
    root.innerHTML=html;
  }
  root.addEventListener('click',(e)=>{
    const button=e.target.closest('button[data-quick]');if(!button)return;
    const action=button.dataset.quick;
    message='';
    if(action==='cancel'){reset();return;}
    if(action==='pick'){if(noGame())return;playerId=button.dataset.player;stage='stats';paint();return;}
    if(action==='made-2'||action==='made-3'){made('us',action==='made-2'?2:3,playerId,true);return;}
    if(action==='miss-2'||action==='miss-3'){miss('us',action==='miss-2'?2:3,playerId);return;}
    if(action==='made-ft'||action==='miss-ft'){stored({type:'free_throw',team:'us',points:1,made:action==='made-ft',playerId});reset();return;}
    if(action==='team-ft'){stored({type:'free_throw',team:'us',points:1,made:true,playerId:null});reset();return;}
    if(action==='team-2'||action==='team-3'){made('us',action==='team-2'?2:3,null,false);return;}
    if(action==='opp-2'||action==='opp-3'){made('opponent',action==='opp-2'?2:3);return;}
    if(action==='opp-miss2'||action==='opp-miss3'){miss('opponent',action==='opp-miss2'?2:3);return;}
    if(action==='opp-ft'){stored({type:'free_throw',team:'opponent',points:1,made:true,playerId:null});reset();return;}
    if(action==='opp-to'){const id=stored({type:'turnover',team:'opponent',playerId:null});if(id){activeShot=id;stage='steal';paint();}return;}
    if(action==='opp-pf'){stored({type:'foul',team:'opponent',playerId:null});reset();return;}
    if(action==='opp-reb'){stored({type:'defensive_rebound',team:'opponent',playerId:null});reset();return;}
    const statTypes={oreb:'offensive_rebound',dreb:'defensive_rebound',ast:'assist',stl:'steal',blk:'block',to:'turnover',pf:'foul'};
    if(statTypes[action]){recordStat(statTypes[action],'us',playerId);reset();return;}
    if(action==='assist-player'){related('assist','us',button.dataset.player);return;}
    if(action==='no-assist'){related('no_assist','us',null);return;}
    if(action==='unknown-assist'){reset();return;}
    if(action==='reb-us'||action==='reb-opp'){reboundTeam=action==='reb-us'?'us':'opponent';paint();return;}
    if(action==='rebound-player'){related(reboundTeam===missedBy?'offensive_rebound':'defensive_rebound','us',button.dataset.player);return;}
    if(action==='team-reb'){
      // Separate team-rebound event types avoid falsely treating an unknown
      // individual player as the rebounder. Aggregate support follows later.
      related(reboundTeam===missedBy?'team_offensive_rebound':'team_defensive_rebound',reboundTeam,null);return;
    }
    if(action==='unknown-reb'){reset();return;}
    if(action==='steal-player'){related('steal','us',button.dataset.player);return;}
    if(action==='no-steal'||action==='unknown-steal'){reset();return;}
  });
  toggle.addEventListener('click',()=>{
    quick=!quick;
    shell?.classList.toggle('quick-mode',quick);
    shell?.classList.toggle('quick-classic',!quick);
    toggle.textContent=quick?'Court controls':'Quick tracking';
    reset();
  });
  shell?.classList.add('quick-mode');
  // Roster loads asynchronously; paint the grid when the existing render runs.
  const original=renderPlayers;
  renderPlayers=function(){original(); if(stage==='grid'||stage==='assist'||stage==='rebound'||stage==='steal')paint();};
  paint();
})();
