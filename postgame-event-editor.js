/* Film Room game-day event corrections; post-game recorded entries only.
   Requires MIGRATION_APEXVISION_GAMEDAY_EVENT_EDITS.sql in ApexVision-Test. */
(()=>{
 'use strict';
 const api=window.apexPostgame;if(!api||api.mode!=='combined')return;
 const $=id=>document.getElementById(id);
 const types=['free_throw','assist','offensive_rebound','defensive_rebound','team_offensive_rebound','team_defensive_rebound','steal','turnover','block','foul'];
 const dialog=document.createElement('dialog');dialog.id='av-event-editor';
 dialog.innerHTML=`<form class="av-event-editor-inner" method="dialog"><h3>Edit Recorded Event</h3>
  <p id="av-ee-detail"></p>
  <label>Stat type <select id="av-ee-type"></select></label>
  <label>Team <select id="av-ee-team"><option value="us">Tracked Team</option><option value="opponent">Opponent</option></select></label>
  <label id="av-ee-player-wrap">Player <select id="av-ee-player"></select></label>
  <label>Quarter <select id="av-ee-period"></select></label>
  <label id="av-ee-result-wrap">Free throw result <select id="av-ee-result"><option value="true">MADE</option><option value="false">MISSED</option></select></label>
  <label>Linked event <select id="av-ee-link"></select></label><div id="av-ee-branch" aria-label="Connected events"></div>
  <p id="av-ee-feedback" role="status"></p>
  <footer><button type="button" id="av-ee-delete">Delete Event</button><button type="button" id="av-ee-save">Save Changes</button><button type="button" id="av-ee-cancel">Cancel</button></footer></form>`;
 document.body.append(dialog);
 const type=$('av-ee-type'),team=$('av-ee-team'),player=$('av-ee-player'),quarter=$('av-ee-period'),result=$('av-ee-result'),linked=$('av-ee-link');
 type.replaceChildren(...types.map(t=>new Option(t.replaceAll('_',' ').toUpperCase(),t)));
 let selected=null,busy=false;
 function refreshFields(){
  const tracked=team.value==='us';
  $('av-ee-player-wrap').hidden=!tracked;
  if(!tracked)player.value='';
  $('av-ee-result-wrap').hidden=type.value!=='free_throw';
 }
 type.addEventListener('change',refreshFields);team.addEventListener('change',refreshFields);
 function openEvent(id){
  const entry=api.getEvents().find(e=>String(e.id)===String(id));
  if(!entry){api.notify('Event no longer available. Refresh game details.');return;}
  if(entry.type==='shot'){
    window.dispatchEvent(new CustomEvent('apex:edit-shot',{detail:{id:entry.id}}));return;
  }
  selected=entry;
  type.value=entry.type;team.value=entry.team;
  player.replaceChildren(new Option('SKIP (unassigned)',''),...api.getPlayers().map(p=>new Option('#'+(p.number??'?')+' '+[p.first_name,p.last_name].filter(Boolean).join(' '),p.id)));
  player.value=entry.player_id||'';
  quarter.replaceChildren(...Array.from({length:Math.max(4,Number(api.getGame()?.current_period)||4)},(_,i)=>new Option(i<4?'Q'+(i+1):'OT'+(i-3),String(i+1))));
  quarter.value=String(entry.period);
  result.value=entry.made?'true':'false';
  linked.replaceChildren(new Option('No link',''));
  const all=api.getEvents();
  for(const e of all.filter(e=>e.id!==entry.id&&Number(e.period)===Number(entry.period)&&['shot','free_throw','steal','turnover','foul'].includes(e.type))){
    const p=api.getPlayers().find(p=>String(p.id)===String(e.player_id));
    linked.add(new Option((e.team==='us'?'Tracked':'Opponent')+' · '+(p?'#'+p.number+' · ':'')+(e.type==='shot'?`${e.points}PT ${e.made?'MADE':'MISS'}`:e.type==='free_throw'?`FT ${e.made?'MADE':'MISS'}`:e.type.toUpperCase()),e.id));
  }
  if(entry.linked_event_id&&!Array.from(linked.options).some(o=>o.value===String(entry.linked_event_id))){
    const original=all.find(e=>String(e.id)===String(entry.linked_event_id));
    linked.add(new Option('Current link ('+(original?.type||'event')+')',entry.linked_event_id));
  }
  linked.value=entry.linked_event_id||'';
  // Linked children are existing events, not duplicate stat insertions.
  // Open them in the same editor so SKIP assignments can be corrected later.
  const branch=$('av-ee-branch');branch.replaceChildren();
  const connected=all.filter(e=>String(e.linked_event_id)===String(entry.id));
  if(connected.length){
    const heading=document.createElement('strong');heading.textContent='Connected events';branch.append(heading);
    for(const child of connected){
      const b=document.createElement('button');b.type='button';
      const credited=api.getPlayers().find(p=>String(p.id)===String(child.player_id));
      b.textContent='Edit '+child.type.replaceAll('_',' ')+
        (credited?' — #'+(credited.number??'?'):child.team==='us'?' — Unassigned':' — Opponent');
      b.addEventListener('click',()=>{dialog.close();openEvent(child.id);});
      branch.append(b);
    }
  }
  $('av-ee-detail').textContent='Recorded '+(entry.type||'event').replaceAll('_',' ')+' · '+(entry.team==='us'?'Tracked team':'Opponent');
  $('av-ee-feedback').textContent='';refreshFields();dialog.showModal();
 }
 async function save(remove){
  if(!selected||busy)return;
  if(remove&&!confirm('Permanently delete this recorded event? Related events may need review.'))return;
  busy=true;
  const buttons=[$('av-ee-save'),$('av-ee-delete')];buttons.forEach(b=>b.disabled=true);
  $('av-ee-feedback').textContent='Saving…';
  try{
   const args={p_game_id:api.gameId,p_event_id:selected.id,p_expected_version:Number(selected.version)};
   if(!remove)Object.assign(args,{
    p_type:type.value,p_team:team.value,p_period:Number(quarter.value),
    p_player_id:team.value==='us'?(player.value||null):null,
    p_made:type.value==='free_throw'?result.value==='true':null,
    p_linked_event_id:linked.value||null
   });
   const response=await supabaseClient.rpc(remove?'apexvision_postgame_delete_event':'apexvision_postgame_edit_event',args);
   if(response.error)throw response.error;
   await api.refresh();
   window.dispatchEvent(new CustomEvent('apex:postgame-events-updated'));
   dialog.close();api.notify(remove?'Event deleted.':'Event corrected.');
  }catch(error){$('av-ee-feedback').textContent=error.message||String(error);}
  finally{busy=false;buttons.forEach(b=>b.disabled=false);}
 }
 $('av-ee-save').addEventListener('click',()=>void save(false));
 $('av-ee-delete').addEventListener('click',()=>void save(true));
 $('av-ee-cancel').addEventListener('click',()=>dialog.close());
 window.addEventListener('apex:edit-event',ev=>openEvent(ev.detail?.id));
})();
