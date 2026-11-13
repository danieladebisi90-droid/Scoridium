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
  let lastShotCount=officialShots().length;
  let previouslyRenderedPeriod=Number(state.period)||1;
  window.render=function(){
    const prior=previouslyRenderedPeriod;
    originalRender();refreshSummary();refreshCourtQueue();paintObservationMarkers();
    const shotCount=officialShots().length;if(shotCount!==lastShotCount){lastShotCount=shotCount;if(remoteEnabled)scheduleReconcile();}
    if(currentGame && state.status!=='not_started' && Number(state.period)!==prior){
      previouslyRenderedPeriod=Number(state.period);
      // A quarter boundary is a reconciliation checkpoint, not a hard lock.
      renderCheckpoint(prior);if(!scorePromptOpen&&document.querySelector('.tracker-shell')?.dataset.focusView==='court')void physicalScoreCheckpoint(prior);
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
  courtSection.innerHTML=`<div class="sc-court-head"><div><h2>SHOT LOCATIONS</h2><p>FIBA court · independent tracking</p></div><span id="sc-court-sync" role="status">Preparing…</span></div>
    <div class="sc-court-main">
      <aside class="sc-shot-sidebar">
        <div class="sc-court-modes" role="group" aria-label="Half-court shooting team"><button type="button" id="sc-offense" class="active">OFFENSE</button><button type="button" id="sc-defense">DEFENSE</button></div>
        <div class="sc-court-scope"><label for="sc-team-scope">Observe</label><select id="sc-team-scope"><option value="us">Tracked team only</option><option value="both">Both teams</option></select></div>
        <button type="button" class="sc-compact-directions" id="sc-swap-directions" title="Switch basket directions" aria-label="Switch basket directions">⇄</button>
      </aside>
      <div class="sc-court-body"><div id="sc-court-mount"></div><div id="sc-court-feedback" role="status" aria-live="polite">Tap/click = made · Double tap/click = missed</div></div>
      <aside class="sc-tools-sidebar"><button type="button" id="sc-shot-counts" class="sc-shot-counts" aria-label="Open Tracker A and B comparison"><strong id="sc-total-shots">0 shots</strong><span id="sc-total-matched">0 matched · 0 pending</span><span>Compare A / B ›</span></button>
        <div class="sc-ft-bar" id="sc-ft-bar"><strong>FT</strong><div id="sc-ft-step"></div></div>
        <button type="button" id="sc-undo-court" class="sc-mini-button">Undo</button></aside>
    </div>
    <div id="sc-checkpoint-summary" class="sc-checkpoint-summary" hidden></div>`;
  stage.append(courtSection);
  const courtWrap=courtPanel.querySelector('.court-wrap');
  courtSection.querySelector('#sc-court-mount').append(courtPanel);
  const oldHeader=courtPanel.querySelector('.section-heading');if(oldHeader)oldHeader.hidden=true;
  const undo=byId('undo-event');if(undo)undo.hidden=true;
  const homeTeam=()=>currentGame?.location?.toLowerCase()!=='away';
  const [offBtn,defBtn]=[byId('sc-offense'),byId('sc-defense')];
  let view='offense',observations=[],quickObservations=[],sessionUser=null,remoteEnabled=false,obsChannel=null,quickObsChannel=null,busy=false;
  let linking=false,scorePromptOpen=false,localScope='us',courtLastTap=null,gestureTimer=null,reconcileTimer=null;
  let checkpointRows=[];const unsyncedIds=new Set();
  const scoreSavedKey=period=>`scoridium-quarter-score:${gameId}:${sessionUser?.id||'none'}:${period}`;
  const observationsKey=()=>`scoridium-court-observations:${gameId||'none'}`;
  try{observations=JSON.parse(localStorage.getItem(observationsKey())||'[]')||[];}catch{observations=[];}
  function setFeedback(text){byId('sc-court-feedback').textContent=text;}
  const usIsHome=()=>homeTeam();
  function effectiveScope(){return byId('sc-team-scope').value;}
  function updateCourtModeUI(){
    const full=courtView==='full';courtSection.classList.toggle('sc-full-mode',full);
    offBtn.classList.toggle('active',view==='offense');defBtn.classList.toggle('active',view==='defense');
    renderCourtLabels();
  }
  function selectHalf(){
    const ourSide=usIsHome()?'home':'away';
    const side=view==='offense'?ourSide:ourSide==='home'?'away':'home';
    if(courtView!=='half')byId('half-court-btn')?.click();
    (side==='home'?byId('home-court-btn'):byId('away-court-btn'))?.click();
    updateCourtModeUI();paintObservationMarkers();
  }
  function setView(next){view=next;selectHalf();refreshCourtQueue();}
  offBtn.addEventListener('click',()=>setView('offense'));
  defBtn.addEventListener('click',()=>setView('defense'));
  const fullBtn=byId('full-court-btn'),halfBtn=byId('half-court-btn');
  const courtChoices=document.createElement('div');courtChoices.className='sc-court-view-choices';
  byId('sc-offense').parentElement.before(courtChoices);
  courtChoices.append(halfBtn,fullBtn);

  function enforceOrientation(){
    const portrait=matchMedia('(orientation:portrait) and (max-width:800px)').matches;
    const landscape=matchMedia('(orientation:landscape)').matches;
    const left=courtSection.querySelector('.sc-shot-sidebar');
    const right=courtSection.querySelector('.sc-tools-sidebar');
    const counter=byId('sc-shot-counts');
    // Preserve the same controls and listeners; only move them between rails.
    // Landscape: one wide right rail, with court occupying all available left space.
    if(landscape){
      for(const node of [courtChoices,byId('sc-offense').parentElement,byId('sc-team-scope').parentElement,byId('sc-swap-directions')]){
        if(node && node.parentElement!==right)right.insertBefore(node,right.querySelector('.sc-ft-bar'));
      }
      if(counter && counter.parentElement!==right)right.insertBefore(counter,right.querySelector('.sc-ft-bar'));
    }else{
      for(const node of [courtChoices,byId('sc-offense').parentElement,byId('sc-team-scope').parentElement,byId('sc-swap-directions')]){
        if(node && node.parentElement!==left)left.append(node);
      }
      if(counter){const dest=portrait?left:right;
        if(counter.parentElement!==dest)dest.prepend(counter);
        else if(portrait)left.prepend(counter);
      }
    }
    if(portrait&&courtView!=='half')selectHalf();else updateCourtModeUI();paintObservationMarkers();
  }
  fullBtn?.addEventListener('click',()=>{
    if(matchMedia('(orientation:portrait) and (max-width:800px)').matches){selectHalf();return;}
    updateCourtModeUI();
  });
  halfBtn?.addEventListener('click',()=>{selectHalf();updateCourtModeUI();});
  window.addEventListener('resize',enforceOrientation);
  byId('sc-team-scope').addEventListener('change',()=>{refreshCourtQueue();scheduleReconcile();});
  function saveLocalObservations(){localStorage.setItem(observationsKey(),JSON.stringify(observations));}
  async function addObservation(o){
    if(!gameId){setFeedback('Choose a real game first.');return;}
    const observation={id:crypto.randomUUID(),game_id:gameId,period:state.period,team:o.team,points:o.points??null,made:o.made??null,
      x:o.x??null,y:o.y??null,distance_meters:o.distance_meters??null,distance_feet:o.distance_feet??null,kind:o.kind||'shot',
      observed_at:new Date().toISOString(),tracker_id:sessionUser?.id||null,matched_event_id:null};
    observations.push(observation);saveLocalObservations();refreshCourtQueue();paintObservationMarkers();
    if(!remoteEnabled){setFeedback('Saved locally only — matching requires successful cross-device synchronization.');return;}
    const {error}=await supabaseClient.from('tracker_observations').insert(observation);
    if(error){unsyncedIds.add(observation.id);console.warn('Could not sync location observation',error);setFeedback('Observation saved locally only; check permissions before continuing.');}
    else {setFeedback('Observation shared · matching automatically. No official points added.');scheduleReconcile();}
  }
  // Single click/tap records MAKE; two nearby clicks/taps record one MISS.
  // Defer the first click so double-click cannot record two makes.
  async function undoObservation(target){
    if(!target||target.matched_event_id){setFeedback('Matched shots need a correction review; no official shot will be deleted.');return false;}
    if(unsyncedIds.has(target.id)||!remoteEnabled||!sessionUser){
      observations=observations.filter(o=>o.id!==target.id);unsyncedIds.delete(target.id);
    }else{
      const {data,error}=await supabaseClient.rpc('scoridium_retract_own_observation',{p_id:target.id});
      if(error||data!==true){setFeedback(`Unable to undo synced observation: ${error?.message||'Check v2 migration'}`);return false;}
      target.retracted_at=new Date().toISOString();
    }
    saveLocalObservations();refreshCourtQueue();paintObservationMarkers();scheduleReconcile();
    setFeedback('Most recent unmatched observation retracted; official scoring unchanged.');return true;
  }
  const svg=byId('basketball-court');
  svg.style.touchAction='manipulation';
  function getCourtPoint(event){
    const matrix=svg.getScreenCTM();if(!matrix)return null;
    const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    const bounds=courtView==='half'?{maxX:460,maxY:430}:{maxX:850,maxY:460};
    if(p.x<10||p.y<10||p.x>bounds.maxX||p.y>bounds.maxY)return null;
    return displayToCourt(p.x,p.y);
  }
  async function recordCourtShot(point,made){
    if(!point||busy)return;
    const info=detectShot(point.x,point.y),dist=calculateShotDistance(point.x,point.y);
    const team=info.team===(usIsHome()?'home':'away')?'us':'opponent';
    if(effectiveScope()==='us'&&team!=='us'){
      setFeedback('Tracked team only is active. Switch to Both teams to record opponent shots.');return;
    }
    await addObservation({kind:'shot',team,points:info.points,made,x:point.x,y:point.y,distance_meters:dist.meters,distance_feet:dist.feet});
  }
  function paintObservationMarkers(){
    const markers=byId('shot-markers');if(!markers)return;
    markers.querySelectorAll('.sc-provisional-marker').forEach(e=>e.remove());
    const ids=new Set();
    for(const obs of observations){
      if(obs.retracted_at||obs.kind!=='shot'||obs.matched_event_id||obs.x==null||obs.y==null||Number(obs.period)!==Number(state.period))continue;
      if(ids.has(obs.id))continue;ids.add(obs.id);
      const position=courtToDisplay(Number(obs.x),Number(obs.y));if(!position)continue;
      const node=document.createElementNS('http://www.w3.org/2000/svg','circle');
      node.setAttribute('cx',position.x);node.setAttribute('cy',position.y);node.setAttribute('r','7');
      node.setAttribute('stroke',obs.made?'#047d3b':'#c82e37');node.setAttribute('stroke-width','3');
      node.setAttribute('stroke-dasharray','3 2');node.setAttribute('fill','none');
      node.setAttribute('pointer-events','none');node.setAttribute('class','sc-provisional-marker');
      markers.append(node);
    }
  }
  svg.addEventListener('click',e=>{
    if(document.querySelector('.tracker-shell')?.dataset.focusView!=='court')return;
    e.stopImmediatePropagation();e.preventDefault();
    const point=getCourtPoint(e);if(!point)return;
    const now=performance.now();
    if(courtLastTap&&now-courtLastTap.at<340&&Math.hypot(e.clientX-courtLastTap.x,e.clientY-courtLastTap.y)<32){
      clearTimeout(gestureTimer);courtLastTap=null;gestureTimer=null;
      void recordCourtShot(point,false);return;
    }
    if(courtLastTap){clearTimeout(gestureTimer);void recordCourtShot(courtLastTap.point,true);}
    courtLastTap={point,x:e.clientX,y:e.clientY,at:now};
    gestureTimer=setTimeout(()=>{const tap=courtLastTap;courtLastTap=null;gestureTimer=null;if(tap)void recordCourtShot(tap.point,true);},340);
  },true);
  svg.addEventListener('dblclick',e=>{if(document.querySelector('.tracker-shell')?.dataset.focusView==='court'){e.stopImmediatePropagation();e.preventDefault();}},true);
  // Fixed-size, single-row FT control: FT → Team → Attempts → outcome for each.
  let ftStep=0,ftTeam='us',ftCount=2,ftResults=[];
  function paintFt(){
    const host=byId('sc-ft-step');host.replaceChildren();
    const btn=(label,click,cls='')=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.className=cls;b.addEventListener('click',click);host.append(b);return b;};
    if(ftStep===0){btn('FT',()=>{ftStep=1;paintFt();});}
    else if(ftStep===1){btn('‹',()=>{ftStep=0;paintFt();},'sc-ft-back');btn(names().us,()=>{ftTeam='us';ftStep=2;paintFt();});btn(names().opponent,()=>{ftTeam='opponent';ftStep=2;paintFt();});}
    else if(ftStep===2){btn('‹',()=>{ftStep=1;paintFt();},'sc-ft-back');[1,2,3].forEach(n=>btn(`${n} FT`,()=>{ftCount=n;ftResults=[];ftStep=3;paintFt();}));}
    else if(ftStep===3){
      btn('‹',async()=>{if(ftResults.length){const target=[...observations].reverse().find(o=>!o.retracted_at&&o.kind==='free_throw'&&o.team===ftTeam&&Number(o.period)===Number(state.period)&&o.tracker_id===sessionUser?.id);if(target&&await undoObservation(target))ftResults.pop();}else ftStep=2;paintFt();},'sc-ft-back');
      const label=document.createElement('strong');label.textContent=`${ftResults.length+1}/${ftCount}`;host.append(label);
      for(const [label,made,cls] of [['MADE',true,'sc-make'],['MISS',false,'sc-miss']])btn(label,async()=>{
        await addObservation({kind:'free_throw',team:ftTeam,points:1,made});ftResults.push(made?'M':'X');
        if(ftResults.length>=ftCount)ftStep=4;paintFt();
      },cls);
    }else{const label=document.createElement('span');label.textContent=`${ftResults.filter(x=>x==='M').length}/${ftCount} · saved`;host.append(label);btn('Done',()=>{ftStep=0;paintFt();});}
  }
  paintFt();
  byId('sc-undo-court').addEventListener('click',async()=>{
    const target=[...observations].reverse().find(o=>!o.retracted_at&&o.kind==='shot'&&o.tracker_id===sessionUser?.id);
    if(!target){setFeedback('No shot from this tracker to undo.');return;}
    await undoObservation(target);
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
  // Align the whole quarter. Team-only Court tracking filters official opponent shots.
  // Dynamic programming tolerates insertions/deletions, and anchors on team+type+result.
  // Ties are not auto-linked because repetitive streaks can be ambiguous.
  function alignSequence(official,observed){
    const n=official.length,m=observed.length;
    const costs=Array.from({length:n+1},()=>Array(m+1).fill(0));
    for(let i=1;i<=n;i++)costs[i][0]=i;
    for(let j=1;j<=m;j++)costs[0][j]=j;
    const equal=(a,b)=>a.team===b.team&&Number(a.points)===Number(b.points)&&Boolean(a.made)===Boolean(b.made)&&(a.type==='free_throw')===(b.kind==='free_throw');
    for(let i=1;i<=n;i++)for(let j=1;j<=m;j++){
      const same=equal(official[i-1],observed[j-1]);
      costs[i][j]=Math.min(costs[i-1][j]+1,costs[i][j-1]+1,costs[i-1][j-1]+(same?0:2));
    }
    let i=n,j=m;const rows=[];
    while(i||j){
      const same=i&&j&&equal(official[i-1],observed[j-1]);
      const diagonal=i&&j&&costs[i][j]===costs[i-1][j-1]+(same?0:2);
      const up=i&&costs[i][j]===costs[i-1][j]+1;
      const left=j&&costs[i][j]===costs[i][j-1]+1;
      if(same&&diagonal){
        // Repeated identical entries without a unique nearby anchor are review-only.
        const ambiguity=(up&&left)||
          (i>1&&equal(official[i-2],observed[j-1]))||
          (j>1&&equal(official[i-1],observed[j-2]));
        rows.push({event:official[--i],obs:observed[--j],status:ambiguity?'ambiguous':'aligned'});
      }else if(up){rows.push({event:official[--i],obs:null,status:'missing-court'});}
      else if(left){rows.push({event:null,obs:observed[--j],status:'extra-court'});}
      else if(diagonal){rows.push({event:official[--i],obs:observed[--j],status:'conflict'});}
      else if(i)rows.push({event:official[--i],obs:null,status:'missing-court'});
      else rows.push({event:null,obs:observed[--j],status:'extra-court'});
    }
    return rows.reverse();
  }
  function compare(period=state.period){
    const scope=effectiveScope();
    const candidates=observations.filter(o=>!o.retracted_at&&Number(o.period)===Number(period));
    const observedFTTeams=new Set(candidates.filter(o=>o.kind==='free_throw').map(o=>o.team));
    const official=state.events.filter(e=>
      Number(e.period)===Number(period)&&
      (e.type==='shot'||e.type==='free_throw')&&
      ((e.type==='shot'&&(scope==='both'||e.team==='us'))||
       (e.type==='free_throw'&&observedFTTeams.has(e.team))))
      .slice().sort((a,b)=>Number(a.time||0)-Number(b.time||0));
    const obs=candidates.filter(o=>
      (o.kind==='shot'&&(scope==='both'||o.team==='us'))||o.kind==='free_throw')
      .sort((a,b)=>Date.parse(a.observed_at)-Date.parse(b.observed_at));
    const found=alignSequence(official,obs);
    return {found,
      unused:found.filter(r=>!r.event&&r.obs?.kind==='shot').map(r=>r.obs),
      matched:found.filter(r=>r.obs?.kind==='shot'&&r.event?.type==='shot'&&
        (r.obs.matched_event_id===r.event.id||r.status==='aligned')).length,
      ambiguous:found.filter(r=>r.status==='ambiguous'||r.status==='conflict').length};
  }
  function scheduleReconcile(){clearTimeout(reconcileTimer);reconcileTimer=setTimeout(()=>void reconcile(),550);}
  async function reconcile(){
    if(linking||busy||!remoteEnabled||!sessionUser)return;
    linking=true;
    try{
      const periods=new Set(observations.filter(o=>!o.retracted_at&&o.kind==='shot').map(o=>Number(o.period)));
      for(const period of periods){
        const result=compare(period);
        for(const pair of result.found){
          if(pair.status!=='aligned'||pair.event?.type!=='shot'||pair.obs?.kind!=='shot'||pair.obs.matched_event_id||pair.event.x!=null||pair.event.y!=null)continue;
          // Require synced, versioned official event and enough timing consistency.
          const dt=Math.abs(Date.parse(pair.obs.observed_at)-Number(pair.event.time||0));
          if(!Number.isInteger(Number(pair.event.version))||Number(pair.event.version)<1||dt>120000)continue;
          try{
            const {data,error}=await supabaseClient.rpc('scoridium_link_shot_observation',{
              p_game_id:gameId,p_observation_id:pair.obs.id,p_event_id:pair.event.id,p_expected_version:Number(pair.event.version)});
            if(error||!Array.isArray(data)||data.length!==1)continue;
            pair.obs.matched_event_id=pair.event.id;pair.event.x=Number(pair.obs.x);pair.event.y=Number(pair.obs.y);
            pair.event.distanceMeters=Number(pair.obs.distance_meters);pair.event.distanceFeet=Number(pair.obs.distance_feet);
            pair.event.version=Number(data[0].new_version);
          }catch(e){console.warn('Auto-link skipped',e);}
        }
      }
      saveLocalObservations();save();renderCourt();paintObservationMarkers();refreshCourtQueue();
    }finally{linking=false;}
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
      saveLocalObservations();save();renderCourt();paintObservationMarkers();refreshCourtQueue();renderCheckpoint(event.period);
      setFeedback(`Linked observation to ${eventKind(event)}. One official field-goal attempt retained.`);
    }catch(e){console.error('Observation matching failed',e);setFeedback(`Match not saved: ${e.message||'Refresh and try again.'}`);}
    finally{busy=false;}
  }
  function eventTotals(period,team){
    const ev=state.events.filter(e=>Number(e.period)===Number(period)&&e.team===team);
    return ev.reduce((n,e)=>n+(e.made===false?0:Number(e.points||0)),0);
  }
  function observedTotals(period,team){
    const obs=observations.filter(o=>!o.retracted_at&&Number(o.period)===Number(period)&&o.team===team);
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
    const observed=observations.filter(o=>!o.retracted_at&&o.kind==='free_throw'&&Number(o.period)===Number(period));
    const consumed=new Set();let matches=0;
    for(const event of official){
      const options=observed.filter(o=>!consumed.has(o.id)&&o.team===event.team&&Boolean(o.made)===Boolean(event.made)&&
        Math.abs(Date.parse(o.observed_at)-Number(event.time||0))<=45000);
      if(options.length===1){consumed.add(options[0].id);matches++;}
    }
    return {official:official.length,observed:observed.length,matches,unmatched:observed.length-matches};
  }
  function running(rows){const totals={us:0,opponent:0};return rows.map(r=>{
    const e=r.event,o=r.obs;
    if(e&&e.made)totals[e.team]+=Number(e.points||0);
    return {...r,quickScore:`${totals.us}–${totals.opponent}`};
  });}
  function renderCheckpoint(period=state.period){
    const r=compare(period),ind=compareIndependent(period),fts=compareFT(period);
    const area=byId('sc-checkpoint-summary');area.hidden=false;
    const summary=`<div class="sc-review-head"><h3>${safe(periodName(period))} · Tracker A / B</h3><button id="sc-close-review" aria-label="Close comparison" type="button">×</button></div>
      <p>${r.matched} aligned or linked · ${r.found.filter(x=>x.status!=='aligned'&&(x.obs?.matched_event_id==null||x.obs?.matched_event_id!==x.event?.id)).length} for review · ${r.ambiguous} conflicts/ambiguous</p>
      <div class="sc-review-columns"><b>Quick Track A</b><b>Court B</b><b>Result</b></div><div class="sc-review-rows"></div>
      <p>Recorded scoring this quarter: Quick ${eventTotals(period,'us')}–${eventTotals(period,'opponent')} · Court observations ${observedTotals(period,'us')}–${observedTotals(period,'opponent')} (may omit opponent).</p>
      <p>FT observations: ${fts.matches}/${fts.official} likely matching attempts; ${fts.unmatched} extra Court observations.</p>
      <p>Score checkpoints are requested at the end of each quarter. A matching score does not prove all shots are correct.</p>`;
    area.innerHTML=summary;
    const rows=area.querySelector('.sc-review-rows');let scoreA={us:0,opponent:0},scoreB={us:0,opponent:0};
    for(const row of r.found){
      if(row.event?.made)scoreA[row.event.team]+=Number(row.event.points||0);
      if(row.obs?.made)scoreB[row.obs.team]+=Number(row.obs.points||0);
      const div=document.createElement('div');div.className='sc-review-columns';
      for(const text of [row.event?`${row.event.team==='us'?'Tracked':'Opponent'} ${row.event.type==='free_throw'?'FT':row.event.points+'PT'} ${row.event.made?'M':'X'} · ${scoreA.us}–${scoreA.opponent}`:'—',row.obs?`${row.obs.team==='us'?'Tracked':'Opponent'} ${row.obs.kind==='free_throw'?'FT':row.obs.points+'PT'} ${row.obs.made?'M':'X'} · ${scoreB.us}–${scoreB.opponent}`:'—',row.obs?.matched_event_id===row.event?.id&&row.event?'Linked':row.status]){
        const span=document.createElement('span');span.textContent=text;div.append(span);
      }
      rows.append(div);
    }
    const checks=checkpointRows.filter(c=>Number(c.period)===Number(period));
    if(checks.length){
      const check=document.createElement('p');
      const latestByUser=new Map();for(const c of checks)latestByUser.set(c.tracker_id,c);
      const distinct=[...latestByUser.values()];
      const agreed=distinct.length>1&&distinct.every(c=>c.observed_home_score===distinct[0].observed_home_score&&c.observed_away_score===distinct[0].observed_away_score);
      check.textContent=`Physical scoreboard: ${distinct.map(c=>c.observed_home_score+'–'+c.observed_away_score).join(' / ')} · ${distinct.length} independent reporter(s) · ${agreed?'agree':distinct.length>1?'DISAGREE':'awaiting second tracker'}`;
      area.append(check);
    }
    area.querySelector('#sc-close-review').addEventListener('click',()=>{area.hidden=true;});
  }
  byId('sc-shot-counts').addEventListener('click',()=>renderCheckpoint());
  function refreshCourtQueue(){
    const count=byId('sc-total-shots');if(!count)return;
    const scope=effectiveScope(),shots=observations.filter(o=>!o.retracted_at&&o.kind==='shot'&&(scope==='both'||o.team==='us'));
    const matches=shots.filter(o=>o.matched_event_id).length;
    count.textContent=`${shots.length} shots`;
    byId('sc-total-matched').textContent=`${matches} matched · ${shots.length-matches} pending`;
    const area=byId('sc-checkpoint-summary');if(area&&!area.hidden)renderCheckpoint();
  }
  async function physicalScoreCheckpoint(period){
    if(scorePromptOpen||!gameId||localStorage.getItem(scoreSavedKey(period))==='yes')return false;scorePromptOpen=true;
    const dialog=document.createElement('dialog');dialog.className='sc-ft-dialog';
    dialog.innerHTML=`<form method="dialog"><h3>End of ${safe(periodName(period))} · Physical scoreboard</h3>
      <p>Both trackers must independently enter what the venue scoreboard actually shows. Do not copy Scoridium's score.</p>
      <label>Home <input name="home" type="number" min="0" max="999" required placeholder="Actual score"></label>
      <label>Away <input name="away" type="number" min="0" max="999" required placeholder="Actual score"></label>
      <div class="sc-ft-checks"><button type="button" id="sc-submit-score" class="sc-make">SAVE SCORE</button><button type="button" id="sc-cancel-score">LATER</button></div>
      <p class="sc-check-status" role="status"></p></form>`;
    document.body.append(dialog);dialog.showModal();
    return new Promise(resolve=>{
      let done=false;const finish=v=>{if(done)return;done=true;dialog.close();resolve(v);};
      dialog.addEventListener('close',()=>{scorePromptOpen=false;dialog.remove();if(!done){done=true;resolve(false);}});
      dialog.querySelector('#sc-cancel-score').addEventListener('click',()=>finish(false));
      dialog.querySelector('#sc-submit-score').addEventListener('click',async()=>{
        const home=Number(dialog.querySelector('[name=home]').value),away=Number(dialog.querySelector('[name=away]').value);
        if(!dialog.querySelector('[name=home]').value||!dialog.querySelector('[name=away]').value||!Number.isInteger(home)||!Number.isInteger(away)||home<0||away<0){dialog.querySelector('.sc-check-status').textContent='Enter both actual scoreboard numbers.';return;}
        if(!sessionUser){dialog.querySelector('.sc-check-status').textContent='Sign in before saving.';return;}
        const {error}=await supabaseClient.from('tracker_checkpoints').insert({game_id:gameId,tracker_id:sessionUser.id,period,checkpoint_type:'quarter',observed_home_score:home,observed_away_score:away});
        if(error){dialog.querySelector('.sc-check-status').textContent=`Cannot save checkpoint: ${error.message}`;return;}
        checkpointRows.push({tracker_id:sessionUser.id,period,observed_home_score:home,observed_away_score:away});
        localStorage.setItem(scoreSavedKey(period),'yes');finish(true);
      });
    });
  }
  // Intercept before the legacy End Quarter handler. Record venue score first, then
  // let the existing confirmation + network writes run untouched.
  let quarterAuthorized=false;
  const legacyEnd=byId('end-quarter');
  legacyEnd?.addEventListener('click',async event=>{
    if(quarterAuthorized){quarterAuthorized=false;return;}
    if(state.status!=='live')return;
    if(localStorage.getItem(scoreSavedKey(state.period))==='yes')return;
    event.preventDefault();event.stopImmediatePropagation();
    const ok=await physicalScoreCheckpoint(state.period);
    if(ok){quarterAuthorized=true;legacyEnd.click();}
  },true);
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
    const {data:checkRows}=await supabaseClient.from('tracker_checkpoints').select('*').eq('game_id',gameId).order('observed_at',{ascending:true});
    if(checkRows)checkpointRows=checkRows;
    const gamePeriodChannel=supabaseClient.channel(`scoridium-quarter-prompt-${gameId}`)
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'games',filter:`id=eq.${gameId}`},payload=>{
        const next=Number(payload.new?.current_period),prior=Number(state.period);
        if(next>prior&&state.status!=='not_started'){
          if(!localStorage.getItem(scoreSavedKey(prior)))void physicalScoreCheckpoint(prior);
        }
      }).subscribe();

    const {data:rows,error}=await supabaseClient.from('tracker_observations').select('*').eq('game_id',gameId).order('observed_at',{ascending:true});
    if(error){remoteEnabled=false;byId('sc-court-sync').textContent='Local observations';setFeedback('Collaboration database not yet configured. Run MIGRATION_COLLABORATION.sql before multi-device testing.');return;}
    remoteEnabled=true;byId('sc-court-sync').textContent='Shared observations';
    const local=observations.slice();observations=rows||[];
    // Preserve unsynced local observations, never silently delete them.
    for(const o of local)if(!observations.some(r=>r.id===o.id))observations.push(o);
    saveLocalObservations();refreshCourtQueue();paintObservationMarkers();scheduleReconcile();
    if(obsChannel)await supabaseClient.removeChannel(obsChannel);
    obsChannel=supabaseClient.channel(`scoridium-court-${gameId}`).on('postgres_changes',{
      event:'*',schema:'public',table:'tracker_observations',filter:`game_id=eq.${gameId}`},async()=>{
        const {data:latest}=await supabaseClient.from('tracker_observations').select('*').eq('game_id',gameId).order('observed_at',{ascending:true});
        if(latest){for(const o of latest){const idx=observations.findIndex(v=>v.id===o.id);if(idx===-1)observations.push(o);else observations[idx]=o;}saveLocalObservations();refreshCourtQueue();paintObservationMarkers();scheduleReconcile();}
      }).subscribe();
  }
  // Do not auto change offense/defense when Quick Track records a shot.
  const courtTab=document.querySelector('[data-focus-view="court"]');
  courtTab?.addEventListener('click',()=>{enforceOrientation();refreshCourtQueue();});
  // Start data load after main game bootstrap finishes.
  let startupTries=0;const initialized=()=>{if(currentGame){enforceOrientation();void initRemote();}else if(++startupTries<30)setTimeout(initialized,350);};
  setTimeout(initialized,300);
  refreshCourtQueue();
})();
