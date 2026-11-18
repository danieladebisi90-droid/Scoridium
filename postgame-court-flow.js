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
let shot=null,selectedJersey=null,step='idle',timer=null,directionOverride=false,saving=false,periodStamp=0;
let teamName='Tracked Team';
const opponentName=()=>api.getGame()?.opponent||'Opponent';
const period=()=>api.getPeriod();
const complete=()=>step==='idle';
function basketSide(team){
 const trackedLeft=(period()<=2)!==directionOverride;
 return team==='us'?(trackedLeft?'left':'right'):(trackedLeft?'right':'left');
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
  content=tag+'<strong>PLAYER '+escapeHTML(selectedJersey?.label)+'</strong><p>Choose shot category</p>'+grid(categories)+
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
 const team=teamAt(location.x),value=api.shotValue(location.x,location.y);
 const detail={position:location,made,points:value,team};
 if(combined){
  window.dispatchEvent(new CustomEvent('apex:postgame-court-shot',{detail}));
  return;
 }
 shot=detail;step='jersey';selectedJersey=null;render();
}
if(shotMode||combined){
 const selector=$('post-switch-direction');
 selector.hidden=false;
 selector.addEventListener('click',()=>{
  if(!complete()&&shotMode&&!confirm('Cancel the current shot selection and switch directions?'))return;
  if(shotMode)clear();
  directionOverride=!directionOverride;
  selector.setAttribute('aria-pressed',String(directionOverride));
  api.notify('Court directions switched for this review. Previously saved locations are unchanged.');
 });
 const captureClick=ev=>{
  ev.stopImmediatePropagation();ev.preventDefault();
  const point=courtPoint(ev);if(!point)return;
  if(timer){clearTimeout(timer);timer=null;begin(point,false);return;}
  if(ev.detail>=2){begin(point,false);return;}
  timer=setTimeout(()=>{timer=null;begin(point,true);},260);
 };
 court.addEventListener('click',captureClick,true);
 court.addEventListener('dblclick',ev=>{ev.preventDefault();ev.stopImmediatePropagation();},true);
}
async function saveShotLinkOrNew(){
 const candidates=api.getEvents().filter(e=>e.type==='shot'&&Number(e.period)===period()&&e.team===shot.team
   &&Number(e.points)===shot.points&&e.made===shot.made&&(e.x==null||e.y==null));
 if(candidates.length){shot.candidates=candidates;step='match';render();return;}
 await finalize(null);
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
    points:shot.points,made:shot.made,position:shot.position,confirmed:false},$('post-review-save-anchor'));
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
  await api.refresh();updateScoreboard();clear();
  api.notify('Shot recorded. Ready for the next shot.');
 }catch(error){api.notify('Could not complete shot: '+(error.message||error));render();}
 finally{saving=false;}
}
prompt?.addEventListener('click',async ev=>{
 const control=ev.target.closest('button[data-flow]');if(!control||saving)return;
 const action=control.dataset.flow;
 if(action==='cancel'){clear();return;}
 if(action==='back'){step='jersey';render();return;}
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
 if(!(shotMode&&!complete()||quick?.hasPending()))return;
 if(!confirm('There is an unfinished play or an event still saving. Leave it? Unsaved selections will be discarded, but saved events remain.')){
   event.preventDefault();event.stopImmediatePropagation();return;
 }
 // Never navigate while server saves are still in flight.
 if(quick&&!quick.ready()){
   event.preventDefault();event.stopImmediatePropagation();
   api.notify('Finishing the saved event. Try again once the save completes.');return;
 }
 if(shotMode&&!complete())clear();
 if(quick?.hasPending())quick.abort();
}
next?.addEventListener('click',reviewLeaveGuard,true);
finish?.addEventListener('click',reviewLeaveGuard,true);
back?.addEventListener('click',reviewLeaveGuard,true);
$('post-period')?.addEventListener('change',()=>{periodStamp++;clear();updateScoreboard();});
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
