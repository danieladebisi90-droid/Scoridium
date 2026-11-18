/* Guided Shot Tracking + deferred review and mobile half-court adaptation.
   Shared game_events IDs are the only authoritative match for guided shots. */
(()=>{
'use strict';
const api=window.apexPostgame,$=id=>document.getElementById(id);
if(!api)return;
const shotMode=api.mode==='shot',hasCourt=api.mode!=='stat';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
let guided=false,sequence=[],index=0,timeline=new Map(),pending=[],queueReady=false,loading=false;
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
function selectGuidedItem(preferredId=null){
 if(!shotMode)return;
 const old=preferredId||sequence[index]?.id;
 sequence=api.getEvents().filter(e=>e.type==='shot'&&Number(e.period)===period()).slice().sort(sequenceOrder);
 if(!sequence.length){index=0;window.apexCourtReview?.setGuidedTarget(null);renderGuided();return;}
 const match=sequence.findIndex(e=>e.id===old);index=match>=0?match:Math.max(0,sequence.findIndex(e=>e.x==null||e.y==null));
 if(index<0)index=0;
 const target=sequence[index];
 if(guided&&!(target.x!=null&&target.y!=null))window.apexCourtReview?.setGuidedTarget(target);
 else window.apexCourtReview?.setGuidedTarget(null);
 renderGuided();
}
function renderGuided(){
 if(!shotMode)return;
 const free=$('pg-guided-free'),enable=$('pg-guided-enable'),hint=$('pg-guided-hint'),status=$('pg-guided-status');
 free?.setAttribute('aria-pressed',String(!guided));enable?.setAttribute('aria-pressed',String(guided));
 const item=sequence[index],unlocated=sequence.filter(e=>e.x==null||e.y==null).length;
 const uncertain=sequence.some(e=>!timeline.has(e.id));
 status.textContent=sequence.length?index+1+' / '+sequence.length+' shots · '+unlocated+' need locations':'No shot events in this quarter';
 if(!guided){hint.textContent='';return;}
 if(!item){
  hint.textContent='No recorded shot attempts to guide in this quarter. Switch to Free Tracking if a shot is missing.';return;
 }
 const state=item.x!=null&&item.y!=null?'ALREADY LOCATED':'TAP LOCATION';
 hint.textContent=state+' · '+label(item)+(uncertain?' · Order based on event entry time; verify against video.':'');
 $('pg-guided-previous').disabled=index<=0;$('pg-guided-next').disabled=index>=sequence.length-1;
}
function setMode(next){
 if(window.apexCourtReview?.isBusy()){api.notify('Finish or cancel the current shot before changing tracking mode.');return;}
 guided=next;
 document.body.classList.toggle('pg-guided-on',guided);
 if(guided){
  const first=sequence.findIndex(e=>e.x==null||e.y==null);
  index=first<0?0:first;
  selectGuidedItem(sequence[index]?.id);
 }else{window.apexCourtReview?.setGuidedTarget(null);renderGuided();}
}
function move(delta){
 if(window.apexCourtReview?.isBusy()){api.notify('Finish the current shot before moving to another recorded play.');return;}
 if(!sequence.length)return;
 index=Math.max(0,Math.min(sequence.length-1,index+delta));
 selectGuidedItem(sequence[index]?.id);
}
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
 const media=window.matchMedia('(orientation: portrait) and (max-width: 900px)');
 let opponent=false;
 function show(){
  if(!court||!toggle)return;
  const compact=media.matches;
  toggle.hidden=!compact;
  if(!compact){court.setAttribute('viewBox','0 0 860 470');return;}
  const trackedLeft=Number(period())<=2;const left=opponent?!trackedLeft:trackedLeft;
  court.setAttribute('viewBox',(left?'10':'430')+' 10 420 450');
  toggle.textContent=opponent?'Show Tracked Half':'Show Opponent Half';
  toggle.setAttribute('aria-pressed',String(opponent));
 }
 toggle?.addEventListener('click',()=>{if(window.apexCourtReview?.isBusy())return;opponent=!opponent;show();});
 media.addEventListener('change',show);
 $('post-period')?.addEventListener('change',()=>{opponent=false;show();});
 show();
}
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
window.addEventListener('apex:pending-shot-added',()=>void reloadPending());
$('post-period')?.addEventListener('change',()=>{if(shotMode)selectGuidedItem(null);void reloadPending();});
let ready=false;
window.addEventListener('apex:postgame-ready',async()=>{
 if(ready)return;ready=true;
 initHalfCourt();
 if(shotMode){await loadTimeline();selectGuidedItem(null);if(sequence.some(e=>e.x==null||e.y==null))setMode(true);}
 if(hasCourt)await reloadPending();
});
})();