/* Roster editor: only authorized team staff can see editing actions.
   Actual writes are enforced by public.scoridium_manage_player RPC. */
(()=>{'use strict';
  const $=id=>document.getElementById(id),btn=$('edit-roster'),dialog=$('roster-edit-dialog');
  if(!btn||!dialog)return;
  let roster=[],teamId=null,canEdit=false;
  const client=()=>typeof supabaseClient!=='undefined'?supabaseClient:null;
  const loadStaff=async()=>{
    const c=client();if(!c||!teamId)return;
    const {data,error}=await c.from('team_members').select('role,user_id').eq('team_id',teamId);
    const host=$('roster-staff-list');if(!host)return;
    if(error){host.textContent='Staff list unavailable with your current permissions.';return;}
    const order=[['head_coach','Head Coaches'],['coach','Coaches'],['assistant_coach','Assistant Coaches'],['manager','Team Managers'],['stat_tracker','Season Stat Trackers']];
    host.replaceChildren();
    for(const [id,label] of order){const n=(data||[]).filter(r=>r.role===id).length;const row=document.createElement('div');row.className='roster-staff-role';const left=document.createElement('strong');left.textContent=label;const right=document.createElement('span');right.textContent=`${n} assigned`;row.append(left,right);host.append(row);}
  };
  async function permissions(){
    const c=client();if(!c||!teamId)return;
    const {data:{user}}=await c.auth.getUser();if(!user)return;
    const {data,error}=await c.from('team_members').select('role').eq('team_id',teamId).eq('user_id',user.id);
    canEdit=!error&&(data||[]).some(r=>['head_coach','coach','assistant_coach','manager'].includes(r.role));
    btn.hidden=!canEdit;
  }
  function openEditor(player){
    if(!canEdit)return;
    $('roster-edit-id').value=player?.id||'';
    $('roster-edit-first').value=player?.first_name||'';
    $('roster-edit-last').value=player?.last_name||'';
    $('roster-edit-number').value=player?.number??'';
    $('roster-edit-heading').textContent=player?'Edit Player':'Add Player';
    $('roster-edit-archive').hidden=!player;
    $('roster-edit-status').textContent='';dialog.showModal();
  }
  // One management panel; never decorate individual player jerseys with edit controls.
  let manager=null;
  function openManager(){
    if(!canEdit)return;
    if(manager){manager.remove();manager=null;return;}
    manager=document.createElement('section');manager.className='roster-manager-list';
    manager.setAttribute('aria-label','Edit roster player list');
    const heading=document.createElement('h3');heading.textContent='Manage Players';manager.append(heading);
    [...roster].sort((a,b)=>Number(a.number??999)-Number(b.number??999)).forEach(player=>{
      const b=document.createElement('button');b.type='button';
      b.textContent=`#${player.number??'—'} · ${player.first_name||''} ${player.last_name||''}`;
      b.addEventListener('click',()=>openEditor(player));manager.append(b);
    });
    const add=document.createElement('button');add.type='button';add.className='roster-add-player';add.textContent='+ Add Player';
    add.addEventListener('click',()=>openEditor(null));manager.append(add);
    btn.closest('.roster-toolbar')?.after(manager);
  }
  btn.addEventListener('click',openManager);
  $('roster-edit-cancel').addEventListener('click',()=>dialog.close());
  async function submit(action){
    if(!canEdit||!teamId)return;
    const c=client();if(!c)return;
    $('roster-edit-status').textContent='Saving…';
    const id=$('roster-edit-id').value||null;
    const {data,error}=await c.rpc('scoridium_manage_player',{
      p_team_id:teamId,p_player_id:id,p_action:action,
      p_first_name:$('roster-edit-first').value.trim(),p_last_name:$('roster-edit-last').value.trim(),
      p_number:Number($('roster-edit-number').value||0)
    });
    if(error){$('roster-edit-status').textContent=error.message;return;}
    dialog.close();location.reload();
  }
  $('roster-player-form').addEventListener('submit',e=>{e.preventDefault();void submit('save');});
  $('roster-edit-archive').addEventListener('click',()=>{if(confirm('Remove this player from the active roster? Historical game stats will remain.'))void submit('archive');});
  document.addEventListener('scoridium-roster-loaded',async e=>{teamId=e.detail.teamId;roster=e.detail.players||[];await Promise.all([permissions(),loadStaff()]);});

})();
