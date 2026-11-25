/* Optional independent Quick Tracker mode. Does not write into game_events.
 * Requires MIGRATION_COLLABORATION.sql; preserves the original primary mode. */
(() => {
 'use strict';
 const game=new URLSearchParams(location.search).get('gameId');
 const id=`scoridium-independent-role:${game||'demo'}`;
 const mode=localStorage.getItem(id)==='independent'?'independent':'primary';
 const nav=document.querySelector('.focus-nav');if(!nav)return;
 const container=document.createElement('div');container.className='sc-tracker-role apex-room-trigger';
 container.innerHTML='<button type="button" id="apex-tracking-room-open" aria-haspopup="dialog" aria-controls="apex-tracking-room">Tracking Room</button><select id="sc-tracker-mode" hidden aria-hidden="true"><option value="primary">Stat Tracker</option><option value="independent">Shot Tracker</option></select>';
 const tabs=nav.querySelector('.focus-tabs');tabs?.before(container);
 const selector=container.querySelector('select');selector.value=mode;
 const dialog=document.createElement('dialog');dialog.id='apex-tracking-room';dialog.className='apex-tracking-room';
 dialog.innerHTML=`<div class="apex-room-head"><h2>Tracking Room</h2><button type="button" id="apex-room-close" aria-label="Close">×</button></div>
 <p class="apex-room-intro">Choose a role for this game. Tracking permissions are verified by the database.</p>
 <div id="apex-room-slots" role="status" aria-live="polite">Checking availability…</div>
 <p class="apex-room-privacy">Tracker identities are hidden. Only confirmed role activity is shown.</p>`;
 document.body.append(dialog);
 container.querySelector('#apex-tracking-room-open').addEventListener('click',()=>{dialog.showModal();void refreshRoom();});
 dialog.querySelector('#apex-room-close').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
 async function refreshRoom(){
   const host=dialog.querySelector('#apex-room-slots');host.replaceChildren();
   let occupied=null,shotActivity=null;
   if(game&&typeof supabaseClient!=='undefined'){
     const [primary,shot]=await Promise.all([
       supabaseClient.from('game_primary_trackers').select('tracker_id').eq('game_id',game).maybeSingle(),
       supabaseClient.from('tracker_observations').select('tracker_id,observed_at').eq('game_id',game).order('observed_at',{ascending:false}).limit(20)
     ]);
     if(!primary.error)occupied=Boolean(primary.data);
     if(!shot.error)shotActivity=(shot.data||[]).some(o=>Date.now()-new Date(o.observed_at).getTime()<180000);
   }
   for(const [value,label,info] of [
     ['primary','Stat Tracker',occupied===null?'Availability unverified':occupied?'Official slot claimed':'Official slot available'],
     ['independent','Shot Tracker',shotActivity===null?'Activity unverified':shotActivity?'Recent shot tracking activity':'No recent shot tracking activity']]){
       const card=document.createElement('div');card.className='apex-room-card';
       const headline=document.createElement('strong');headline.textContent=label+(mode===value?' · Your role':'');
       const status=document.createElement('small');status.textContent=info;
       const button=document.createElement('button');button.type='button';button.textContent=mode===value?'Current role':'Switch to '+label;
       button.disabled=mode===value;
       button.addEventListener('click',()=>{dialog.close();selector.value=value;selector.dispatchEvent(new Event('change'));});
       card.append(headline,status,button);host.append(card);
     }
 }

 // Official Stat Trackers work in Quick Track and Play-by-Play only.
 // Shot Trackers can independently record locations AND Quick Track observations.
 // Database authorization remains mandatory; this is an interaction boundary,
 // not a substitute for RLS.
 const courtTab=document.querySelector('.focus-tabs [data-focus-view="court"]');
 if(mode==='primary'){
   if(courtTab)courtTab.hidden=true;
 } else if(courtTab)courtTab.hidden=false;

 const deviceKey='scoridium-device-id';
 let deviceId=localStorage.getItem(deviceKey);
 if(!deviceId){deviceId=crypto.randomUUID();localStorage.setItem(deviceKey,deviceId);}
 let ownsPrimary=false,primaryGuard=false;
 const guard=(event)=>{
   if(primaryGuard&&!ownsPrimary&&event.target.closest('button')){
     event.stopImmediatePropagation();event.preventDefault();
   }
 };
 if(mode==='primary'){
   document.getElementById('quick-track-root')?.addEventListener('click',guard,true);
 }
 const status=document.createElement('span');status.className='sc-observer-status';nav.append(status);
 const controls=document.querySelectorAll('.focus-game-actions [data-original]');
 function permitPrimary(allowed){
   primaryGuard=true;ownsPrimary=allowed;
   controls.forEach(b=>{b.disabled=!allowed;b.title=allowed?'':'Another device currently owns official game tracking.';});
 }
 async function claimPrimary(){
   if(!game||mode!=='primary')return;
   try{
     const {data,error}=await supabaseClient.rpc('scoridium_claim_primary_tracker',{p_game_id:game,p_device_id:deviceId});
     if(error)throw error;
     if(!Array.isArray(data)||data.length!==1)throw new Error('Stat Tracker claim unavailable');
     permitPrimary(Boolean(data[0].is_owner));
     if(!ownsPrimary){
       status.textContent='Stat Tracker slot occupied';
       const takeover=document.createElement('button');takeover.className='sc-takeover';takeover.type='button';takeover.textContent='Take over';
       takeover.title='Head coach only: take control from another device';
       status.append(takeover);
       takeover.addEventListener('click',async()=>{
         if(!confirm('Take over official Stat Tracker duties? Only do this after the other Stat Tracker has stopped.'))return;
         const r=await supabaseClient.rpc('scoridium_takeover_primary_tracker',{p_game_id:game,p_device_id:deviceId});
         if(r.error){alert(r.error.message);return;}permitPrimary(true);status.textContent='Stat Tracker active';
       });
     }else status.textContent='Stat Tracker active';
   }catch(err){
     // Backward-compatible solo mode until SQL migration is installed.
     status.textContent='Stat Tracker (solo mode)';console.warn('Stat Tracker claim unavailable:',err.message);
   }
 }
 selector.addEventListener('change',async()=>{
   const next=selector.value;
   if(!confirm(next==='independent'?'Shot Tracker mode saves events separately for verification, without changing official scores. Switch and reload?':'Stat Tracker mode writes official game events. Only one device may own it. Switch and reload?')){
     selector.value=mode;return;
   }
   if(mode==='primary'&&ownsPrimary&&game){
     const r=await supabaseClient.rpc('scoridium_release_primary_tracker',{p_game_id:game,p_device_id:deviceId});
     if(r.error){alert('Unable to release Stat Tracker slot: '+r.error.message);selector.value=mode;return;}
   }
   localStorage.setItem(id,next);window.location.reload();
 });
 if(mode==='primary'){
   setTimeout(()=>void claimPrimary(),350);
   setInterval(()=>{if(ownsPrimary)void claimPrimary();},30000);
 }
 if(mode!=='independent')return;
 // Independent observers may not start/stop a game or change official status.
 document.querySelectorAll('.focus-game-actions [data-original]').forEach(b=>{
   b.disabled=true;b.title='Only the active Stat Tracker controls game status.';
 });
 status.textContent='Shot Tracker observations';
 const originalAdd=window.addEvent,originalStat=window.recordStat;
 if(typeof originalAdd!=='function')return;
 let user=null,ready=false;
 const backlogKey=`scoridium-independent-events:${game||'demo'}`;
 let backlog=[];try{backlog=JSON.parse(localStorage.getItem(backlogKey)||'[]')||[];}catch{backlog=[];}
 const persist=()=>localStorage.setItem(backlogKey,JSON.stringify(backlog));
 const saved=new Set();
 async function postObservation(obs){
  if(!ready||!user){status.textContent='Local only — sign in/apply migration';return;}
  const {error}=await supabaseClient.from('tracker_event_observations').insert(obs);
  if(error){status.textContent='Independent tracking sync failed — saved locally';console.error('Shot Tracker observation write',error);return;}
  saved.add(obs.id);status.textContent='Shot Tracker observations synced';
 }
 function capture(ev){
  if(state.status!=='live')return;
  const obs={id:crypto.randomUUID(),game_id:game,tracker_id:user?.id||null,
    observed_at:new Date().toISOString(),period:state.period,team:ev.team,
    type:ev.type,source_event_id:ev.id||crypto.randomUUID(),
    linked_source_event_id:ev.linkedEventId||null,
    player_id:ev.playerId||null,points:ev.points??null,made:ev.made??null};
  backlog.push(obs);persist();void postObservation(obs);
 }
 window.addEvent=function(ev){capture(ev);};
 window.recordStat=function(type,team,playerId=null){
   const eventId=crypto.randomUUID();capture({id:eventId,type,team,playerId});
   if(type==='steal'){capture({type:'turnover',team:team==='us'?'opponent':'us',
     linkedEventId:eventId,playerId:team==='opponent'?selectedPlayerId:null});}
 };
 async function init(){
   if(!game){status.textContent='Shot Tracker requires a selected game';return;}
   const auth=await supabaseClient.auth.getUser();user=auth.data?.user||null;
   if(!user){status.textContent='Shot Tracker not signed in';return;}
   const {data:existing,error}=await supabaseClient.from('tracker_event_observations').select('id')
      .eq('game_id',game).eq('tracker_id',user.id).order('observed_at',{ascending:false}).limit(1000);
   if(error){status.textContent='Run collaboration SQL migration';return;}
   for(const row of existing||[])saved.add(row.id);
   ready=true;
   const pending=backlog.filter(o=>!saved.has(o.id));
   for(const o of pending){o.tracker_id=user.id;await postObservation(o);}
   if(pending.length===0)status.textContent='Shot Tracker ready';
 }
 // Existing local observations may already exist remotely after a reload.
 // De-duplicate insert attempts using server IDs, never silently discard them.
 setTimeout(()=>{void init();},400);
})();
