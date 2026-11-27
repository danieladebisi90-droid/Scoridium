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
    <label>Quarter<select id="av-edit-period"></select></label>
    <p id="av-edit-location-label">Shot location · tap court below to correct</p><div id="av-edit-court-wrap"></div>
    <div id="av-edit-links" aria-label="Linked events"></div>
    <p id="av-edit-feedback" role="status"></p>
    <footer><button type="button" data-editor="delete" class="av-shot-danger">Delete Shot</button><button type="button" data-editor="save">Save Changes</button></footer>
  </div>`;
  document.body.append(host);
  let selected=null,x=0,y=0,busy=false;
  // Editing is explicitly opt-in: normal court gestures are reserved for tracking.
  let editMode=false;
  const editToggle=document.createElement('button');
  editToggle.type='button';editToggle.id='av-cn-edit-mode';
  editToggle.textContent='Edit: OFF';editToggle.setAttribute('aria-pressed','false');
  editToggle.title='Toggle shot editing. Tap a saved marker only while Edit is ON.';
  const toolbar=document.querySelector('#av-combined-nav .av-cn-more');
  if(toolbar)toolbar.parentNode.insertBefore(editToggle,toolbar);
  else document.getElementById('postgame-screen')?.prepend(editToggle);
  function setEditMode(value){
    editMode=!!value;
    editToggle.textContent=editMode?'Edit: ON':'Edit: OFF';
    editToggle.setAttribute('aria-pressed',String(editMode));
    document.body.classList.toggle('av-cn-edit-mode',editMode);
  }
  editToggle.addEventListener('click',()=>{setEditMode(!editMode);if(!editMode)document.getElementById('av-edit-overlap-picker')?.querySelector('button:last-child')?.click();});
  document.addEventListener('keydown',ev=>{
    if(ev.key==='Escape'&&editMode&&!host.open)setEditMode(false);
  });
  const team=host.querySelector('#av-edit-team'),player=host.querySelector('#av-edit-player'),made=host.querySelector('#av-edit-made');
  const feedback=host.querySelector('#av-edit-feedback'),locLabel=host.querySelector('#av-edit-location-label'),editPeriod=host.querySelector('#av-edit-period');
  const cv=()=>host.querySelector('#av-edit-mini-court');
  const shotDistanceFeet=(sx,sy)=>(Math.hypot(sx-(sx<430?57.25:802.75),sy-235)/30*3.28084).toFixed(1);
  const inputPosition=event=>{
    const svg=cv();if(!svg)return;
    const matrix=svg.getScreenCTM();if(!matrix)return;
    const pt=svg.createSVGPoint();pt.x=event.clientX;pt.y=event.clientY;
    const co=pt.matrixTransform(matrix.inverse());
    if(co.x<10||co.x>850||co.y<10||co.y>460)return;
    x=Number(co.x.toFixed(2));y=Number(co.y.toFixed(2));
    locLabel.textContent=`Location set · ${shotDistanceFeet(x,y)} ft · ${api.shotValue(x,y)}PT`;drawHalfCourt();
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
    editPeriod.replaceChildren(...Array.from({length:Math.max(4,Number(api.getGame()?.current_period)||4)},(_,i)=>new Option(i<4?'Q'+(i+1):'OT'+(i-3),String(i+1))));
    editPeriod.value=String(event.period);
    const opts=[new Option('Unknown Player',''),...api.getPlayers().map(p=>new Option('#'+(p.number??'?'),p.id))];
    player.replaceChildren(...opts);player.value=event.player_id||'';
    player.closest('label').hidden=team.value!=='us';
    feedback.textContent='';locLabel.textContent=`Shot location · ${shotDistanceFeet(x,y)} ft · ${event.points}PT · tap half court to change`;
    const related=api.getEvents().filter(e=>String(e.linked_event_id)===String(event.id));
    const links=host.querySelector('#av-edit-links');links.replaceChildren();
    const heading=document.createElement('strong');heading.textContent='Linked events ('+related.length+')';links.append(heading);
    if(!related.length){const empty=document.createElement('span');empty.textContent='No linked stats';links.append(empty);}
    related.forEach(e=>{
      const line=document.createElement('div');
      const assigned=api.getPlayers().find(p=>String(p.id)===String(e.player_id));
      line.textContent=(e.type||'event').replaceAll('_',' ').toUpperCase()+' · '+(e.team==='us'?(assigned?'#'+assigned.number:'Unknown Player'):(api.getGame()?.opponent||'Opponent'))+' ';
      const button=document.createElement('button');button.type='button';button.textContent='Edit linked stat';
      button.addEventListener('click',()=>{host.close();window.dispatchEvent(new CustomEvent('apex:edit-event',{detail:{id:e.id}}));});
      line.append(button);links.append(line);
    });
    drawHalfCourt();host.showModal();
  }
  team.addEventListener('change',()=>{
    if(!selected)return;
    x=860-x; y=470-y; // Rotate 180° when the shooting team changes.
    player.closest('label').hidden=team.value!=='us';
    drawHalfCourt();locLabel.textContent='Location mirrored to the new team basket · tap to correct';
  });
  async function submit(remove=false){
    if(!selected||busy)return;
    busy=true;feedback.textContent='Saving…';
    const action=remove?'apexvision_postgame_delete_shot':'apexvision_postgame_edit_shot_gameday';
    const args=remove?{
      p_game_id:api.gameId,p_event_id:selected.id,p_expected_version:Number(selected.version)
    }:{
      p_game_id:api.gameId,p_event_id:selected.id,p_expected_version:Number(selected.version),
      p_team:team.value,p_player_id:team.value==='us'?(player.value||null):null,
      p_made:made.value==='true',p_x:x,p_y:y,p_period:Number(editPeriod.value),
      p_confirm_cleanup:false
    };
    try{
      if(!remove){
        const invalid=api.getEvents().filter(e=>String(e.linked_event_id)===String(selected.id) && (
          (e.type==='assist' && (made.value!=='true' || e.team!==team.value)) ||
          (e.type==='block' && (made.value==='true' || e.team===team.value)) ||
          (['offensive_rebound','defensive_rebound','team_offensive_rebound','team_defensive_rebound'].includes(e.type) &&
            (made.value==='true'||(e.type.includes('offensive')&&e.team!==team.value)||
              (e.type.includes('defensive')&&e.team===team.value)))
        ));
        if(invalid.length){
          if(!confirm('This edit would remove '+invalid.length+' incompatible linked stat(s): '+invalid.map(e=>e.type.replaceAll('_',' ')).join(', ')+'. Continue?')){
            feedback.textContent='Cancelled; no changes saved.';return;
          }
          args.p_confirm_cleanup=true;
        }
        if(Number(editPeriod.value)!==Number(selected.period)){
          if(!confirm('Move this shot and its compatible linked events to '+editPeriod.options[editPeriod.selectedIndex].text+'?')){
            feedback.textContent='Cancelled; no changes saved.';return;
          }
        }
      }
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
  const overlapMenu=document.createElement('div');overlapMenu.id='av-edit-overlap-picker';
  overlapMenu.hidden=true;overlapMenu.setAttribute('role','dialog');
  overlapMenu.setAttribute('aria-label','Choose saved shot to edit');document.body.append(overlapMenu);
  const overlapStyle=document.createElement('style');
  overlapStyle.textContent='#av-edit-overlap-picker:not([hidden]){position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99998;width:min(370px,calc(100vw - 30px));padding:16px;background:#14233b;color:#fff;border:1px solid #8296ad;border-radius:12px;box-shadow:0 14px 38px #0009;display:flex;flex-direction:column;gap:8px;max-height:70vh;overflow-y:auto}#av-edit-overlap-picker button{background:#263955;border:1px solid #627c9c;border-radius:8px;padding:10px;color:white;text-align:left;min-height:40px;cursor:pointer}';
  document.head.append(overlapStyle);
  const palette=['#fbbf24','#60a5fa','#c084fc','#34d399','#fb7185','#f97316','#22d3ee'];
  const temporaryRings=[];
  function dismissOverlap(){overlapMenu.hidden=true;overlapMenu.replaceChildren();temporaryRings.forEach(n=>n.remove());temporaryRings.length=0;}
  function chooseEditShot(candidates){
    if(candidates.length===1){open(candidates[0]);return;}
    dismissOverlap();
    const header=document.createElement('strong');header.textContent='Select shot to edit';overlapMenu.append(header);
    const markers=document.getElementById('postgame-link-markers');
    candidates.forEach((shot,i)=>{
      const c=palette[i%palette.length];
      if(markers&&shot.x!=null&&shot.y!=null){
        const ring=document.createElementNS(ns,'circle');ring.setAttribute('cx',shot.x);ring.setAttribute('cy',shot.y);
        ring.setAttribute('r','14');ring.setAttribute('fill','none');ring.setAttribute('stroke',c);
        ring.setAttribute('stroke-width','4');ring.setAttribute('pointer-events','none');markers.append(ring);temporaryRings.push(ring);
      }
      const shooter=api.getPlayers().find(p=>String(p.id)===String(shot.player_id));
      const who=shot.team==='us'?(shooter?'#'+shooter.number:'Unknown Player'):(api.getGame?.()?.opponent||'Opponent');
      const ft=Math.hypot(Number(shot.x)-(Number(shot.x)<430?57.25:802.75),Number(shot.y)-235)/30*3.28084;
      const b=document.createElement('button');b.type='button';b.style.borderLeft='6px solid '+c;
      b.textContent=`${Number(shot.period)<=4?'Q'+shot.period:'OT'+(shot.period-4)} · ${who} · ${ft.toFixed(1)} ft · ${shot.points}PT ${shot.made?'MADE':'MISS'}`;
      b.addEventListener('click',()=>{dismissOverlap();open(shot);});overlapMenu.append(b);
    });
    const back=document.createElement('button');back.type='button';back.textContent='Back';
    back.addEventListener('click',dismissOverlap);overlapMenu.append(back);
    overlapMenu.hidden=false;
  }
  const getPoint=ev=>{
    const matrix=court.getScreenCTM();if(!matrix)return null;
    const pt=court.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;
    const v=pt.matrixTransform(matrix.inverse());return {x:v.x,y:v.y};
  };
  window.addEventListener('apex:edit-shot',ev=>{
    const id=ev.detail?.id;
    const found=api.getEvents().find(e=>String(e.id)===String(id)&&e.type==='shot');
    if(found){dismissOverlap();open(found);}
  });
  // Window capture precedes the court's own capture handler; selecting a marker
  // opens editing rather than recording a duplicate FGA.
  window.addEventListener('click',ev=>{
    if(!editMode||host.open||!court.contains(ev.target)||window.apexPostgameQuick?.linkIntent?.())return;
    const pt=getPoint(ev);if(!pt)return;
    const candidates=api.getEvents().filter(e=>e.type==='shot'&&e.x!=null&&e.y!=null&&
      Math.hypot(Number(e.x)-pt.x,Number(e.y)-pt.y)<17);
    // Edit Mode must NEVER interpret an empty-court click as a new shot.
    ev.stopImmediatePropagation();ev.preventDefault();
    if(!candidates.length)return;
    candidates.sort((a,b)=>Math.hypot(a.x-pt.x,a.y-pt.y)-Math.hypot(b.x-pt.x,b.y-pt.y));
    chooseEditShot(candidates);
  },true);
})();
