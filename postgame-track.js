(()=>{
'use strict';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search),gameId=params.get('gameId');
const mode=['shot','stat','combined'].includes(params.get('mode'))?params.get('mode'):'stat';
let activeWorkflow=mode==='shot'?'shot':'stat';
const teamId=sessionStorage.getItem('selectedTeamId'),seasonId=sessionStorage.getItem('selectedSeasonId');
let game=null,players=[],events=[],observations=[],observationError=null,point=null,busy=false,pendingId=null;
const say=s=>{$('postgame-message').textContent=s};
const periodName=p=>p<=4?'Q'+p:'OT'+(p-4);
const label=e=>(e.type==='shot'?(e.made?'Made ':'Missed ')+e.points+'PT':e.type==='free_throw'?(e.made?'Made FT':'Missed FT'):e.type.replaceAll('_',' '));
const shotValue=(x,y)=>{
 const left=x<430,hoopX=left?57.25:802.75,delta=Math.sqrt(202.5**2-(235-37)**2);
 const outside=y<37||y>433;
 const isThree=left?(x<=hoopX+delta?outside:Math.hypot(x-hoopX,y-235)>202.5)
   :(x>=hoopX-delta?outside:Math.hypot(x-hoopX,y-235)>202.5);
 return isThree?3:2;
};
// Derive a stable, visible opponent accent without overwriting saved team colours.
function applyApexTeamPalette(primary,secondary){
 const valid=c=>/^#[a-f0-9]{6}$/i.test(c||'');
 if(!valid(primary))primary='#1E3A8A';
 const rgb=[1,3,5].map(i=>parseInt(primary.slice(i,i+2),16)/255);
 const hi=Math.max(...rgb),lo=Math.min(...rgb),d=hi-lo;
 let hue=0;
 if(d){
  if(hi===rgb[0])hue=((rgb[1]-rgb[2])/d)%6;
  else if(hi===rgb[1])hue=(rgb[2]-rgb[0])/d+2;
  else hue=(rgb[0]-rgb[1])/d+4;
  hue=(hue*60+360)%360;
 }
 const opponent=d<0.09?'#B45309':`hsl(${Math.round((hue+180)%360)} 70% 37%)`;
 // If secondary is absent or very close to white, use a visible primary accent.
 const secondaryUsable=valid(secondary) && secondary.toLowerCase()!=='#ffffff' &&
  [1,3,5].map(i=>parseInt(secondary.slice(i,i+2),16)).some(n=>n<230);
 const highlight=secondaryUsable?secondary:primary;
 const brightness=c=>{
  if(!valid(c))return 0.25;
  const v=[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)/255)
    .map(x=>x<=0.04045?x/12.92:((x+0.055)/1.055)**2.4);
  return 0.2126*v[0]+0.7152*v[1]+0.0722*v[2];
 };
 const ink=brightness(highlight)>0.34?'#101820':'#FFFFFF';
 const border=brightness(primary)>0.84?'#475569':primary;
 document.documentElement.style.setProperty('--review-primary',primary);
 document.documentElement.style.setProperty('--review-secondary',highlight);
 document.body.style.setProperty('--av-tracked-accent',primary);
 document.body.style.setProperty('--av-tracked-visible-border',border);
 document.body.style.setProperty('--av-tracked-highlight-ink',ink);
 document.body.style.setProperty('--av-tracked-highlight',highlight);
 document.body.style.setProperty('--av-opponent-accent',opponent);
 document.body.style.setProperty('--av-opponent-highlight',opponent);
}
const currentPeriod=()=>Number($('post-period').value);
const currentTeam=()=>$('post-team').value;
const currentPlayer=()=>currentTeam()==='us'&&$('post-player').value?$('post-player').value:null;
const currentMade=()=>$('post-shot-made').value==='true';
const getCandidates=()=>events.filter(e=>e.type==='shot'&&Number(e.period)===currentPeriod()&&e.team===currentTeam()
 && e.x==null&&e.y==null&&Number(e.points)===point?.points&&e.made===currentMade());
const resetPending=()=>{pendingId=null};
function updatePlayer(){
 const tracked=currentTeam()==='us';
 $('post-player').disabled=!tracked;
 if(!tracked)$('post-player').value='';
 renderEvents();refreshChoices();renderObservations();
}
function renderEvents(){
 const host=$('post-events');host.replaceChildren();
 const filtered=events.filter(e=>Number(e.period)===currentPeriod()&&e.team===currentTeam()&&(mode!=='shot'||e.type==='shot'));
 if(!filtered.length){host.textContent='No recorded events for this team and quarter.';return;}
 for(const e of filtered.slice().reverse()){
  const row=document.createElement('div');row.className='post-event';
  const a=document.createElement('span');a.textContent=periodName(e.period)+' · '+label(e);
  const b=document.createElement('small');const p=players.find(p=>String(p.id)===String(e.player_id));
  b.textContent=e.team==='us'?(p?'#'+p.number+' '+p.first_name:'Player unassigned'):'Opponent';
  if(e.type==='shot')b.textContent+=' · '+(e.x!=null&&e.y!=null?'Location recorded':'Location missing');
  row.append(a,b);
  if(e.team==='us'&&['shot','free_throw','assist','offensive_rebound','defensive_rebound','steal','turnover','block','foul'].includes(e.type)){
   const editor=document.createElement('div');editor.className='post-player-editor';
   const select=document.createElement('select');select.setAttribute('aria-label','Assign player for '+label(e));
   select.add(new Option('Unassigned',''));
   for(const p of players)select.add(new Option('#'+(p.number??'?')+' '+(p.first_name||'')+' '+(p.last_name||''),p.id));
   select.value=e.player_id||'';
   const save=document.createElement('button');save.type='button';save.textContent='Save player';
   save.disabled=true;
   select.addEventListener('change',()=>{save.disabled=select.value===(e.player_id||'');});
   save.addEventListener('click',async()=>{
    const value=select.value||null;
    if(!confirm('Update the player assigned to this recorded '+e.type.replaceAll('_',' ')+'?'))return;
    const result=await invoke('apexvision_postgame_assign_player',{
     p_game_id:gameId,p_event_id:e.id,p_expected_version:e.version,p_player_id:value
    },save);
    if(result!==null)say('Player attribution updated. The game score and shot result are unchanged.');
   });
   editor.append(select,save);row.append(editor);
  }
  if(e.type==='shot'){
   const link=document.createElement('a');link.className='post-analysis-link';
   link.href='film-analysis.html?gameId='+encodeURIComponent(gameId)+'&eventId='+encodeURIComponent(e.id);
   link.textContent='Review shot details';row.append(link);
  }
  host.append(row);
 }
}
function renderObservations(){
 if(mode==='stat')return;
 const host=$('post-observations');host.replaceChildren();
 if(observationError){host.textContent='Live observations unavailable: '+observationError.message;return;}
 const subset=observations.filter(o=>o.team===currentTeam()&&Number(o.period)===currentPeriod()&&!o.matched_event_id);
 if(!subset.length){host.textContent='No unlinked live shot observations for this quarter.';return;}
 for(const o of subset){
  const row=document.createElement('div');row.className='post-observation';
  const title=document.createElement('strong');
  title.textContent=periodName(o.period)+' · '+(o.made?'Made ':'Missed ')+o.points+'PT · ('+Math.round(o.x)+', '+Math.round(o.y)+')';
  const choices=document.createElement('div');choices.className='post-observation-controls';
  const select=document.createElement('select');
  select.setAttribute('aria-label','Select recorded shot to match');
  const matches=events.filter(e=>e.type==='shot'&&e.team===o.team&&Number(e.period)===Number(o.period)&&Number(e.points)===Number(o.points)&&e.made===o.made&&e.x==null&&e.y==null);
  for(const [index,e] of matches.entries())select.add(new Option('Recorded '+(e.made?'make':'miss')+' '+e.points+'PT · Shot '+(index+1),e.id));
  const match=document.createElement('button');match.type='button';match.textContent='Match existing shot';match.disabled=!select.value;
  match.addEventListener('click',async()=>{
   const e=events.find(x=>x.id===select.value);if(!e)return;
   if(!confirm('Match the location to this existing shot attempt?'))return;
   const result=await invoke('scoridium_link_shot_observation',{p_game_id:gameId,p_observation_id:o.id,p_event_id:e.id,p_expected_version:Number(e.version)},match);
   if(result!==null)say('Shot location linked. No extra attempt created.');
  });
  const promote=document.createElement('button');
  promote.type='button';promote.textContent='Add as missing shot';
  promote.addEventListener('click',async()=>{
   if(matches.length){say('Match this observation to a recorded shot first.');return;}
   if(!confirm('Create one NEW field-goal attempt from this live shot observation? Confirm it was never recorded by Stat Tracking.'))return;
   const key='apex-postgame-promote:'+gameId+':'+o.id;
   let id=localStorage.getItem(key);
   if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}
   const saved=await invoke('apexvision_postgame_promote_observation',{p_game_id:gameId,p_observation_id:o.id,p_event_id:id},promote);
   if(saved!==null){localStorage.removeItem(key);say('Observation added as one new shot, without changing final score.');}
  });
  choices.append(select,match,promote);
  row.append(title,choices);host.append(row);
 }
}

function refreshChoices(){
 if(mode==='stat')return;
 const existing=$('post-shot-existing');
 const selected=existing.value;
 existing.replaceChildren();
 for(const event of getCandidates()){
  const player=players.find(p=>String(p.id)===String(event.player_id));
  const option=new Option(periodName(event.period)+' · '+(event.made?'Made':'Missed')+' '+event.points+'PT'+(player?' · #'+player.number:''),event.id);
  existing.add(option);
 }
 if([...existing.options].some(o=>o.value===selected))existing.value=selected;
 const match=$('post-shot-action').value==='match';
 $('post-existing-label').hidden=!match;
 $('post-shot-warning').hidden=match;
 $('post-shot-save').disabled=!point||(match&&!existing.value);
}
function renderShotMarkers(){
 const host=$('postgame-markers');host.replaceChildren();
 // The view selector never changes the quarter assigned to new events.
 const selectedView=document.getElementById('av-cn-shot-filter')?.value||String(currentPeriod());
 for(const event of events){
   if(event.type!=='shot'||event.x==null||event.y==null)continue;
   // A missed shooting-foul attempt is an observation, not a field-goal attempt.
   if(event.non_fga && !event.made)continue;
   if(selectedView!=='all'&&Number(event.period)!==Number(selectedView))continue;
   const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
   circle.setAttribute('cx',event.x);circle.setAttribute('cy',event.y);
   const color=event.team==='opponent'
     ? getComputedStyle(document.body).getPropertyValue('--av-opponent-accent').trim()||'#b45309'
     : getComputedStyle(document.documentElement).getPropertyValue('--review-primary').trim()||'#1e3a8a';
   // A neutral halo keeps white or pale team colours visible on the tan court.
   const halo=document.createElementNS('http://www.w3.org/2000/svg','circle');
   halo.setAttribute('cx',event.x);halo.setAttribute('cy',event.y);
   halo.setAttribute('r','7.5');halo.setAttribute('fill','none');
   halo.setAttribute('stroke','#273547');halo.setAttribute('stroke-width','1.5');
   halo.setAttribute('pointer-events','none');host.append(halo);
   circle.setAttribute('r','5.5');circle.setAttribute('stroke',color);
   circle.setAttribute('fill',event.made?color:'none');circle.setAttribute('stroke-width','3');
   circle.setAttribute('aria-label',(event.team==='us'?'Tracked':'Opponent')+' '+(event.made?'made':'missed')+' shot');
   host.append(circle);
 }
}
function updateShotSelection(){
 if(!point)return;
 $('post-shot-preview').textContent=point.points+'PT · '+Math.round(Math.hypot(point.x-(point.x<430?57.25:802.75),point.y-235)/30*3.28084)+' feet from basket';
 $('postgame-target').setAttribute('cx',point.x);$('postgame-target').setAttribute('cy',point.y);
 refreshChoices();
}
async function refresh(){
 const results=[];
 for(let offset=0;offset<10000;offset+=500){
  const r=await supabaseClient.from('game_events')
   .select('id,game_id,period,type,team,player_id,points,made,x,y,version,created_at,linked_event_id')
   .eq('game_id',gameId).order('id',{ascending:true}).range(offset,offset+499);
  if(r.error)throw r.error;
  results.push(...r.data||[]);
  if((r.data||[]).length<500)break;
 }
 events=results;
 // Mark shooting-foul misses as visible but non-counting field-goal observations.
 const foulTags=await supabaseClient.from('apexvision_postgame_foul_shots')
   .select('event_id').eq('game_id',gameId);
 if(!foulTags.error){
   const nonFga=new Set((foulTags.data||[]).map(e=>String(e.event_id)));
   events.forEach(e=>{e.non_fga=nonFga.has(String(e.id));});
 }
 if(mode==='combined'){
  const details=await supabaseClient.from('apexvision_postgame_foul_details')
    .select('event_id,foul_class,shot_event_id').eq('game_id',gameId);
  if(!details.error){
    const lookup=new Map((details.data||[]).map(x=>[String(x.event_id),x]));
    for(const e of events)if(e.type==='foul'&&lookup.has(String(e.id))){
      const d=lookup.get(String(e.id));e.foul_class=d.foul_class;e.foul_shot_id=d.shot_event_id;
    }
  }
  const oob=await supabaseClient.from('apexvision_postgame_out_of_bounds')
    .select('event_id').eq('game_id',gameId);
  if(!oob.error){
    const ids=new Set((oob.data||[]).map(x=>String(x.event_id)));
    for(const e of events)if(ids.has(String(e.id)))e.out_of_bounds=true;
  }
 }
 if(mode!=='stat'){
  const o=await supabaseClient.from('tracker_observations').select('id,period,kind,team,points,made,x,y,matched_event_id').eq('game_id',gameId).eq('kind','shot').is('matched_event_id',null).limit(1000);
  observationError=o.error;observations=o.data||[];
 }
 renderEvents();renderShotMarkers();refreshChoices();renderObservations();
 if(mode!=='stat'){
 const pending=events.filter(e=>e.type==='shot'&&(e.x==null||e.y==null)).length+observations.filter(o=>!o.matched_event_id).length;
 $('post-shot-link-count').textContent=pending?'('+pending+')':'';
 }
}
function setupAnalysisButtons(){
 for(const selectId of ['post-shot-creation','post-shot-pressure']){
  const select=$(selectId),group=document.createElement('div');group.className='post-analysis-buttons';
  const redraw=()=>{for(const b of group.querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.value===select.value));};
  for(const option of [...select.options]){
   const b=document.createElement('button');b.type='button';b.dataset.value=option.value;b.textContent=option.textContent;
   b.addEventListener('click',()=>{select.value=option.value;redraw();});group.append(b);
  }
  select.hidden=true;select.after(group);redraw();
 }
}
async function init(){
 if(!gameId||!teamId||!seasonId){say('Open this screen from the Film Room.');return;}
 if(typeof supabaseClient==='undefined'){say('Supabase unavailable.');return;}
 const auth=await supabaseClient.auth.getUser();if(!auth.data?.user){say('Sign in before tracking.');return;}
 const response=await supabaseClient.from('games')
   .select('id,date,opponent,status,current_period,team_score,opponent_score')
   .eq('id',gameId).eq('team_id',teamId).eq('seasons_id',seasonId).maybeSingle();
 if(response.error||!response.data){say('Game not available to the selected team and season.');return;}
 game=response.data;
 try{
  const cached=sessionStorage.getItem('scoridium:team-preview:'+teamId);
  if(cached){const theme=JSON.parse(cached);game.team_name=[theme.school_name||theme.club_name,theme.mascot].filter(Boolean).join(' ')||'Tracked team';
    applyApexTeamPalette(theme.primary_color,theme.secondary_color);
  }
 }catch(error){console.warn('Stored team theme unavailable',error);}
 try{
  const teamRes=await supabaseClient.from('teams').select('name,primary_color,secondary_color').eq('id',teamId).maybeSingle();
  if(teamRes.data){
   game.team_name=teamRes.data.name||game.team_name||'Tracked Team';
   applyApexTeamPalette(teamRes.data.primary_color,teamRes.data.secondary_color);
  }
 }catch(error){console.warn('Team theme unavailable',error);}
 if(!document.body.style.getPropertyValue('--av-opponent-accent'))applyApexTeamPalette(
   getComputedStyle(document.documentElement).getPropertyValue('--review-primary').trim(),null);
 document.body.classList.add('postgame-shot-mode','pg-v3-'+mode);
 document.body.classList.toggle('pgq-stat-workflow',mode!=='shot');
 if(game.status!=='completed'){say('This post-game screen is only for completed games. Live games use the Game Tracker.');return;}
 $('back-to-room').href='app.html?page='+encodeURIComponent('gamehub.html?filmRoomGameId='+gameId);
 $('page-title').textContent=mode==='shot'?'Post-game Shot Tracking':mode==='combined'?'Post-game Stat & Shot Tracking':'Post-game Stat Tracking';
 $('game-title').textContent='vs '+(game.opponent||'Opponent')+' · '+game.date+' · Final '+(game.team_score??'—')+'–'+(game.opponent_score??'—');
 $('post-stat-section').hidden=mode==='shot';
 $('post-shot-section').hidden=mode==='stat';
 // Combined mode puts stat-entry and optional shot analysis in one court flow.
 $('post-observation-section').hidden=false;
 for(let p=1;p<=Math.max(4,Number(game.current_period)||4);p++)$('post-period').add(new Option(periodName(p),String(p)));
 $('post-next-quarter').addEventListener('click',()=>{
  const select=$('post-period'),index=select.selectedIndex;
  if(index<select.options.length-1){select.selectedIndex=index+1;select.dispatchEvent(new Event('change'));say('Reviewing '+periodName(currentPeriod())+'. The completed game result is unchanged.');}
  else say('Final recorded period reached. End Game Review returns to Game Hub.');
 });
 // The official score only changes when Finish Review is explicitly confirmed.
 const finalScoreDialog=$('post-final-score-dialog');
 const finalScoreSave=$('post-final-score-save');
 const finalScoreKeep=$('post-final-score-keep');
 const finalScoreContinue=$('post-final-score-continue');
 const returnToFilmRoom=()=>{
  location.href='app.html?page='+encodeURIComponent('gamehub.html?filmRoomGameId='+gameId);
 };
 const formatReviewScore=value=>value==null?'—':String(value);
 const reviewScoringTotals=()=>{
  let ours=0,opponent=0,attempts=0;
  for(const event of events){
   if(event.type!=='shot'&&event.type!=='free_throw')continue;
   attempts++;
   if(event.made!==true)continue;
   const points=event.type==='free_throw'?1:Number(event.points);
   if(!Number.isInteger(points)||(event.type==='shot'&&![2,3].includes(points))){
    throw new Error('A made basket has an invalid point value. Review the event before finalizing.');
   }
   if(event.team==='us')ours+=points;
   else if(event.team==='opponent')opponent+=points;
   else throw new Error('A made scoring event has an unknown team. Review it before finalizing.');
  }
  return {ours,opponent,attempts};
 };
 $('post-end-review').addEventListener('click',async()=>{
  if(busy||finalScoreDialog.open)return;
  const finishButton=$('post-end-review');
  finishButton.disabled=true;
  $('post-final-score-error').hidden=true;
  try{
   await refresh();
   const totals=reviewScoringTotals();
   const original=game.team_score==null||game.opponent_score==null
    ? formatReviewScore(game.team_score)+' – '+formatReviewScore(game.opponent_score)
    : game.team_score+' – '+game.opponent_score;
   $('post-final-score-comparison').textContent=
    'Current official score: '+original+' | Reviewed score: '+totals.ours+' – '+totals.opponent;
   finalScoreSave.disabled=totals.attempts===0;
   if(totals.attempts===0){
    $('post-final-score-comparison').textContent+=' | No scoring attempts recorded yet; the official score cannot be updated.';
   }
   finalScoreDialog.showModal();
  }catch(error){
   say('Could not prepare final score: '+(error.message||'Unknown error'));
  }finally{
   finishButton.disabled=false;
  }
 });
 finalScoreContinue.addEventListener('click',()=>finalScoreDialog.close());
 finalScoreKeep.addEventListener('click',()=>{finalScoreDialog.close();returnToFilmRoom();});
 finalScoreSave.addEventListener('click',async()=>{
  if(finalScoreSave.disabled)return;
  finalScoreSave.disabled=true;
  finalScoreKeep.disabled=true;
  finalScoreContinue.disabled=true;
  $('post-final-score-error').hidden=true;
  try{
   const {data,error}=await supabaseClient.rpc('apexvision_finish_review_score',{p_game_id:gameId});
   if(error)throw error;
   if(data==null||!Number.isInteger(Number(data.team_score))||!Number.isInteger(Number(data.opponent_score))){
    throw new Error('The score update returned an invalid result.');
   }
   game.team_score=Number(data.team_score);
   game.opponent_score=Number(data.opponent_score);
   finalScoreDialog.close();
   returnToFilmRoom();
  }catch(error){
   const errorLabel=$('post-final-score-error');
   errorLabel.textContent='Could not update final score: '+(error.message||'Unknown error')+'. Review is still open.';
   errorLabel.hidden=false;
   say(errorLabel.textContent);
  }finally{
   finalScoreSave.disabled=false;
   finalScoreKeep.disabled=false;
   finalScoreContinue.disabled=false;
  }
 });
 const roster=await supabaseClient.from('players').select('id,first_name,last_name,number').eq('team_id',teamId).order('number');
 if(roster.error){say('Unable to load roster: '+roster.error.message);return;}
 // Supabase may store jersey numbers as text, so sort numerically client-side.
 const jerseySort=(a,b)=>{
   const numeric=p=>p.number==null||String(p.number).trim()===''?Infinity:Number(p.number);
   const x=numeric(a),y=numeric(b);
   return (Number.isFinite(x)?x:Infinity)-(Number.isFinite(y)?y:Infinity) || String(a.number??'').localeCompare(String(b.number??''),undefined,{numeric:true});
 };
 players=(roster.data||[]).slice().sort(jerseySort);
 for(const player of players)$('post-player').add(new Option('#'+(player.number??'?')+' '+(player.first_name||'')+' '+(player.last_name||''),player.id));
 $('post-period').addEventListener('change',()=>{resetPending();renderEvents();renderShotMarkers();refreshChoices();renderObservations();});
 window.addEventListener('apex:shot-view-change',()=>{renderShotMarkers();renderEvents();});
 $('post-team').addEventListener('change',()=>{resetPending();updatePlayer();});
 $('post-player').addEventListener('change',resetPending);
 $('post-refresh').addEventListener('click',async()=>{try{await refresh();say('Event list refreshed.');}catch(e){say('Refresh failed: '+e.message);}});
 $('post-stat-type').addEventListener('change',()=>{
  const type=$('post-stat-type').value;
  $('post-points-wrap').hidden=type!=='shot';
  $('post-result-wrap').hidden=!['shot','free_throw'].includes(type);
  resetPending();
 });
 $('post-stat-form').addEventListener('change',resetPending);
 $('post-stat-type').dispatchEvent(new Event('change'));
 $('post-shot-analysis').hidden=mode!=='combined';
 if(mode==='combined')setupAnalysisButtons();
 $('post-shot-made').addEventListener('change',()=>{resetPending();refreshChoices();});
 $('post-shot-action').addEventListener('change',()=>{resetPending();refreshChoices();});
 {
 // The court owns the page; player attribution belongs in the shot popup.
 const playerLabel=$('post-player').closest('label');
 $('post-shot-form').insertBefore(playerLabel,$('post-shot-form').firstChild);
 const shotDialog=$('post-shot-dialog'),linksDialog=$('post-shot-links-dialog');
 $('post-shot-dialog-close').onclick=()=>shotDialog.close();
 const court=$('postgame-court');const parent=court.parentElement;
 const wrap=document.createElement('div');wrap.className='postgame-court-workspace';parent.insertBefore(wrap,court);wrap.appendChild(court);
 const quick=$('post-quick-root');if(mode==='combined'&&quick)wrap.appendChild(quick);
 const flowPrompt=$('postgame-court-prompt');if(flowPrompt)wrap.appendChild(flowPrompt);
 $('post-shot-links-close').onclick=()=>linksDialog.close();
 $('post-shot-links-open').onclick=()=>{renderEvents();renderObservations();linksDialog.showModal();};
 for(const dlg of [shotDialog,linksDialog])dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close();});
 }
 $('postgame-court').addEventListener('click',event=>{
  const svg=$('postgame-court'),matrix=svg.getScreenCTM();
  if(!matrix)return;
  const pt=svg.createSVGPoint();pt.x=event.clientX;pt.y=event.clientY;
  const c=pt.matrixTransform(matrix.inverse());
  if(c.x<10||c.x>850||c.y<10||c.y>460)return;
  point={x:Number(c.x.toFixed(2)),y:Number(c.y.toFixed(2)),points:shotValue(c.x,c.y)};
  resetPending();updateShotSelection();
  if((mode==='shot'||mode==='combined'&&activeWorkflow==='shot')&&!$('post-shot-dialog').open)$('post-shot-dialog').showModal();
  else if(activeWorkflow==='stat')window.dispatchEvent(new CustomEvent('apex:postgame-court',{detail:{...point}}));
 });
 $('post-stat-form').addEventListener('submit',e=>{e.preventDefault();void saveStat();});
 $('post-shot-form').addEventListener('submit',e=>{e.preventDefault();void saveShot();});
 try{await refresh();$('postgame-screen').hidden=false;window.dispatchEvent(new CustomEvent('apex:postgame-ready'));say('Ready. Review recorded events before adding new ones.');}
 catch(e){say('Unable to load existing events: '+e.message);}
}
async function touchReview(){
 const auth=await supabaseClient.auth.getUser(),uid=auth.data?.user?.id;
 if(!uid)return;
 const activity=mode;
 const time=new Date().toISOString();
 const {error}=await supabaseClient.from('apexvision_film_room_status').update({last_reviewed_at:time,last_reviewed_by:uid,updated_at:time,updated_by:uid}).eq('game_id',gameId).eq('activity',activity);
 if(error)console.warn('Unable to update Film Room review timestamp:',error.message);
}
async function mergeClassification(eventId,creation,pressure){
 if(!creation&&!pressure)return true;
 const existing=await supabaseClient.from('apexvision_film_tags').select('shot_creation,shot_contest,turnover_cause,defence_scheme').eq('event_id',eventId).maybeSingle();
 if(existing.error){say('Could not load previous analysis: '+existing.error.message);return false;}
 const prior=existing.data||{};
 const res=await supabaseClient.rpc('apexvision_save_film_tag',{p_event_id:eventId,
  p_shot_creation:creation||prior.shot_creation||null,p_shot_contest:pressure||prior.shot_contest||null,
  p_turnover_cause:prior.turnover_cause||null,p_defence_scheme:prior.defence_scheme||null});
 if(res.error){say('Could not save shot classification: '+res.error.message);return false;}
 await touchReview();return true;
}
async function invoke(name,args,button){
 if(busy)return null;busy=true;button.disabled=true;
 say('Saving…');
 try{
  const r=await supabaseClient.rpc(name,args);
  if(r.error)throw r.error;
  resetPending();await refresh();await touchReview();say('Saved to game statistics. The official final score is unchanged.');return r.data;
 }catch(e){say('Could not save: '+(e.message||'Unknown error')+'. No unconfirmed event has been added locally.');return null;}
 finally{busy=false;button.disabled=false;refreshChoices();}
}
async function saveStat(){
 const type=$('post-stat-type').value,points=type==='shot'?Number($('post-stat-points').value):type==='free_throw'?1:null;
 const made=['shot','free_throw'].includes(type)?$('post-stat-made').value==='true':null;
 const same=events.filter(e=>e.team===currentTeam()&&Number(e.period)===currentPeriod()&&e.type===type&&(type!=='shot'||e.points===points&&e.made===made));
 const warning=same.length?'There are already '+same.length+' '+type.replaceAll('_',' ')+' event(s) in this quarter for this team. Confirm you are adding a DIFFERENT event.':'Confirm this event was missing from the game.';
 if(!confirm(warning))return;
 if(!pendingId)pendingId=crypto.randomUUID();
 await invoke('apexvision_postgame_add_event',{p_game_id:gameId,p_event_id:pendingId,p_type:type,
  p_team:currentTeam(),p_period:currentPeriod(),p_player_id:currentPlayer(),p_points:points,p_made:made,p_x:null,p_y:null},$('post-stat-save'));
}
async function saveShot(){
 if(!point)return;
 const match=$('post-shot-action').value==='match',eventId=$('post-shot-existing').value;
 if(match){
  const event=events.find(e=>e.id===eventId);
  if(!event){say('Select an existing shot to match.');return;}
  const done=await invoke('apexvision_postgame_assign_shot',{p_game_id:gameId,p_event_id:event.id,p_expected_version:event.version,p_x:point.x,p_y:point.y},$('post-shot-save'));
  if(done!==null){await saveShotAnalysis(event.id);$('post-shot-dialog').close();}
 }else{
  if(!confirm('This will add a NEW field-goal attempt to the box score. Confirm this shot was not recorded by Stat Tracking or Shot Tracking.'))return;
  if(!pendingId)pendingId=crypto.randomUUID();
  const done=await invoke('apexvision_postgame_add_event',{p_game_id:gameId,p_event_id:pendingId,p_type:'shot',
   p_team:currentTeam(),p_period:currentPeriod(),p_player_id:currentPlayer(),
   p_points:point.points,p_made:currentMade(),p_x:point.x,p_y:point.y},$('post-shot-save'));
   if(done!==null){await saveShotAnalysis(done);$('post-shot-dialog').close();}
 }
}
async function saveShotAnalysis(eventId){
 if(mode!=='combined'||!eventId)return;
 const creation=$('post-shot-creation').value||null,pressure=$('post-shot-pressure').value||null;
 if(!creation&&!pressure)return;
 await mergeClassification(eventId,creation,pressure);
}
window.apexPostgame={get mode(){return mode;},get gameId(){return gameId;},getPlayers:()=>players.slice(),getEvents:()=>events.slice(),getPeriod:currentPeriod,getTeam:currentTeam,getPoint:()=>point,getGame:()=>game?{...game}:null,shotValue,
 setPlayer:id=>{$('post-player').value=id||'';},setTeam:team=>{$('post-team').value=team;$('post-team').dispatchEvent(new Event('change'));},
 saveEvent:async({type,team='us',playerId=null,points=null,made=null,position=null,linkedEventId=null,fixedId=null,confirmed=false},button)=>{
   // Each recording action has its own event ID.
// Repeated basketball statistics in a quarter are valid.
// Do not use event similarity as duplicate detection.
const id = fixedId || crypto.randomUUID();

// If this event ID is already present, do not create it again.
if (events.some(e => e.id === id)) {
  return id;
}
   const result=await invoke('apexvision_postgame_add_event',{p_game_id:gameId,p_event_id:id,p_type:type,p_team:team,p_period:currentPeriod(),p_player_id:playerId,p_points:points,p_made:made,p_x:position?.x??null,p_y:position?.y??null},button);
   if(result===null)return null;
   if(linkedEventId){
    const link=await supabaseClient.rpc('apexvision_postgame_link_event',{p_game_id:gameId,p_event_id:id,p_source_event_id:linkedEventId});
    if(link.error)say('Event saved, but could not link it to the related play: '+link.error.message);
    else await touchReview();
   }
   return id;
 },
 assignPlayer:async(eventId,playerId)=>{
  await refresh();const found=events.find(e=>e.id===eventId);
  if(!found)return false;
  if(found.player_id===playerId)return true;
  const saved=await invoke('apexvision_postgame_assign_player',{p_game_id:gameId,p_event_id:eventId,p_expected_version:Number(found.version),p_player_id:playerId},$('post-review-save-anchor'));
  return saved!==null;
 },
 linkRelated:async(childId,sourceId)=>{
   const r=await supabaseClient.rpc('apexvision_postgame_link_event',{p_game_id:gameId,p_event_id:childId,p_source_event_id:sourceId});
   if(r.error){say('Could not link related events: '+r.error.message);return false;}
   await touchReview();return true;
 },
 linkShot:async(event,position,button)=>{
   const saved=await invoke('apexvision_postgame_assign_shot',{p_game_id:gameId,p_event_id:event.id,p_expected_version:Number(event.version),p_x:position.x,p_y:position.y},button);
   return saved!==null;
 },
 saveClassification:async(id,creation,pressure)=>{
   if(!id||!creation&&!pressure)return true;
   return await mergeClassification(id,creation,pressure);
 },notify:say,refresh,touchReview};
void init();
})();