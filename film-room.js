(()=>{
'use strict';
const $=id=>document.getElementById(id);
const gameId=new URLSearchParams(location.search).get('gameId');
const teamId=sessionStorage.getItem('selectedTeamId'),seasonId=sessionStorage.getItem('selectedSeasonId');
const activities=['stat','shot','film']; // 'film' remains the existing database key for combined workflow.
const names={not_started:'Not Started',in_progress:'In Progress',completed:'Completed'};
const destinations={stat:'postgame-track.html?mode=stat',shot:'postgame-track.html?mode=shot',film:'postgame-track.html?mode=combined'};
const records=new Map();let user=null,ready=false;
const message=s=>{$('room-message').textContent=s;};
function dateLabel(value){
 if(!value)return 'Not reviewed yet';
 const date=new Date(value);return Number.isNaN(+date)?'Not reviewed yet':new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'long',day:'numeric'}).format(date);
}
function display(){
 for(const activity of activities){
  const card=document.querySelector('[data-activity="'+activity+'"]');
  const record=records.get(activity),status=record?.status||'not_started';
  card.dataset.status=status;
  card.querySelector('.room-status').textContent=names[status]||names.not_started;
  card.querySelector('.room-reviewed').textContent='Last Reviewed: '+dateLabel(record?.last_reviewed_at);
  card.querySelector('[data-open]').textContent=status==='not_started'?'Start':status==='completed'?'Review':'Continue';
  const complete=card.querySelector('[data-complete]');
  complete.hidden=status==='not_started';
  complete.textContent=status==='completed'?'Reopen':'Mark Completed';
 }
}
async function update(activity,nextStatus,{reviewed=false}={}){
 if(!ready||!user)return false;
 const previous=records.get(activity);
 const now=new Date().toISOString();
 const payload={game_id:gameId,activity,status:nextStatus,updated_by:user.id,updated_at:now,
  last_reviewed_at:reviewed?now:previous?.last_reviewed_at||null,
  last_reviewed_by:reviewed?user.id:previous?.last_reviewed_by||null};
 const {error}=await supabaseClient.from('apexvision_film_room_status').upsert(payload,{onConflict:'game_id,activity'});
 if(error){message('Could not save review: '+error.message);return false;}
 records.set(activity,payload);display();message('');return true;
}
async function init(){
 if(!gameId||!teamId||!seasonId){message('Open Film Room from Game Hub.');return;}
 if(typeof supabaseClient==='undefined'){message('Supabase unavailable.');return;}
 const auth=await supabaseClient.auth.getUser();user=auth.data?.user;
 if(!user){message('Sign in to access Film Room.');return;}
 const game=await supabaseClient.from('games').select('id,opponent,date,status').eq('id',gameId).eq('team_id',teamId).eq('seasons_id',seasonId).maybeSingle();
 if(game.error||!game.data){message('Game not available for the selected team and season.');return;}
 if(game.data.status!=='completed'){message('Post-game Film Room requires a completed game.');return;}
 $('room-matchup').textContent='vs '+(game.data.opponent||'Opponent')+' · '+game.data.date+' · Final';
 const result=await supabaseClient.from('apexvision_film_room_status').select('activity,status,last_reviewed_at,last_reviewed_by,updated_at').eq('game_id',gameId);
 if(result.error){message('Film Room review-date migration may be missing: '+result.error.message);return;}
 for(const row of result.data||[])if(activities.includes(row.activity))records.set(row.activity,row);
 ready=true;display();$('room-cards').hidden=false;message('');
 for(const activity of activities){
  const card=document.querySelector('[data-activity="'+activity+'"]');
  card.querySelector('[data-open]').addEventListener('click',async()=>{
   const previous=records.get(activity),status=previous?.status||'in_progress';
   if(!(await update(activity,status,{reviewed:false})))return;
   location.href=destinations[activity]+'&gameId='+encodeURIComponent(gameId);
  });
  card.querySelector('[data-complete]').addEventListener('click',async()=>{
   const next=records.get(activity)?.status==='completed'?'in_progress':'completed';
   await update(activity,next,{reviewed:true});
  });
 }
}
void init();
})();