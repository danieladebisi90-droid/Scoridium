(()=>{'use strict';
 const client=window.supabaseClient,params=new URLSearchParams(location.search),input=document.getElementById('invitation-code'),message=document.getElementById('join-message'),form=document.getElementById('auto-join-form'),auth=document.getElementById('join-auth'),button=document.getElementById('join-now');
 const valid=x=>/^[0-9A-F]{32}$/.test(x);
 const code=(params.get('code')||'').trim().toUpperCase();if(valid(code))input.value=code;
 const save=()=>{const value=input.value.trim().toUpperCase();if(valid(value))sessionStorage.setItem('apex_pending_invite',value);return value;};
 const stored=sessionStorage.getItem('apex_pending_invite');if(!input.value&&valid(stored||''))input.value=stored;
 const loginLink=(page)=>{const u=new URL(page,location.href);u.searchParams.set('invite',save());return u.href;};
 const refreshLinks=()=>{document.getElementById('join-signup').href=loginLink('signup.html');document.getElementById('join-login').href=loginLink('Login.html');};
 async function attempt(){
  if(!client){message.textContent='Unable to initialize Supabase.';return;}
  const token=save();if(!valid(token)){message.textContent='Enter a valid invitation code.';return;}
  const selectedRole=document.getElementById('membership-type').value;
  if(!['viewer','parent','player','coach'].includes(selectedRole)){message.textContent='Choose Team Viewer, Parent, Player, or Coach before joining.';return;}
  const {data:{user},error}=await client.auth.getUser();
  if(error||!user){message.textContent='Sign up or sign in to join this team.';auth.hidden=false;form.hidden=true;refreshLinks();return;}
  if(!user.email_confirmed_at){message.textContent='Verify your email address before joining.';auth.hidden=false;form.hidden=true;refreshLinks();return;}
  auth.hidden=true;form.hidden=false;button.disabled=true;message.textContent='Joining team…';
  try{const {data,error:joinError}=await client.rpc('apex_auto_join_team',{p_code:token,p_kind:selectedRole});if(joinError)throw joinError;
   sessionStorage.removeItem('apex_pending_invite');message.textContent=data||'You joined the team.';location.replace('myTeams.html');
  }catch(err){message.textContent=err.message||'Unable to join. Try a new invitation.';}finally{button.disabled=false;}
 }
 form.addEventListener('submit',e=>{e.preventDefault();attempt();});
 input.addEventListener('change',()=>{const token=save();if(valid(token))history.replaceState(null,'','join-team.html?code='+encodeURIComponent(token));});
 (async()=>{const {data}=await client.auth.getUser();if(!data?.user){auth.hidden=false;form.hidden=true;message.textContent='Sign up or sign in to accept your invitation.';refreshLinks();return;}if(valid(save())){message.textContent='Invitation ready. Choose how you are connected to the team, then select Join Team.';}else{message.textContent='Enter an invitation code, choose your role, and select Join Team.';}})();
})();