/* Scoridium collaborative tracking workspace — builds on existing game state.
 * Canonical scoring stays in game_events; court-only observations never score.
 * Requires MIGRATION_COLLABORATION.sql for cross-device observations/location RPC.
 */
(() => {
  'use strict';
  const byId=id=>document.getElementById(id);
  const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const ready=()=>typeof state!=='undefined'&&typeof gameId!=='undefined';
  if(!ready()||!byId('game-info-panel')||!byId('tracker-controls'))return;
  const officialShots=()=>state.events.filter(e=>e.type==='shot').slice().sort((a,b)=>(a.time||0)-(b.time||0));
  const names=()=>({us:teamName||'Tracked team',opponent:currentGame?.opponent||'Opponent'});
  const pName=id=>{const p=players.find(p=>String(p.id)===String(id));return p?`#${p.number}`:'Unassigned';};
  const pct=(a,b)=>b?`${(100*a/b).toFixed(1)}%`:'—';
  const num=(es,type)=>es.filter(e=>e.type===type).length;
  const fmtTeam=t=>{
    const es=state.events.filter(e=>e.team===t), fg=es.filter(e=>e.type==='shot'),ft=es.filter(e=>e.type==='free_throw');
    const fgM=fg.filter(e=>e.made),ftM=ft.filter(e=>e.made),three=fg.filter(e=>Number(e.points)===3);
    const ore=num(es,'offensive_rebound')+num(es,'team_offensive_rebound');
    const dre=num(es,'defensive_rebound')+num(es,'team_defensive_rebound');
    return {PTS:fgM.reduce((n,e)=>n+Number(e.points||0),0)+ftM.length,
      FG:`${fgM.length}/${fg.length}`, 'FG%':pct(fgM.length,fg.length),
      '3PT':`${three.filter(e=>e.made).length}/${three.length}`,
      FT:`${ftM.length}/${ft.length}`,'FT%':pct(ftM.length,ft.length),
      AST:num(es,'assist'),REB:ore+dre,OREB:ore,DREB:dre,
      TO:num(es,'turnover'),STL:num(es,'steal'),BLK:num(es,'block'),PF:num(es,'foul')};
  };
  const info=byId('game-info-panel'), box=byId('info-box'),plays=byId('info-plays');
  const teamStats=document.createElement('section');teamStats.className='sc-team-stats';
  teamStats.innerHTML='<h3>TEAM BOX SCORE</h3><div class="sc-team-stats-table"></div>';
  box.insertBefore(teamStats,box.firstChild);
  const playerTitle=document.createElement('h3');playerTitle.className='sc-player-title';playerTitle.textContent='PLAYER BOX SCORE';
  byId('player-box').closest('.table-scroll').before(playerTitle);
  // Keep the original event and filter IDs: renderPlayByPlay() and edits continue to work.
  box.append(plays);
  plays.hidden=false;
  plays.classList.add('sc-embedded-plays');
  const tabs=info.querySelector('.game-info-tabs');
  tabs.querySelectorAll('[data-info-tab="plays"]').forEach(b=>b.hidden=true);
  // Avoid toggling away from the visible combined box score when the old hidden plays tab is activated.
  const originalSwitch=window.switchInfoTab;
  window.switchInfoTab=function(tab){
    originalSwitch(tab==='plays'?'box':tab);
    if(tab==='box'||tab==='plays')plays.hidden=false;
  };
  const originalPlayerBox=window.renderPlayerBox;
  window.renderPlayerBox=function(){
    const body=byId('player-box-body');if(!body)return;
    body.replaceChildren();
    const filter=byId('play-filter')?.value||'all';
    const es=state.events.filter(e=>e.team==='us'&&(filter==='all'||Number(e.period)===Number(filter)));
    const sorted=[...players].sort((a,b)=>Number(a.number)-Number(b.number)||String(a.number).localeCompare(String(b.number)));
    for(const p of sorted){
      const mine=es.filter(e=>String(e.playerId)===String(p.id));
      const fg=mine.filter(e=>e.type==='shot'),made=fg.filter(e=>e.made),ft=mine.filter(e=>e.type==='free_throw');
      const ftm=ft.filter(e=>e.made).length;
      const vals=[pName(p.id),made.reduce((n,e)=>n+Number(e.points||0),0)+ftm,
        `${made.length}/${fg.length}`,`${fg.filter(e=>e.made&&Number(e.points)===3).length}/${fg.filter(e=>Number(e.points)===3).length}`,
        `${ftm}/${ft.length}`,num(mine,'offensive_rebound')+num(mine,'defensive_rebound'),
        num(mine,'assist'),num(mine,'steal'),num(mine,'block'),num(mine,'turnover'),num(mine,'foul')];
      const tr=document.createElement('tr');for(const v of vals){const td=document.createElement('td');td.textContent=v;tr.append(td);}body.append(tr);
    }
    if(!sorted.length){body.innerHTML='<tr><td colspan="11">No players available.</td></tr>';}
    const label=byId('box-period');if(label)label.textContent=filter==='all'?'ALL':periodName(Number(filter));
  };
  function refreshSummary(){
    const a=fmtTeam('us'),b=fmtTeam('opponent'),n=names();
    const rows=['PTS','FG','FG%','3PT','FT','FT%','AST','REB','OREB','DREB','TO','STL','BLK','PF'];
    const compact=(keys)=>`<table><thead><tr><th>${safe(n.us)}</th><th>STAT</th><th>${safe(n.opponent)}</th></tr></thead><tbody>${keys.map(k=>`<tr><td>${a[k]}</td><th>${k}</th><td>${b[k]}</td></tr>`).join('')}</tbody></table>`;
    teamStats.querySelector('.sc-team-stats-table').innerHTML=`<div class="sc-stats-columns">${compact(rows.slice(0,7))}${compact(rows.slice(7))}</div><p class="sc-stats-note">Figures use recorded events only. Untracked opponent statistics may be incomplete.</p>`;
  }
  const originalRender=window.render;
  let previouslyRenderedPeriod=Number(state.period)||1;
  window.render=function(){
    const prior=previouslyRenderedPeriod;
    originalRender();refreshSummary();refreshCourtQueue();
    if(currentGame && state.status!=='not_started' && Number(state.period)!==prior){
      previouslyRenderedPeriod=Number(state.period);
      // A quarter boundary is a reconciliation checkpoint, not a hard lock.
      renderCheckpoint(prior);
    }
  };
  // Existing play-by-play tab is replaced by the combined view, with the unassigned tab intact.
  const prevPlayTab=tabs.querySelector('[data-info-tab="plays"]');
  prevPlayTab?.addEventListener('click',()=>tabs.querySelector('[data-info-tab="box"]')?.click());
  refreshSummary();window.renderPlayerBox();

  // Dedicated Court workspace. Moves the ORIGINAL calibrated SVG, not a redraw.
  const stage=document.querySelector('.focus-stage');
  const courtPanel=byId('tracker-controls');
  const courtSection=document.createElement('section');courtSection.className='focus-court sc-court-workspace';
  courtSection.innerHTML=`<div class="sc-court-head"><div><h2>SHOT LOCATIONS</h2><p>FIBA court · Shared game events</p></div><span id="sc-court-sync" role="status">Preparing…</span></div>
    <div class="sc-court-main"><aside class="sc-shot-sidebar"><div class="sc-queue-top"><strong>Shot queue</strong><span id="sc-queue-count"></span></div>
    <div class="sc-court-modes"><button type="button" id="sc-offense" class="active">OFFENSE</button><button type="button" id="sc-defense">DEFENSE</button></div>
    <div id="sc-shot-queue" class="sc-shot-queue" aria-live="polite"></div>
    <div class="sc-observation"><strong>Location before Quick Track?</strong><p>Choose the shooting team’s half, then tap the court to record an independent location observation. It will not change the score.</p>
    <div class="sc-observe-buttons"><button id="sc-observe-made" type="button" class="sc-make">MADE</button><button id="sc-observe-miss" type="button" class="sc-miss">MISS</button></div>
    <div class="sc-observe-footer"><button id="sc-observe-ft" type="button">FT checkpoint</button><button id="sc-review-checkpoint" type="button">Compare</button></div></div></aside>
    <div class="sc-court-body"><div class="sc-court-actions"><button type="button" id="sc-swap-directions">⇄ Switch basket directions</button><span id="sc-direction-summary"></span></div><div id="sc-court-mount"></div>
    <div id="sc-court-feedback" role="status" aria-live="polite">Choose a shot, or use MADE / MISS to capture a location first.</div></div></div>
    <div id="sc-checkpoint-summary" class="sc-checkpoint-summary" hidden></div>`;
  stage.append(courtSection);
  const wrap=courtPanel.querySelector('.court-wrap');
  courtSection.querySelector('#sc-court-mount').append(courtPanel);
  // Court control buttons stay functional; only the legacy redundant player/stat panels are hidden.
  const oldHeader=courtPanel.querySelector('.section-heading');if(oldHeader)oldHeader.hidden=true;
  const undo=byId('undo-event');if(undo)undo.hidden=true;
  const homeTeam=()=>currentGame?.location?.toLowerCase()!=='away';
  const [offBtn,defBtn]=[byId('sc-offense'),byId('sc-defense')];
  let view='offense',selectedShotId=null,mode=null,observations=[],quickObservations=[],sessionUser=null,remoteEnabled=false,obsChannel=null,quickObsChannel=null,busy=false;
  const observationsKey=()=>`scoridium-court-observations:${gameId||'none'}`;
  try{observations=JSON.parse(localStorage.getItem(observationsKey())||'[]')||[];}catch{observations=[];}
  function setFeedback(text){byId('sc-court-feedback').textContent=text;}
  const usIsHome=()=>homeTeam();
  function selectHalf(){
    const ourSide=usIsHome()?'home':'away';
    const side=view==='offense'?ourSide:ourSide==='home'?'away':'home';
    if(courtView!=='half')byId('half-court-btn')?.click();
    (side==='home'?byId('home-court-btn'):byId('away-court-btn'))?.click();
    offBtn.classList.toggle('active',view==='offense');defBtn.classList.toggle('active',view==='defense');
    byId('sc-direction-summary').textContent=`${view==='offense'?names().us:names().opponent} attacking ${getSelectedBasketSide().toUpperCase()} basket`;
  }
  function setView(next){view=next;selectHalf();refreshCourtQueue();}
  offBtn.addEventListener('click',()=>setView('offense'));defBtn.addEventListener('click',()=>setView('defense'));
  const fullBtn=byId('full-court-btn'),halfBtn=byId('half-court-btn');
  fullBtn?.addEventListener('click',()=>{byId('sc-direction-summary').textContent='Full FIBA court · both baskets';});
  halfBtn?.addEventListener('click',()=>selectHalf());
  async function saveCoords(event,point){
    if(busy)return;busy=true;
    if(!Number.isInteger(Number(event.version))||Number(event.version)<1){setFeedback('This shot has not synchronized yet. Try again after it appears on both devices.');busy=false;return;}
    const info=detectShot(point.x,point.y);
    const recordedTeam=info.team===(usIsHome()?'home':'away')?'us':'opponent';
    if(recordedTeam!==event.team||Number(event.points)!==Number(info.points)){
      setFeedback(`Location belongs to ${recordedTeam==='us'?names().us:names().opponent} ${info.points}PT, but selected event is ${event.team==='us'?names().us:names().opponent} ${event.points}PT. Select the matching event or tap again.`);
      busy=false;return;
    }
    try{
      const dist=calculateShotDistance(point.x,point.y);
      const {data,error}=await supabaseClient.rpc('scoridium_assign_shot_location',{
        p_game_id:gameId,p_event_id:event.id,p_expected_version:Number(event.version),
        p_x:point.x,p_y:point.y,p_distance_meters:dist.meters,p_distance_feet:dist.feet});
      if(error)throw error;
      if(!Array.isArray(data)||data.length!==1)throw new Error('Shot was changed on another device. Refresh and try again.');
      event.x=point.x;event.y=point.y;event.distanceMeters=dist.meters;event.distanceFeet=dist.feet;event.version=Number(data[0].new_version);
      save();renderCourt();setFeedback(`${event.team==='us'?names().us:names().opponent} ${event.points}PT location saved · ${dist.feet.toFixed(1)} ft.`);
      selectedShotId=null;refreshCourtQueue();
    }catch(err){console.error('Court location update',err);setFeedback(`Location not saved: ${err.message||'Check the collaboration SQL migration and permissions.'}`);}finally{busy=false;}
  }
  function saveLocalObservations(){localStorage.setItem(observationsKey(),JSON.stringify(observations));}
  async function addObservation(o){
    if(!gameId){setFeedback('Choose a real game first.');return;}
    const observation={id:crypto.randomUUID(),game_id:gameId,period:state.period,team:o.team,points:o.points??null,made:o.made??null,
      x:o.x??null,y:o.y??null,distance_meters:o.distance_meters??null,distance_feet:o.distance_feet??null,kind:o.kind||'shot',
      observed_at:new Date().toISOString(),tracker_id:sessionUser?.id||null,matched_event_id:null};
    observations.push(observation);saveLocalObservations();refreshCourtQueue();
    if(!remoteEnabled){setFeedback('Observation saved on this device. Cross-device sharing requires the collaboration migration.');return;}
    const {error}=await supabaseClient.from('tracker_observations').insert(observation);
    if(error){console.warn('Could not sync location observation',error);setFeedback('Observation saved locally only; retry after checking permissions.');}
    else setFeedback('Location observation shared. It will not add points until matched to an official shot.');
  }
  const svg=byId('basketball-court');
  svg.addEventListener('click',async e=>{
    if(document.querySelector('.tracker-shell')?.dataset.focusView!=='court')return;
    e.stopImmediatePropagation();e.preventDefault();
    if(busy)return;
    const matrix=svg.getScreenCTM();if(!matrix)return;
    const pt=new DOMPoint(e.clientX,e.clientY).matrixTransform(matrix.inverse());
    const bounds=courtView==='half'?{maxX:460,maxY:430}:{maxX:850,maxY:460};
    if(pt.x<10||pt.y<10||pt.x>bounds.maxX||pt.y>bounds.maxY)return;
    const physical=displayToCourt(pt.x,pt.y),info=detectShot(physical.x,physical.y),dist=calculateShotDistance(physical.x,physical.y);
    if(selectedShotId){const event=officialShots().find(e=>String(e.id)===String(selectedShotId));if(event){await saveCoords(event,physical);return;}}
    if(!mode){setFeedback('Select a shot from the queue, or choose MADE / MISS before tapping a new location.');return;}
    const team=info.team===(usIsHome()?'home':'away')?'us':'opponent';
    await addObservation({kind:'shot',team,points:info.points,made:mode==='made',x:physical.x,y:physical.y,distance_meters:dist.meters,distance_feet:dist.feet});
    mode=null;byId('sc-observe-made').classList.remove('active');byId('sc-observe-miss').classList.remove('active');
  },true);
  for(const [id,m] of [['sc-observe-made','made'],['sc-observe-miss','miss']])byId(id).addEventListener('click',()=>{
    selectedShotId=null;mode=m;byId('sc-observe-made').classList.toggle('active',m==='made');byId('sc-observe-miss').classList.toggle('active',m==='miss');
    setFeedback(`Tap the ${view==='offense'?'offense':'defense'} court for the ${m} shot location.`);
    refreshCourtQueue();
  });
  byId('sc-observe-ft').addEventListener('click',()=>{
    const dialog=document.createElement('dialog');dialog.className='sc-ft-dialog';dialog.innerHTML=`<form method="dialog"><h3>FT checkpoint</h3><p>Verify the shooting team and each attempt. These entries never change the official score.</p><label>Team <select name="team"><option value="us">${safe(names().us)}</option><option value="opponent">${safe(names().opponent)}</option></select></label><div class="sc-ft-checks"><button type="button" data-ft="made" class="sc-make">FT MADE</button><button type="button" data-ft="missed" class="sc-miss">FT MISS</button></div><p id="sc-ft-sequence">No attempts yet</p><button value="cancel">CLOSE</button></form>`;
    document.body.append(dialog);const seq=[];dialog.querySelectorAll('[data-ft]').forEach(b=>b.addEventListener('click',async()=>{
      const made=b.dataset.ft==='made';seq.push(made?'M':'X');dialog.querySelector('#sc-ft-sequence').textContent=`FT sequence: ${seq.join(' · ')}`;
      await addObservation({kind:'free_throw',team:dialog.querySelector('[name=team]').value,points:1,made});
    }));dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
  });
  // Explicit, shared direction change. Existing physical coordinates are never rewritten.
  byId('sc-swap-directions').addEventListener('click',async()=>{
    if(!currentGame||busy)return;
    if(!confirm('Switch which basket each team attacks for future shots? This affects every connected tracker.'))return;
    const {data,error}=await supabaseClient.rpc('scoridium_switch_basket_directions',{p_game_id:gameId});
    if(error||!Array.isArray(data)||data.length!==1){setFeedback(`Direction change was not saved: ${error?.message||'Check collaboration migration'}`);return;}
    applySharedDirection(data[0].home_attacks_left_first_half);selectHalf();setFeedback('Basket assignments switched and synced. Previous shot coordinates were preserved.');
  });
  function eventKind(e){return `${e.team==='us'?names().us:names().opponent} · ${e.points}PT ${e.made?'MADE':'MISS'} · ${e.playerId?pName(e.playerId):'TEAM'}`;}
  function compare(period=state.period){
    const shots=officialShots().filter(s=>Number(s.period)===Number(period));
    const obs=observations.filter(o=>o.kind==='shot'&&!o.matched_event_id&&Number(o.period)===Number(period));
    const used=new Set(),found=[];
    for(const shot of shots){
      // A captured shot location is a stronger signal than order alone;
      // require team, result, type, period AND close capture times.
      const same=obs.filter(o=>!used.has(o.id)&&o.team===shot.team&&
        Number(o.points)===Number(shot.points)&&Boolean(o.made)===Boolean(shot.made));
      const near=same.filter(o=>Math.abs(Date.parse(o.observed_at)-Number(shot.time||0))<=30000);
      if(near.length===1){const o=near[0];used.add(o.id);found.push({event:shot,obs:o,status:'candidate'});}
      else found.push({event:shot,obs:null,status:near.length>1?'ambiguous':same.length?'time-uncertain':'missing'});
    }
    return {found,unused:obs.filter(o=>!used.has(o.id)),matched:found.filter(x=>x.status==='candidate').length,
      ambiguous:found.filter(x=>x.status==='ambiguous'||x.status==='time-uncertain').length};
  }
  async function linkCandidate(observation,event){
    if(!remoteEnabled){setFeedback('Please apply MIGRATION_COLLABORATION.sql and sync the observation before linking.');return;}
    if(busy)return;busy=true;
    try{
      const {data,error}=await supabaseClient.rpc('scoridium_link_shot_observation',{
        p_game_id:gameId,p_observation_id:observation.id,p_event_id:event.id,p_expected_version:Number(event.version)});
      if(error)throw error;
      if(!Array.isArray(data)||data.length!==1)throw new Error('Link was not confirmed.');
      observation.matched_event_id=event.id;
      if(event.x==null&&event.y==null){event.x=Number(observation.x);event.y=Number(observation.y);
        event.distanceMeters=Number(observation.distance_meters);event.distanceFeet=Number(observation.distance_feet);}
      event.version=Number(data[0].new_version);
      saveLocalObservations();save();renderCourt();refreshCourtQueue();renderCheckpoint(event.period);
      setFeedback(`Linked observation to ${eventKind(event)}. One official field-goal attempt retained.`);
    }catch(e){console.error('Observation matching failed',e);setFeedback(`Match not saved: ${e.message||'Refresh and try again.'}`);}
    finally{busy=false;}
  }
  function eventTotals(period,team){
    const ev=state.events.filter(e=>Number(e.period)===Number(period)&&e.team===team);
    return ev.reduce((n,e)=>n+(e.made===false?0:Number(e.points||0)),0);
  }
  function observedTotals(period,team){
    const obs=observations.filter(o=>Number(o.period)===Number(period)&&o.team===team);
    return obs.reduce((n,o)=>n+(o.made?Number(o.points||0):0),0);
  }
  function compareIndependent(period){
    const canonical=state.events.filter(e=>Number(e.period)===Number(period));
    const independent=quickObservations.filter(e=>Number(e.period)===Number(period));
    const matched=new Set(),results=[];
    for(const e of canonical){
      const candidates=independent.filter(o=>!matched.has(o.id)&&o.team===e.team&&o.type===e.type&&
        (e.type!=='shot'&&e.type!=='free_throw'||(Number(o.points)===Number(e.points)&&Boolean(o.made)===Boolean(e.made)))&&
        Math.abs(Date.parse(o.observed_at)-Number(e.time||0))<=45000);
      if(candidates.length===1){const o=candidates[0];matched.add(o.id);
        results.push({event:e,observation:o,status:o.player_id&&e.playerId&&String(o.player_id)!==String(e.playerId)?'player-conflict':'likely'});
      }else results.push({event:e,status:candidates.length>1?'ambiguous':'missing'});
    }
    const unmatched=independent.filter(o=>!matched.has(o.id));
    const score=t=>independent.filter(o=>o.team===t).reduce((n,o)=>n+(o.made===false?0:Number(o.points||0)),0);
    return {results,unmatched,score:{us:score('us'),opponent:score('opponent')},available:independent.length>0};
  }
  function compareFT(period){
    const official=state.events.filter(e=>e.type==='free_throw'&&Number(e.period)===Number(period));
    const observed=observations.filter(o=>o.kind==='free_throw'&&Number(o.period)===Number(period));
    const consumed=new Set();let matches=0;
    for(const event of official){
      const options=observed.filter(o=>!consumed.has(o.id)&&o.team===event.team&&Boolean(o.made)===Boolean(event.made)&&
        Math.abs(Date.parse(o.observed_at)-Number(event.time||0))<=45000);
      if(options.length===1){consumed.add(options[0].id);matches++;}
    }
    return {official:official.length,observed:observed.length,matches,unmatched:observed.length-matches};
  }
  function renderCheckpoint(period=state.period){
    const r=compare(period),ind=compareIndependent(period),fts=compareFT(period),a=eventTotals(period,'us'),b=eventTotals(period,'opponent');
    const oa=observedTotals(period,'us'),ob=observedTotals(period,'opponent');
    const area=byId('sc-checkpoint-summary');area.hidden=false;
    area.innerHTML=`<h3>${safe(periodName(period))} · Tracker comparison</h3>
      <div class="sc-checkpoint-counters"><span>${r.matched} likely shot matches</span><span>${r.unused.length} unmatched Court observations</span><span>${r.ambiguous} uncertain shots</span></div>
      <p>Quick Track scoring this period: <strong>${a}–${b}</strong>. Court's independently observed points: <strong>${oa}–${ob}</strong> (may be incomplete). Equal scores do not prove all events match.</p>
      <p>FT checkpoint agreement: <strong>${fts.matches}/${fts.official}</strong> official attempts matched to Court observations (${fts.unmatched} unmatched Court FTs).</p>
      <p>${ind.available?`Independent Quick: ${ind.results.filter(r=>r.status==='likely').length} likely event matches, ${ind.results.filter(r=>r.status==='missing').length} missing, ${ind.unmatched.length} extra observations. Independently recorded points ${ind.score.us}–${ind.score.opponent}.`:'No independent Quick Tracker observations for this period.'}</p>
      <div id="sc-independent-disagreements"></div>
      <div id="sc-match-suggestions"></div>
      <button type="button" id="sc-confirm-score">Record physical scoreboard</button>`;
    const disputes=area.querySelector('#sc-independent-disagreements');
    for(const result of ind.results.filter(r=>r.status!=='likely').slice(0,8)){
      const row=document.createElement('p');row.className='sc-discrepancy';row.textContent=`${periodName(result.event.period)} · ${result.event.team==='us'?names().us:names().opponent} · ${result.event.type} ${result.event.points||''}: ${result.status.replace('-', ' ')}`;disputes.append(row);
    }
    if(ind.unmatched.length){const row=document.createElement('p');row.className='sc-discrepancy';row.textContent=`${ind.unmatched.length} observation(s) exist only in Independent Quick Track.`;disputes.append(row);}
    const container=area.querySelector('#sc-match-suggestions');
    for(const pair of r.found.filter(f=>f.status==='candidate')){
      const row=document.createElement('div');row.className='sc-match-suggestion';
      const text=document.createElement('span');text.textContent=`${eventKind(pair.event)} · ${Math.round(Math.abs(Date.parse(pair.obs.observed_at)-pair.event.time)/1000)}s apart`;
      const button=document.createElement('button');button.type='button';button.textContent='LINK';
      button.addEventListener('click',()=>void linkCandidate(pair.obs,pair.event));
      row.append(text,button);container.append(row);
    }
    if(!container.children.length)container.textContent='No unique near-time matches to confirm. Other observations remain available for review.';
    area.querySelector('#sc-confirm-score').addEventListener('click',()=>void physicalScoreCheckpoint(period));
  }
  async function physicalScoreCheckpoint(period){
    const home=byId('home-score')?.textContent||'0',away=byId('away-score')?.textContent||'0';
    const dialog=document.createElement('dialog');dialog.className='sc-ft-dialog';
    dialog.innerHTML=`<form method="dialog"><h3>Verify venue scoreboard</h3><p>Enter the actual scoreboard at this timeout or quarter break, not Scoridium's displayed score.</p>
      <label>Home <input name="home" type="number" min="0" max="999" required value="${Number(home)||0}"></label>
      <label>Away <input name="away" type="number" min="0" max="999" required value="${Number(away)||0}"></label>
      <div class="sc-ft-checks"><button type="button" id="sc-submit-score" class="sc-make">SAVE CHECK</button><button value="cancel">CANCEL</button></div><p class="sc-check-status" role="status"></p></form>`;
    document.body.append(dialog);
    dialog.addEventListener('close',()=>dialog.remove());
    dialog.querySelector('#sc-submit-score').addEventListener('click',async()=>{
      const a=Number(dialog.querySelector('[name=home]').value),b=Number(dialog.querySelector('[name=away]').value);
      if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0){dialog.querySelector('.sc-check-status').textContent='Enter valid nonnegative scores.';return;}
      if(!sessionUser){dialog.querySelector('.sc-check-status').textContent='Sign in to save this checkpoint.';return;}
      const result=await supabaseClient.from('tracker_checkpoints').insert({game_id:gameId,tracker_id:sessionUser.id,period,
        checkpoint_type:'manual',observed_home_score:a,observed_away_score:b});
      if(result.error){dialog.querySelector('.sc-check-status').textContent=`Could not sync: ${result.error.message}`;return;}
      const gameHome=Number(byId('home-score')?.textContent)||0,gameAway=Number(byId('away-score')?.textContent)||0;
      setFeedback(a===gameHome&&b===gameAway?'Venue score agrees with Scoridium. Event details may still require review.':
        `Venue score ${a}–${b} differs from Scoridium ${gameHome}–${gameAway}. Review event timeline.`);
      dialog.close();
    });dialog.showModal();
  }
  byId('sc-review-checkpoint').addEventListener('click',()=>renderCheckpoint());
  function refreshCourtQueue(){
    if(!byId('sc-shot-queue'))return;
    const shots=officialShots();const pending=shots.filter(e=>!Number.isFinite(Number(e.x))||!Number.isFinite(Number(e.y))||e.x==null||e.y==null);
    byId('sc-queue-count').textContent=`${pending.length} needing location`;
    const list=byId('sc-shot-queue');list.replaceChildren();
    const latest=shots.slice(-80).reverse();
    if(!latest.length)list.textContent='No field-goal events yet.';
    for(const shot of latest){
      const located=shot.x!=null&&shot.y!=null;
      const button=document.createElement('button');button.type='button';button.className='sc-shot-item'+(selectedShotId===shot.id?' active':'');
      button.innerHTML=`<strong>${safe(eventKind(shot))}</strong><small>${safe(periodName(shot.period))} · ${located?`Located · ${Number(shot.distanceFeet||0).toFixed(1)} ft`:'Location needed'}</small>`;
      button.addEventListener('click',()=>{
        mode=null;selectedShotId=shot.id;refreshCourtQueue();
        setFeedback(`Selected ${eventKind(shot)}. ${shot.team==='us'&&view!=='offense'||shot.team==='opponent'&&view!=='defense'?'Manually switch OFFENSE / DEFENSE before tapping.':'Tap the court to assign its location.'}`);
      });list.append(button);
    }
    const unsynced=observations.filter(o=>!o.matched_event_id);
    if(unsynced.length){const hd=document.createElement('h4');hd.textContent=`Unmatched observations (${unsynced.length})`;list.append(hd);
      for(const o of unsynced.slice(-20).reverse()){
        const row=document.createElement('div');row.className='sc-shot-item sc-observation-row';row.innerHTML=`<strong>${safe(o.team==='us'?names().us:names().opponent)} · ${safe(o.kind==='free_throw'?'FT':`${o.points}PT`)} ${o.made?'MADE':'MISS'}</strong><small>${safe(periodName(o.period))} · Awaiting reconciliation</small>`;list.append(row);
      }
    }
  }
  async function initIndependentFeed(){
    if(!gameId||!sessionUser)return;
    const load=async()=>{
      const {data,error}=await supabaseClient.from('tracker_event_observations').select('*')
        .eq('game_id',gameId).order('observed_at',{ascending:true}).limit(2000);
      if(!error&&data){quickObservations=data;if(!byId('sc-checkpoint-summary').hidden)renderCheckpoint();}
    };
    await load();
    if(quickObsChannel)await supabaseClient.removeChannel(quickObsChannel);
    quickObsChannel=supabaseClient.channel(`scoridium-independent-review-${gameId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'tracker_event_observations',filter:`game_id=eq.${gameId}`},()=>void load())
      .subscribe();
  }
  async function initRemote(){
    if(!gameId||!currentGame)return;
    const {data}=await supabaseClient.auth.getUser();sessionUser=data?.user||null;
    if(!sessionUser)return;
    void initIndependentFeed();
    const {data:rows,error}=await supabaseClient.from('tracker_observations').select('*').eq('game_id',gameId).order('observed_at',{ascending:true});
    if(error){remoteEnabled=false;byId('sc-court-sync').textContent='Local observations';setFeedback('Collaboration database not yet configured. Run MIGRATION_COLLABORATION.sql before multi-device testing.');return;}
    remoteEnabled=true;byId('sc-court-sync').textContent='Shared observations';
    const local=observations.slice();observations=rows||[];
    // Preserve unsynced local observations, never silently delete them.
    for(const o of local)if(!observations.some(r=>r.id===o.id))observations.push(o);
    saveLocalObservations();refreshCourtQueue();
    if(obsChannel)await supabaseClient.removeChannel(obsChannel);
    obsChannel=supabaseClient.channel(`scoridium-court-${gameId}`).on('postgres_changes',{
      event:'*',schema:'public',table:'tracker_observations',filter:`game_id=eq.${gameId}`},async()=>{
        const {data:latest}=await supabaseClient.from('tracker_observations').select('*').eq('game_id',gameId).order('observed_at',{ascending:true});
        if(latest){for(const o of latest){const idx=observations.findIndex(v=>v.id===o.id);if(idx===-1)observations.push(o);else observations[idx]=o;}saveLocalObservations();refreshCourtQueue();}
      }).subscribe();
  }
  // Do not auto change offense/defense when Quick Track records a shot.
  const courtTab=document.querySelector('[data-focus-view="court"]');
  courtTab?.addEventListener('click',()=>{if(courtView==='full')selectHalf();refreshCourtQueue();});
  // Start data load after main game bootstrap finishes.
  let startupTries=0;const initialized=()=>{if(currentGame){selectHalf();void initRemote();}else if(++startupTries<30)setTimeout(initialized,350);};
  setTimeout(initialized,300);
  refreshCourtQueue();
})();
