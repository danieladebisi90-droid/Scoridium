(()=>{
'use strict';
const $=id=>document.getElementById(id),api=window.apexPostgame,root=$('post-quick-root');
if(!api||!root||api.mode==='shot')return;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state='players',player=null,team='us',shot=null,creation='',pressure='',source=null;
let busy=false,teamMode=false,eventsPanel=false,last='Select a player or a team action.',selectedPoint=null,existingMatches=[];
const labels={shot:'SHOT',free_throw:'FT',assist:'AST',offensive_rebound:'OREB',defensive_rebound:'DREB',team_offensive_rebound:'TEAM OREB',team_defensive_rebound:'TEAM DREB',steal:'STL',turnover:'TO',block:'BLK',foul:'PF'};
const button=(action,label,kind='')=>'<button type="button" class="pgq-btn '+kind+'" data-action="'+esc(action)+'">'+esc(label)+'</button>';
const grid=buttons=>'<div class="pgq-grid">'+buttons.join('')+'</div>';
const players=()=>api.getPlayers().slice().sort((a,b)=>(Number(a.number)||0)-(Number(b.number)||0));
const playerName=()=>player?('#'+(players().find(p=>p.id===player)?.number??'?')):'TEAM';
function reset(message){state='players';player=null;shot=null;source=null;selectedPoint=null;creation='';pressure='';if(message)last=message;render();}
function chooseAction(a){
 if(a==='back'){reset();return;}
 if(a==='team'){teamMode=!teamMode;reset();return;}
 if(a==='review'){eventsPanel=!eventsPanel;render();return;}
 if(a==='player'){player=root.querySelector('[data-action="player"]:focus')?.dataset.player||null;state='stats';render();return;}
 if(a==='shoot'){state='shot';render();return;}
}
async function save(type,{points=null,made=null,position=null}={},buttonElement){
 if(busy)return null;
 busy=true;
 try{return await api.saveEvent({type,team,playerId:team==='us'?player:null,points,made,position},buttonElement);}
 finally{busy=false;}
}
async function finishShot(buttonElement){
 if(!shot)return;
 existingMatches=shot.position?api.getEvents().filter(e=>e.type==='shot'&&e.x==null&&e.y==null&&e.team===team&&Number(e.period)===api.getPeriod()&&Number(e.points)===shot.points&&e.made===shot.made):[];
 if(existingMatches.length){state='matchShot';render();return;}
 const id=await save('shot',{points:shot.points,made:shot.made,position:shot.position},buttonElement);
 if(!id){render();return;}
 source=id;selectedPoint=null;
 if(creation||pressure)await api.saveClassification(id,creation,pressure);
 last=(shot.made?'Made ':'Missed ')+shot.points+'PT shot · '+playerName();
 if(team==='opponent'){reset(last);return;}
 state=shot.made?'assist':'rebound';render();
}
function renderTimeline(){
 const ordered=api.getEvents().filter(e=>Number(e.period)===api.getPeriod()).slice().sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.id).localeCompare(String(b.id)));
 return '<div class="pgq-timeline"><h3>Play-by-Play Review · Q'+api.getPeriod()+'</h3><p>Listed by entry time; footage sequence is not yet available.</p>'
 +ordered.map((event,i)=>'<div class="pgq-entry"><span>'+String(i+1).padStart(2,'0')+'</span><strong>'+esc(labels[event.type]||event.type)+'</strong><small>'+esc(event.team==='us'?('#'+(players().find(p=>p.id===event.player_id)?.number??'?')):'OPP')+(event.type==='shot'?' · '+(event.made?'MAKE':'MISS')+' '+event.points+'PT':'')+'</small></div>').join('')
 +'<p>For player corrections or shot links, use the existing Review controls.</p></div>';
}
function render(){
 const ns=players();
 const title=state==='players'?'Select a player':state==='stats'?playerName()+' · Choose stat':state==='shot'?'Select shot result':state==='shotDetails'?'Shot creation and pressure':state==='assist'?'Who assisted?':state==='rebound'?'Rebound or block?':state==='reboundPlayer'?'Who rebounded?':state==='foul'?'Record foul':state==='ft'?'Free throw result':'Quick Track';
 let content='';
 if(state==='players'){
  content=teamMode?grid([button('set:us','Tracked Team'),button('set:opponent','Opponent')]):grid(ns.map(p=>'<button class="pgq-btn" type="button" data-action="player" data-player="'+esc(p.id)+'">#'+esc(p.number??'?')+'</button>'));
 }else if(state==='stats'){
  content=grid(['+2PT','+3PT','2 MISS','3 MISS'].map((x,i)=>button('shot:'+i,x,i<2?'pgq-made':'pgq-miss')).concat(
   [['reb','REB'],['ast','AST'],['stl','STL'],['blk','BLK'],['to','TO'],['pf','PF'],['ft','FT']].map(([a,l])=>button('stat:'+a,l))));
 }else if(state==='shot'){
  content=grid(['2PT MAKE','3PT MAKE','2PT MISS','3PT MISS'].map((x,i)=>button('shot:'+i,x,i<2?'pgq-made':'pgq-miss')));
 }else if(state==='shotDetails'){
  content='<p>'+esc(shot?.points)+'PT '+(shot?.made?'MAKE':'MISS')+' · '+esc(playerName())+'</p><strong>Shot creation (optional)</strong>'+
  grid([['catch_shoot','Catch & Shoot'],['pull_up','Pull-Up'],['drive','Drive / Layup'],['post','Post Move'],['putback','Putback'],['other','Other']].map(([k,v])=>button('creation:'+k,v,creation===k?'pgq-selected':'')))+
  '<strong>Defensive pressure (optional)</strong>'+grid([['open','Open'],['contested','Contested'],['unknown','Unknown']].map(([k,v])=>button('pressure:'+k,v,pressure===k?'pgq-selected':'')))+
  '<div class="pgq-actions">'+button('saveShot','Save Shot & Continue','pgq-primary')+button('skipDetails','Skip Details','')+'</div>';
 }else if(state==='matchShot'){
 content='<p>Possible existing '+shot.points+'PT '+(shot.made?'makes':'misses')+' without locations. Link the correct attempt, or confirm a new shot.</p>'+grid(existingMatches.map((e,i)=>button('link:'+i,'Link '+(e.player_id?'#'+(players().find(p=>p.id===e.player_id)?.number??'?'):'Unassigned')+' · '+e.id.slice(0,6))).concat(button('reallyNew','New Attempt')));
 }else if(state==='assist'){
  content='<p>Was there an assist on the made shot?</p>'+grid(ns.filter(p=>p.id!==player).map(p=>'<button class="pgq-btn" data-action="assistPlayer" data-player="'+esc(p.id)+'">#'+esc(p.number??'?')+'</button>').concat(button('noAssist','No assist / Skip')));
 }else if(state==='rebound'){
  content='<p>For a missed shot, record the rebound or block only if it happened.</p>'+grid([button('reb:offensive_rebound','Offensive REB'),button('reb:defensive_rebound','Defensive REB'),button('reb:team_offensive_rebound','Team OREB'),button('reb:team_defensive_rebound','Team DREB'),button('reb:block','BLOCK'),button('done','No rebound / Skip')]);
 }else if(state==='reboundPlayer'){
  content='<p>Choose rebounder or leave as team event.</p>'+grid(ns.map(p=>'<button class="pgq-btn" data-action="reboundPlayer" data-player="'+esc(p.id)+'">#'+esc(p.number??'?')+'</button>').concat(button('reboundTeam','TEAM / Unassigned')));
 }
 root.innerHTML='<div class="pgq-head"><div><strong>'+esc(team==='us'?'TRACKED TEAM':'OPPONENT')+'</strong><small>'+esc(title)+'</small></div><button class="pgq-mode" data-action="team">'+(teamMode?'Player Mode':'Team Mode')+'</button></div>'+
 '<div class="pgq-content">'+content+'</div><div class="pgq-footer">'+(state!=='players'?button('back','BACK'):'')+'<span>'+esc(last)+'</span></div>'+ (eventsPanel?renderTimeline():'');
}
root.addEventListener('click',async e=>{
 const b=e.target.closest('button[data-action]');if(!b||busy)return;const a=b.dataset.action;
 if(a==='back'){reset();return;}
 if(a==='team'){teamMode=!teamMode;team='us';reset();return;}
 if(a==='player'){player=b.dataset.player;team='us';state='stats';render();return;}
 if(a.startsWith('set:')){team=a.split(':')[1];player=null;state='stats';render();return;}
 if(a.startsWith('shot:')){
  const n=Number(a.split(':')[1]);
  if(selectedPoint&&selectedPoint.points!==(n%2?3:2)){api.notify('Selected court location is '+selectedPoint.points+'PT. Use the matching shot button.');return;}
  shot={points:selectedPoint?.points??(n%2?3:2),made:n<2,position:selectedPoint};creation='';pressure='';
  state='shotDetails';render();return;
 }
 if(a.startsWith('creation:')){creation=a.slice(9)===creation?'':a.slice(9);render();return;}
 if(a.startsWith('pressure:')){pressure=a.slice(9)===pressure?'':a.slice(9);render();return;}
 if(a==='saveShot'||a==='skipDetails'){if(a==='skipDetails'){creation='';pressure='';}await finishShot(b);return;}
 if(a.startsWith('link:')){
 const existing=existingMatches[Number(a.slice(5))];if(!existing||!shot?.position)return;
 const ok=await api.linkShot(existing,shot.position,b);if(!ok){render();return;}
 if(creation||pressure)await api.saveClassification(existing.id,creation,pressure);
 last='Existing '+shot.points+'PT attempt linked to court.';selectedPoint=null;
 source=existing.id;state=team==='us'?(shot.made?'assist':'rebound'):'players';render();return;
 }
 if(a==='reallyNew'){
 const id=await save('shot',{points:shot.points,made:shot.made,position:shot.position},b);
 if(!id){render();return;}
 if(creation||pressure)await api.saveClassification(id,creation,pressure);
 source=id;selectedPoint=null;last='New shot added';state=team==='us'?(shot.made?'assist':'rebound'):'players';render();return;
 }
 if(a==='noAssist'){reset('Shot recorded without an assist attribution.');return;}
 if(a==='assistPlayer'){const name=b.dataset.player;const prior=player;player=name;const id=await save('assist',{},b);player=prior;if(id)reset('Assist recorded');else render();return;}
 if(a.startsWith('reb:')){
  const val=a.slice(4);
  if(val==='block'){const id=await save('block',{},b);if(id)state='rebound';render();return;}
  if(val.startsWith('team_')){const prior=player;player=null;const id=await save(val,{},b);player=prior;if(id)reset('Team rebound recorded');else render();return;}
  shot={...shot,reboundType:val};state='reboundPlayer';render();return;
 }
 if(a==='reboundPlayer'||a==='reboundTeam'){
  const prior=player;player=a==='reboundPlayer'?b.dataset.player:null;
  const id=await save(shot.reboundType,{},b);player=prior;
  if(id)reset('Rebound recorded');else render();return;
 }
 if(a==='done'){reset('Review next play');return;}
 if(a.startsWith('stat:')){
  const code=a.slice(5);
  if(code==='ft'){const id=await save('free_throw',{points:1,made:true},b);if(id)reset('Made FT recorded');else render();return;}
  const type={reb:'defensive_rebound',ast:'assist',stl:'steal',blk:'block',to:'turnover',pf:'foul'}[code];
  if(!type)return;const id=await save(type,{},b);if(id)reset(type.toUpperCase()+' recorded');else render();return;
 }
});
$('post-quick-review')?.addEventListener('click',()=>{$('post-shot-links-open')?.click();});
$('post-period')?.addEventListener('change',()=>reset('Quarter changed. Existing records preserved.'));
$('post-team')?.addEventListener('change',()=>{team=$('post-team').value;reset();});
if(api.mode==='combined'){$('post-tab-stat').addEventListener('click',()=>reset());}
// Only render when the existing post-game tracker is initialized with its roster.
window.addEventListener('apex:postgame-court',e=>{
 selectedPoint=e.detail;const prefer=selectedPoint.x<430?'right':'left';root.dataset.side=prefer;
 state='players';team='us';player=null;
 last='Shot location selected · '+selectedPoint.points+'PT. Choose the shooter.';
 render();
});
let tries=0;
const wait=()=>{if(api.getPlayers().length||++tries>60){render();return;}setTimeout(wait,200)};
wait();
})();