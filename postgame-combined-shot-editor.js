/* Combined Tracking shot corrections. No changes to Live Tracking.
   Requires MIGRATION_APEXVISION_COMBINED_SHOT_EDIT.sql on staging. */
(() => {
  'use strict';
  const api=window.apexPostgame;
  if(!api||api.mode!=='combined')return;
  const court=document.getElementById('postgame-court');
  if(!court)return;
  const ns='http://www.w3.org/2000/svg';
  const host=document.createElement('dialog');host.id='av-shot-editor';
  host.innerHTML=`<div class="av-shot-editor-shell"><header><strong>Edit Shot</strong><button type="button" data-editor="close" aria-label="Close editor">×</button></header>
    <label>Team<select id="av-edit-team"><option value="us">Tracked team</option><option value="opponent">Opponent</option></select></label>
    <label id="av-edit-player-wrap">Shooter<select id="av-edit-player"></select></label>
    <label>Result<select id="av-edit-made"><option value="true">MADE</option><option value="false">MISSED</option></select></label>
    <p id="av-edit-location-label">Shot location · tap court below to correct</p><div id="av-edit-court-wrap"></div>
    <p id="av-edit-feedback" role="status"></p>
    <footer><button type="button" data-editor="delete" class="av-shot-danger">Delete Shot</button><button type="button" data-editor="save">Save Changes</button></footer>
  </div>`;
  document.body.append(host);
  let selected=null,x=0,y=0,busy=false;
  const team=host.querySelector('#av-edit-team'),player=host.querySelector('#av-edit-player'),made=host.querySelector('#av-edit-made');
  const feedback=host.querySelector('#av-edit-feedback'),locLabel=host.querySelector('#av-edit-location-label');
  const cv=()=>host.querySelector('#av-edit-mini-court');
  const inputPosition=event=>{
    const svg=cv();if(!svg)return;
    const matrix=svg.getScreenCTM();if(!matrix)return;
    const pt=svg.createSVGPoint();pt.x=event.clientX;pt.y=event.clientY;
    const co=pt.matrixTransform(matrix.inverse());
    if(co.x<10||co.x>850||co.y<10||co.y>460)return;
    x=Number(co.x.toFixed(2));y=Number(co.y.toFixed(2));
    locLabel.textContent=`Location set · ${api.shotValue(x,y)}PT`;drawHalfCourt();
  };
  function drawHalfCourt(){
    const side=x<430?'left':'right';
    const view=side==='left'?'0 0 430 470':'430 0 430 470';
    const mini=document.createElementNS(ns,'svg');mini.id='av-edit-mini-court';mini.setAttribute('viewBox',view);
    mini.setAttribute('role','img');mini.setAttribute('aria-label','Tap on the half court to set the corrected shot location');
    const original=court.querySelector('g');
    if(original){mini.append(original.cloneNode(true));}
    const marker=document.createElementNS(ns,'circle');
    marker.setAttribute('cx',x);marker.setAttribute('cy',y);marker.setAttribute('r','10');
    marker.setAttribute('fill','#e23b3b');marker.setAttribute('stroke','#fff');marker.setAttribute('stroke-width','3');
    mini.append(marker);
    host.querySelector('#av-edit-court-wrap').replaceChildren(mini);
    mini.addEventListener('click',inputPosition);
  }
  function open(event){
    selected=event;x=Number(event.x);y=Number(event.y);busy=false;
    team.value=event.team||'us';made.value=event.made?'true':'false';
    const opts=[new Option('Unknown Player',''),...api.getPlayers().map(p=>new Option('#'+(p.number??'?'),p.id))];
    player.replaceChildren(...opts);player.value=event.player_id||'';
    player.closest('label').hidden=team.value!=='us';
    feedback.textContent='';locLabel.textContent=`Shot location · ${event.points}PT · tap half court to change`;
    drawHalfCourt();host.showModal();
  }
  team.addEventListener('change',()=>{
    if(!selected)return;
    x=860-x; // Mirror horizontally when shooting team changes.
    player.closest('label').hidden=team.value!=='us';
    drawHalfCourt();locLabel.textContent='Location mirrored to the new team basket · tap to correct';
  });
  async function submit(remove=false){
    if(!selected||busy)return;
    busy=true;feedback.textContent='Saving…';
    const action=remove?'apexvision_postgame_delete_shot':'apexvision_postgame_edit_shot';
    const args=remove?{
      p_game_id:api.gameId,p_event_id:selected.id,p_expected_version:Number(selected.version)
    }:{
      p_game_id:api.gameId,p_event_id:selected.id,p_expected_version:Number(selected.version),
      p_team:team.value,p_player_id:team.value==='us'?(player.value||null):null,
      p_made:made.value==='true',p_x:x,p_y:y
    };
    try{
      const result=await supabaseClient.rpc(action,args);
      if(result.error)throw result.error;
      await api.refresh();
      window.dispatchEvent(new CustomEvent('apex:postgame-events-updated'));
      host.close();api.notify(remove?'Shot deleted and linked events checked.':'Shot information updated.');
    }catch(error){feedback.textContent=String(error.message||error)+' · Check staging migration and linked stats.';}
    finally{busy=false;}
  }
  host.addEventListener('click',event=>{
    const button=event.target.closest('[data-editor]');if(!button)return;
    if(button.dataset.editor==='close')host.close();
    else if(button.dataset.editor==='save')void submit(false);
    else if(button.dataset.editor==='delete')void submit(true);
  });
  const getPoint=ev=>{
    const matrix=court.getScreenCTM();if(!matrix)return null;
    const pt=court.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;
    const v=pt.matrixTransform(matrix.inverse());return {x:v.x,y:v.y};
  };
  // Window capture precedes the court's own capture handler; selecting a marker
  // opens editing rather than recording a duplicate FGA.
  window.addEventListener('click',ev=>{
    if(host.open||!court.contains(ev.target)||window.apexPostgameQuick?.linkIntent?.())return;
    const pt=getPoint(ev);if(!pt)return;
    const candidates=api.getEvents().filter(e=>e.type==='shot'&&e.x!=null&&e.y!=null&&
      Math.hypot(((Number(e.period)<=2)!==(Number(api.getPeriod())<=2)?860-Number(e.x):Number(e.x))-pt.x,Number(e.y)-pt.y)<12);
    if(!candidates.length)return;
    ev.stopImmediatePropagation();ev.preventDefault();
    candidates.sort((a,b)=>Math.hypot(((Number(a.period)<=2)!==(Number(api.getPeriod())<=2)?860-a.x:a.x)-pt.x,a.y-pt.y)-Math.hypot(((Number(b.period)<=2)!==(Number(api.getPeriod())<=2)?860-b.x:b.x)-pt.x,b.y-pt.y));
    open(candidates[0]);
  },true);
})();
