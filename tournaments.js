/* Scoridium Tournament Hub — standalone module; requires MIGRATION_TOURNAMENTS.sql.
   Never creates official player stats from externally entered tournament results. */
(() => {
  'use strict';
  let tournaments = [];
  let matches = [];
  let activeContext = 0;
  let selectedTournament = null;
  let headToHeadRequest = 0;
  const statCache = new Map();

  const el = (tag, cls, content) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content != null) node.textContent = String(content);
    return node;
  };
  const button = (label, cb) => {
    const node = el('button', '', label);
    node.type = 'button';
    node.addEventListener('click', cb);
    return node;
  };
  const dateKey = d => [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  const selectedKey = () => typeof selectedGameDate !== 'undefined' && selectedGameDate ? dateKey(selectedGameDate) : '';
  const forDate = key => tournaments.filter(t => t.starts_on <= key && key <= t.ends_on);
  const context = () => document.getElementById('gamehub-dynamic-context');

  // Calculate a readable variant of the SECONDARY team colour. No hard-coded yellow.
  function highlight() {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--team-secondary').trim();
    let hex = raw.match(/^#([a-f\d]{6})$/i)?.[1];
    if (!hex) hex = '9299a5';
    const rgb = [0,2,4].map(i => parseInt(hex.slice(i,i+2),16));
    const linear = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v+.055)/1.055,2.4); };
    const lum = rgb.reduce((acc,n,i) => acc + linear(n)*[.2126,.7152,.0722][i],0);
    // Bright secondary: darken. Dark secondary: lighten. Use accessible contrast.
    const mix = lum > .45 ? [0,0,0] : [255,255,255];
    const factor = lum > .45 ? .36 : .53;
    const out = rgb.map((v,i) => Math.round(v*(1-factor)+mix[i]*factor));
    const y = out.reduce((acc,n,i)=>acc+linear(n)*[.2126,.7152,.0722][i],0);
    return { bg: `rgb(${out.join(',')})`, ink:y>.22?'#12243b':'#ffffff' };
  }
  function decorateDate(node,key) {
    if (!forDate(key).length) return;
    const {bg,ink} = highlight();
    node.classList.add('tournament-date');
    node.style.setProperty('--tournament-highlight',bg);
    node.style.setProperty('--tournament-text',ink);
    node.title = [node.title,...forDate(key).map(t => `${t.name || 'Tournament'} (${t.starts_on} – ${t.ends_on})`)].filter(Boolean).join('\n');
    node.setAttribute('aria-label',`${key}, tournament date`);
  }
  async function reload() {
    const team = sessionStorage.getItem('selectedTeamId');
    const season = sessionStorage.getItem('selectedSeasonId');
    if (!team || !season || typeof supabaseClient === 'undefined') return;
    const response = await supabaseClient.from('scoridium_tournaments').select('*')
      .eq('team_id',team).eq('season_id',season).order('starts_on');
    if (response.error) {
      console.warn('Tournaments unavailable; apply MIGRATION_TOURNAMENTS.sql:',response.error.message);
      tournaments = [];
    } else {
      tournaments = response.data || [];
    }
    const ids = tournaments.map(t=>t.id);
    matches = [];
    if (ids.length) {
      const m = await supabaseClient.from('scoridium_tournament_matches').select('*')
        .in('tournament_id',ids).order('created_at', { ascending:true });
      if (m.error) {
        // Older database without created_at: fall back to deterministic ID sort.
        const alternate = await supabaseClient.from('scoridium_tournament_matches').select('*').in('tournament_id',ids).order('id');
        if (alternate.error) console.warn('Tournament results unavailable:',alternate.error.message);
        else matches = alternate.data || [];
      } else matches = m.data || [];
    }
    renderGameCalendar();
    renderSelectedDate();
    if (typeof renderMobileSelectedDay === 'function') renderMobileSelectedDay();
    const add = document.getElementById('add-tournament');
    if (add) add.hidden = !(typeof canManageSchedule !== 'undefined' && canManageSchedule);
  }
  function card(label,value) {
    const c=el('div','gamehub-context-card');
    c.append(el('small','',label),el('strong','',value));
    return c;
  }
  const muted = txt => el('p','context-muted',txt);
  const row = () => el('div','gamehub-context-row');
  function renderSelectedDate() {
    const root=context();
    if (!root) return;
    root.replaceChildren();
    const key=selectedKey();
    const tournament=forDate(key)[0];
    const h=document.getElementById('context-panel-heading');
    if (tournament) {
      if(h) h.textContent='TOURNAMENT HUB';
      renderTournament(root,tournament);
      return;
    }
    if(h) h.textContent='OPPONENT HEAD-TO-HEAD';
    const games = typeof gameHubGames !== 'undefined' ? gameHubGames : [];
    const onDate=games.filter(g => String(g.date).slice(0,10)===key);
    if(!key){root.append(muted('Select a game or tournament date to see its details.'));return;}
    if(!onDate.length){root.append(muted('No game scheduled on this date.'));return;}
    // Select a game on this date without affecting the immutable Next Game card.
    const game=onDate[0];
    const title=el('h3','',`vs. ${game.opponent || 'TBD'}`);
    root.append(title);
    if(onDate.length>1) {
      const picker=el('select');
      for(const g of onDate){const opt=el('option','',g.opponent || 'TBD');opt.value=g.id;picker.append(opt);}
      picker.onchange=()=>renderHeadToHead(root,onDate.find(g=>g.id===picker.value));
      root.append(picker);
    }
    renderHeadToHead(root,game);
  }
  function renderHeadToHead(root,game) {
    root.querySelectorAll('.headtohead-details').forEach(n=>n.remove());
    const wrap=el('div','headtohead-details');
    root.append(wrap);
    if(!game?.opponent){wrap.append(muted('Opponent not known yet.'));return;}
    const norm=s=>String(s||'').trim().replace(/\s+/g,' ').toLocaleLowerCase();
    const all = typeof gameHubGames !== 'undefined' ? gameHubGames : [];
    const completed=all.filter(g=>g.id!==game.id && g.status==='completed' &&
      norm(g.opponent)===norm(game.opponent) && String(g.date).slice(0,10)<=String(game.date).slice(0,10) &&
      Number.isFinite(Number(g.team_score)) && Number.isFinite(Number(g.opponent_score)));
    if(!completed.length){wrap.append(muted('First meeting this season — no previous head-to-head statistics.'));return;}
    const wins=completed.filter(g=>Number(g.team_score)>Number(g.opponent_score)).length;
    const losses=completed.filter(g=>Number(g.team_score)<Number(g.opponent_score)).length;
    const draws=completed.length-wins-losses;
    const own=completed.reduce((n,g)=>n+Number(g.team_score),0);
    const opp=completed.reduce((n,g)=>n+Number(g.opponent_score),0);
    const grid=el('div','gamehub-context-grid');
    grid.append(card('Previous games',completed.length),card('Record',`${wins}–${losses}${draws?`–${draws}`:''}`),
      card('Avg points',(own/completed.length).toFixed(1)),card('Avg allowed',(opp/completed.length).toFixed(1)));
    wrap.append(grid,muted('Same-season completed meetings only. Detailed statistics include all available events from those games.'));
    const details = el('div','gamehub-detailed-h2h');
    wrap.append(details);
    const requestId = ++headToHeadRequest;
    loadHeadToHeadStats(completed,details,requestId);
    for(const g of completed.sort((a,b)=>String(b.date).localeCompare(String(a.date)))) {
      const r=row();r.append(el('span','',`${g.date} · ${g.location || 'Game'}`),el('strong','',`${g.team_score}–${g.opponent_score}`));wrap.append(r);
    }
    const link=el('a','', 'View Opponent Stats');link.href='stats.html';wrap.append(link);
  }
  async function loadHeadToHeadStats(games,container,requestId) {
    const ids=games.map(g=>g.id);
    const cacheKey=ids.slice().sort().join(',');
    if(statCache.has(cacheKey)){displayHeadToHeadStats(container,statCache.get(cacheKey));return;}
    container.append(muted('Loading available shot and player statistics…'));
    try {
      const events=[];
      for(let offset=0; offset<10000; offset+=500){
        const {data,error}=await supabaseClient.from('game_events').select('game_id,type,team,player_id,made,points,period')
          .in('game_id',ids).order('id',{ascending:true}).range(offset,offset+499);
        if(error)throw error;
        events.push(...(data||[]));
        if((data||[]).length<500)break;
      }
      const teamId=sessionStorage.getItem('selectedTeamId');
      const playersResponse=await supabaseClient.from('players').select('id,first_name,last_name,number').eq('team_id',teamId);
      const roster=new Map((playersResponse.data||[]).map(p=>[String(p.id),`${p.first_name||''} ${p.last_name||''}`.trim()||`#${p.number||'?'}`]));
      if(requestId!==headToHeadRequest)return;
      const fresh={events,roster};statCache.set(cacheKey,fresh);
      displayHeadToHeadStats(container,fresh);
    } catch(e){container.replaceChildren(muted('Detailed event data is unavailable: '+e.message));}
  }
  function displayHeadToHeadStats(container,{events,roster}){
    container.replaceChildren();
    if(!events.length){container.append(muted('No recorded event statistics for these meetings.'));return;}
    const makeTotals=()=>({pts:0,fgm:0,fga:0,threeM:0,threeA:0,ftm:0,fta:0,reb:0,ast:0,to:0,stl:0,blk:0,pf:0});
    const home=makeTotals(),op=makeTotals(),players=new Map();
    for(const e of events){
      const side=String(e.team||'').toLowerCase();
      const ours=['us','our','ours'].includes(side);
      const total=ours?home:op;
      const type=String(e.type||'').toLowerCase();
      const person=ours&&e.player_id!=null?String(e.player_id):null;
      if(person&&!players.has(person))players.set(person,makeTotals());
      const targets=person?[total,players.get(person)]:[total];
      for(const t of targets){
        if(type==='shot'){
          t.fga++;if(Number(e.points)===3)t.threeA++;
          if(e.made===true){t.fgm++;t.pts+=Number(e.points)||0;if(Number(e.points)===3)t.threeM++;}
        } else if(type==='free_throw'){
          t.fta++;if(e.made===true){t.ftm++;t.pts++;}
        } else if(['rebound','offensive_rebound','defensive_rebound'].includes(type))t.reb++;
        else if(type==='assist')t.ast++;
        else if(type==='turnover')t.to++;
        else if(type==='steal')t.stl++;
        else if(type==='block')t.blk++;
        else if(type==='foul')t.pf++;
      }
    }
    const pct=(m,a)=>a?`${(m/a*100).toFixed(1)}%`:'—';
    const stats=[['Points',home.pts,op.pts],['FG',`${home.fgm}/${home.fga}`,`${op.fgm}/${op.fga}`],
      ['FG%',pct(home.fgm,home.fga),pct(op.fgm,op.fga)],['3PT',`${home.threeM}/${home.threeA}`,`${op.threeM}/${op.threeA}`],
      ['3PT%',pct(home.threeM,home.threeA),pct(op.threeM,op.threeA)],['FT',`${home.ftm}/${home.fta}`,`${op.ftm}/${op.fta}`],
      ['FT%',pct(home.ftm,home.fta),pct(op.ftm,op.fta)],['Rebounds',home.reb,op.reb],
      ['Assists',home.ast,op.ast],['Turnovers',home.to,op.to],['Steals',home.stl,op.stl],['Blocks',home.blk,op.blk],['Fouls',home.pf,op.pf]];
    const table=el('table','h2h-detail-table');const head=el('tr');
    for(const x of ['Statistic','Our team','Opponent'])head.append(el('th','',x));table.append(head);
    for(const [name,a,b] of stats){const tr=el('tr');for(const v of [name,a,b])tr.append(el('td','',v));table.append(tr);}
    container.append(el('h4','','Team statistics across previous meetings'),table);
    if(players.size){
      const playerTable=el('table','h2h-detail-table'),headRow=el('tr');
      for(const name of ['Player','PTS','REB','AST','FGM/FGA'])headRow.append(el('th','',name));playerTable.append(headRow);
      for(const [id,s] of [...players.entries()].sort((a,b)=>b[1].pts-a[1].pts)){
        const tr=el('tr');for(const v of [roster.get(id)||'Unassigned',s.pts,s.reb,s.ast,`${s.fgm}/${s.fga}`])tr.append(el('td','',v));playerTable.append(tr);
      }
      container.append(el('h4','','Player statistics'),playerTable);
    }
    container.append(muted('Statistics reflect recorded events only; missing opponent/player events are not inferred.'));
  }
  function renderTournament(root,tournament) {
    selectedTournament=tournament;
    const header=row();
    header.append(el('h3','',tournament.name || 'Tournament'),el('small','',`${tournament.starts_on} – ${tournament.ends_on}`));
    root.append(header);
    const tm=matches.filter(m=>m.tournament_id===tournament.id);
    // Scheduled team games are always the real game records, not external result rows.
    const scheduled = (typeof gameHubGames !== 'undefined' ? gameHubGames : [])
      .filter(g=>String(g.date).slice(0,10)>=tournament.starts_on && String(g.date).slice(0,10)<=tournament.ends_on);
    if(scheduled.length){
      root.append(el('h4','','Our scheduled games'));
      for(const game of scheduled){
        const r=row(); r.append(el('span','',`${game.date} · vs ${game.opponent||'TBD'}`));
        const open=button(game.status==='completed'?'Box Score':'Open Game',()=>{
          location.href=game.status==='completed'?`stats.html?gameId=${encodeURIComponent(game.id)}`:`game.html?gameId=${encodeURIComponent(game.id)}`;
        });
        r.append(open);root.append(r);
      }
    }
    const top=row();top.append(el('strong','',`${tm.length} tournament match${tm.length===1?'':'es'}`));
    const expand=button('Expand Bracket',()=>showBracket(tournament,tm));top.append(expand);root.append(top);
    if(!tm.length){root.append(muted('No games added yet. Add tournament games whenever the schedule is announced. A bracket is optional.'));}
    else {
      const list=el('div','gamehub-dynamic-context');
      for(const m of tm.slice(0,6)) list.append(matchCard(m));
      if(tm.length>6) list.append(muted(`${tm.length-6} more games — open the expanded view.`));
      root.append(list);
    }
    const actions=row();root.append(actions);
    const btn=button('Add Tournament Game',()=>openMatchEditor(tournament));
    actions.append(btn);
    canEdit(tournament.id).then(yes=>{btn.hidden=!yes;});
  }
  function matchCard(m) {
    const c=el('div','tournament-match');
    c.append(el('small','',m.round_name || 'Tournament Game'));
    const score = (m.score_a==null||m.score_b==null) ? 'Score TBD' : `${m.score_a} – ${m.score_b}`;
    const r=row();r.append(el('strong','',`${m.team_a||'TBD'} vs ${m.team_b||'TBD'}`),el('span','',score));c.append(r);
    c.append(el('small','',m.result_status==='confirmed'?'Confirmed result':'Unconfirmed / upcoming'));
    const edit=button('Edit result',()=>openMatchEditor(selectedTournament,m));c.append(edit);
    canEdit(m.tournament_id).then(yes=>{edit.hidden=!yes;});
    return c;
  }
  async function canEdit(id) {
    if(!id || typeof supabaseClient==='undefined') return false;
    const {data,error}=await supabaseClient.rpc('scoridium_can_edit_tournament',{p_tournament:id});
    return !error && data===true;
  }
  function showBracket(tournament,tm){
    const root=context();if(!root)return;
    const modal=el('div','bracket-expanded');modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');
    const top=row();top.append(el('h2','',tournament.name),button('Close ×',()=>modal.remove()));modal.append(top);
    if(!tm.length)modal.append(muted('No bracket has been entered yet.'));
    for(const match of tm)modal.append(matchCard(match));
    root.append(modal);modal.querySelector('button')?.focus();
    const esc=e=>{if(e.key==='Escape'){modal.remove();document.removeEventListener('keydown',esc)}};
    document.addEventListener('keydown',esc);
  }
  function showDialog(formName,onSubmit){
    const backdrop=el('div','tournament-backdrop');backdrop.style.display='grid';
    const form=el('form','tournament-dialog');form.setAttribute('aria-label',formName);
    backdrop.append(form);document.body.append(backdrop);
    const heading=row();heading.append(el('h2','',formName),button('×',()=>backdrop.remove()));form.append(heading);
    const status=el('p','context-muted');
    const save=el('button','','Save');save.type='submit';
    const actions=row();actions.append(button('Cancel',()=>backdrop.remove()),save);
    form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;status.textContent='Saving…';try{await onSubmit(form);backdrop.remove();await reload();}catch(err){status.textContent=err.message || String(err);}finally{save.disabled=false;}});
    return {form,status,actions};
  }
  function field(form,labelText,id,value='',type='text'){
    const label=el('label','',labelText);const input=el('input');input.id=id;input.type=type;input.value=value??'';label.append(input);form.append(label);return input;
  }
  function openMatchEditor(t,m=null){
    const {form,status,actions}=showDialog(m?'Edit tournament result':'Add Tournament Game',async f=>{
      const uid=(await supabaseClient.auth.getUser()).data.user?.id;
      if(!uid)throw Error('Sign in to edit tournament results.');
      const read=id=>f.querySelector('#'+id).value.trim();
      const sa=read('match-score-a'),sb=read('match-score-b');
      if((sa==='') !== (sb===''))throw Error('Enter both scores or leave both blank.');
      const data={tournament_id:t.id,round_name:read('match-round')||null,team_a:read('match-a')||'TBD',team_b:read('match-b')||'TBD',
        score_a:sa===''?null:Number(sa),score_b:sb===''?null:Number(sb),result_status:read('match-status'),updated_by:uid};
      if(m){const res=await supabaseClient.from('scoridium_tournament_matches').update(data).eq('id',m.id);if(res.error)throw res.error;}
      else{const res=await supabaseClient.from('scoridium_tournament_matches').insert(data);if(res.error)throw res.error;}
    });
    field(form,'Round / game label (optional)','match-round',m?.round_name||'');
    field(form,'Team A (TBD allowed)','match-a',m?.team_a||'TBD');
    field(form,'Team B (TBD allowed)','match-b',m?.team_b||'TBD');
    const scores=row();
    const a=field(scores,'Team A score','match-score-a',m?.score_a??'','number');a.min='0';a.max='400';
    const b=field(scores,'Team B score','match-score-b',m?.score_b??'','number');b.min='0';b.max='400';
    form.append(scores);
    const label=el('label','','Result state');const state=el('select');state.id='match-status';
    for(const k of ['unconfirmed','confirmed']){const o=el('option','',k==='confirmed'?'Confirmed':'Unconfirmed');o.value=k;state.append(o);}
    state.value=m?.result_status||'unconfirmed';label.append(state);form.append(label,status,actions);
  }
  function configureCreate() {
    const open=document.getElementById('add-tournament');
    const backdrop=document.getElementById('tournament-editor');
    const form=document.getElementById('tournament-form');
    const start=document.getElementById('tournament-start');
    const end=document.getElementById('tournament-end');
    const status=document.getElementById('tournament-form-status');
    if(!open||!backdrop||!form)return;
    const close=()=>{backdrop.hidden=true;};
    open.addEventListener('click',()=>{
      backdrop.hidden=false; status.textContent='';
      start.value=selectedKey()||dateKey(new Date());end.value=start.value;
    });
    start.addEventListener('change',()=>{end.min=start.value;if(end.value<start.value)end.value=start.value;});
    for(const id of ['tournament-cancel','tournament-dismiss'])document.getElementById(id)?.addEventListener('click',close);
    backdrop.addEventListener('click',e=>{if(e.target===backdrop)close();});
    form.addEventListener('submit',async e=>{
      e.preventDefault();
      const team=sessionStorage.getItem('selectedTeamId'),season=sessionStorage.getItem('selectedSeasonId');
      const uid=(await supabaseClient.auth.getUser()).data.user?.id;
      if(!uid||!team||!season){status.textContent='Sign in and select a team and season.';return;}
      if(!start.value||!end.value||end.value<start.value){status.textContent='Choose a valid start and end date.';return;}
      const raw=document.getElementById('tournament-name').value.trim();
      const {error}=await supabaseClient.from('scoridium_tournaments').insert({team_id:team,season_id:season,
        name:raw||'Tournament',starts_on:start.value,ends_on:end.value,created_by:uid});
      if(error){status.textContent=error.message;return;}
      close();await reload();
    });
  }
  document.addEventListener('DOMContentLoaded',configureCreate);
  window.scoridiumTournaments={reload,forDate,decorateDate,renderSelectedDate};
})();
