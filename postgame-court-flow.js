/* ApexVision Film Room v3: court-first shot tracking, shared scoreboard,
   and court-to-Quick-Track selections for the combined review mode. */
(()=>{
'use strict';
const api=window.apexPostgame,$=id=>document.getElementById(id);
if(!api)return;
const mode=api.mode,shotMode=mode==='shot',combined=mode==='combined';
const court=$('postgame-court'),prompt=$('postgame-court-prompt');
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const categories=[['catch_shoot','Catch & Shoot'],['pull_up','Dribble Pull-Up'],['drive','Drive / Layup'],['post','Post Move'],['putback','Putback'],['other','Other']];
// Direction is game-specific. Q1/Q2 use the chosen side; Q3/Q4 flip automatically.
const directionKey='apex:film:first-half-right:'+api.gameId;
let firstHalfRight=false;
try{firstHalfRight=sessionStorage.getItem(directionKey)==='true';}catch(_){}
let shot=null,selectedJersey=null,step='idle',timer=null,saving=false,periodStamp=0;
let guidedTarget=null,insertedShot=null;
let teamName='Tracked Team';
const opponentName=()=>api.getGame()?.opponent||'Opponent';
const period=()=>api.getPeriod();

const viewPeriod = () => {
  const selected = document.getElementById('av-cn-shot-filter')?.value;

  if (selected && selected !== 'all') {
    return Number(selected);
  }

  return Number(api.getPeriod());
};

const complete=()=>step==='idle';

function basketSide(team) {
  const activeQuarter = viewPeriod();
  const trackedLeft = (activeQuarter <= 2) !== firstHalfRight;

  return team === 'us'
    ? (trackedLeft ? 'left' : 'right')
    : (trackedLeft ? 'right' : 'left');
}

function teamAt(x){return x<430?(basketSide('us')==='left'?'us':'opponent'):(basketSide('us')==='right'?'us':'opponent');}
function courtPoint(ev){
 const matrix=court?.getScreenCTM();if(!matrix)return null;
 const pt=court.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;
 const result=pt.matrixTransform(matrix.inverse());
 if(result.x<10||result.x>850||result.y<10||result.y>460)return null;
 return {x:Number(result.x.toFixed(2)),y:Number(result.y.toFixed(2))};
}
function labelPeriod(n){return n<=4?'Q'+n:'OT'+(n-4);}
function updateScoreboard(){
 const g=api.getGame();if(!g)return;
 const tally={us:0,opponent:0};
 for(const e of api.getEvents()){
  if(e.made===true&&(e.type==='shot'||e.type==='free_throw')&&Number.isFinite(Number(e.points)))
   tally[e.team]=(tally[e.team]||0)+Number(e.points);
 }
 $('pg-score-team-name').textContent=teamName;
 $('pg-score-opponent-name').textContent=opponentName();
 $('pg-score-us').textContent=tally.us;
 $('pg-score-opponent').textContent=tally.opponent;
 $('pg-score-period').textContent=labelPeriod(period())+' REVIEW';
 $('pg-score-official').textContent='OFFICIAL FINAL '+(g.team_score??'—')+'–'+(g.opponent_score??'—');
 const discrepant=tally.us!==Number(g.team_score)||tally.opponent!==Number(g.opponent_score);
 $('postgame-scoreboard').dataset.discrepancy=discrepant?'true':'false';
 $('pg-score-official').title=discrepant?'Tracked entries differ from the official score. The final result is unchanged.':'Matches official final score';
}
async function refreshScoreboard(){
 if(document.hidden||saving)return;
 try{await api.refresh();updateScoreboard();}catch(error){console.warn('Film Room scoreboard refresh:',error.message);}
}
function clear(){
 if(timer){clearTimeout(timer);timer=null;}
 shot=null;selectedJersey=null;step='idle';prompt.hidden=true;
 document.dispatchEvent(new CustomEvent('apex:postgame-court-clear'));
}
function grid(items){return '<div class="pg-flow-grid">'+items.map(([a,name])=>'<button type="button" data-flow="'+escapeHTML(a)+'">'+escapeHTML(name)+'</button>').join('')+'</div>';}
function render(){
 if(!shot||!shotMode){prompt.hidden=true;return;}
 prompt.hidden=false;prompt.dataset.side=shot.position.x<430?'right':'left';
 const team=shot.team==='us'?teamName:opponentName();
 const tag='<span class="pg-flow-label">'+escapeHTML(team)+' · '+(shot.made?'MADE ':'MISSED ')+shot.points+'PT</span>';
 let content='';
 if(step==='jersey'){
  const numbers=shot.team==='us'?api.getPlayers().slice().sort((a,b)=>Number(a.number)-Number(b.number)).map(p=>[String(p.id),'#'+(p.number??'?')]):Array.from({length:40},(_,i)=>[String(i),'#'+i]);
  content=tag+'<strong>WHO SHOT?</strong>'+grid(numbers)+(shot.team==='opponent'?'<label class="pg-flow-manual">Other jersey # <input type="number" min="0" max="99" id="post-opp-jersey" placeholder="0–99"><button data-flow="manualJersey">Use</button></label>':'')+
    '<div class="pg-flow-actions"><button data-flow="cancel">Cancel</button></div>';
 }else if(step==='category'){
  content=tag+'<strong>'+(shot.guidedId?'GUIDED SHOT':'PLAYER '+escapeHTML(selectedJersey?.label||'Unassigned'))+'</strong><p>Choose shot category</p>'+grid(categories)+
  '<div class="pg-flow-actions"><button data-flow="back">Back</button><button data-flow="categorySkip">Skip category</button></div>';
 }else if(step==='match'){
  const candidates=shot.candidates||[];
  content=tag+'<strong>LINK AN EXISTING SHOT?</strong><p>Choose an existing unlocated attempt to avoid counting it twice.</p>'+
   grid(candidates.map((e,i)=>['match:'+i,'Shot '+(i+1)+' · '+(e.player_id?'#'+(api.getPlayers().find(p=>p.id===e.player_id)?.number??'?'):'Unassigned')]))+
   '<div class="pg-flow-actions"><button data-flow="newShot">Record as new attempt</button></div>';
 }
 prompt.innerHTML=content;
}
function begin(location,made){
 if(saving)return;
 if(shotMode&&!insertedShot&&document.body.classList.contains('pg-guided-on')&&!guidedTarget){api.notify('This recorded shot is already located. Choose Next or another pending shot.');return;}
 if(shotMode&&!complete()){api.notify('Finish or cancel the current shot before selecting another location.');return;}
 const team=teamAt(location.x),value=api.shotValue(location.x,location.y);
 if(combined&&window.apexPostgameQuick?.linkIntent()){
  const intent=window.apexPostgameQuick.linkIntent();
  // Only AST/BLK/REB have a fixed shot result. A shooting foul uses the
  // actual single-tap MADE / double-tap MISSED gesture.
  if(intent==='ast')made=true;
  else if(intent==='blk'||intent==='reb')made=false;
 }
 if(shotMode&&insertedShot){
  if(team!==insertedShot.team||value!==insertedShot.points){api.notify('Choose the '+insertedShot.points+'PT area on the selected team’s basket.');return;}
  shot={position:location,made:insertedShot.made,points:value,team,inserted:true};
  selectedJersey=null;step=team==='opponent'?'category':'jersey';render();return;
 }
 if(shotMode&&guidedTarget){
   if(team!==guidedTarget.team||value!==Number(guidedTarget.points)){
     api.notify('This play is '+guidedTarget.team+' '+guidedTarget.points+'PT. Choose a matching location on that team’s basket, or use Switch Directions.');
     return;
   }
   if(guidedTarget.x!=null&&guidedTarget.y!=null){
     api.notify('This shot already has a location. Use Free Tracking to review or change its details.');return;
   }
   shot={position:location,made:guidedTarget.made,points:value,team,guidedId:guidedTarget.id};
   const player=api.getPlayers().find(p=>String(p.id)===String(guidedTarget.player_id));
   selectedJersey=player?{id:player.id,number:player.number,label:'#'+player.number}:{label:'Unassigned'};
   step=team==='opponent'||player?'category':'jersey';render();return;
 }
 const detail={position:location,made,points:value,team};
 if(combined){
  window.dispatchEvent(new CustomEvent('apex:postgame-court-shot',{detail}));
  return;
 }
 shot=detail;step=team==='opponent'?'category':'jersey';selectedJersey=null;render();
}
if(shotMode||combined){
 const selector=$('post-switch-direction');
 selector.hidden=false;
 const syncDirections=()=>{
  selector.setAttribute('aria-pressed',String(firstHalfRight));
  const q=viewPeriod(),trackedBasket=basketSide('us');
  selector.title='Switch basket sides · '+labelPeriod(q)+' · '+teamName+' attacks '+trackedBasket;
  selector.setAttribute('aria-label','Switch basket sides. '+teamName+' attacks the '+trackedBasket+' basket in '+labelPeriod(q));
  window.dispatchEvent(new CustomEvent('apex:review-direction-changed',{
   detail:{reversed:firstHalfRight,quarter:q,trackedBasket}
  }));
 };
 selector.addEventListener('click',()=>{
  if(!complete()&&shotMode&&!confirm('Cancel the current shot selection and switch directions?'))return;
  if(combined&&window.apexPostgameQuick?.hasPending?.()){
   api.notify('Finish or cancel the current stat before switching sides.');return;
  }
  if(shotMode)clear();
  firstHalfRight=!firstHalfRight;
  try{sessionStorage.setItem(directionKey,String(firstHalfRight));}catch(_){}
  syncDirections();
  api.notify(teamName+' now attacks '+basketSide('us')+' in '+labelPeriod(viewPeriod())+'. The opposite basket is used after halftime. Previously saved shots are unchanged.');
 });
 syncDirections();
 $('post-period')?.addEventListener('change',syncDirections);
 window.addEventListener('apex:shot-view-change',syncDirections);
 const captureClick=ev=>{
  ev.stopImmediatePropagation();ev.preventDefault();
  if(Date.now()<(window.__apexCourtSwipeUntil||0))return;
  const point=courtPoint(ev);if(!point)return;
  if(combined&&window.apexPostgameQuick?.selectExistingShotAt(point)){if(timer){clearTimeout(timer);timer=null;}return;}
  if(shotMode&&insertedShot){if(timer){clearTimeout(timer);timer=null;}begin(point,insertedShot.made);return;}
  if(shotMode&&guidedTarget){if(timer){clearTimeout(timer);timer=null;}begin(point,guidedTarget.made);return;}
  if(timer){clearTimeout(timer);timer=null;begin(point,false);return;}
  if(ev.detail>=2){begin(point,false);return;}
  timer=setTimeout(()=>{timer=null;begin(point,true);},260);
 };
 court.addEventListener('click',captureClick,true);
 court.addEventListener('dblclick',ev=>{ev.preventDefault();ev.stopImmediatePropagation();},true);
}
async function saveShotLinkOrNew(){
 if(shot.guidedId){
  const match=api.getEvents().find(e=>e.id===shot.guidedId);
  if(!match){api.notify('The selected play is no longer available. Refresh Guided Tracking.');return;}
  await finalize(match);return;
 }
 const candidates=api.getEvents().filter(e=>e.type==='shot'&&Number(e.period)===period()&&e.team===shot.team
   &&Number(e.points)===shot.points&&e.made===shot.made&&(e.x==null||e.y==null));
 // A player-confirmed unique candidate is safe to match. Never guess between
 // multiple similar attempts or infer identity from shot value alone.
 const direct=!shot.inserted&&candidates.length===1&&selectedJersey?.id&&
  String(candidates[0].player_id)===String(selectedJersey.id);
 if(direct){await finalize(candidates[0]);return;}
 const locatedDuplicate=api.getEvents().some(e=>e.type==='shot'&&e.team===shot.team
   &&Number(e.period)===period()&&e.made===shot.made&&Number(e.points)===shot.points
   &&e.x!=null&&e.y!=null&&Math.hypot(Number(e.x)-shot.position.x,Number(e.y)-shot.position.y)<16);
 if(candidates.length||locatedDuplicate){await savePending();return;}
 await finalize(null);
}
async function savePending(){
 if(!shot||saving)return;
 saving=true;
 try{
  const auth=await supabaseClient.auth.getUser(),uid=auth.data?.user?.id;
  if(!uid)throw new Error('Please sign in again.');
  const record={id:crypto.randomUUID(),game_id:api.gameId,period:period(),team:shot.team,points:shot.points,
   made:shot.made,x:shot.position.x,y:shot.position.y,player_id:shot.team==='us'?selectedJersey?.id||null:null,
   category:shot.category||null,opponent_jersey:shot.team==='opponent'?selectedJersey?.number??null:null,created_by:uid};
  const result=await supabaseClient.from('apexvision_postgame_pending_shots').insert(record);
  if(result.error)throw result.error;
  clear();insertedShot=null;api.notify('Uncertain shot saved to Unmatched Shots. No duplicate attempt or points were added.');
  window.dispatchEvent(new CustomEvent('apex:pending-shot-added'));
 }catch(error){api.notify('Could not save pending shot: '+error.message+' (check staging migration).');}
 finally{saving=false;}
}
async function finalize(match){
 if(!shot||saving)return;
 saving=true;prompt.querySelectorAll('button').forEach(b=>b.disabled=true);
 try{
  let eventId=match?.id||null;
  if(match){
   const ok=await api.linkShot(match,shot.position,$('post-review-save-anchor'));
   if(!ok)throw new Error('Existing attempt could not be linked.');
   if(shot.team==='us'&&selectedJersey?.id&&!match.player_id){
    const assigned=await api.assignPlayer(eventId,selectedJersey.id);
    if(!assigned)api.notify('Shot linked, but player attribution needs a review.');
   }
  }else{
   const similar=api.getEvents().filter(e=>e.type==='shot'&&e.team===shot.team&&Number(e.period)===period()
    &&e.x!=null&&e.y!=null&&Math.hypot(Number(e.x)-shot.position.x,Number(e.y)-shot.position.y)<10&&e.made===shot.made);
   if(similar.length&&!confirm('A similar recorded shot already exists here. Is this definitely a different attempt?'))return;
   eventId=await api.saveEvent({type:'shot',team:shot.team,playerId:shot.team==='us'?selectedJersey?.id:null,
    points:shot.points,made:shot.made,position:shot.position,confirmed:true},$('post-review-save-anchor'));
   if(!eventId)throw new Error('The shot was not saved.');
  }
  if(shot.category){
   const done=await api.saveClassification(eventId,shot.category,null);
   if(!done)api.notify('Shot saved, but its category needs review.');
  }
  if(shot.team==='opponent'&&selectedJersey?.number!=null){
   const auth=await supabaseClient.auth.getUser();
   if(auth.data?.user){
    const result=await supabaseClient.from('apexvision_postgame_opponent_jerseys').upsert({
      event_id:eventId,game_id:api.gameId,jersey_number:selectedJersey.number,
      updated_by:auth.data.user.id,updated_at:new Date().toISOString()
    },{onConflict:'event_id'});
    if(result.error)api.notify('Shot saved, but opponent jersey attribution needs review: '+result.error.message);
   }
  }
  const wasGuided=!!shot.guidedId,wasInserted=!!shot.inserted;
  await api.refresh();updateScoreboard();clear();insertedShot=null;
  window.dispatchEvent(new CustomEvent('apex:shot-review-saved',{detail:{eventId,wasGuided,wasInserted}}));
  api.notify(wasGuided?'Guided shot located. Moving to the next recorded attempt.':'Shot recorded. Ready for the next shot.');
 }catch(error){api.notify('Could not complete shot: '+(error.message||error));render();}
 finally{saving=false;}
}
prompt?.addEventListener('click',async ev=>{
 const control=ev.target.closest('button[data-flow]');if(!control||saving)return;
 const action=control.dataset.flow;
 if(action==='cancel'){clear();if(insertedShot){insertedShot=null;window.dispatchEvent(new CustomEvent('apex:insert-shot-cancelled'));}return;}
 if(action==='back'){if(shot?.team==='opponent'){clear();return;}step='jersey';render();return;}
 if(action==='manualJersey'){
  const n=Number($('post-opp-jersey')?.value);
  if(!Number.isInteger(n)||n<0||n>99){api.notify('Select a jersey between 0 and 99.');return;}
  selectedJersey={number:n,label:'#'+n};step='category';render();return;
 }
 if(step==='jersey'){
  if(shot.team==='us'){
   const p=api.getPlayers().find(p=>String(p.id)===action);
   if(!p)return;selectedJersey={id:p.id,number:p.number,label:'#'+p.number};
  }else{
   const n=Number(action);if(!Number.isInteger(n))return;
   selectedJersey={number:n,label:'#'+n};
  }
  step='category';render();return;
 }
 if(step==='category'){
  if(action!=='categorySkip'&&!categories.some(([id])=>id===action))return;
  shot.category=action==='categorySkip'?null:action;
  await saveShotLinkOrNew();return;
 }
 if(step==='match'){
  if(action==='newShot'){await finalize(null);return;}
  if(action.startsWith('match:'))await finalize(shot.candidates[Number(action.slice(6))]);
 }
});
const next=$('post-next-quarter'),finish=$('post-end-review'),back=$('back-to-room');
function reviewLeaveGuard(event){
 const quick=window.apexPostgameQuick;
 if(!(shotMode&&(!complete()||!!insertedShot)||quick?.hasPending()))return;
 if(!confirm('There is an unfinished play or an event still saving. Leave it? Unsaved selections will be discarded, but saved events remain.')){
   event.preventDefault();event.stopImmediatePropagation();return;
 }
 // Never navigate while server saves are still in flight.
 if(quick&&!quick.ready()){
   event.preventDefault();event.stopImmediatePropagation();
   api.notify('Finishing the saved event. Try again once the save completes.');return;
 }
 if(shotMode&&(!complete()||insertedShot)){clear();insertedShot=null;}
 if(quick?.hasPending())quick.abort();
}
next?.addEventListener('click',reviewLeaveGuard,true);
finish?.addEventListener('click',reviewLeaveGuard,true);
back?.addEventListener('click',reviewLeaveGuard,true);
window.apexCourtReview={
 startInsertedShot:info=>{
  if(!shotMode||saving||!complete())return false;
  insertedShot={team:info.team,made:!!info.made,points:Number(info.points)};
  return true;
 },
 cancelInsertedShot:()=>{insertedShot=null;clear();},
 isInserting:()=>!!insertedShot,
 setGuidedTarget:event=>{
  if(!shotMode||saving||!complete())return false;
  guidedTarget=event||null;
  // Guided-mode styling is owned by Guided Tracking, even when a shot is already located.
  return true;
 },
 getGuidedTarget:()=>guidedTarget,
 isBusy:()=>saving||!complete()||!!insertedShot,
 reset:()=>{guidedTarget=null;insertedShot=null;clear();document.body.classList.remove('pg-guided-on');}
};
$('post-period')?.addEventListener('change',()=>{periodStamp++;guidedTarget=null;insertedShot=null;document.body.classList.remove('pg-guided-on');clear();updateScoreboard();});
window.addEventListener('apex:shot-view-change',updateScoreboard);
window.addEventListener('apex:postgame-events-updated',updateScoreboard);
window.addEventListener('focus',()=>void refreshScoreboard());
setInterval(()=>{if(!document.hidden)void refreshScoreboard();},7000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refreshScoreboard();});
const wait=async()=>{
 for(let n=0;n<90;n++){
  const game=api.getGame();
  if(game&&$('postgame-screen')?.hidden===false){
   teamName=game.team_name||'Tracked Team';updateScoreboard();
   try{
    supabaseClient.channel('apexvision-film-score-'+api.gameId)
      .on('postgres_changes',{event:'*',schema:'public',table:'game_events',filter:'game_id=eq.'+api.gameId},
       ()=>void refreshScoreboard()).subscribe();
   }catch(error){console.warn('Realtime unavailable; refresh on focus remains enabled.',error);}
   return;
  }
  await new Promise(resolve=>setTimeout(resolve,170));
 }
};
void wait();
})();
