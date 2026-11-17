(()=>{
 'use strict';
 const $=id=>document.getElementById(id);
 const gameId=new URLSearchParams(location.search).get('gameId');
 const teamId=sessionStorage.getItem('selectedTeamId');
 const seasonId=sessionStorage.getItem('selectedSeasonId');
 const activities=['stat','shot','film'];
 const labels={not_started:'Not Started',in_progress:'In Progress',completed:'Completed'};
 const urls={stat:'postgame-track.html?mode=stat',shot:'postgame-track.html?mode=shot',film:'film-analysis.html'};
 const statusMap=new Map();
 let user=null,ready=false;
 const message=text=>{$('room-message').textContent=text;};
 function display(){
   for(const name of activities){
     const card=document.querySelector('[data-activity="'+name+'"]');
     const value=statusMap.get(name)||'not_started';
     card.dataset.status=value;
     card.querySelector('.room-status').textContent=labels[value];
     card.querySelector('[data-open]').textContent=value==='not_started'?'Start':value==='completed'?'Review':'Continue';
     const complete=card.querySelector('[data-complete]');
     complete.hidden=value==='not_started';
     complete.textContent=value==='completed'?'Reopen':'Mark Completed';
   }
 }
 async function save(name,value){
   if(!ready||!user)return false;
   const payload={game_id:gameId,activity:name,status:value,updated_by:user.id,updated_at:new Date().toISOString()};
   const {error}=await supabaseClient.from('apexvision_film_room_status').upsert(payload,{onConflict:'game_id,activity'});
   if(error){message('Could not save status: '+error.message);return false;}
   statusMap.set(name,value);display();message('');return true;
 }
 async function init(){
   if(!gameId||!teamId||!seasonId){message('Open Film Room from a game in the Game Hub.');return;}
   if(typeof supabaseClient==='undefined'){message('Supabase is unavailable.');return;}
   const auth=await supabaseClient.auth.getUser();user=auth.data?.user;
   if(!user){message('Sign in to access Film Room.');return;}
   const game=await supabaseClient.from('games').select('id,opponent,date,status').eq('id',gameId).eq('team_id',teamId).eq('seasons_id',seasonId).maybeSingle();
   if(game.error||!game.data){message('Game not available for the selected team and season.');return;}
   $('room-matchup').textContent='vs '+(game.data.opponent||'Opponent')+' · '+game.data.date+' · '+(game.data.status==='completed'?'Final':game.data.status);
   const result=await supabaseClient.from('apexvision_film_room_status').select('activity,status').eq('game_id',gameId);
   if(result.error){message('Film Room setup is required before saving tracking statuses. Contact the team manager.');return;}
   for(const row of result.data||[])if(activities.includes(row.activity))statusMap.set(row.activity,row.status);
   ready=true;display();$('room-cards').hidden=false;message('');
   for(const name of activities){
     const card=document.querySelector('[data-activity="'+name+'"]');
     card.querySelector('[data-open]').addEventListener('click',async()=>{
       if(!statusMap.has(name)&&!(await save(name,'in_progress')))return;
       const dest=urls[name]+(urls[name].includes('?')?'&':'?')+'gameId='+encodeURIComponent(gameId);
       // Post-game tracking uses its own restricted RPCs, never live-game controls.
       location.href=dest;
     });
     card.querySelector('[data-complete]').addEventListener('click',async()=>{
       const current=statusMap.get(name);
       const next=current==='completed'?'in_progress':'completed';
       await save(name,next);
     });
   }
 }
 void init();
})();