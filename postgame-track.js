(()=>{
'use strict';
const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search),gameId=params.get('gameId');
const mode=params.get('mode')==='shot'?'shot':'stat';
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
 const filtered=events.filter(e=>Number(e.period)===currentPeriod()&&e.team===currentTeam());
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
  host.append(row);
 }
}
function renderObservations(){
 if(mode!=='shot')return;
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
  for(const e of matches)select.add(new Option('Recorded shot · '+e.id.slice(0,8),e.id));
  const match=document.createElement('button');match.type='button';match.textContent='Match existing shot';match.disabled=!select.value;
  match.addEventListener('click',async()=>{
   const e=events.find(x=>x.id===select.value);if(!e)return;
   if(!confirm('Match the location to this existing shot attempt?'))return;
   const result=await invoke('scoridium_link_shot_observation',{p_game_id:gameId,p_observation_id:o.id,p_event_id:e.id,p_expected_version:Number(e.version)},match);
   if(result!==null)say('Shot location linked. No extra attempt created.');
  });
  choices.append(select,match);
  row.append(title,choices);host.append(row);
 }
}

function refreshChoices(){
 if(mode!=='shot')return;
 const existing=$('post-shot-existing');
 const selected=existing.value;
 existing.replaceChildren();
 for(const event of getCandidates()){
  const player=players.find(p=>String(p.id)===String(event.player_id));
  const option=new Option(periodName(event.period)+' · '+(event.made?'Made':'Missed')+' '+event.points+'PT'+(player?' · #'+player.number:'')+' · '+event.id.slice(0,8),event.id);
  existing.add(option);
 }
 if([...existing.options].some(o=>o.value===selected))existing.value=selected;
 const match=$('post-shot-action').value==='match';
 $('post-existing-label').hidden=!match;
 $('post-shot-warning').hidden=match;
 $('post-shot-save').disabled=!point||(match&&!existing.value);
}
function renderShotMarkers(){
 if(mode!=='shot')return;
 const host=$('postgame-markers');host.replaceChildren();
 for(const event of events){
   if(event.type!=='shot'||event.x==null||event.y==null)continue;
   const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
   circle.setAttribute('cx',event.x);circle.setAttribute('cy',event.y);
   circle.setAttribute('r','5');circle.setAttribute('stroke',event.made?'#16763c':'#9c2a2a');
   circle.setAttribute('fill',event.made?'#42d784':'#f87d7d');circle.setAttribute('stroke-width','2');
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
   .select('id,game_id,period,type,team,player_id,points,made,x,y,version,created_at')
   .eq('game_id',gameId).order('id',{ascending:true}).range(offset,offset+499);
  if(r.error)throw r.error;
  results.push(...r.data||[]);
  if((r.data||[]).length<500)break;
 }
 events=results;
 if(mode==='shot'){
  const o=await supabaseClient.from('tracker_observations').select('id,period,kind,team,points,made,x,y,matched_event_id').eq('game_id',gameId).eq('kind','shot').is('matched_event_id',null).limit(1000);
  observationError=o.error;observations=o.data||[];
 }
 renderEvents();renderShotMarkers();refreshChoices();renderObservations();
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
 if(game.status!=='completed'){say('This post-game screen is only for completed games. Live games use the Game Tracker.');return;}
 $('back-to-room').href='film-room.html?gameId='+encodeURIComponent(gameId);
 $('page-title').textContent=mode==='shot'?'Post-game Shot Tracking':'Post-game Stat Tracking';
 $('game-title').textContent='vs '+(game.opponent||'Opponent')+' · '+game.date+' · Final '+(game.team_score??'—')+'–'+(game.opponent_score??'—');
 $('post-'+mode+'-section').hidden=false;
 if(mode==='shot')$('post-observation-section').hidden=false;
 for(let p=1;p<=Math.max(4,Number(game.current_period)||4);p++)$('post-period').add(new Option(periodName(p),String(p)));
 const roster=await supabaseClient.from('players').select('id,first_name,last_name,number').eq('team_id',teamId).order('number');
 if(roster.error){say('Unable to load roster: '+roster.error.message);return;}
 players=roster.data||[];
 for(const player of players)$('post-player').add(new Option('#'+(player.number??'?')+' '+(player.first_name||'')+' '+(player.last_name||''),player.id));
 $('post-period').addEventListener('change',()=>{resetPending();renderEvents();refreshChoices();renderObservations();});
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
 $('post-shot-made').addEventListener('change',()=>{resetPending();refreshChoices();});
 $('post-shot-action').addEventListener('change',()=>{resetPending();refreshChoices();});
 $('postgame-court').addEventListener('click',event=>{
  const svg=$('postgame-court'),matrix=svg.getScreenCTM();
  if(!matrix)return;
  const pt=svg.createSVGPoint();pt.x=event.clientX;pt.y=event.clientY;
  const c=pt.matrixTransform(matrix.inverse());
  if(c.x<10||c.x>850||c.y<10||c.y>460)return;
  point={x:Number(c.x.toFixed(2)),y:Number(c.y.toFixed(2)),points:shotValue(c.x,c.y)};
  resetPending();updateShotSelection();
 });
 $('post-stat-form').addEventListener('submit',e=>{e.preventDefault();void saveStat();});
 $('post-shot-form').addEventListener('submit',e=>{e.preventDefault();void saveShot();});
 try{await refresh();$('postgame-screen').hidden=false;say('Ready. Review recorded events before adding new ones.');}
 catch(e){say('Unable to load existing events: '+e.message);}
}
async function invoke(name,args,button){
 if(busy)return null;busy=true;button.disabled=true;
 say('Saving…');
 try{
  const r=await supabaseClient.rpc(name,args);
  if(r.error)throw r.error;
  resetPending();await refresh();say('Saved to game statistics. The official final score is unchanged.');return r.data;
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
  await invoke('apexvision_postgame_assign_shot',{p_game_id:gameId,p_event_id:event.id,p_expected_version:event.version,p_x:point.x,p_y:point.y},$('post-shot-save'));
 }else{
  if(!confirm('This will add a NEW field-goal attempt to the box score. Confirm this shot was not recorded by Stat Tracking or Shot Tracking.'))return;
  if(!pendingId)pendingId=crypto.randomUUID();
  await invoke('apexvision_postgame_add_event',{p_game_id:gameId,p_event_id:pendingId,p_type:'shot',
   p_team:currentTeam(),p_period:currentPeriod(),p_player_id:currentPlayer(),
   p_points:point.points,p_made:currentMade(),p_x:point.x,p_y:point.y},$('post-shot-save'));
 }
}
void init();
})();