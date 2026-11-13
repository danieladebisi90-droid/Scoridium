/* Scoridium Quick Track v2: additive to original Court tracker. All durable
   stats go through existing addEvent() and its recovery/sync queue. */
(() => {
  'use strict';
  const root=document.getElementById('quick-track-root');
  if(!root || typeof addEvent!=='function') return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let mode='idle', who=null, shooting='us', source=null, last='Ready to track', block=null, assister=null, pendingShooter=null;
  let foul={type:null,shot:null,result:null,bonus:null,ft:null,technicalPersonal:null};
  let ft={total:0,done:0,shooter:null,source:null,team:'us',lastMiss:false,dead:false};
  const opposite=t=>t==='us'?'opponent':'us';
  const names=()=>({us:teamName||'Tracked team',opponent:currentGame?.opponent||'Opponent'});
  const active=()=>state.status==='live';
  const player=()=>players.find(p=>String(p.id)===String(who));
  const label=(id)=>id==null?'TEAM':`#${players.find(p=>String(p.id)===String(id))?.number??'?'}`;
  const tell=s=>{last=s;render();};
  const reset=()=>{mode='idle';who=null;source=null;block=null;foul={type:null,shot:null,result:null,bonus:null,ft:null,technicalPersonal:null};render();};
  const record=(type,team,playerId=null,extra={})=>{
    if(!active()){tell('Start or resume the game before recording stats.');return null;}
    const id=crypto.randomUUID();addEvent({id,type,team,playerId,...extra});return id;
  };
  const shot=(team,points,made,playerId=null)=>record('shot',team,playerId,{points,made});
  const related=(type,team,playerId=null,linkedEventId=source)=>record(type,team,playerId,{...(linkedEventId?{linkedEventId}:{})});
  const btn=(action,text,kind='',extra='')=>`<button type="button" class="qv-button ${kind}" data-qv="${action}" ${extra}>${esc(text)}</button>`;
  const tile=(action,text,kind='',extra='')=>`<button type="button" class="qv-button qv-tile ${kind}" data-qv="${action}" ${extra}>${esc(text)}</button>`;
  const tileGrid=items=>`<div class="qv-grid" style="--qv-rows:${Math.max(3,Math.ceil(items.length/4))}">${items.join('')}</div>`;
  const sortedPlayers=()=>[...players].sort((a,b)=>{const x=Number(a.number),y=Number(b.number);return (Number.isFinite(x)?x:9999)-(Number.isFinite(y)?y:9999)||String(a.number??'').localeCompare(String(b.number??''));});
  const roster=(action='player',exclude=null,extra=null)=>tileGrid([...sortedPlayers().map(p=>tile(action,`#${p.number??'?'}`,'',`data-player="${esc(p.id)}" ${exclude!==null&&String(exclude)===String(p.id)?'disabled':''}`)),...(extra?[tile(extra[0],extra[1],'qv-neutral')]:[])]);
  const choice=(options)=>`<div class="qv-choices">${options.map(x=>tile(x[0],x[1],x[2]||'')).join('')}</div>`;
  function startRebound(missedTeam,id,blocked=null){shooting=missedTeam;source=id;block=blocked;mode='reboundChoice';render();}
  function conclude(message){last=message;reset();}
  function assignRebound(team,pid=null,teamRebound=false){
    const kind=team===shooting?'offensive_rebound':'defensive_rebound';
    const type=teamRebound?`team_${kind}`:kind;
    related(type,team,pid);
    conclude(`${names()[team]} ${team===shooting?'OREB':'DREB'}${pid?` ${label(pid)}`:teamRebound?' (team)':' (unassigned)'}`);
  }
  function startFT(total,team,playerId,id,dead=false){
    ft={total:Number(total),done:0,team,shooter:playerId,source:id,lastMiss:false,dead};
    mode=team==='us'&&playerId==null?'ftShooter':'ft';render();
  }
  function beginFoul(team,pid){shooting=team;who=pid;foul={type:null,shot:null,result:null,bonus:null,ft:null,technicalPersonal:null};mode='foul';render();}
  function confirmFoul(){
    if(!foul.type)return;
    const t=shooting,pid=t==='us'?who:null;
    if(foul.type==='shooting'&&(!foul.shot||!foul.result))return;
    if(foul.type==='nonshooting'&&foul.bonus==null)return;
    if(foul.type==='technical'&&(foul.ft==null||foul.technicalPersonal==null))return;
    const rootId=record('foul',t,((foul.type==='technical'&&!foul.technicalPersonal)?null:pid));
    if(!rootId)return;
    last=`${names()[t]} • ${foul.type} foul`;
    if(foul.type==='offensive'){
      related('turnover',t,pid,rootId);
      conclude(`${names()[t]} ${label(pid)} • Offensive PF + TO`);
      return;
    }
    if(foul.type==='shooting'&&foul.result==='made'){
      shot(opposite(t),Number(foul.shot),true,opposite(t)==='us'?null:null);
      // Awarded basket is recorded as the original made shot; scorer can be
      // assigned later in Review (or on next revision when shooter prompt added).
    }
    const total=foul.type==='shooting'?(foul.result==='made'?1:Number(foul.shot)):
      foul.type==='technical'?Number(foul.ft):Number(foul.bonus);
    if(total>0){startFT(total,opposite(t),null,rootId,foul.type==='technical');}
    else conclude(last);
  }
  function stat(action){
    const pid=who===null?null:who;
    if(action==='pf'){beginFoul('us',pid);return;}
    if(action==='made2'||action==='made3'){
      const points=action==='made2'?2:3;source=shot('us',points,true,pid);
      if(!source)return;mode='assist';render();return;
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
      if(active()){recordStat('steal','us',pid);conclude(`Croxford ${label(pid)} • STL + opponent TO`);}return;
    }
    if(action==='ast'){if(pid==null){tell('Select a player to enter an assist first.');return;}assister=pid;mode='assistFirstShooter';render();return;}
    const types={reb:'defensive_rebound',blk:'block'};
    if(types[action]){record(types[action],'us',pid);conclude(`${names().us} ${label(pid)} • ${action.toUpperCase()}`);}
  }
  function opponentAction(action){
    if(action==='pf'){beginFoul('opponent',null);return;}
    if(action==='made2'||action==='made3'){const points=action==='made2'?2:3;shot('opponent',points,true);conclude(`${names().opponent} +${points}PT`);return;}
    if(action==='miss2'||action==='miss3'){const points=action==='miss2'?2:3;const id=shot('opponent',points,false);if(id)startRebound('opponent',id);return;}
    if(action==='to'){source=record('turnover','opponent');if(source){mode='steal';render();}return;}
    if(action==='stl'){if(active()&&mode==='oppSteal'){related('steal','opponent',null,source);conclude(`${names().opponent} STL linked to tracked-team TO`);}return;}
    if(action==='reb'){
      if(['reboundChoice','reboundPlayer','blocker','ftRebound'].includes(mode))assignRebound('opponent',null,true);
      else {record('team_defensive_rebound','opponent');conclude(`${names().opponent} team rebound`);}
      return;
    }
    if(action==='blk'){if(shooting==='us'&&['reboundChoice','reboundPlayer'].includes(mode)){related('block','opponent');last=`${names().opponent} BLK • Choose rebound`;mode='reboundChoice';block='opponent';render();}else{record('block','opponent');conclude(`${names().opponent} BLK`);}}
  }
  const locked=()=>!active();
  function render(){
    const ns=names();
    const descriptive={idle:'Select a player',stats:`${label(who)} • Choose stat`,assist:'Who assisted?',assistFirstShooter:'Who scored?',assistFirstShot:'Choose the made shot',steal:'Who stole the ball?',oppSteal:'Did the opponent steal?',reboundChoice:'Block or rebound?',blocker:'Who blocked?',reboundPlayer:'Who rebounded?',foul:'Classify the foul',ft:'Record each free throw',ftShooter:'Who is shooting?',ftRebound:'Final FT missed • rebound',done:'Complete'};
    const current=mode==='idle'?'':mode;
    let content='';
    if(mode==='idle') content=roster('player');
    else if(mode==='stats') content=tileGrid([
      tile('made2','+2PT','qv-made'),tile('miss2','2PT MISS','qv-miss'),
      tile('made3','+3PT','qv-made'),tile('miss3','3PT MISS','qv-miss'),
      ...[['reb','REB'],['ast','AST'],['stl','STL'],['blk','BLK'],['pf','PF'],['to','TO']].map(([a,b])=>tile(a,b)),
      tile('back','BACK','qv-neutral'),tile('skip','SKIP','qv-neutral')]);
    else if(['assist','assistFirstShooter','steal','blocker','reboundPlayer','ftShooter'].includes(mode)){
      const action={assist:'assistPlayer',assistFirstShooter:'assistFirstPick',steal:'stealPlayer',blocker:'blockPlayer',reboundPlayer:'rebPlayer',ftShooter:'shooterPlayer'}[mode];
      const special={assist:['noAssist','NO AST'],steal:['noSteal','NO STL'],reboundPlayer:['unknownReb','UNKNOWN'],ftShooter:['unknownShooter','TEAM']}[mode];
      content=roster(action,mode==='assist'?who:mode==='assistFirstShooter'?assister:null,special);
    }else if(mode==='assistFirstShot')content=choice([['assistMake2','+2PT','qv-made'],['assistMake3','+3PT','qv-made']]);
    else if(mode==='reboundChoice')content=choice(shooting==='opponent'&&!block?[['chooseBlock','BLK','qv-info'],['chooseRebound','REB','qv-neutral']]:[['chooseRebound','REB','qv-neutral']]);
    else if(mode==='oppSteal')content=choice([['oppStealYes','OPP STL'],['noSteal','NO STL'],['skip','SKIP']]);
    else if(mode==='foul'){
      const sel=(field,value,label)=>`<button type="button" class="qv-option ${String(foul[field])===(field==='technicalPersonal'?String(value==='yes'):value)?'selected':''}" data-qv="setFoul" data-field="${field}" data-value="${value}">${esc(label)}</button>`;
      content=`<div class="qv-foul"><div class="qv-line"><strong>Foul type</strong><div class="qv-options">${sel('type','shooting','Shooting')}${sel('type','nonshooting','Non-shooting')}${sel('type','offensive','Offensive')}${sel('type','technical','Technical')}</div></div>`;
      if(foul.type==='shooting')content+=`<div class="qv-line"><strong>Shot</strong><div class="qv-options">${sel('shot','2','2PT')}${sel('shot','3','3PT')}</div></div><div class="qv-line"><strong>Result</strong><div class="qv-options">${sel('result','made','Made')}${sel('result','missed','Missed')}</div></div>`;
      if(foul.type==='nonshooting')content+=`<div class="qv-line"><strong>Eligible penalty</strong><div class="qv-options">${sel('bonus','0','No FTs')}${sel('bonus','2','2 FTs')}</div></div>`;
      if(foul.type==='technical')content+=`<div class="qv-line"><strong>FT penalty</strong><div class="qv-options">${sel('ft','0','0 FTs')}${sel('ft','1','1 FT')}${sel('ft','2','2 FTs')}</div></div><div class="qv-line"><strong>Charge a player PF?</strong><div class="qv-options">${sel('technicalPersonal','yes','Yes')}${sel('technicalPersonal','no','No / team')}</div></div>`;
      const valid=foul.type==='offensive'||(foul.type==='shooting'&&foul.shot&&foul.result)||(foul.type==='nonshooting'&&foul.bonus!==null)||(foul.type==='technical'&&foul.ft!==null&&foul.technicalPersonal!==null);
      content+=`<div class="qv-foul-footer">${btn('confirmFoul','CONTINUE','qv-info',valid?'':'disabled')}${btn('skip','CANCEL','qv-neutral')}</div></div>`;
    }else if(mode==='ft'){
      const attempts=Array.from({length:ft.total-ft.done},(_,i)=>`<div class="qv-ft-line ${i===0?'qv-current':''}"><strong>FT ${ft.done+i+1} / ${ft.total}</strong><div>${btn('ftMake','MAKE +1','qv-made',i?'disabled':'')}${btn('ftMiss','MISS','qv-miss',i?'disabled':'')}</div></div>`).join('');
      content=`<div class="qv-ft-list">${attempts}</div>`;
    }else if(mode==='ftRebound')content=choice([['chooseRebound','REB','qv-info'],['noLiveRebound','DEAD BALL / NO REB'],['skip','SKIP']]);
    const reboundActive=['reboundChoice','reboundPlayer','blocker','ftRebound'].includes(mode);
    const trackedActive=mode!=='idle';
    // Only show opponent BLK/STL/REB as contextual controls, preventing
    // double-entry of events already linked to a tracked-team shot/TO.
    const opponentActions=[['made2','+2PT','qv-made'],['miss2','2PT MISS','qv-miss'],
      ['made3','+3PT','qv-made'],['miss3','3PT MISS','qv-miss'],['to','TO',''],['pf','PF','']];
    if(reboundActive){opponentActions.push(['reb','REB','']);
      if(shooting==='us')opponentActions.push(['blk','BLK','']);}
    if(mode==='oppSteal')opponentActions.push(['stl','STL','']);
    root.innerHTML=`<div class="qv-layout">
      <section class="qv-tracked ${trackedActive?'qv-highlight':''}" aria-label="Tracked team controls">
        <div class="qv-team-heading"><div><strong>${esc(ns.us)}</strong><small>${esc(descriptive[mode]||'Choose action')}</small></div>${btn('teamPlayer','TEAM','qv-team-btn',trackedActive?'disabled':'')}</div>
        <div class="qv-action-surface">${content}</div>
        <div class="qv-bottom">${mode!=='idle'&&mode!=='stats'&&mode!=='foul'?btn('skip','SKIP','qv-neutral'):''}${mode!=='idle'&&mode!=='stats'&&mode!=='foul'?btn('back','BACK','qv-neutral'):''}</div>
      </section>
      <section class="qv-opponent ${reboundActive?'qv-opponent-highlight':''}" aria-label="Opponent controls"><div class="qv-team-heading"><div><strong>${esc(ns.opponent)}</strong><small>Opponent team stats</small></div></div>
      <div class="qv-opp-buttons">${opponentActions.map(([a,label,kind])=>btn(`opp:${a}`,label,kind,(mode!=='idle'&&!(reboundActive&&(a==='reb'||(shooting==='us'&&a==='blk')))&&!(mode==='oppSteal'&&a==='stl'))?'disabled':'')).join('')}</div></section>
      <section class="qv-last"><small>LAST EVENT</small><strong>${esc(last)}</strong></section></div>`;
  }
  root.addEventListener('click',e=>{
    const b=e.target.closest('button[data-qv]');if(!b||b.disabled)return;
    const a=b.dataset.qv;
    if(a==='back'){if(mode==='assistFirstShot'){mode='assistFirstShooter';render();return;}if(mode==='stats')reset();else if(mode==='reboundPlayer')mode='reboundChoice';else if(mode==='ftShooter')mode='ft';else if(mode==='foul')reset();else {reset();}render();return;}
    if(a==='skip'){
      if(mode==='assistFirstShooter'||mode==='assistFirstShot'){conclude('Assist entry cancelled — no basket or assist credited');assister=null;pendingShooter=null;return;}
      if(mode==='foul'){reset();return;}
      if(mode==='ft'){conclude('FT sequence incomplete — continue in review');return;}
      conclude('Recorded play • follow-up unresolved');return;
    }
    if(a==='player'||a==='teamPlayer'){if(!active()){tell('Start or resume the game first.');return;}who=a==='teamPlayer'?null:b.dataset.player;mode='stats';render();return;}
    if(['made2','made3','miss2','miss3','reb','ast','stl','blk','pf','to'].includes(a)){stat(a);return;}
    if(a.startsWith('opp:')){if(!active()){tell('Start or resume the game first.');return;}opponentAction(a.slice(4));return;}
    if(a==='assistFirstPick'){pendingShooter=b.dataset.player;mode='assistFirstShot';render();return;}
    if(a==='assistMake2'||a==='assistMake3'){const pts=a==='assistMake2'?2:3;const shotId=shot('us',pts,true,pendingShooter);if(!shotId)return;record('assist','us',assister,{linkedEventId:shotId});conclude(`${label(pendingShooter)} +${pts}PT • AST ${label(assister)}`);assister=null;pendingShooter=null;return;}
    if(a==='assistPlayer'){related('assist','us',b.dataset.player);conclude(`${label(b.dataset.player)} • AST`);return;}
    if(a==='noAssist'){related('no_assist','us',null);conclude('No assist (confirmed)');return;}
    if(a==='stealPlayer'){related('steal','us',b.dataset.player);conclude(`${label(b.dataset.player)} • STL`);return;}
    if(a==='noSteal'){conclude('No steal (confirmed)');return;}
    if(a==='oppStealYes'){related('steal','opponent');conclude(`${names().opponent} STL`);return;}
    if(a==='chooseBlock'){if(shooting==='opponent'){mode='blocker';render();}return;}
    if(a==='blockPlayer'){block=b.dataset.player;related('block','us',block);mode='reboundChoice';render();return;}
    if(a==='chooseRebound'){mode='reboundPlayer';render();return;}
    if(a==='rebPlayer'){assignRebound('us',b.dataset.player);return;}
    if(a==='unknownReb'){assignRebound('us',null);return;}
    if(a==='noLiveRebound'){conclude('Final FT missed • dead ball/no live rebound');return;}
    if(a==='setFoul'){
      const field=b.dataset.field,value=b.dataset.value;
      if(field==='type'&&foul.type!==value){foul={type:value,shot:null,result:null,bonus:null,ft:null,technicalPersonal:null};}
      else foul[field]=value;
      if(field==='technicalPersonal')foul[field]=value==='yes';
      render();return;
    }
    if(a==='confirmFoul'){confirmFoul();return;}
    if(a==='shooterPlayer'){ft.shooter=b.dataset.player;mode='ft';render();return;}
    if(a==='unknownShooter'){mode='ft';render();return;}
    if(a==='ftMake'||a==='ftMiss'){
      const made=a==='ftMake';const id=record('free_throw',ft.team,ft.shooter,{points:1,made,linkedEventId:ft.source});
      if(!id)return;ft.done++;ft.lastMiss=!made;
      last=`${names()[ft.team]} • FT ${ft.done}/${ft.total} ${made?'MADE':'MISSED'}`;
      if(ft.done>=ft.total){if(!made&&!ft.dead)startRebound(ft.team,id);else reset();}
      else render();return;
    }
  });
  // Refresh names and roster after the original tracker hydrates asynchronously.
  const original=renderPlayers;
  renderPlayers=function(){original();render();};
  const originalScore=renderScoreboard;
  renderScoreboard=function(){originalScore();if(mode==='idle')render();};
  render();
})();
