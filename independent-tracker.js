/* Optional independent Quick Tracker mode. Does not write into game_events.
 * Requires MIGRATION_COLLABORATION.sql; preserves the original primary mode. */
(() => {
 'use strict';
 const game=new URLSearchParams(location.search).get('gameId');
 const id=`scoridium-independent-role:${game||'demo'}`;
 const mode=localStorage.getItem(id)==='independent'?'independent':'primary';
 const nav=document.querySelector('.focus-nav');if(!nav)return;
 const container=document.createElement('label');container.className='sc-tracker-role';
 container.innerHTML='<span>TRACKER ROLE</span><select id="sc-tracker-mode" aria-label="Tracking responsibility"><option value="primary">Primary</option><option value="independent">Observer</option></select>';
 const tabs=nav.querySelector('.focus-tabs');tabs?.before(container);
 const selector=container.querySelector('select');selector.value=mode;
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
     if(!Array.isArray(data)||data.length!==1)throw new Error('Primary claim unavailable');
     permitPrimary(Boolean(data[0].is_owner));
     if(!ownsPrimary){
       status.textContent='Primary occupied';
       const takeover=document.createElement('button');takeover.className='sc-takeover';takeover.type='button';takeover.textContent='Take over';
       takeover.title='Head coach only: take control from another device';
       status.append(takeover);
       takeover.addEventListener('click',async()=>{
         if(!confirm('Force this device to become primary? Only do this after the other scorekeeper stops tracking.'))return;
         const r=await supabaseClient.rpc('scoridium_takeover_primary_tracker',{p_game_id:game,p_device_id:deviceId});
         if(r.error){alert(r.error.message);return;}permitPrimary(true);status.textContent='Primary claimed';
       });
     }else status.textContent='Primary claimed';
   }catch(err){
     // Backward-compatible solo mode until SQL migration is installed.
     status.textContent='Primary (solo mode)';console.warn('Primary tracker locking unavailable:',err.message);
   }
 }
 selector.addEventListener('change',async()=>{
   const next=selector.value;
   if(!confirm(next==='independent'?'Observer mode saves events separately for verification, without changing official scores. Switch and reload?':'Primary mode writes official game events. Only one device may own it. Switch and reload?')){
     selector.value=mode;return;
   }
   if(mode==='primary'&&ownsPrimary&&game){
     const r=await supabaseClient.rpc('scoridium_release_primary_tracker',{p_game_id:game,p_device_id:deviceId});
     if(r.error){alert('Unable to release primary tracking: '+r.error.message);selector.value=mode;return;}
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
   b.disabled=true;b.title='Only the designated primary tracker controls game status.';
 });
 status.textContent='Independent observations';
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
  if(error){status.textContent='Observer sync failed — saved locally';console.error('Independent observer write',error);return;}
  saved.add(obs.id);status.textContent='Independent observations synced';
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
   if(!game){status.textContent='Observer requires a selected game';return;}
   const auth=await supabaseClient.auth.getUser();user=auth.data?.user||null;
   if(!user){status.textContent='Observer not signed in';return;}
   const {data:existing,error}=await supabaseClient.from('tracker_event_observations').select('id')
      .eq('game_id',game).eq('tracker_id',user.id).order('observed_at',{ascending:false}).limit(1000);
   if(error){status.textContent='Run collaboration SQL migration';return;}
   for(const row of existing||[])saved.add(row.id);
   ready=true;
   const pending=backlog.filter(o=>!saved.has(o.id));
   for(const o of pending){o.tracker_id=user.id;await postObservation(o);}
   if(pending.length===0)status.textContent='Independent observer ready';
 }
 // Existing local observations may already exist remotely after a reload.
 // De-duplicate insert attempts using server IDs, never silently discard them.
 setTimeout(()=>{void init();},400);
})();
