(()=>{
'use strict';
const $=id=>document.getElementById(id),dialog=$('apex-score-dialog'),open=$('apex-add-score-link');
if(!dialog||!open)return;
const form=$('apex-score-form'),url=new URLSearchParams(location.search);let gameId=null,submitting=false;
const feedback=text=>{$('apex-score-feedback').textContent=text};
function formatDate(value){if(!value)return'Never';const d=new Date(value);return Number.isNaN(d.getTime())?'Unknown':new Intl.DateTimeFormat('en-US',{dateStyle:'long',timeStyle:'short'}).format(d);}
async function lastSubmitted(){
  $('apex-score-last').textContent='Last submitted: Loading…';
  const {data,error}=await supabaseClient.from('apexvision_score_snapshots')
    .select('submitted_at,team_score,opponent_score').eq('game_id',gameId).order('submitted_at',{ascending:false}).limit(1);
  if(!dialog.open)return;
  if(error){$('apex-score-last').textContent='Last submitted: Unavailable (migration required)';return;}
  const latest=data?.[0];$('apex-score-last').textContent='Last submitted: '+formatDate(latest?.submitted_at);
  if(latest){$('apex-score-us').value=latest.team_score;$('apex-score-them').value=latest.opponent_score;}
}
function selection(){const point=form.elements['apex-score-point'].value;$('apex-score-period-wrap').hidden=point==='final';return point;}
form.querySelectorAll('[name=apex-score-point]').forEach(el=>el.addEventListener('change',selection));
$('apex-score-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
open.addEventListener('click',async event=>{
  event.preventDefault();
  gameId=new URL(open.getAttribute('data-game-id')||open.dataset.gameId||'',location.href).searchParams.get('gameId');
  if(!gameId){feedback('Select a game first.');return;}
  $('apex-score-matchup').textContent=open.dataset.matchup||'Selected game';
  $('apex-score-us').value='';$('apex-score-them').value='';feedback('');
  selection();dialog.showModal();await lastSubmitted();
});
form.addEventListener('submit',async event=>{
 event.preventDefault();if(submitting||!gameId)return;
 const teamScore=Number($('apex-score-us').value),opponentScore=Number($('apex-score-them').value);
 const point=selection(),period=point==='final'?null:Number($('apex-score-period').value);
 if(![teamScore,opponentScore].every(x=>Number.isInteger(x)&&x>=0&&x<=500)){feedback('Enter valid whole-number scores.');return;}
 if(point==='final'&&teamScore===opponentScore){feedback('A final basketball score must have a winner. Choose a quarter or during-game snapshot instead.');return;}
 submitting=true;$('apex-score-submit').disabled=true;feedback('Submitting…');
 try{
  const auth=await supabaseClient.auth.getUser();if(!auth.data?.user)throw Error('Sign in required.');
  const {error}=await supabaseClient.from('apexvision_score_snapshots').insert({
    game_id:gameId,team_score:teamScore,opponent_score:opponentScore,score_point:point,period,submitted_by:auth.data.user.id
  });
  if(error)throw error;
  if(point==='final'){
    const result=await supabaseClient.rpc('apexvision_submit_game_score',{p_game_id:gameId,p_team_score:teamScore,p_opponent_score:opponentScore,p_quarter_scores:null});
    feedback(result.error?'Score snapshot saved; could not request final-score approval: '+result.error.message:'Submitted for coach review. The official final score has not changed yet.');
  }else feedback('Score snapshot submitted.');
  await lastSubmitted();
 }catch(e){feedback('Submission failed: '+e.message);}
 finally{submitting=false;$('apex-score-submit').disabled=false;}
});
})();