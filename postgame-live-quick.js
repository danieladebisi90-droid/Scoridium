/* ApexVision post-game adapter built directly from live quick-track.js.
   Preserves the original jersey/stat/foul/rebound/FT rendering workflow.
   Completed-game writes use postgame-only authorized RPCs. */
(() => {
  'use strict';
  const root=document.getElementById('post-quick-root');
  const api=window.apexPostgame;
  if(!root||!api||api.mode==='shot')return;
  let players=[],teamName='Tracked team',currentGame={opponent:'Opponent'};
  const state={status:'live'};
  let writeQueue=Promise.resolve(),unresolved=0,lastSaveError='';
  const pendingIds=new Map();
  let selectedCourtShot=null,pendingCourtShot=null,pendingAssist=null,opponentJersey=null;
  let linkIntent=null,linkShot=null,linkingPlayer=null,linkShootingTeam=null; // Current unsaved player-first related event
  let phoneTeam='choose';
  const phoneCombined=()=>api.mode==='combined'&&matchMedia('(max-width:700px) and (orientation:portrait)').matches;
  const rootContainer=()=>root.querySelector('.qv-tracked');
  const notify=s=>{api.notify(s);};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let teamMode=false;
  // Post-game Film Room always opens directly on jerseys (Player Mode).
  // Users never need to switch modes to begin or continue a play.
  const teamModeBtn=document.getElementById('quick-team-mode');
  if(teamModeBtn){teamModeBtn.hidden=true;teamModeBtn.setAttribute('aria-pressed','false');}

  let mode='idle', who=null, shooting='us', source=null, last='Ready to track', block=null;
  let foul={type:null,shot:null,result:null,bonus:null,ft:null,technicalPersonal:null,shotAlreadyRecorded:null};
  let committedFoulId=null;
  let ft={total:0,done:0,shooter:null,source:null,team:'us',lastMiss:false,dead:false,pendingShot:null,fromFoul:false};
  const opposite=t=>t==='us'?'opponent':'us';
  const names=()=>({us:teamName||'Tracked team',opponent:currentGame?.opponent||'Opponent'});
  const active=()=>state.status==='live';
  const player=()=>players.find(p=>String(p.id)===String(who));
  const label=(id)=>id==null?'Unknown Player':`#${players.find(p=>String(p.id)===String(id))?.number??'?'}`;
  const tell=s=>{last=s;render();};
  const reset=()=>{linkIntent=null;linkShot=null;linkingPlayer=null;linkShootingTeam=null;updateLinkHighlights();if(phoneCombined())phoneTeam='choose';teamMode=false;mode='idle';who=null;source=null;block=null;selectedCourtShot=null;opponentJersey=null;committedFoulId=null;foul={type:null,shot:null,result:null,bonus:null,ft:null,technicalPersonal:null,shotAlreadyRecorded:null};render();};
  const record=(type,team,playerId=null,extra={})=>{
    if(!active())return null;
    if(type==='no_assist')return null; // confirmation is a UI choice, not a real stat event.
    const id=crypto.randomUUID(),relatedId=extra.linkedEventId||null;
    const candidate={type,team,playerId,points:extra.points??null,made:extra.made??null,
      position:extra.position??null,linkedEventId:relatedId,fixedId:id,confirmed:!!relatedId};
    if(!candidate.position&&type==='shot'&&selectedCourtShot?.team===team
      &&selectedCourtShot.points===candidate.points&&selectedCourtShot.made===candidate.made){
      candidate.position=selectedCourtShot.position;
      selectedCourtShot=null;
    }
    if(type==='shot'&&api.mode==='combined'&&!candidate.position&&!phoneCombined())pendingCourtShot={id,team,points:extra.points,made:extra.made};
    let priorAssist=null;
    if(type==='assist'&&!relatedId)pendingAssist={id,team};
    // Shot-to-assist linking is explicit through the marker-based workflow.
    if(type==='shot'&&candidate.made&&pendingAssist?.team===team)pendingAssist=null;
    const thisOpponentJersey=type==='shot'&&team==='opponent'?opponentJersey:null;
    unresolved++;
    writeQueue=writeQueue.then(async()=>{
      // Resolve a related event written earlier in this queue to its saved database ID.
      if(candidate.linkedEventId)candidate.linkedEventId=pendingIds.get(candidate.linkedEventId)||candidate.linkedEventId;
      const saved=await api.saveEvent(candidate,document.getElementById('post-review-save-anchor'));
      if(!saved)throw new Error('Event was not saved or was cancelled');
      pendingIds.set(id,saved);
      if(priorAssist)await api.linkRelated(pendingIds.get(priorAssist)||priorAssist,saved);
      if(thisOpponentJersey!==null){
        const auth=await supabaseClient.auth.getUser();
        if(auth.data?.user){
          const assigned=await supabaseClient.from('apexvision_postgame_opponent_jerseys').upsert({
            event_id:saved,game_id:api.gameId,jersey_number:thisOpponentJersey,updated_by:auth.data.user.id
          },{onConflict:'event_id'});
          if(assigned.error)notify('Opponent jersey was not saved: '+assigned.error.message);
        }
      }
      await api.refresh();
      window.dispatchEvent(new CustomEvent('apex:postgame-events-updated'));
    }).catch(error=>{lastSaveError=String(error.message||error);notify('Review entry needs attention: '+lastSaveError);})
      .finally(()=>{unresolved--;});
    return id;
  };
  const shot=(team,points,made,playerId=null)=>{
    if(selectedCourtShot&&selectedCourtShot.team===team&&
     (selectedCourtShot.points!==points||selectedCourtShot.made!==made)){
      tell('Court selection is '+(selectedCourtShot.made?'MAKE ':'MISS ')+selectedCourtShot.points+'PT. Choose the matching Quick Track shot button.');
      return null;
    }
    // A new court-first selection always records its own shot. Older unlocated
    // attempts are resolved explicitly from Shot Links rather than hijacking
    // the new shooter-selection workflow (or silently reassigning a shot).
    return record('shot',team,playerId,{points,made});
  };
  const related=(type,team,playerId=null,linkedEventId=source)=>record(type,team,playerId,{...(linkedEventId?{linkedEventId}:{})});
  const btn=(action,text,kind='',extra='')=>`<button type="button" class="qv-button ${kind}" data-qv="${action}" ${extra}>${esc(text)}</button>`;
  const tile=(action,text,kind='',extra='')=>`<button type="button" class="qv-button qv-tile ${kind}" data-qv="${action}" ${extra}>${esc(text)}</button>`;
  const tileGrid=items=>`<div class="qv-grid">${items.join('')}</div>`;
  const roster=(action='player',exclude=null,extra=null)=>teamMode&&action!=='player'?tileGrid([tile(action,'TEAM','qv-neutral'),...(extra?[tile(extra[0],extra[1],'qv-neutral')]:[])]):tileGrid([...players.map(p=>tile(action,`#${p.number??'?'}`,'',`data-player="${esc(p.id)}" ${exclude!==null&&String(exclude)===String(p.id)?'disabled':''}`)),...(extra?[tile(extra[0],extra[1],'qv-neutral')]:[])]);
  const choice=(options)=>`<div class="qv-choices">${options.map(x=>tile(x[0],x[1],x[2]||'')).join('')}</div>`;
  function startRebound(missedTeam,id,blocked=null){shooting=missedTeam;source=id;block=blocked;mode='reboundChoice';if(phoneCombined())phoneTeam='us';render();}
  function conclude(message){
    last=message;
    if(phoneCombined()){
      // Related basketball actions (assist, rebound, block, foul, FTs) are
      // presented by their own states BEFORE conclude() is reached.
      // Once a sequence is complete, do not invent a generic follow-up.
      mode='idle';source=null;block=null;who=null;teamMode=false;
      selectedCourtShot=null;opponentJersey=null;
      phoneTeam='choose';render();
    }else reset();
  }
  function assignRebound(team,pid=null,teamRebound=false){
    const decision=window.ApexBasketballRules?.rebound(shooting,team,teamRebound);
    if(!decision)return;
    const kind=decision.type.replace(/^team_/, '');
    const type=decision.type;
    related(type,team,pid);
    conclude(`${names()[team]} ${team===shooting?'OREB':'DREB'}${pid?` ${label(pid)}`:teamRebound?' (team)':' (unassigned)'}`);
  }
  function startFT(total,team,playerId,id,dead=false,pendingShot=null){
    ft={total:Number(total),done:0,team,shooter:playerId,source:id,lastMiss:false,dead,pendingShot,fromFoul:true};
    mode=team==='us'&&playerId==null?'ftShooter':'ft';render();
  }
  const bonusPenalty=team=>{
    const settings=window.ApexBasketballRuleConfig || {};
    // FIBA rules by default. Configure threshold:null to require manual entry.
    const threshold=settings.bonusThreshold===null?null:
      Math.max(1,Number(settings.bonusThreshold)||5);
    if(threshold===null)return null;
    const period=typeof state.period==='number'?state.period:
      (typeof api!=='undefined'?api.getPeriod():1);
    const events=Array.isArray(state.events)?state.events:
      (typeof api!=='undefined'?api.getEvents():[]);
    if(period==null||!Array.isArray(events))return null;
    const count=events.filter(e=>e.type==='foul' && e.team===team &&
      Number(e.period)===Number(period) && e.foulType!=='offensive').length;
    return count+1>=threshold?2:0;
  };
  function beginFoul(team,pid){committedFoulId=null;shooting=team;who=pid;foul={type:null,shot:null,result:null,bonus:null,ft:null,technicalPersonal:null,shotAlreadyRecorded:null};mode='foul';render();}
  function confirmFoul(){
    if(!foul.type)return;
    const t=shooting,pid=t==='us'?who:null;
    if(foul.type==='shooting'&&(!foul.shot||!foul.result||foul.shotAlreadyRecorded===null))return;
    if(foul.type==='nonshooting'&&foul.bonus==null)return;
    if(foul.type==='technical'){foul.ft=1;foul.technicalPersonal=pid!=null;}
    if(committedFoulId){mode='ftShooter';render();return;}
    const rootId=record('foul',t,((foul.type==='technical'&&!foul.technicalPersonal)?null:pid));
    committedFoulId=rootId;
    if(!rootId)return;
    last=`${names()[t]} • ${foul.type} foul`;
    if(foul.type==='offensive'){
      related('turnover',t,pid,rootId);
      conclude(`${names()[t]} ${label(pid)} • Offensive PF + TO`);
      return;
    }
    // An already-recorded FGA is never duplicated. When missing, wait for
    // the shooter selection so the attempt and FTs share player attribution.
    const pendingShot = foul.type==='shooting' && foul.result==='made' && !foul.shotAlreadyRecorded
      ? {points:Number(foul.shot),made:foul.result==='made',team:opposite(t)} : null;
    const total=foul.type==='shooting'?(foul.result==='made'?1:Number(foul.shot)):
      foul.type==='technical'?Number(foul.ft):Number(foul.bonus);
    if(total>0){startFT(total,opposite(t),null,rootId,foul.type==='technical',pendingShot);}
    else conclude(last);
  }
  // Phone-only shot flow: one shot input, completed by existing court geometry.
  function finishPhoneShot(team, points, made, playerId) {
    const id=shot(team,points,made,playerId);
    if(!id)return;
    source=id;
    if(made){if(team==='us'&&playerId){mode='assist';phoneTeam='us';render();}else if(team==='opponent'&&api.mode==='combined'){mode='opponentAssist';render();}else conclude('Shot recorded');}
    else startRebound(team,id);
  }
  function stat(action){
    const pid=who===null?null:who;
    if(action==='pf'){beginFoul('us',pid);return;}
    if(action==='made2'||action==='made3'){
      const points=action==='made2'?2:3;source=shot('us',points,true,pid);
      if(!source)return;if(teamMode){conclude(`${names().us} • +${points}PT team basket`);return;}mode='assist';render();return;
    }
    if(action==='miss2'||action==='miss3'){
      const points=action==='miss2'?2:3;const id=shot('us',points,false,pid);
      if(id)startRebound('us',id);return;
    }
    if(action==='to'){
      source=record('turnover','us',pid);if(source){mode='oppSteal';render();}return;
    }
    if(action==='stl'){
      // recordStat auto-creates opposite-team TO and links it.
      if(active()){const id=record('steal','us',pid);if(id)record('turnover','opponent',null,{linkedEventId:id});conclude(`${names().us} ${label(pid)} • STL + opponent TO`);}return;
    }
    const types={reb:teamMode?'team_defensive_rebound':'defensive_rebound',ast:'assist',blk:'block'};
    if(types[action]){
      if(api.mode==='combined'){beginLinkedStat(action,'us',pid);return;}
      record(types[action],'us',pid);conclude(`${names().us} ${label(pid)} • ${action.toUpperCase()}`);
    }
  }
  function opponentAction(action){
    if(action==='pf'){beginFoul('opponent',null);return;}
    if(action==='made2'||action==='made3'){const points=action==='made2'?2:3;shot('opponent',points,true);conclude(`${names().opponent} +${points}PT`);return;}
    if(action==='miss2'||action==='miss3'){const points=action==='miss2'?2:3;const id=shot('opponent',points,false);if(id)startRebound('opponent',id);return;}
    if(action==='to'){source=record('turnover','opponent');if(source){mode='steal';render();}return;}
    if(action==='stl'){if(active()){const id=record('steal','opponent');if(id)record('turnover','us',null,{linkedEventId:id});conclude(`${names().opponent} STL + tracked team TO`);}return;}
    if(api.mode==='combined'&&['reb','ast','blk'].includes(action)&&!['reboundChoice','reboundPlayer','blocker','ftRebound'].includes(mode)){beginLinkedStat(action,'opponent',null);return;}
    if(action==='reb'){
      if(['reboundChoice','reboundPlayer','blocker','ftRebound'].includes(mode))assignRebound('opponent',null,true);
      else {record('team_defensive_rebound','opponent');conclude(`${names().opponent} team rebound`);}
      return;
    }
    if(action==='blk'){if(shooting==='us'&&['reboundChoice','reboundPlayer'].includes(mode)){related('block','opponent');last=`${names().opponent} BLK • Choose rebound`;mode='reboundChoice';block='opponent';render();}else{record('block','opponent');conclude(`${names().opponent} BLK`);}}
  }

  function linkedShotTeam(){
    if(linkIntent==='ast')return linkingTeam;
    if(linkIntent==='blk')return opposite(linkingTeam);
    if(linkIntent==='foul')return opposite(shooting);
    return null; // Either team may have missed before a rebound.
  }
  let linkingTeam='us';
  const linkEligible=()=>{
    if(!linkIntent)return [];
    return api.getEvents().filter(e=>e.type==='shot'&&Number(e.period)===Number(api.getPeriod())&&
      (linkIntent==='foul'||(linkIntent==='ast'?e.made===true:e.made===false))&&
      (!linkedShotTeam()||e.team===linkedShotTeam())&&
      !api.getEvents().some(child=>String(child.linked_event_id)===String(e.id)&&
        (linkIntent==='foul'?child.type==='free_throw':linkIntent==='ast'?child.type==='assist':linkIntent==='blk'?child.type==='block':
          ['offensive_rebound','defensive_rebound','team_offensive_rebound','team_defensive_rebound'].includes(child.type))));
  };
  function updateLinkHighlights(){
    const host=document.getElementById('postgame-link-markers');if(!host)return;
    host.replaceChildren();
    for(const e of linkEligible()){
      if(e.x==null||e.y==null)continue;
      const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
      c.setAttribute('cx',e.x);c.setAttribute('cy',e.y);c.setAttribute('r',13);
      c.setAttribute('fill','#ffce36');c.setAttribute('fill-opacity','.24');
      c.setAttribute('stroke','#b77d00');c.setAttribute('stroke-width','3');
      c.setAttribute('pointer-events','none');host.append(c);
    }
  }
  function beginLinkedStat(kind,team,pid){
    linkIntent=kind;linkingTeam=team;linkingPlayer=pid;linkShot=null;
    mode='linkShot';updateLinkHighlights();render();
    notify('Select an existing highlighted shot, or tap the court to add a missing shot.');
  }
  function linkSavedShot(event){
    if(!event||!linkIntent)return false;
    const kind=linkIntent,team=linkingTeam,pid=linkingPlayer;
    if(kind==='ast'&&(!event.made||event.team!==team))return false;
    if(kind==='foul'){
      foul.shot=String(event.points);foul.result=event.made?'made':'missed';foul.shotAlreadyRecorded=true;
      linkIntent=null;updateLinkHighlights();confirmFoul();return true;
    }
    if(kind!=='ast'&&(event.made||kind==='blk'&&event.team===team))return false;
    let type=kind==='reb'?(event.team===team?'offensive_rebound':'defensive_rebound'):
      kind==='ast'?'assist':'block';
    const id=record(type,team,pid,{linkedEventId:event.id});
    if(!id)return false;
    linkIntent=null;linkShot=null;updateLinkHighlights();
    if(kind==='blk'){shooting=event.team;source=event.id;block=team;mode='reboundChoice';render();}
    else conclude(`${names()[team]} ${pid?label(pid):'Team'} • ${type.replaceAll('_',' ').toUpperCase()}`);
    return true;
  }
  function finishLinkedNewShot(shooter){
    const detail=linkShot;if(!detail||!linkIntent)return;
    const kind=linkIntent,team=linkingTeam,pid=linkingPlayer;
    const newId=record('shot',detail.team,detail.team==='us'?shooter:null,
      {points:detail.points,made:kind==='foul'?detail.made:kind==='ast',position:detail.position});
    if(!newId)return;
    if(kind==='foul'){
      foul.shot=String(detail.points);foul.result=detail.made?'made':'missed';foul.shotAlreadyRecorded=true;
      linkIntent=null;linkShot=null;updateLinkHighlights();confirmFoul();return;
    }
    const type=kind==='ast'?'assist':kind==='blk'?'block':detail.team===team?'offensive_rebound':'defensive_rebound';
    record(type,team,pid,{linkedEventId:newId});
    linkIntent=null;linkShot=null;updateLinkHighlights();
    if(kind==='blk'){shooting=detail.team;source=newId;block=team;mode='reboundChoice';render();}
    else conclude(`${names()[team]} ${pid?label(pid):'Team'} • ${type.replaceAll('_',' ').toUpperCase()}`);
  }
  // Called from the court click capture path BEFORE a new shot tap is interpreted.
  function selectExistingShotAt(position){
    if(!linkIntent)return false;
    const candidates=linkEligible().filter(e=>e.x!=null&&e.y!=null&&Math.hypot(Number(e.x)-position.x,Number(e.y)-position.y)<17);
    if(!candidates.length)return false;
    const nearest=candidates.sort((a,b)=>Math.hypot(a.x-position.x,a.y-position.y)-Math.hypot(b.x-position.x,b.y-position.y))[0];
    linkSavedShot(nearest);
    return true;
  }

  const locked=()=>!active();
  function render(){
    const ns=names();
    const descriptive={linkShot:'Select a shot on the court',linkShooter:'Who shot the ball?',shotLocation:'Tap court or skip',shotManual:'Manual shot without location',idle:'Select a player',stats:`${label(who)} • Choose stat`,assist:'Who assisted?',steal:'Who stole the ball?',oppSteal:'Did the opponent steal?',reboundChoice:'Block or rebound?',blocker:'Who blocked?',reboundPlayer:'Who rebounded?',foul:'Classify the foul',ft:'Record each free throw',ftShooter:'Who is shooting?',ftRebound:'Final FT missed • rebound',done:'Complete'};
    const current=mode==='idle'?'':mode;
    let content='';
    if(mode==='idle') content=teamMode?tileGrid([...(api.mode==='combined'?[]:[tile('made2','+2PT','qv-made'),tile('made3','+3PT','qv-made'),tile('miss2','2PT MISS','qv-miss'),tile('miss3','3PT MISS','qv-miss')]),...[['reb','REB'],['ast','AST'],['stl','STL'],['blk','BLK'],['pf','PF'],['to','TO']].map(([a,b])=>tile(a,b))]):roster('player');
    else if(mode==='linkShot') content=`<div class="qv-link-intro"><strong>${esc(linkIntent==='reb'?'Who shot the ball?':linkIntent==='ast'?'Who scored?':linkIntent==='blk'?'Who attempted the shot?':'Select the foul shot')}</strong><p>Tap a highlighted existing shot, or tap empty court space to record a new ${linkIntent==='ast'?'made':linkIntent==='foul'?'made or missed':'missed'} shot.</p></div>`;
    else if(mode==='linkShooter') content=roster('linkedShooter',null,['unknownLinkedShooter','UNKNOWN PLAYER']);
    else if(mode==='opponentAssist')content='<p>Opponent made shot — choose assist or no assist in the opponent container.</p>';
    else if(mode==='stats') content=tileGrid([
      ...(api.mode==='combined' ? [] : phoneCombined()&&!teamMode ? [tile('phoneShot','SHOT','qv-info')] : [
        tile('made2','+2PT','qv-made'),tile('made3','+3PT','qv-made'),
        tile('miss2','2PT MISS','qv-miss'),tile('miss3','3PT MISS','qv-miss')]),
      ...[['reb','REB'],['ast','AST'],['stl','STL'],['blk','BLK'],['pf','PF'],['to','TO']].map(([a,b])=>tile(a,b)),
      tile('back','BACK','qv-neutral'),tile('skip','SKIP','qv-neutral')]);
    else if (mode === 'shotLocation') content = `
  <div class="av-cp-shot-prompt">
    <strong>Select the shot location on the court</strong>
    <span>Single tap = MAKE · Double tap = MISS</span>

    <div class="av-cp-shot-actions">
      ${btn('phoneShotSkip', 'SKIP LOCATION', 'qv-neutral')}
      ${btn('back', 'BACK', 'qv-neutral')}
    </div>
  </div>`;
    else if (mode === 'shotManual') {
  content = `
    <div class="av-cp-manual-hint">
      Select the shot result in the popup above.
    </div>`;
}
    else if(['assist','steal','blocker','reboundPlayer','ftShooter'].includes(mode)){
      const action={assist:'assistPlayer',steal:'stealPlayer',blocker:'blockPlayer',reboundPlayer:'rebPlayer',ftShooter:'shooterPlayer'}[mode];
      const special={assist:['noAssist','NO AST'],steal:['noSteal','NO STL'],reboundPlayer:['unknownReb','UNKNOWN'],ftShooter:['unknownShooter','UNKNOWN PLAYER']}[mode];
      content=roster(action,mode==='assist'?who:null,special);
    }else if(mode==='reboundChoice')content=choice([
      ['reboundOff','OFFENSIVE REBOUND','qv-neutral'],
      ['reboundDef','DEFENSIVE REBOUND','qv-neutral'],
      ['reboundOobUs','OUT OF BOUNDS — TRACKED BALL','qv-info'],
      ['reboundOobOpp','OUT OF BOUNDS — OPPONENT BALL','qv-info'],
      ...(!block?[['chooseBlock','BLOCK','qv-neutral']]:[])
    ]);
    else if(mode==='oppSteal')content='<p>Turnover recorded. Select the opponent’s steal outcome in their container.</p>';
    else if(mode==='foul'){
      const sel=(field,value,label)=>`<button type="button" class="qv-option ${String(foul[field])===(field==='technicalPersonal'||field==='shotAlreadyRecorded'?String(value==='yes'):value)?'selected':''}" data-qv="setFoul" data-field="${field}" data-value="${value}">${esc(label)}</button>`;
      content=`<div class="qv-foul"><div class="qv-line"><strong>Foul type</strong><div class="qv-options">${sel('type','shooting','Shooting')}${sel('type','nonshooting','Non-shooting')}${sel('type','offensive','Offensive')}${sel('type','technical','Technical')}</div></div>`;
      if(foul.type==='shooting')content+=`<div class="qv-line"><strong>Shooting foul</strong><p>Use the court to select an existing shot or record the attempt.</p>${btn('foulCourt','SELECT SHOT ON COURT','qv-info')}</div>`;
      if(foul.type==='nonshooting')content+=foul.bonus===null?`<div class="qv-line"><strong>Eligible penalty</strong><div class="qv-options">${sel('bonus','0','No FTs')}${sel('bonus','2','2 FTs')}</div></div>`:`<div class="qv-line"><strong>Automatic team-foul penalty</strong><div>${foul.bonus?'2 FTs (bonus)':'No FTs (under bonus)'}</div></div>`;
      if(foul.type==='technical')content+=`<div class="qv-line"><strong>Technical foul</strong><div>1 FT · ${who?'Personal foul credited to selected player':'Team technical (no player PF)'}</div></div>`;
      const valid=foul.type==='offensive'||(foul.type==='nonshooting'&&foul.bonus!==null)||(foul.type==='technical');
      content+=`<div class="qv-foul-footer">${btn('confirmFoul','CONTINUE','qv-info',valid?'':'disabled')}${btn('skip','CANCEL','qv-neutral')}</div></div>`;
    }else if(mode==='ft'){
      const attempts=Array.from({length:ft.total-ft.done},(_,i)=>`<div class="qv-ft-line ${i===0?'qv-current':''}"><strong>FT ${ft.done+i+1} / ${ft.total}</strong><div>${btn('ftMake','MAKE +1','qv-made',i?'disabled':'')}${btn('ftMiss','MISS','qv-miss',i?'disabled':'')}</div></div>`).join('');
      content=`<div class="qv-ft-list">${attempts}</div>`;
    }else if(mode==='ftRebound')content=choice([
      ['reboundOff','OFFENSIVE REBOUND'],['reboundDef','DEFENSIVE REBOUND'],
      ['reboundOobUs','OUT OF BOUNDS — TRACKED BALL'],['reboundOobOpp','OUT OF BOUNDS — OPPONENT BALL'],
      ['noLiveRebound','DEAD BALL / NO REB'],['skip','SKIP']
    ]);
    const reboundActive=['reboundChoice','reboundPlayer','blocker','ftRebound'].includes(mode);
    const opponentFT=mode==='ft'&&ft.team==='opponent';
    const opponentAssist=mode==='opponentAssist';
    const opponentFTContent=opponentFT?content:'';
    const opponentAssistContent=opponentAssist?choice([['opponentAssistYes','AST'],['opponentAssistNo','NO AST']]):'';
    const opponentSteal=mode==='oppSteal';
    const opponentStealContent=opponentSteal?choice([['oppStealYes','STL'],['noSteal','NO STL']]):'';
    if(opponentFT)content='<p>Free throws are recorded in the shooting team’s container.</p>';
    const rebContext=mode==='reboundChoice'||mode==='ftRebound';
    if(rebContext){
      content=choice([
        ...(shooting==='us'?[['reboundOff','OFFENSIVE REBOUND']]:[['reboundDef','DEFENSIVE REBOUND']]),
        ['reboundOobUs','OUT OF BOUNDS — '+ns.us.toUpperCase()+' BALL'],
        ...(!block&&shooting==='opponent'?[['chooseBlock','BLOCK']]:[]),
        ...(mode==='ftRebound'?[['noLiveRebound','DEAD BALL / NO REB']]:[])
      ]);
    }
    const trackedActive=mode!=='idle';
    const compact=phoneCombined();
    if(compact&&mode!=='idle'&&mode!=='stats')phoneTeam=(opponentFT||opponentAssist||opponentSteal)?'opponent':'us';
    const chooseTeams=compact&&phoneTeam==='choose'&&mode==='idle';
    root.innerHTML=`<div class="qv-layout ${compact?'av-cp-layout':''}">
      ${chooseTeams?`<section class="av-cp-chooser" aria-label="Select the team"><strong>Select Team</strong><div class="av-cp-options">${btn('cpTracked',ns.us,'qv-info')}${btn('cpOpponent',ns.opponent,'qv-neutral')}</div></section>`:''}
      ${compact&&!chooseTeams?`<div class="av-cp-top"><span>${esc(phoneTeam==='opponent'?ns.opponent:ns.us)}</span>${mode==='idle'?btn('cpSwitch','Change Team','qv-neutral'):btn('cpNew','New Event','qv-neutral')}</div>`:''}
      <section style="${compact&&(chooseTeams||phoneTeam!=='us')?'display:none!important':''}" class="qv-tracked ${trackedActive?'qv-highlight':''}" aria-label="Tracked team controls">
        <div class="qv-team-heading"><div><strong>${esc(ns.us)}</strong><small>${esc(descriptive[mode]||'Choose action')}</small></div>${mode==='idle'&&!teamMode?btn('teamPlayer','TEAM STAT','qv-team-btn'):mode!=='idle'?btn('back','BACK','qv-team-btn'):''}</div>
        <div class="qv-action-surface">${content}</div>
        <div class="qv-bottom">${['assist','steal','oppSteal'].includes(mode)?btn('skip','SKIP','qv-neutral'):''}</div>
      </section>
      <section style="${compact&&(chooseTeams||phoneTeam!=='opponent')?'display:none!important':''}" class="qv-opponent ${reboundActive?'qv-opponent-highlight':''}" aria-label="Opponent controls"><div class="qv-team-heading"><div><strong>${esc(ns.opponent)}</strong><small>Opponent team stats</small></div></div>
      <div class="qv-opp-buttons">${(opponentAssist||opponentSteal?[]:rebContext?[
        [shooting==='opponent'?'reboundOff':'reboundDef',shooting==='opponent'?'OFFENSIVE REBOUND':'DEFENSIVE REBOUND',''],
        ['reboundOobOpp','OUT OF BOUNDS — '+ns.opponent.toUpperCase()+' BALL',''],
        ...(!block&&shooting==='us'?[['blk','BLOCK','']]:[])
      ]:opponentFT?[]:[...(api.mode==='combined'?[]:[['made2','+2PT','qv-made'],['made3','+3PT','qv-made'],['miss2','2PT MISS','qv-miss'],['miss3','3PT MISS','qv-miss']]),['to','TO',''],['pf','PF',''],['reb','REB',''],['ast','AST',''],['stl','STL',''],['blk','BLK','']]).map(([a,label,kind])=>btn(rebContext?`context:${a}`:`opp:${a}`,label,kind,rebContext?'':((mode!=='idle'&&!(mode==='stats'&&teamMode))?'disabled':''))).join('')}${opponentFT?opponentFTContent:opponentAssist?opponentAssistContent:opponentSteal?opponentStealContent:''}</div></section>
      ${(
  compact || document.body.classList.contains('pg-combined-ipad-portrait')
)
  ? ''
  : `<section class="qv-last"><small>LAST EVENT</small><strong>${esc(last)}</strong></section>`}</div>`;
    updateLinkHighlights();
    // Opponent court workflow is team-level: no jersey prompt.
    // Keep the original opponent stat buttons, and associate the selected
    // shot location with whichever matching stat action is chosen.
    if(api.mode==='combined'&&selectedCourtShot?.team==='opponent'){
      root.querySelector('.qv-opponent')?.classList.add('qv-selection-required');
    }
    if(api.mode==='combined'&&selectedCourtShot?.team==='us')root.querySelector('.qv-tracked')?.classList.add('qv-selection-required');
    document.body.classList.toggle('pg-awaiting-location',!!pendingCourtShot);
    // Combined Tracking phone — manual shot popup over court
if (phoneCombined()) {
  const courtArea = document.querySelector(
    '#post-shot-section .pg-shot-court-area'
  );

  if (courtArea) {
    let overlay = document.getElementById('av-cp-manual-overlay');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'av-cp-manual-overlay';
      courtArea.appendChild(overlay);
      overlay.addEventListener('click', handleQuickClick);
    }

    overlay.hidden = mode !== 'shotManual';

    if (mode === 'shotManual') {
      overlay.innerHTML = `
        <div class="av-cp-manual-card"
             role="dialog"
             aria-label="Record shot without location">

          <strong>Shot Without Location</strong>
          <span>Choose the shot result to save without a location.</span>

          ${choice([
            ['phoneMake2', 'MADE 2PT', 'qv-made'],
            ['phoneMake3', 'MADE 3PT', 'qv-made'],
            ['phoneMiss2', 'MISSED 2PT', 'qv-miss'],
            ['phoneMiss3', 'MISSED 3PT', 'qv-miss']
          ])}

          ${btn('back', 'CANCEL / BACK', 'qv-neutral')}
        </div>`;
    } else {
      overlay.replaceChildren();
    }
  }
}
  }
  function handleQuickClick(e) {
    const jersey=e.target.closest('[data-opponent-jersey]');
    if(jersey){opponentJersey=Number(jersey.dataset.opponentJersey);render();return;}
    const manual=e.target.closest('[data-opponent-manual]');
    if(manual){
      const n=Number(document.getElementById('pg-opponent-manual')?.value);
      if(Number.isInteger(n)&&n>=0&&n<=99){opponentJersey=n;render();}
      else notify('Enter an opponent jersey number from 0 to 99.');
      return;
    }
    const b=e.target.closest('button[data-qv]');if(!b||b.disabled)return;
    const a=b.dataset.qv;
    if(a==='cpTracked'){phoneTeam='us';mode='idle';render();return;}
    if(a==='cpOpponent'){phoneTeam='opponent';mode='idle';render();return;}
    if(a==='cpSwitch'||a==='cpNew'){reset();return;}
    if(a==='back'&&mode==='linkShooter'){mode='linkShot';linkShot=null;render();return;}
    if(a==='back'&&mode==='linkShot'){if(linkIntent==='foul'){linkIntent=null;mode='foul';render();}else{who=linkingPlayer;linkIntent=null;linkShot=null;mode=linkingTeam==='us'&&who?'stats':'idle';updateLinkHighlights();render();}return;}
    if(a==='back'){if(phoneCombined()&&mode==='shotManual'){mode='shotLocation';render();return;}if(phoneCombined()&&mode==='shotLocation'){mode='stats';render();return;}if(mode==='stats')reset();else if(mode==='reboundPlayer')mode='reboundChoice';else if(mode==='ftShooter'&&ft.done===0)mode='foul';else if(mode==='foul')reset();else {reset();}render();return;}
    if(a==='skip'){
      if(mode==='foul'){if(committedFoulId){mode='ftShooter';render();}else reset();return;}
      if(mode==='ft'){notify('Complete the required free throws or use Back to correct the preceding step.');return;}
      conclude('Recorded play • follow-up unresolved');return;
    }
    if(a==='player'||a==='teamPlayer'){
      if(!active()){tell('Start or resume the game first.');return;}
      teamMode=a==='teamPlayer';who=a==='teamPlayer'?null:b.dataset.player;
      // Court-first: a location and result were already chosen. This jersey
      // completes the SAME attempt without asking for another shot tap.
      if(!teamMode&&selectedCourtShot?.team==='us'){
        // Court-first is the same on phones, tablets, and desktops. The tap
        // already determines result, distance, and team; selecting a jersey
        // records that attempt once and advances directly to its follow-up.
        const picked=selectedCourtShot;
        finishPhoneShot('us',picked.points,picked.made,who);
        return;
      }
      mode='stats';render();return;
    }
    if(phoneCombined()&&a==='phoneShot') {mode='shotLocation';phoneTeam='us';render();return;}
    if(phoneCombined()&&a==='phoneShotSkip') {selectedCourtShot=null;mode='shotManual';render();return;}
    if(phoneCombined()&&['phoneMake2','phoneMake3','phoneMiss2','phoneMiss3'].includes(a)) {
      selectedCourtShot=null; // A skipped location must NOT attach to a prior court tap.
      finishPhoneShot('us',a.endsWith('3')?3:2,a.startsWith('phoneMake'),who);
      return;
    }
    if(['made2','made3','miss2','miss3','reb','ast','stl','blk','pf','to'].includes(a)){stat(a);return;}
    if(a.startsWith('context:')){
      const which=a.slice(8);
      if(which==='reboundOff'||which==='reboundDef'){assignRebound('opponent',null,true);return;}
      if(which==='reboundOobOpp'){conclude('Out of Bounds — '+names().opponent+' Ball');return;}
      if(which==='blk'){opponentAction('blk');return;}
    }
    if(a.startsWith('opp:')){if(!active()){tell('Start or resume the game first.');return;}opponentAction(a.slice(4));return;}
    if(a==='linkedShooter'||a==='unknownLinkedShooter'){finishLinkedNewShot(a==='linkedShooter'?b.dataset.player:null);return;}
    if(a==='opponentAssistYes'){related('assist','opponent',null,source);conclude(names().opponent+' AST');return;}
    if(a==='opponentAssistNo'){conclude('No opponent assist');return;}
    if(a==='assistPlayer'){related('assist','us',b.dataset.player);conclude(`${label(b.dataset.player)} • AST`);return;}
    if(a==='noAssist'){related('no_assist','us',null);conclude('No assist (confirmed)');return;}
    if(a==='stealPlayer'){related('steal','us',b.dataset.player);conclude(`${label(b.dataset.player)} • STL`);return;}
    if(a==='noSteal'){conclude('No steal (confirmed)');return;}
    if(a==='oppStealYes'){related('steal','opponent');conclude(`${names().opponent} STL`);return;}
    if(a==='chooseBlock'){if(shooting==='opponent'){mode='blocker';render();}return;}
    if(a==='blockPlayer'){block=b.dataset.player;related('block','us',block);mode='reboundChoice';render();return;}
    if(a==='reboundOff'||a==='reboundDef'){
      const team=a==='reboundOff'?shooting:opposite(shooting);
      if(team==='us'){mode='reboundPlayer';render();}
      else assignRebound(team,null,true);
      return;
    }
    if(a==='reboundOobUs'||a==='reboundOobOpp'){
      const team=a==='reboundOobUs'?'us':'opponent';
      conclude('Out of Bounds — '+names()[team]+' Ball');
      return;
    }
    if(a==='chooseRebound'){mode='reboundPlayer';render();return;}
    if(a==='rebPlayer'){assignRebound('us',b.dataset.player||null,teamMode||!b.dataset.player);return;}
    if(a==='unknownReb'){assignRebound('us',null);return;}
    if(a==='noLiveRebound'){conclude('Final FT missed • dead ball/no live rebound');return;}
    if(a==='setFoul'){
      if(committedFoulId){tell('Foul is already saved. Continue selecting the FT shooter.');return;}
      const field=b.dataset.field,value=b.dataset.value;
      if(field==='type'&&foul.type!==value){foul={type:value,shot:null,result:null,bonus:null,ft:null,technicalPersonal:null,shotAlreadyRecorded:null};}
      else foul[field]=field==='shotAlreadyRecorded'?(value==='yes'):value;
      if(field==='technicalPersonal')foul[field]=value==='yes';
      if(field==='type'&&value==='nonshooting')foul.bonus=bonusPenalty(shooting);
      render();return;
    }
    if(a==='foulCourt'){beginLinkedStat('foul',opposite(shooting),null);return;}
    if(a==='confirmFoul'){confirmFoul();return;}
    const ensureFoulShot=()=>{
      if(!ft.pendingShot)return;
      const attempt=ft.pendingShot;
      const id=record('shot',attempt.team,ft.shooter,{
        points:attempt.points,made:attempt.made,linkedEventId:ft.source
      });
      if(id)ft.pendingShot=null;
    };
    if(a==='shooterPlayer'){ft.shooter=b.dataset.player;ensureFoulShot();mode='ft';render();return;}
    if(a==='unknownShooter'){ensureFoulShot();mode='ft';render();return;}
    if(a==='ftMake'||a==='ftMiss'){
      ensureFoulShot();
      const made=a==='ftMake';const id=record('free_throw',ft.team,ft.shooter,{points:1,made,linkedEventId:ft.source});
      if(!id)return;ft.done++;ft.lastMiss=!made;
      last=`${names()[ft.team]} • FT ${ft.done}/${ft.total} ${made?'MADE':'MISSED'}`;
      if(ft.done>=ft.total){if(!made&&!ft.dead)startRebound(ft.team,id);else reset();}
      else render();return;
    }
  }
  root.addEventListener('click', handleQuickClick);
  // Shared review controls are separate from the active Quick Tracker step.
  // They must not replace the original jersey/stat/secondary-stat workflow.
  document.getElementById('post-quick-review')?.addEventListener('click',()=>{
    document.getElementById('post-shot-links-open')?.click();
  });
  // Refresh names and roster after the original tracker hydrates asynchronously.
  // Court-to-stat and stat-to-court both resolve against the same pending attempt.
  window.addEventListener('apex:postgame-court-shot',event=>{
    const detail=event.detail;
    if(api.mode!=='combined')return;
    if(phoneCombined()&&mode==='shotLocation'){
      if(detail.team!=='us'){
        notify('Select a location at the tracked team basket.');return;
      }
      selectedCourtShot=detail;
      finishPhoneShot('us',detail.points,detail.made,who);
      return;
    }
    if(linkIntent){
      // Player-first: the court provides the relevant attempt, not another independent stat.
      const needTeam=linkedShotTeam();
      if(needTeam&&detail.team!==needTeam){notify('Select the correct team’s basket for the linked shot.');return;}
      linkShot={...detail,made:linkIntent==='foul'?detail.made:linkIntent==='ast'};
      if(detail.team==='us'){mode='linkShooter';render();return;}
      finishLinkedNewShot(null);return;
    }
    if(pendingCourtShot){
      // Stat first: the court only provides a location, never another FGA.
      const shotPending=pendingCourtShot;pendingCourtShot=null;
      if(shotPending.points!==detail.points || shotPending.team!==detail.team || shotPending.made!==detail.made){
        notify('This spot is for a '+(detail.made?'made ':'missed ')+detail.points+'PT '+detail.team+' shot. Select the matching court location and shot result.');
        pendingCourtShot=shotPending;
        return;
      }
      writeQueue=writeQueue.then(async()=>{
        // The stat-first event has a temporary client ID until the write
        // finishes. Resolve it before assigning a court location.
        const savedId=pendingIds.get(shotPending.id)||shotPending.id;
        let entry=api.getEvents().find(e=>e.id===savedId);
        if(!entry){
          await api.refresh();
          entry=api.getEvents().find(e=>e.id===savedId);
        }
        if(!entry){
          pendingCourtShot=shotPending;
          notify('The shot has not finished saving. Please tap its location again.');
          return;
        }
        const ok=await api.linkShot(entry,detail.position,document.getElementById('post-review-save-anchor'));
        if(!ok){
          pendingCourtShot=shotPending;
          notify('The shot was saved, but its court location was not attached. Please try again.');
          return;
        }
        await api.refresh();
        window.dispatchEvent(new CustomEvent('apex:postgame-events-updated'));
      }).catch(error=>{
        pendingCourtShot=shotPending;
        notify('Could not attach shot location: '+String(error.message||error));
      });
      document.dispatchEvent(new CustomEvent('apex:postgame-court-clear'));
      render();return;
    }
    // The shot has ALREADY been chosen at the court. Never send the user
    // back through +2PT/+3PT/MAKE/MISS buttons or create a second attempt.
    if(mode!=='idle' && mode!=='stats'){
      notify('Finish, skip, or cancel the current play before selecting another shot.');
      return;
    }
    selectedCourtShot=detail;
    if(phoneCombined())phoneTeam=detail.team;
    shooting=detail.team;
    who=null;opponentJersey=null;
    if(detail.team==='opponent'){
      // Opponent court-first shots never require a tracked-team jersey.
      // finishPhoneShot handles makes and missed-shot follow-ups alike.
      finishPhoneShot('opponent',detail.points,detail.made,null);
      return;
    }
    mode='idle';teamMode=false;
    render();
    notify((detail.made?'Made ':'Missed ')+detail.points+'PT selected. Select the shooter to continue.');
  });
  window.addEventListener('apex:postgame-court-cancel',()=>{selectedCourtShot=null;pendingCourtShot=null;render();});
  document.addEventListener('apex:postgame-events-updated',()=>{
    if(mode==='idle')render();
  });
  window.apexPostgameQuick={ready:()=>unresolved===0,flush:()=>writeQueue,reset,hasPending:()=>!!selectedCourtShot||!!pendingCourtShot||unresolved>0,
    selectingLocation:()=>!!pendingCourtShot||!!linkIntent,selectExistingShotAt,linkIntent:()=>linkIntent,abort:()=>{selectedCourtShot=null;pendingCourtShot=null;reset();}};
  // Render immediately even before asynchronous roster hydration. This avoids
  // a blank combined-mode column while the parent page is loading.
  const hydrate=()=>{
    players=api.getPlayers();
    teamMode=false;
    const g=api.getGame?.()||{};
    teamName=g.team_name||'Tracked team';
    currentGame={opponent:g.opponent||'Opponent'};
    render();
  };
  hydrate();
  window.addEventListener('apex:postgame-ready',hydrate);
  // A later roster response must also update the jersey grid without a mode tap.
  let tries=0;
  const rosterCheck=()=>{
    if(players.length||++tries>80)return;
    if(api.getPlayers().length){hydrate();return;}
    setTimeout(rosterCheck,150);
  };
  rosterCheck();
})();
