(() => {
  const client=window.supabaseClient;
  const list=document.getElementById('teams-list'), notice=document.getElementById('teams-notice');
  const valid = (value,fallback) => /^#[0-9a-fA-F]{6}$/.test(value||'') ? value : fallback;
  function luminance(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0)}
  function show(message,error=false){notice.className=message?`notice${error?' error':''}`:'';notice.textContent=message}
  function openTeamInvite(team,teamId,trigger){
      const overlay=document.createElement('div');overlay.className='team-invite-overlay';
      const modal=document.createElement('div');modal.className='team-invite-dialog';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label','Share and manage team');
      const header=document.createElement('div');header.className='team-invite-dialog-header';
      const close=document.createElement('button');close.type='button';close.className='team-invite-close';close.setAttribute('aria-label','Close team sharing');close.textContent='×';
      header.append(close);modal.append(header);
      const panel=document.createElement('section');panel.className='team-admin-panel';
      const heading=document.createElement('h3');heading.textContent=(team.mascot||team.club_name||team.school_name||'Team')+' — Share Team';panel.append(heading);heading.id='share-team-heading';modal.setAttribute('aria-labelledby',heading.id);
      const info=document.createElement('p');info.setAttribute('role','status');panel.append(info);
      // A QR generated from localhost / 127.0.0.1 does not work on a different device.
      // Admins can set the hosted website or a reachable LAN address for local testing.
      const siteLabel=document.createElement('label');siteLabel.textContent='Website address for phone invitations';siteLabel.className='invite-site-label';
      const siteInput=document.createElement('input');siteInput.type='url';siteInput.className='invite-site-input';siteInput.setAttribute('aria-label','Public website URL or phone-accessible testing URL');
      siteInput.autocomplete='url';siteInput.spellcheck=false;
      const currentDirectory=new URL('./',location.href).href;
      const storedSite=localStorage.getItem('apex_invite_site_base');
      siteInput.value=storedSite||currentDirectory;
      const siteSave=document.createElement('button');siteSave.type='button';siteSave.textContent='Use Address';
      const siteNote=document.createElement('p');siteNote.className='invite-site-note';siteNote.setAttribute('role','status');
      panel.append(siteLabel,siteInput,siteSave,siteNote);
      const link=document.createElement('input');link.readOnly=true;link.setAttribute('aria-label','Team invitation link');link.className='invite-url';panel.append(link);
      const qr=document.createElement('div');qr.className='invite-qr';panel.append(qr);
      const code=document.createElement('p');code.className='invite-code';panel.append(code);
      const actions=document.createElement('div');actions.className='invite-actions';
      const copy=document.createElement('button');copy.type='button';copy.textContent='Copy Link';
      const rotate=document.createElement('button');rotate.type='button';rotate.textContent='Generate / Rotate Link';
      const disable=document.createElement('button');disable.type='button';disable.textContent='Disable Invite';
      actions.append(copy,rotate,disable);panel.append(actions);
      const memberHeading=document.createElement('h4');memberHeading.textContent='Members';panel.append(memberHeading);
      const members=document.createElement('div');members.className='members-list';panel.append(members);
      const rpc=async(name,args)=>{const {data,error}=await client.rpc(name,args);if(error)throw error;return data;};
      let activeInviteToken=null;
      const getPhoneSite=()=>{
        const inputValue=siteInput.value.trim();
        const base=new URL(inputValue);
        if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash)throw Error('Enter a website URL beginning with https:// (or http:// for local Wi-Fi testing).');
        const host=base.hostname.toLowerCase().replace(/\.$/,'');
        if(['localhost','127.0.0.1','0.0.0.0','::1','[::1]'].includes(host)||host.endsWith('.localhost'))throw Error('This address points to your own device. Use your deployed HTTPS website or your PC’s Wi-Fi IP address, not localhost.');
        if(base.protocol!=='https:' && !(/^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(host)))throw Error('Use HTTPS for shared invitations. HTTP is only allowed for local private Wi-Fi testing.');
        let path=base.pathname;
        // The field expects the app directory, not a link to a specific HTML screen.
        if(/\.html?$/i.test(path))throw Error('Enter the ApexVision website/folder address, not an individual .html page.');
        if(!path.endsWith('/'))path+='/';
        const normalized=new URL(path,base.origin);
        return normalized.href;
      };
      const displayInvite=token=>{
        activeInviteToken=token;
        qr.replaceChildren();link.value='';code.textContent='';
        if(!token){siteNote.textContent='';info.textContent='Invites disabled. Generate a new link when you are ready to share.';return;}
        code.textContent='Manual code: '+token;
        let url;
        try{url=new URL('join-team.html',getPhoneSite());}
        catch(error){siteNote.textContent=error.message;info.textContent='Fix the website address above to enable a scannable invitation. The manual code still works.';return;}
        url.searchParams.set('code',token);
        link.value=url.href;
        const localLan=url.protocol==='http:';
        siteNote.textContent=localLan?'Local Wi-Fi test: both devices must be on the same network, the server must accept LAN connections, and the phone must be able to open this URL. For email confirmation, use a deployed HTTPS website.':'Check that this exact URL opens on a phone and add your website to Supabase Auth redirect allowlist.';
        info.textContent='Anyone with this link can join as a read-only team member. Share privately.';
        if(typeof QRCode==='function')new QRCode(qr,{text:url.href,width:186,height:186,correctLevel:QRCode.CorrectLevel.M});
        else qr.textContent='QR code unavailable. Copy the link instead.';
      };
      siteSave.onclick=()=>{
        try{const normalized=getPhoneSite();siteInput.value=normalized;localStorage.setItem('apex_invite_site_base',normalized);displayInvite(activeInviteToken);}
        catch(error){siteNote.textContent=error.message;link.value='';qr.replaceChildren();}
      };
      siteInput.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();siteSave.click();}});
      const reloadInvite=async()=>displayInvite(await rpc('apex_auto_get_invite',{p_team_id:teamId}));
      const reloadMembers=async()=>{
        members.replaceChildren();
        const rows=await rpc('apex_auto_list_members',{p_team_id:teamId});
        for(const r of rows||[]){
          const item=document.createElement('div');item.className='member-item';
          const t=document.createElement('span');t.textContent=(r.email||('Account '+r.user_id.slice(0,8)))+' · '+r.role.replaceAll('_',' ');item.append(t);
          if(r.role!=='head_coach'){
            const rm=document.createElement('button');rm.textContent='Remove';rm.type='button';
            rm.onclick=async()=>{if(!confirm('Remove this member from your team?'))return;rm.disabled=true;try{await rpc('apex_auto_remove_member',{p_team_id:teamId,p_user_id:r.user_id});await reloadMembers();}catch(e){info.textContent=e.message;rm.disabled=false;}};
            item.append(rm);
          }
          members.append(item);
        }
      };
      copy.onclick=async()=>{try{if(!link.value)throw Error('Generate an invite link first.');await navigator.clipboard.writeText(link.value);info.textContent='Invitation link copied.';}catch(e){info.textContent=e.message;}};
      rotate.onclick=async()=>{if(link.value&&!confirm('Replace the current link? The old link will stop working.'))return;rotate.disabled=true;try{displayInvite(await rpc('apex_auto_rotate_invite',{p_team_id:teamId}));}catch(e){info.textContent=e.message;}finally{rotate.disabled=false;}};
      disable.onclick=async()=>{if(!confirm('Disable this team invitation link?'))return;disable.disabled=true;try{await rpc('apex_auto_disable_invite',{p_team_id:teamId});displayInvite(null);}catch(e){info.textContent=e.message;}finally{disable.disabled=false;}};
      modal.append(panel);overlay.append(modal);document.body.append(overlay);
      const dismiss=()=>{overlay.remove();document.removeEventListener('keydown',handleKey);trigger.focus();};
      const handleKey=event=>{
        if(event.key==='Escape')dismiss();
        if(event.key==='Tab'){
          const focusables=[...modal.querySelectorAll('button:not([disabled]), input:not([disabled])')];
          const first=focusables[0],last=focusables[focusables.length-1];
          if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
          else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
        }
      };
      close.onclick=dismiss;
      overlay.addEventListener('click',event=>{if(event.target===overlay)dismiss();});
      document.addEventListener('keydown',handleKey);
      close.focus();
      Promise.all([reloadInvite(),reloadMembers()]).catch(e=>{info.textContent='Invite management unavailable: '+e.message;});
  }
  async function load(){
    if(!client){show('Supabase is not initialized.',true);return;}
    show('Loading your teams…');
    const {data:{user},error:authError}=await client.auth.getUser();
    if(authError||!user){window.location.href='Login.html';return;}
    const {data:memberships,error}=await client.from('team_members')
      .select('role,team_id,teams(id,team_type,school_name,club_name,mascot,division,primary_color,secondary_color)')
      .eq('user_id',user.id);
    if(error){show('Unable to load teams: '+error.message,true);return;}
    show('');list.replaceChildren();
    for(const membership of memberships||[]){
      const team=Array.isArray(membership.teams)?membership.teams[0]:membership.teams;
      if(!team)continue;
      const primary=valid(team.primary_color,'#181818'),secondary=valid(team.secondary_color,'#9299A5');
      const name=team.team_type==='club'?(team.club_name||team.school_name||'Team'):(team.mascot||team.school_name||'Team');
      const organization=team.team_type==='club'?'Club basketball':(team.school_name||'School basketball');
      const abbreviation=(team.mascot || team.club_name || team.school_name || 'T').trim().charAt(0).toUpperCase();
      const card=document.createElement('button');card.type='button';card.className='team-card';
      card.style.setProperty('--card-primary',primary);card.style.setProperty('--card-secondary',secondary);
      card.style.setProperty('--card-primary-ink',luminance(primary)>.179?'#161616':'#FFFFFF');
      const banner=document.createElement('div');banner.className='team-card-banner';
      const logo=document.createElement('div');logo.className='team-card-logo';logo.textContent=abbreviation;
      if(Math.abs(luminance(primary)-luminance(secondary))<.18)logo.classList.add('light-logo');
      const title=document.createElement('div');title.className='team-card-banner-name';title.textContent=name;
      banner.append(logo,title);
      const body=document.createElement('div');body.className='team-card-body';
      const info=document.createElement('div');info.className='team-card-info';
      const org=document.createElement('p');org.textContent=organization;
      const badges=document.createElement('div');badges.className='team-card-badges';
      [team.division,membership.role?.replaceAll('_',' ')].filter(Boolean).forEach(t=>{const b=document.createElement('span');b.textContent=t;badges.appendChild(b)});
      info.append(org,badges);
      const arrow=document.createElement('span');arrow.className='team-card-arrow';arrow.textContent='→';
      body.append(info,arrow);card.append(banner,body);
      card.addEventListener('click',()=>{
        sessionStorage.setItem('selectedTeamId',membership.team_id);
        sessionStorage.removeItem('selectedSeasonId');
        // Immediately available to next page before its first paint.
        try {sessionStorage.setItem('scoridium:team-preview:'+membership.team_id,JSON.stringify({id:membership.team_id,...team}));}catch{}
        window.location.href='app.html?page=dashboard.html';
      });
      const cardWrap=document.createElement('div');cardWrap.className='team-card-wrap';
      cardWrap.appendChild(card);
      // The actions button must not be nested inside the navigational team button.
      if(membership.role==='head_coach'){
        const options=document.createElement('button');options.type='button';options.className='team-card-options';
        options.setAttribute('aria-label','Share and manage '+name);options.title='Team options';
        options.textContent='⋮';
        options.addEventListener('click',event=>{event.stopPropagation();openTeamInvite(team,membership.team_id,options);});
        cardWrap.appendChild(options);
      }
      list.appendChild(cardWrap);
    }
    const create=document.createElement('a');create.href='create-team.html';create.className='empty-team-card';create.textContent='+ Create another team';list.appendChild(create);
  }
  const joinForm=document.getElementById('join-form');
  joinForm.addEventListener('submit',e=>{
    e.preventDefault();const c=document.getElementById('join-code').value.trim().toUpperCase();
    if(!/^[0-9A-F]{32}$/.test(c)){document.getElementById('join-notice').textContent='Enter a valid 32-character invitation code.';return;}
    location.href='join-team.html?code='+encodeURIComponent(c);
  });
  document.getElementById('sign-out').addEventListener('click',async()=>{
    const {error}=await client.auth.signOut();if(error){show(error.message,true);return;}
    sessionStorage.removeItem('selectedTeamId');sessionStorage.removeItem('selectedSeasonId');location.href='Login.html';
  });
  load().catch(e=>show('Unable to load teams: '+e.message,true));
})();
