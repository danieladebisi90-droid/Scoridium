(()=>{
'use strict';
const $=id=>document.getElementById(id),params=new URLSearchParams(location.search);
const team=sessionStorage.getItem('selectedTeamId'),season=sessionStorage.getItem('selectedSeasonId');
const options={"shot_creation":[["","Not classified"],["catch_shoot","Catch-and-shoot"],["pull_up","Dribble pull-up"],["drive","Drive / Layup"],["post","Post move"],["putback","Putback"],["other","Other"]],"shot_contest":[["","Not classified"],["open","Open"],["contested","Contested"],["unknown","Unknown"]],"turnover_cause":[["","Not classified"],["bad_pass","Bad pass"],["lost_ball","Lost ball"],["travel","Travel"],["out_of_bounds","Out of bounds"],["offensive_foul","Offensive foul"],["shot_clock","Shot clock"],["other","Other"]],"defence_scheme":[["","Not classified"],["man","Man-to-man"],["zone_2_3","2–3 Zone"],["zone_3_2","3–2 Zone"],["zone_1_3_1","1–3–1 Zone"],["press","Press"],["other","Other"]]};
const SVG='http://www.w3.org/2000/svg';
let allEvents=[],events=[],tags=new Map(),selectedId=null,requestId=0,roster=new Map(),activeGame=null;
function status(message){$('film-message').textContent=message;}
function periodName(p){const n=Number(p);return n<=4?'Q'+n:'OT'+(n-4);}
function playerLabel(event){
 if(event.team!=='us')return 'Opponent';
 const p=roster.get(String(event.player_id));
 return p?'#'+(p.number??'?')+' '+(p.first_name||'')+' '+(p.last_name||''):'Unassigned player';
}
function eventName(event){return event.type==='shot'?(event.made?'Made ':'Missed ')+event.points+'PT shot':'Turnover';}
// Full court SVG width 860, y 10..460. Fold either attacking end into
// the original 470x440 FIBA half court: both hoops map to (235,57.25).
function halfPosition(event){
 const x=Number(event.x),y=Number(event.y);
 if(event.x==null||event.y==null||!Number.isFinite(x)||!Number.isFinite(y)
   ||x<10||x>850||y<10||y>460)return null;
 return x<430?{x:y,y:x}:{x:470-y,y:860-x};
}
function field(name,title,tag){
 const wrapper=document.createElement('label');wrapper.textContent=title;
 const select=document.createElement('select');select.dataset.field=name;
 for(const [value,label] of options[name])select.add(new Option(label,value));
 select.value=tag?.[name]||'';wrapper.append(select);return wrapper;
}
function svg(tag,attrs){
 const element=document.createElementNS(SVG,tag);
 Object.entries(attrs).forEach(([key,value])=>element.setAttribute(key,String(value)));
 return element;
}
function selectedIndex(){return events.findIndex(e=>e.id===selectedId);}
function selectEvent(id){
 if(!events.some(e=>e.id===id))return;
 selectedId=id;render();
}
function renderMarkers(){
 const host=$('film-shot-markers');host.replaceChildren();
 const shots=events.filter(e=>e.type==='shot'),placed=shots.filter(e=>halfPosition(e));
 $('film-map-count').textContent=placed.length+' plotted of '+shots.length+' shot'+(shots.length===1?'':'s');
 for(const event of placed){
   const p=halfPosition(event),selected=event.id===selectedId;
   const g=svg('g',{'class':'film-mark','role':'button','tabindex':'0','aria-label':periodName(event.period)+' '+eventName(event)+' '+playerLabel(event),'aria-current':selected?'true':'false'});
   const circle=svg('circle',{cx:p.x,cy:p.y,r:selected?10:7,fill:event.made?'#37be76':'#f77575',stroke:'#203755','stroke-width':selected?2:1.5});
   const outline=svg('circle',{'class':'film-marker-outline',cx:p.x,cy:p.y,r:selected?14:10,fill:'none',stroke:selected?'#111e35':'transparent','stroke-width':selected?4:1});
   g.append(circle,outline);g.addEventListener('click',()=>selectEvent(event.id));
   g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectEvent(event.id);}});
   host.append(g);
 }
 const selected=events.find(e=>e.id===selectedId);
 const where=selected?.type==='shot'?halfPosition(selected):null;
 $('film-court-caption').textContent=!selected?'Select an event to inspect its location.'
  :selected.type==='turnover'?'Turnovers do not have a shot location.'
  :where?'Selected: '+periodName(selected.period)+' · '+eventName(selected)+' · '+playerLabel(selected)
  :'No shot location was recorded for this attempt. You can still classify it here.';
}
function renderPicker(){
 const picker=$('film-event-picker');picker.replaceChildren();
 $('film-event-count').textContent=events.length+' events';
 for(const event of events){
   const btn=document.createElement('button');btn.type='button';btn.className='film-event-choice';
   btn.setAttribute('aria-pressed',String(event.id===selectedId));
   const name=document.createElement('strong');name.textContent=periodName(event.period)+' · '+eventName(event);
   const meta=document.createElement('small');meta.textContent=event.type==='shot'?(halfPosition(event)?'Located':'Unlocated'):'No location';
   btn.append(name,meta);btn.addEventListener('click',()=>selectEvent(event.id));
   picker.append(btn);

 }
}
function renderDetail(){
 const host=$('film-detail');host.replaceChildren();
 const event=events.find(e=>e.id===selectedId),idx=selectedIndex();
 $('film-selection-counter').textContent=event?(idx+1)+' of '+events.length:'No event';
 $('film-prev').disabled=idx<=0;
 $('film-next').disabled=idx<0||idx===events.length-1;
 if(!event){const p=document.createElement('p');p.className='film-empty';p.textContent='No recorded events match this filter.';host.append(p);return;}
 const header=document.createElement('div');header.className='film-details-title';
 const name=document.createElement('h3');name.textContent=periodName(event.period)+' · '+eventName(event);
 const position=document.createElement('small');position.textContent=event.type==='shot'?(halfPosition(event)?'Shot location shown on court':'Shot location unavailable'):'Event without court location';
 header.append(name,position);
 const meta=document.createElement('p');meta.className='film-meta';meta.textContent=playerLabel(event)+' · '+(event.team==='us'?'Tracked team':'Opponent');
 const fields=document.createElement('div');fields.className='film-fields';
 const tag=tags.get(event.id);
 if(event.type==='shot')fields.append(field('shot_creation','Shot creation',tag),field('shot_contest','Defensive pressure',tag));
 else fields.append(field('turnover_cause','Turnover reason',tag));
 fields.append(field('defence_scheme','Opponent defensive scheme (optional)',tag));
 const button=document.createElement('button');button.className='film-save';button.type='button';button.textContent='Save Analysis';
 const result=document.createElement('span');result.className='film-status';result.setAttribute('role','status');
 button.addEventListener('click',async()=>{
   button.disabled=true;result.textContent='Saving…';
   const data=Object.fromEntries([...fields.querySelectorAll('select')].map(el=>[el.dataset.field,el.value||null]));
   const response=await supabaseClient.rpc('apexvision_save_film_tag',{
      p_event_id:event.id,p_shot_creation:data.shot_creation||null,p_shot_contest:data.shot_contest||null,
      p_turnover_cause:data.turnover_cause||null,p_defence_scheme:data.defence_scheme||null});
   if(response.error)result.textContent='Could not save: '+response.error.message;
   else{
     tags.set(event.id,{...tag,...data});
     result.textContent='Saved ✓';
   }
   button.disabled=false;
 });
 host.append(header,meta,fields,button,result);
}
function render(){renderMarkers();renderPicker();renderDetail();}
function applyFilters(){
 const type=$('film-type').value,quarter=$('film-quarter').value;
 events=allEvents.filter(e=>(type==='all'||e.type===type)&&(quarter==='all'||Number(e.period)===Number(quarter)));
 if(!events.some(e=>e.id===selectedId))selectedId=events[0]?.id||null;
 $('film-workspace').hidden=!events.length;render();
 status(events.length?events.length+' event'+(events.length===1?'':'s')+' available. Select a shot on the court or in the list.'
   :'No recorded events match the selected filters.');
}
async function loadEvents(){
 const gameId=$('film-game').value,token=++requestId;
 allEvents=[];events=[];selectedId=null;tags=new Map();roster=new Map();
 $('film-workspace').hidden=true;
 if(!gameId){status('Select a completed game.');return;}
 status('Loading recorded events and shot locations…');
 const [ev,tagResult,rosterResult]=await Promise.all([
  supabaseClient.from('game_events').select('id,game_id,period,type,team,player_id,points,made,x,y,created_at')
    .eq('game_id',gameId).in('type',['shot','turnover']).order('created_at',{ascending:true}).limit(2000),
  supabaseClient.from('apexvision_film_tags').select('*').eq('game_id',gameId),
  supabaseClient.from('players').select('id,number,first_name,last_name').eq('team_id',team)
 ]);
 if(token!==requestId)return;
 if(ev.error){status('Unable to load recorded events: '+ev.error.message);return;}
 if(tagResult.error){status('Film Analysis cannot load annotations: '+tagResult.error.message);return;}
 if(rosterResult.error){status('Player names unavailable: '+rosterResult.error.message);}
 roster=new Map((rosterResult.data||[]).map(p=>[String(p.id),p]));
 tags=new Map((tagResult.data||[]).map(t=>[t.event_id,t]));
 allEvents=ev.data||[];
 allEvents.sort((a,b)=>Number(a.period)-Number(b.period)||String(a.created_at||'').localeCompare(String(b.created_at||''))||String(a.id).localeCompare(String(b.id)));
 const quarters=[...new Set(allEvents.map(e=>Number(e.period)).filter(Number.isFinite))].sort((a,b)=>a-b);
 const selector=$('film-quarter'),previous=selector.value;
 selector.replaceChildren(new Option('Full game','all'));
 for(const p of quarters)selector.add(new Option(periodName(p),String(p)));
 selector.value=[...selector.options].some(o=>o.value===previous)?previous:'all';
 applyFilters();
}
async function init(){
 if(!team||!season){status('Select a team and season first.');return;}
 const user=await supabaseClient.auth.getUser();
 if(!user.data?.user){status('Sign in to use Film Analysis.');return;}
 const result=await supabaseClient.from('games').select('id,date,opponent,status')
  .eq('team_id',team).eq('seasons_id',season).eq('status','completed').order('date',{ascending:false});
 if(result.error){status('Could not load games: '+result.error.message);return;}
 const select=$('film-game');select.replaceChildren(new Option('Choose game',''));
 for(const game of result.data||[])select.add(new Option(game.date+' · vs '+(game.opponent||'Opponent'),game.id));
 const gameId=params.get('gameId');
 if(gameId&&(result.data||[]).some(g=>g.id===gameId))select.value=gameId;
 else if(result.data?.length)select.value=result.data[0].id;
 $('film-back').href=select.value?'film-room.html?gameId='+encodeURIComponent(select.value):'gamehub.html';
 select.addEventListener('change',()=>{$('film-back').href='film-room.html?gameId='+encodeURIComponent(select.value);void loadEvents();});
 $('film-type').addEventListener('change',applyFilters);
 $('film-quarter').addEventListener('change',applyFilters);
 $('film-prev').addEventListener('click',()=>{const idx=selectedIndex();if(idx>0)selectEvent(events[idx-1].id);});
 $('film-next').addEventListener('click',()=>{const idx=selectedIndex();if(idx>=0&&idx<events.length-1)selectEvent(events[idx+1].id);});
 await loadEvents();
}
if(typeof supabaseClient==='undefined'){status('Supabase configuration unavailable.');return;}
void init();
})();