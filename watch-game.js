/* Scoridium Game Center: read-only spectator view. All writes stay in the tracker. */
(() => {
  'use strict';
  const api = window.supabaseClient;
  const params = new URLSearchParams(location.search);
  const gameId = params.get('gameId');
  const $ = id => document.getElementById(id);
  const state = { game:null, team:null, events:[], players:[], channel:null, refreshTimer:null, running:false, pending:false, loaded:false };
  const text = (id,value) => { const node=$(id); if(node)node.textContent=String(value??'—'); };
  const formatDate = value => {
    if(!value) return 'Date to be announced';
    const iso = String(value).slice(0,10);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if(!m)return String(value);
    return new Date(Date.UTC(+m[1],+m[2]-1,+m[3],12)).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'});
  };
  const periodLabel = n => { const v=Number(n);return !Number.isFinite(v)||v<1?'—':v<=4?`Q${v}`:`OT${v-4}`; };
  const isUs = event => ['us','our','ours'].includes(String(event.team??'').toLowerCase());
  const isOpponent = event => ['opponent','them','away'].includes(String(event.team??'').toLowerCase());
  const scoreEvent = event => {
    if(!['shot','free_throw','opponent_score'].includes(String(event.type)))return 0;
    if(event.made===false)return 0;
    const n=Number(event.points);
    return Number.isFinite(n)&&n>0?n:0;
  };
  const make = (tag,cls,value) => {const el=document.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=String(value);return el;};
  const replace = (id,content) => {$(id).replaceChildren(...content);};
  const setError = message => {const node=$('watch-error');node.hidden=!message;node.textContent=message||'';};
  function teamName(team) {
    if (!team)return 'Our Team';
    if(team.team_type==='club')return team.club_name||team.mascot||team.school_name||'Our Team';
    return team.mascot||team.club_name||team.school_name||'Our Team';
  }
  function setTeamTheme(team){
    const primary=String(team?.primary_color||'');
    const secondary=String(team?.secondary_color||'');
    if(/^#[a-f\d]{6}$/i.test(primary))document.documentElement.style.setProperty('--navy',primary);
    if(/^#[a-f\d]{6}$/i.test(secondary))document.documentElement.style.setProperty('--secondary',secondary);
  }
  function renderScore() {
    const game=state.game;if(!game)return;
    const home=String(game.location||'').trim().toLowerCase()!=='away';
    const our=teamName(state.team), opponent=game.opponent||'Opponent';
    const left=home?our:opponent, right=home?opponent:our;
    text('home-name',left);text('away-name',right);
    const ourScore=game.team_score??'—',theirScore=game.opponent_score??'—';
    text('home-score',home?ourScore:theirScore);text('away-score',home?theirScore:ourScore);
    text('game-date',formatDate(game.date));
    text('game-location',game.venue||game.court||game.location_name|| (home?'Home game':'Away game'));
    const status=String(game.status||'scheduled').toLowerCase();
    const live=['live','in_progress','in-progress'].includes(status);
    const completed=['completed','final','finished'].includes(status);
    text('game-heading',live?'LIVE GAME':completed?'FINAL SCORE':'GAME CENTER');
    text('game-status',live?'LIVE':completed?'FINAL':status==='scheduled'?'UPCOMING':status.replaceAll('_',' ').toUpperCase());
    $('game-status').className='status'+(live?' live':completed?' final':'');
    text('game-period',live?periodLabel(game.period??game.quarter):completed?'FULL TIME':periodLabel(game.period??game.quarter));
    $('game-period').hidden=!(live||completed||game.period);
  }
  function renderQuarters(){
    const game=state.game;if(!game)return;
    const byPeriod=new Map();
    let scored=0;
    for(const e of state.events){
      const p=Number(e.period??e.quarter);const pts=scoreEvent(e);
      if(!Number.isInteger(p)||p<1||!pts)continue;
      if(!isUs(e)&&!isOpponent(e))continue;
      scored++;
      if(!byPeriod.has(p))byPeriod.set(p,{us:0,opponent:0});
      byPeriod.get(p)[isUs(e)?'us':'opponent']+=pts;
    }
    const periods=Array.from({length:Math.max(4,...byPeriod.keys(),Number(game.period)||0)},(_,i)=>i+1).slice(0,10);
    const head=make('tr');for(const title of ['TEAM',...periods.map(periodLabel),'TOTAL'])head.append(make('th','',title));
    $('quarters-head').replaceChildren(head);
    const home=String(game.location||'').toLowerCase()!=='away';
    const lines=[{name:home?teamName(state.team):game.opponent||'Opponent',side:home?'us':'opponent',total:home?game.team_score:game.opponent_score},
      {name:home?game.opponent||'Opponent':teamName(state.team),side:home?'opponent':'us',total:home?game.opponent_score:game.team_score}];
    const rows=lines.map(line=>{
      const tr=make('tr');tr.append(make('td','',line.name));
      for(const p of periods){const recorded=byPeriod.get(p);tr.append(make('td','',recorded?recorded[line.side]:'—'));}
      tr.append(make('td','',line.total??'—'));return tr;
    });
    $('quarters-body').replaceChildren(...rows);
    text('quarters-note',scored?'Quarter scores are calculated from recorded scoring events; totals use the official game score.':'Quarter breakdown becomes available when scoring events are recorded.');
  }
  function description(e){
    const type=String(e.type||'').toLowerCase();
    if(type==='shot'){const pts=Number(e.points);const kind=pts===3?'3-point':pts===2?'2-point':'field goal';return `${e.made===false?'Missed':'Made'} ${kind} shot`;}
    if(type==='free_throw')return `${e.made===false?'Missed':'Made'} free throw`;
    if(type==='opponent_score')return `${Number(e.points)||0} points recorded`;
    return ({offensive_rebound:'Offensive rebound',defensive_rebound:'Defensive rebound',assist:'Assist',steal:'Steal',block:'Block',turnover:'Turnover',foul:'Personal foul',game_start:'Game started',game_end:'Game finalized',tip_off:'Opening tip'}[type]||type.replaceAll('_',' ')||'Game event');
  }
  function renderPlays(){
    const list=$('plays-list');
    if(!state.events.length){list.replaceChildren(make('p','empty','No play-by-play events recorded yet.'));return;}
    const roster=new Map(state.players.map(p=>[String(p.id), `${p.first_name||''} ${p.last_name||''}`.trim()||`#${p.number||'?'}`]));
    const visible=state.events.filter(e=>e.type&&e.type!=='game_state').slice(-250).reverse();
    const frag=document.createDocumentFragment();
    for(const e of visible){
      const row=make('article','play');row.append(make('span','play-period',periodLabel(e.period??e.quarter)));
      const detail=make('div','play-info');detail.append(make('div','play-title',description(e)));
      const who=isUs(e)?teamName(state.team):isOpponent(e)?state.game?.opponent||'Opponent':'Game';
      const player=e.player_id?roster.get(String(e.player_id)):null;
      detail.append(make('div','play-meta',[who,player].filter(Boolean).join(' · ')));row.append(detail);frag.append(row);
    }
    list.replaceChildren(frag);
  }
  function renderStats(){
    const body=$('stats-body');
    const players=new Map(state.players.map(p=>[String(p.id),{name:`${p.first_name||''} ${p.last_name||''}`.trim()||`#${p.number||'?'}`,number:p.number,pts:0,reb:0,ast:0,stl:0,blk:0,tov:0,pf:0,has:false}]));
    for(const e of state.events){
      if(!isUs(e)||!e.player_id)continue;
      const id=String(e.player_id);
      if(!players.has(id))players.set(id,{name:'Player',number:'',pts:0,reb:0,ast:0,stl:0,blk:0,tov:0,pf:0,has:false});
      const p=players.get(id);p.has=true;
      const type=String(e.type||'');
      if(['shot','free_throw'].includes(type))p.pts+=scoreEvent(e);
      else if(['offensive_rebound','defensive_rebound','rebound'].includes(type))p.reb++;
      else if(type==='assist')p.ast++;
      else if(type==='steal')p.stl++;
      else if(type==='block')p.blk++;
      else if(type==='turnover')p.tov++;
      else if(type==='foul')p.pf++;
    }
    const active=Array.from(players.values()).filter(p=>p.has).sort((a,b)=>Number(a.number)-Number(b.number));
    if(!active.length){body.replaceChildren(make('tr'));const tr=make('tr'),cell=make('td','empty','No attributed player statistics recorded yet.');cell.colSpan=8;tr.append(cell);body.replaceChildren(tr);return;}
    const tr=make('tr','team-group');const group=make('td','',teamName(state.team));group.colSpan=8;tr.append(group);
    const rows=[tr,...active.map(p=>{const r=make('tr');for(const v of [`${p.number!==null&&p.number!==undefined?`#${p.number} `:''}${p.name}`,p.pts,p.reb,p.ast,p.stl,p.blk,p.tov,p.pf])r.append(make('td','',v));return r;})];
    body.replaceChildren(...rows);
  }
  function render(){renderScore();renderQuarters();renderPlays();renderStats();}
  async function fetchEvents(){
    const result=[];const size=500;
    for(let offset=0;offset<5000;offset+=size){
      const {data,error}=await api.from('game_events').select('id,game_id,team,type,made,points,player_id,period,created_at').eq('game_id',gameId).order('created_at',{ascending:true}).order('id',{ascending:true}).range(offset,offset+size-1);
      if(error)throw error;
      result.push(...(data||[]));if(!data||data.length<size)break;
    }
    return result;
  }
  async function load({initial=false}={}){
    if(state.running){state.pending=true;return;}
    state.running=true;
    try{
      const gameRes=await api.from('games').select('*').eq('id',gameId).single();
      if(gameRes.error)throw gameRes.error;
      const game=gameRes.data;
      const needTeam=!state.team||String(state.team.id)!==String(game.team_id);
      const tasks=[fetchEvents()];
      if(needTeam){tasks.push(api.from('teams').select('id,mascot,school_name,club_name,team_type,primary_color,secondary_color').eq('id',game.team_id).single());
        tasks.push(api.from('players').select('id,team_id,first_name,last_name,number').eq('team_id',game.team_id));}
      const data=await Promise.allSettled(tasks);
      state.game=game;
      if(data[0].status==='fulfilled')state.events=data[0].value;
      if(needTeam){
        if(data[1]?.status==='fulfilled'&&!data[1].value.error)state.team=data[1].value.data;
        if(data[2]?.status==='fulfilled'&&!data[2].value.error)state.players=data[2].value.data||[];
      }
      setTeamTheme(state.team);render();
      if(data[0].status==='rejected')setError('Game loaded, but play-by-play is currently unavailable.');else setError('');
      text('connection','● Connected · Auto-updating');$('connection').className='connected';state.loaded=true;
    }catch(err){
      console.warn('Game viewer load:',err);
      if(initial||!state.loaded)setError('This game is unavailable, or your account does not have permission to view it.');
      text('connection','● Reconnecting…');$('connection').className='disconnected';
    }finally{
      state.running=false;
      if(state.pending){state.pending=false;queueMicrotask(()=>load());}
    }
  }
  function subscribe(){
    if(!api.channel)return;
    state.channel=api.channel(`scoridium-watch-${gameId}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'games',filter:`id=eq.${gameId}`},()=>load())
      .on('postgres_changes',{event:'*',schema:'public',table:'game_events',filter:`game_id=eq.${gameId}`},()=>load())
      .subscribe(status=>{if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'){text('connection','● Reconnecting…');$('connection').className='disconnected';}});
  }
  function init(){
    for(const b of document.querySelectorAll('[data-tab]'))b.addEventListener('click',()=>{
      const chosen=b.dataset.tab;for(const other of document.querySelectorAll('[data-tab]'))other.setAttribute('aria-selected',String(other===b));
      $('panel-plays').hidden=chosen!=='plays';$('panel-stats').hidden=chosen!=='stats';
    });
    if(!gameId){setError('No game selected. Open a game from Game Hub to view it.');text('connection','No game selected');return;}
    if(!api){setError('Game connection is unavailable. Please reload.');return;}
    load({initial:true}).then(subscribe);
    state.refreshTimer=setInterval(()=>{if(document.visibilityState==='visible')load();},12000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load();});
    window.addEventListener('pagehide',()=>{clearInterval(state.refreshTimer);if(state.channel)api.removeChannel(state.channel);},{once:true});
  }
  init();
})();
