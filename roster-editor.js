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
  function addEditControls(){
    if(!canEdit)return;
    const links=Array.from(document.querySelectorAll('#jersey-grid .jersey-card'));
    links.forEach((link,i)=>{
      const pid=new URL(link.href).searchParams.get('playerId');const p=roster.find(row=>String(row.id)===String(pid));if(!p||link.nextElementSibling?.classList.contains('roster-edit-trigger'))return;
      const b=document.createElement('button');b.type='button';b.className='roster-edit-trigger';b.textContent='Edit';b.setAttribute('aria-label',`Edit ${p.first_name||''} ${p.last_name||''}`);
      b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openEditor(p);});link.after(b);
    });
  }
  btn.addEventListener('click',()=>openEditor(null));
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
  document.addEventListener('scoridium-roster-loaded',async e=>{teamId=e.detail.teamId;roster=e.detail.players||[];await Promise.all([permissions(),loadStaff()]);addEditControls();});
  document.addEventListener('scoridium-roster-rendered',()=>{document.querySelectorAll('.roster-edit-trigger').forEach(b=>b.remove());addEditControls();});
})();
