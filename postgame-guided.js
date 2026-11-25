/* Guided Shot Tracking + deferred review and mobile half-court adaptation.
   Shared game_events IDs are the only authoritative match for guided shots. */
(()=>{
'use strict';
const api=window.apexPostgame,$=id=>document.getElementById(id);
if(!api)return;
const shotMode=api.mode==='shot',hasCourt=api.mode!=='stat';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let guided=false,sequence=[],index=0,timeline=new Map(),pending=[],queueReady=false,loading=false;
let reversed=false,courtView='full',insertActive=false,manualOpponent=false,insertBeforeId=null,insertRows=[];
let showCourt=()=>{};
const period=()=>api.getPeriod();
const label=e=>(e.team==='us'?(api.getGame()?.team_name||'Tracked Team'):(api.getGame()?.opponent||'Opponent'))+
 ' · '+(e.made?'Made ':'Missed ')+e.points+'PT'+(e.player_id?' · #'+(api.getPlayers().find(p=>String(p.id)===String(e.player_id))?.number??'?'):'');
function candidates(o){return api.getEvents().filter(e=>e.type==='shot'&&e.team===o.team&&Number(e.period)===Number(o.period)&&
 Number(e.points)===Number(o.points)&&e.made===o.made&&e.x==null&&e.y==null&&
 (!o.player_id||!e.player_id||String(e.player_id)===String(o.player_id)));}
function sequenceOrder(a,b){
 const at=timeline.get(a.id),bt=timeline.get(b.id);
 if(at!=null&&bt!=null)return at-bt||String(a.created_at).localeCompare(String(b.created_at))||a.id.localeCompare(b.id);
 if(at!=null)return -1;if(bt!=null)return 1;
 return String(a.created_at||'').localeCompare(String(b.created_at||''))||a.id.localeCompare(b.id);
}
function orderedShots(rows){
 const sorted=rows.slice().sort(sequenceOrder);
 for(const record of insertRows){
  const position=sorted.findIndex(e=>e.id===record.event_id);
  if(position<0)continue;
  const [item]=sorted.splice(position,1);
  const before=sorted.findIndex(e=>e.id===record.before_event_id);
  sorted.splice(before<0?sorted.length:before,0,item);
 }
 return sorted;
}
async function loadInsertions(){
 if(!shotMode)return;
 const r=await supabaseClient.from('apexvision_postgame_shot_inserts')
  .select('event_id,before_event_id,created_at').eq('game_id',api.gameId).order('created_at');
 if(r.error){insertRows=[];console.warn('Guided inserted-shot order unavailable; staging migration required:',r.error.message);return;}
 insertRows=r.data||[];
}
async function saveInsertionOrder(eventId){
 if(!insertBeforeId)return;
 const auth=await supabaseClient.auth.getUser(),user=auth.data?.user;
 if(!user)return;
 const r=await supabaseClient.from('apexvision_postgame_shot_inserts').insert({
  event_id:eventId,game_id:api.gameId,before_event_id:insertBeforeId,created_by:user.id
 });
 if(r.error)api.notify('Shot saved, but its position in Guided Tracking could not be kept across sessions. Apply the shot-inserts staging migration.');
 insertBeforeId=null;
}
function selectGuidedItem(preferredId=null){
 if(!shotMode)return;
 const old=preferredId||sequence[index]?.id;
 sequence=orderedShots(api.getEvents().filter(e=>e.type==='shot'&&Number(e.period)===period()));
 if(!sequence.length){index=0;window.apexCourtReview?.setGuidedTarget(null);renderGuided();return;}
 const match=sequence.findIndex(e=>e.id===old);index=match>=0?match:Math.max(0,sequence.findIndex(e=>e.x==null||e.y==null));
 if(index<0)index=0;
 const target=sequence[index];
 if(guided&&!(target.x!=null&&target.y!=null))window.apexCourtReview?.setGuidedTarget(target);
 else window.apexCourtReview?.setGuidedTarget(null);
 window.dispatchEvent(new CustomEvent('apex:guided-shot-selected',{detail:{team:target.team,guided,located:target.x!=null&&target.y!=null}}));
 highlightGuidedHalf(target);
 renderGuided();
}
function highlightGuidedHalf(event){
  document.getElementById('pg-guided-half-highlight')?.remove();
}
function runningScore(){
 const running={us:0,opponent:0},item=sequence[index];
 for(const e of api.getEvents().filter(e=>Number(e.period)<period())){
  if(e.made===true&&(e.type==='shot'||e.type==='free_throw'))running[e.team]=(running[e.team]||0)+(Number(e.points)||0);
 }
 for(const e of api.getEvents().filter(e=>Number(e.period)===period()).slice().sort(sequenceOrder)){
  if(e.made===true&&(e.type==='shot'||e.type==='free_throw'))running[e.team]=(running[e.team]||0)+(Number(e.points)||0);
  if(item&&e.id===item.id)break;
 }
 return running;
}
function renderGuided(){
 if(!shotMode)return;
 const free=$('pg-guided-free'),enable=$('pg-guided-enable'),hint=$('pg-guided-hint'),status=$('pg-guided-status');
 free?.setAttribute('aria-pressed',String(!guided));enable?.setAttribute('aria-pressed',String(guided));
 const item=sequence[index],unlocated=sequence.filter(e=>e.x==null||e.y==null).length;
 const uncertain=sequence.some(e=>!timeline.has(e.id));
 status.textContent=sequence.length?'Shot '+(index+1)+' of '+sequence.length+' · '+unlocated+' need locations':'No shot events in this quarter';
 const summary=$('pg-shot-sequence');
 const count=sequence.length?((index+1)+' of '+sequence.length+' · '+unlocated+' need locations'):'No recorded shots';
 if(summary)summary.textContent=guided?'Progress: '+count:'Free Tracking · '+count;
 
const hintBox = $('pg-guided-hint');

if (hintBox) {
  hintBox.replaceChildren();

  if (guided && item) {
    const shotLine = document.createElement('div');
    shotLine.className = 'pg-compact-shot';

    const description = document.createElement('strong');
    description.textContent = label(item);

    const progress = document.createElement('span');
    progress.textContent =
      'Q' + period() + ' · Shot ' +
      (index + 1) + '/' + sequence.length;

    shotLine.append(description, progress);

    const instruction = document.createElement('small');
    instruction.textContent =
      item.x != null && item.y != null
        ? 'Shot location already recorded'
        : 'Tap the court to place this shot';

    hintBox.append(shotLine, instruction);
  }
}

}
function setMode(next){
 if(window.apexCourtReview?.isBusy()){api.notify('Finish or cancel the current shot before changing tracking mode.');return;}
 guided=next;
 document.body.classList.toggle('pg-guided-on',guided);
 if(guided){
  const first=sequence.findIndex(e=>e.x==null||e.y==null);
  index=first<0?0:first;
  selectGuidedItem(sequence[index]?.id);
 }else{window.apexCourtReview?.setGuidedTarget(null);highlightGuidedHalf(null);renderGuided();}
}
function move(delta){
 if(window.apexCourtReview?.isBusy()){api.notify('Finish the current shot before moving to another recorded play.');return;}
 if(!sequence.length)return;
 index=Math.max(0,Math.min(sequence.length-1,index+delta));
 selectGuidedItem(sequence[index]?.id);
}


window.apexGuidedPosition = {
  getEventId: () => sequence[index]?.id || null,

  setEventId: id => {
    if (id && sequence.some(e => e.id === id)) {
      selectGuidedItem(id);
    }
  }
};


function jumpToPendingReview(){const dlg=$('pg-review-queue-dialog');if(dlg&&!dlg.open){void reloadPending().then(()=>dlg.showModal());}}
async function loadTimeline(){
 if(!shotMode)return;
 const r=await supabaseClient.from('apexvision_postgame_timeline').select('event_id,video_second').eq('game_id',api.gameId);
 if(r.error){console.warn('Film video timestamp unavailable',r.error.message);return;}
 timeline=new Map((r.data||[]).map(row=>[row.event_id,Number(row.video_second)]));
}
function itemHTML(o){
 const c=candidates(o),name=(o.team==='us'?(api.getGame()?.team_name||'Tracked Team'):(api.getGame()?.opponent||'Opponent'));
 const options=c.map((e,i)=>'<option value="'+esc(e.id)+'">Shot '+(i+1)+' · '+esc(label(e))+'</option>').join('');
 return '<article class="pg-review-item" role="listitem" data-pending-id="'+esc(o.id)+'">'+
 '<div><strong>'+esc(name)+' · Q'+Number(o.period)+' · '+(o.made?'Made ':'Missed ')+Number(o.points)+'PT</strong>'+
 '<small>'+(o.player_id?'Player #'+esc(api.getPlayers().find(p=>String(p.id)===String(o.player_id))?.number??'?')+' · ':'')+
 c.length+' possible matches · Location saved, not counted</small>'+
 '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:7px">'+
 (options?'<select aria-label="Existing attempt to link" data-pending-match>'+options+'</select><button type="button" data-pending-action="link">Link Existing</button>':'')+
 '<button type="button" data-pending-action="new">Confirm New</button>'+
 '<button type="button" data-pending-action="discard">Discard</button></div></div></article>';
}
function renderPending(){
 const list=$('pg-review-queue-list');if(!list)return;
 const unresolved=pending.filter(x=>!x.resolved_event_id);
 $('pg-unmatched-count').textContent=unresolved.length?'('+unresolved.length+')':'';
 list.innerHTML=unresolved.length?unresolved.map(itemHTML).join(''):
 '<p>No unresolved shot observations. You can keep tracking.</p>';
}
async function reloadPending(){
 if(!hasCourt)return;
 const r=await supabaseClient.from('apexvision_postgame_pending_shots')
  .select('id,game_id,period,team,points,made,x,y,player_id,category,opponent_jersey,created_at,resolved_event_id')
  .eq('game_id',api.gameId).is('resolved_event_id',null).order('created_at');
 if(r.error){
  queueReady=false;
  $('pg-unmatched-count').textContent='(!)';
  $('pg-review-queue-list').textContent='Deferred shot storage not available yet. Apply MIGRATION_APEXVISION_POSTGAME_PENDING_SHOTS.sql to ApexVision-Test. '+r.error.message;
  return;
 }
 queueReady=true;pending=r.data||[];renderPending();
}
async function markResolved(observation,eventId){
 const r=await supabaseClient.from('apexvision_postgame_pending_shots')
  .update({resolved_event_id:eventId,resolved_at:new Date().toISOString()}).eq('id',observation.id).eq('game_id',api.gameId);
 if(r.error)throw r.error;
}
async function preserveMetadata(o,eventId){
 if(o.category)await api.saveClassification(eventId,o.category,null);
 if(o.team==='opponent'&&o.opponent_jersey!=null){
  const auth=await supabaseClient.auth.getUser(),user=auth.data?.user;
  if(user){
   const r=await supabaseClient.from('apexvision_postgame_opponent_jerseys').upsert({
    event_id:eventId,game_id:api.gameId,jersey_number:o.opponent_jersey,updated_by:user.id
   },{onConflict:'event_id'});
   if(r.error)api.notify('Shot saved; opponent jersey still needs review: '+r.error.message);
  }
 }
}
async function resolvePending(o,action,matchId=null){
 if(loading)return;
 loading=true;
 try{
  if(action==='discard'){
   if(!confirm('Discard this unmatched observation? No recorded game event will be deleted.'))return;
   const result=await supabaseClient.from('apexvision_postgame_pending_shots').delete().eq('id',o.id).eq('game_id',api.gameId);
   if(result.error)throw result.error;
  }else{
   let eventId=null;
   if(action==='link'){
    const match=candidates(o).find(e=>e.id===matchId);
    if(!match)throw new Error('The chosen existing attempt is no longer available.');
    const ok=await api.linkShot(match,{x:Number(o.x),y:Number(o.y)},$('post-review-save-anchor'));
    if(!ok)throw new Error('The existing shot could not be linked.');
    if(o.team==='us'&&o.player_id&&!match.player_id)
     await api.assignPlayer(match.id,o.player_id);
    eventId=match.id;
   }else if(action==='new'){
    if(!confirm('Confirm this was an additional shot not already recorded. It will count as a new attempt in tracked statistics.'))return;
    const id=await api.saveEvent({
     type:'shot',team:o.team,playerId:o.team==='us'?o.player_id:null,
     points:Number(o.points),made:o.made,position:{x:Number(o.x),y:Number(o.y)},confirmed:true
    },$('post-review-save-anchor'));
    if(!id)throw new Error('New shot could not be saved.');
    eventId=id;
   }
   if(!eventId)return;
   await preserveMetadata(o,eventId);
   await markResolved(o,eventId);
   await api.refresh();
   window.dispatchEvent(new CustomEvent('apex:postgame-events-updated'));
  }
  await reloadPending();selectGuidedItem();
 }catch(error){api.notify('Could not resolve shot: '+error.message);}
 finally{loading=false;}
}
function initHalfCourt(){
 if(!hasCourt)return;
 const court=$('postgame-court'),toggle=$('pg-half-toggle');
 const media=window.matchMedia('(orientation: portrait) and (max-width: 700px)');
 const tablet=window.matchMedia('(orientation: portrait) and (min-width: 701px) and (max-width: 1100px)');
 let opponent=false;
 
function show(){
  if(!court)return;

  const compact=media.matches;
  const half=courtView==='half'||(compact&&courtView!=='full');

  if(toggle)toggle.hidden=!half;

  if(!half){
    court.setAttribute('viewBox','0 0 860 470');
    court.classList.remove('pg-half-view');
    publish();
    return;
  }

  const trackedLeft=(Number(period())<=2)!==reversed;
  const left=opponent?!trackedLeft:trackedLeft;

  court.setAttribute('viewBox',(left?'10':'430')+' 10 420 450');
  court.classList.add('pg-half-view');

  if(toggle){
    toggle.textContent=opponent?'Show Tracked Half':'Show Opponent Half';
    toggle.setAttribute('aria-pressed',String(opponent));
  }

  publish();
}

 function publish(){
  const team=opponent?'opponent':'us';
  document.body.classList.toggle('pg-view-opponent',courtView==='half'&&opponent);
  const game=api.getGame();
  const title=team==='us'?(game?.team_name||'Tracked Team'):(game?.opponent||'Opponent');
  const heading=document.getElementById('pg-court-team-label');
  if(heading)heading.textContent=courtView==='half'?title+' OFFENSE':'FULL COURT';
  const trackedLeft=(Number(period())<=2)!==reversed;
  const labels=[document.getElementById('left-basket-label'),document.getElementById('right-basket-label')];
  for(let i=0;i<2;i++)if(labels[i]){
   const name=(i===0?trackedLeft:!trackedLeft)?(game?.team_name||'Tracked Team'):(game?.opponent||'Opponent');
   labels[i].textContent=String(name).length>21?String(name).slice(0,18)+'…':name;
   labels[i].setAttribute('font-size','18');
   labels[i].setAttribute('x',i===0?'220':'640');
   labels[i].setAttribute('y','430');
  }
  window.dispatchEvent(new CustomEvent('apex:court-view-updated',{detail:{team,half:courtView==='half',reversed}}));
 }
 toggle?.addEventListener('click',()=>{if(window.apexCourtReview?.isBusy())return;opponent=!opponent;show();});
 window.apexFilmCourtView={
  isHalf:()=>courtView==='half', currentTeam:()=>opponent?'opponent':'us',
  setHalf:team=>{if(window.apexCourtReview?.isBusy())return false;courtView='half';opponent=team==='opponent';$('pg-court-full')?.setAttribute('aria-pressed','false');$('pg-court-half')?.setAttribute('aria-pressed','true');show();return true;},
  swipeTo:team=>{if(courtView!=='half'||window.apexCourtReview?.isBusy())return false;opponent=team==='opponent';show();return true;},
  showFull:()=>{if(window.apexCourtReview?.isBusy())return false;setCourtView('full');return true;}
 };
 showCourt=show;
 function setCourtView(value){
  if(window.apexCourtReview?.isBusy()){api.notify('Finish or cancel the active shot before changing court views.');return;}
  courtView=value;
  $('pg-court-full')?.setAttribute('aria-pressed',String(value==='full'));
  $('pg-court-half')?.setAttribute('aria-pressed',String(value==='half'));
  show();
 }
 $('pg-court-full')?.addEventListener('click',()=>setCourtView('full'));
 $('pg-court-half')?.addEventListener('click',()=>setCourtView('half'));
 media.addEventListener('change',()=>{if(media.matches&&courtView==='full'){courtView='half';$('pg-court-full')?.setAttribute('aria-pressed','false');$('pg-court-half')?.setAttribute('aria-pressed','true');}show();});
 tablet.addEventListener('change',show);
 window.addEventListener('apex:review-direction-changed',ev=>{reversed=!!ev.detail?.reversed;show();highlightGuidedHalf(sequence[index]);});
 window.addEventListener('apex:guided-shot-selected',ev=>{if(ev.detail?.guided&&!insertActive){opponent=ev.detail.team==='opponent';show();}});
 window.addEventListener('apex:insert-shot-focus',ev=>{opponent=ev.detail.team==='opponent';show();});
 $('post-period')?.addEventListener('change',()=>{opponent=false;show();});
 if(media.matches){courtView='half';$('pg-court-full')?.setAttribute('aria-pressed','false');$('pg-court-half')?.setAttribute('aria-pressed','true');}
 show();
}
function insertShow(open){
 insertActive=open;
 $('pg-add-shot-form').hidden=!open;
 $('pg-add-shot').textContent=open?'Choose missing shot location':'+ Record a Shot';
}
$('pg-add-shot')?.addEventListener('click',()=>{
 if(insertActive){
  if(window.apexCourtReview?.isInserting()){
   if(confirm('Cancel the missing-shot selection?')){window.apexCourtReview.cancelInsertedShot();insertBeforeId=null;insertShow(false);document.body.classList.remove('pg-insert-shot');selectGuidedItem();}
  }else $('pg-add-shot-form').requestSubmit();
  return;
 }
 if(window.apexCourtReview?.isBusy()){api.notify('Finish the current shot first.');return;}
 insertShow(true);
 insertBeforeId=sequence[index]?.id||null;
 $('pg-add-shot-team').value=sequence[index]?.team||'us';
});
$('pg-add-shot-form')?.addEventListener('submit',event=>{
 event.preventDefault();
 const request={team:$('pg-add-shot-team').value,made:$('pg-add-shot-made').value==='true',
 points:Number($('pg-add-shot-value').value)};
 if(!window.apexCourtReview?.startInsertedShot(request)){api.notify('Complete or cancel the current shot first.');return;}
 insertActive=true;
 document.body.classList.add('pg-insert-shot');
 // Switch to half court to make accurate placement easier; preserve guided shot context.
 courtView='half';$('pg-court-full').setAttribute('aria-pressed','false');$('pg-court-half').setAttribute('aria-pressed','true');
 window.dispatchEvent(new CustomEvent('apex:insert-shot-focus',{detail:{team:request.team}}));
 $('pg-add-shot-form').hidden=true;
 $('pg-add-shot').textContent='Inserting '+(request.made?'made ':'missed ')+request.points+'PT · Tap court';
 api.notify('Choose a '+request.points+'PT location for the '+(request.team==='us'?'tracked team':'opponent')+'. Then select the shooter and category.');
});
$('pg-add-shot-cancel')?.addEventListener('click',()=>{
 window.apexCourtReview?.cancelInsertedShot();insertBeforeId=null;insertShow(false);
 document.body.classList.remove('pg-insert-shot');selectGuidedItem();
});
window.addEventListener('apex:insert-shot-cancelled',()=>{insertBeforeId=null;insertShow(false);document.body.classList.remove('pg-insert-shot');selectGuidedItem();});
$('pg-guided-free')?.addEventListener('click',()=>setMode(false));
$('pg-guided-enable')?.addEventListener('click',()=>setMode(true));
$('pg-guided-previous')?.addEventListener('click',()=>move(-1));
$('pg-guided-next')?.addEventListener('click',()=>move(1));
$('pg-guided-skip')?.addEventListener('click',()=>move(1));
$('pg-unmatched-open')?.addEventListener('click',jumpToPendingReview);
$('pg-review-queue-close')?.addEventListener('click',()=>$('pg-review-queue-dialog')?.close());
$('pg-review-queue-list')?.addEventListener('click',async e=>{
 const btn=e.target.closest('[data-pending-action]');if(!btn)return;
 const row=btn.closest('[data-pending-id]'),o=pending.find(x=>x.id===row?.dataset.pendingId);
 if(!o)return;
 await resolvePending(o,btn.dataset.pendingAction,row.querySelector('[data-pending-match]')?.value);
});
window.addEventListener('apex:shot-review-saved',async e=>{
 if(e.detail?.wasInserted){
  insertShow(false);document.body.classList.remove('pg-insert-shot');
  await saveInsertionOrder(e.detail.eventId);
  await loadInsertions();
 }
 await api.refresh();
 const previous=sequence[index]?.id;
 selectGuidedItem(previous);
 if(guided){
  const next=sequence.findIndex((x,i)=>i>index&&(x.x==null||x.y==null));
  if(next>=0){index=next;selectGuidedItem(sequence[index]?.id);}
  else{const remaining=sequence.findIndex(x=>x.x==null||x.y==null);
   if(remaining>=0){index=remaining;selectGuidedItem(sequence[index]?.id);}
  }
 }
 await reloadPending();
});
window.addEventListener('apex:postgame-events-updated',()=>{if(shotMode&&!window.apexCourtReview?.isBusy())selectGuidedItem(sequence[index]?.id);});
window.addEventListener('apex:pending-shot-added',()=>{insertBeforeId=null;insertShow(false);document.body.classList.remove('pg-insert-shot');void reloadPending();selectGuidedItem();});
$('post-period')?.addEventListener('change',()=>{if(shotMode)selectGuidedItem(null);void reloadPending();});
let ready=false;
window.addEventListener('apex:postgame-ready',async()=>{
 if(ready)return;ready=true;
 initHalfCourt();
 if(shotMode){await Promise.all([loadTimeline(),loadInsertions()]);selectGuidedItem(null);if(sequence.some(e=>e.x==null||e.y==null))setMode(true);}
 window.dispatchEvent(new Event('apex:guided-ready'));
 if(hasCourt)await reloadPending();
});
})();