/* ApexVision Combined Tracking: seven-control toolbar + swipe review.
   Add AFTER existing Combined and mobile tracking scripts. */
(() => {
  'use strict';
  const api = window.apexPostgame;
  const params = new URLSearchParams(location.search);
  if ((api?.mode || params.get('mode')) !== 'combined') return;
  const $ = id => document.getElementById(id);
  const screen = $('postgame-screen');
  const shot = $('post-shot-section');
  const quick = $('post-quick-root');
  if (!screen || !shot || !quick) return;

  const bar = document.createElement('nav');
  bar.id = 'av-combined-nav';
  bar.setAttribute('aria-label', 'Combined Tracking controls');
  
bar.innerHTML = `
  <div class="av-cn-quarter"></div>
  <div class="av-cn-modes"></div>
  <div class="av-cn-team-mode"></div>
  <div class="av-cn-more"></div>
  <div class="av-cn-steps"></div>
`;

  screen.insertBefore(bar, shot);

const statusMessage = document.getElementById('postgame-message');

if (statusMessage) {
}


  // Combined Tracking page indicator
const pageIndicator = document.createElement('div');
pageIndicator.id = 'av-cn-page-indicator';

pageIndicator.innerHTML = `
  <span class="av-cn-dot active"></span>
  <span class="av-cn-dot"></span>
`;

screen.insertBefore(pageIndicator, shot);


const statusRow = document.createElement('div');
statusRow.id = 'av-cn-status-row';

screen.insertBefore(statusRow, shot);

if (statusMessage) {
  statusRow.appendChild(statusMessage);
}

statusRow.appendChild(pageIndicator);



  const moreBtn = document.createElement('button');
  moreBtn.type = 'button'; moreBtn.id = 'av-cn-more-button'; moreBtn.textContent = 'More';
  moreBtn.setAttribute('aria-expanded', 'false');
  moreBtn.setAttribute('aria-controls', 'av-cn-more-panel');
  bar.querySelector('.av-cn-more').append(moreBtn);

  const menu = document.createElement('div');
  menu.id = 'av-cn-more-panel'; menu.hidden = true;
  menu.setAttribute('aria-label', 'Additional review tools');
  bar.append(menu);
  // Game Details is a separate swipe page; show both cards together.

  const review = document.createElement('section');
  review.id = 'av-cn-review'; review.hidden = true;
  review.setAttribute('aria-label', 'Game details');
  // Same two stacked cards as Stat Tracking; there is no extra Back/Tracking button.
  review.innerHTML = `<div class="av-cn-review-body">
    <section id="av-cn-box" class="av-cn-card av-cn-box-card" aria-label="Box Score">
      <div class="av-cn-review-heading"><div><h3>Box Score</h3><small>Tracked team</small></div><span class="av-cn-team-totals">Team Totals</span></div>
      <div class="av-cn-scroll"><table id="av-cn-box-table"></table></div>
      <div id="av-cn-tracked-fouls" class="av-cn-fouls-summary" aria-label="Tracked team fouls by quarter"></div>
      <div class="av-cn-review-heading av-cn-opponent-heading"><div><h3 id="av-cn-opponent-heading">Opponent — Team Box Score</h3><small>Team-level statistics only</small></div></div>
      <div class="av-cn-scroll"><table id="av-cn-opponent-table" aria-label="Opponent team statistics"></table></div>
      <div id="av-cn-opponent-fouls" class="av-cn-fouls-summary" aria-label="Opponent fouls by quarter"></div>
    </section>
    <section id="av-cn-plays" class="av-cn-card av-cn-plays-card" aria-label="Play-by-Play">
      <div class="av-cn-review-heading"><h3>Play-by-Play</h3><span id="av-cn-period">Q1</span><button type="button" id="av-pbp-add" title="Insert a missed stat">+ Add</button></div>
      <div id="av-cn-play-list"></div>
      <p class="av-cn-play-hint">Scroll inside to view earlier plays</p>
    </section>
  </div>`;
  shot.after(review);

  // Original quarter/court controls are MOVED, not cloned; Team Mode is removed.
  function mount() {
    const quarter = $('post-period')?.closest('label');
    const modes = $('pg-court-full')?.closest('.pg-court-modes');
    if (quarter) bar.querySelector('.av-cn-quarter').append(quarter);
    if (!$('av-cn-shot-filter')){
      const label=document.createElement('label');label.className='av-cn-shot-view';
      label.textContent='Show shots ';
      const filter=document.createElement('select');filter.id='av-cn-shot-filter';
      filter.setAttribute('aria-label','Filter visible court shots by quarter');
      const opts=[...$('post-period').options].map(o=>new Option(o.text,o.value));
      opts.push(new Option('All','all'));
      filter.replaceChildren(...opts);filter.value=$('post-period').value;
      filter.addEventListener('change',()=>{
        // A quarter selection means record AND review that quarter.
        // All is view-only and must not change where new events are saved.
        const recording=$('post-period');
        if(filter.value!=='all' && recording && recording.value!==filter.value){
          if(window.apexCourtReview?.isBusy?.() || window.apexPostgameQuick?.selectingLocation?.()){
            filter.value=recording.value;
            api.notify?.('Finish or cancel the current play before changing quarters.');
            return;
          }
          recording.value=filter.value;
          recording.dispatchEvent(new Event('change',{bubbles:true}));
        }
        window.dispatchEvent(new Event('apex:shot-view-change'));
      });
      label.append(filter);bar.querySelector('.av-cn-quarter').append(label);
      $('post-period').addEventListener('change',()=>{
        if(filter.value!=='all')filter.value=$('post-period').value;
        window.dispatchEvent(new Event('apex:shot-view-change'));
      });
    }
    // 'mount' may run before the game's quarters are hydrated.
    const filter=$('av-cn-shot-filter');
    if(filter && $('post-period')?.options.length){
      const desired=[...$('post-period').options].map(o=>({label:o.text,value:o.value}));
      desired.push({label:'All',value:'all'});
      const existing=[...filter.options].map(o=>o.value);
      if(desired.map(o=>o.value).join('|')!==existing.join('|')){
        const was=filter.value;
        filter.replaceChildren(...desired.map(o=>new Option(o.label,o.value)));
        filter.value=desired.some(o=>o.value===was)?was:$('post-period').value;
        window.dispatchEvent(new Event('apex:shot-view-change'));
      }
    }
    if (modes) bar.querySelector('.av-cn-modes').append(modes);

const teamMode = document.getElementById(
  'av-combined-team-mode'
);

if (teamMode) {
  bar.querySelector('.av-cn-team-mode').append(teamMode);
}

    for (const id of ['post-switch-direction','post-shot-links-open','pg-unmatched-open']) {
      const b = $(id);
      if (b) menu.append(b);
    }
    for (const id of ['post-next-quarter','post-end-review']) {
      const b = $(id);
      if (b) bar.querySelector('.av-cn-steps').append(b);
    }
    const play = $('post-quick-review');
    if (play) play.hidden = true;
    // No old More toggle: preserve its node and handlers for other modes.
    document.body.classList.add('av-cn-active');
  }
  function setMenu(open) {
    menu.hidden = !open;
    moreBtn.textContent = open ? 'Close' : 'More';
    moreBtn.setAttribute('aria-expanded', String(open));
  }
  moreBtn.addEventListener('click', () => setMenu(menu.hidden));
  menu.addEventListener('click', e => {
    if (e.target.closest('button')) setMenu(false);
  });
  document.addEventListener('pointerdown', e => {
    if (!menu.hidden && !bar.contains(e.target)) setMenu(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { setMenu(false); if (!review.hidden) showPage('tracking'); }
  });

  const statKeys = ['PTS','REB','AST','STL','BLK','TO','PF','FGM','FGA','3PM','3PA','FTM','FTA'];
  function getStats(events) {
    const s = Object.fromEntries(statKeys.map(k => [k,0]));
    for (const e of events) {
      const made = e.made === true || e.made === 1;
      const pts = Number(e.points) || 0;
      if (e.type === 'shot') {
        if(!e.non_fga){s.FGA++; if (pts === 3) s['3PA']++;}
        if (made) { s.FGM++; s.PTS += pts; if (pts === 3) s['3PM']++; }
      } else if (e.type === 'free_throw') {
        s.FTA++; if (made) { s.FTM++; s.PTS++; }
      }
      if (['offensive_rebound','defensive_rebound','team_offensive_rebound','team_defensive_rebound'].includes(e.type)) s.REB++;
      if (e.type === 'assist') s.AST++;
      if (e.type === 'steal') s.STL++;
      if (e.type === 'block') s.BLK++;
      if (e.type === 'turnover') s.TO++;
      if (e.type === 'foul') s.PF++;
    }
    return s;
  }
  // Film Room editing uses a separate, permission-checked sequence table.
  // If the migration has not been applied, the list remains read-only and
  // keeps the existing chronological order; no false "saved" indication.
  let orderById=new Map(), orderReady=false, dragId=null;
  async function reloadOrder(){
    const response=await supabaseClient.from('apexvision_postgame_order')
      .select('event_id,sort_key').eq('game_id',api.gameId);
    if(response.error){orderReady=false;orderById.clear();return;}
    orderReady=true;
    orderById=new Map((response.data||[]).map(e=>[String(e.event_id),Number(e.sort_key)]));
  }
  const isScorer=e=>e.type==='shot'||e.type==='free_throw';
  const pointsFor=e=>e.made===true||e.made===1 ?
    (e.type==='free_throw'?1:e.type==='shot'?Number(e.points)||0:0):0;
  const rootFor=(e,all)=>{
    const byId=new Map(all.map(x=>[String(x.id),x]));
    const seen=new Set();let cur=e;
    while(cur?.linked_event_id && byId.has(String(cur.linked_event_id)) && !seen.has(String(cur.id))){
      seen.add(String(cur.id));cur=byId.get(String(cur.linked_event_id));
    }
    return cur;
  };
  const seqValue=e=>orderById.has(String(e.id))?orderById.get(String(e.id)):null;
  function sequenceSort(a,b){
    const va=seqValue(a),vb=seqValue(b);
    if(va!==null&&vb!==null&&va!==vb)return vb-va;
    return String(b.created_at||b.id||'').localeCompare(String(a.created_at||a.id||''));
  }
  async function commitOrder(){
    if(!orderReady){api.notify('Play order storage is unavailable. Apply the Play-by-Play SQL migration.');return;}
    const rows=[...document.querySelectorAll('#av-cn-play-list .av-cn-play[data-root-id]')];
    const groups=new Map();
    for(const el of rows){
      const period=Number(el.dataset.period);
      if(!groups.has(period))groups.set(period,[]);
      groups.get(period).push(el.dataset.rootId);
    }
    // Each period is saved separately. "All" can be viewed and dragged, but
    // events cannot silently change quarters merely by being reordered.
    for(const [period,ids] of groups){
      if(!ids.length)continue;
      const result=await supabaseClient.rpc('apexvision_postgame_reorder_plays',{
        p_game_id:api.gameId,p_period:period,p_roots:ids.reverse()
      });
      if(result.error){api.notify('Order not saved: '+result.error.message);await reloadOrder();renderReview();return;}
    }
    await reloadOrder();renderReview();api.notify('Play order saved.');
  }
  function menuAction(label,handler){
    const button=document.createElement('button');button.type='button';button.textContent=label;
    button.addEventListener('click',handler);return button;
  }
  const insertDialog=document.createElement('dialog');insertDialog.id='av-pbp-insert-dialog';
  insertDialog.innerHTML=`<form method="dialog" class="av-pbp-form"><h3>Insert recorded stat</h3>
   <p>For shots, use the court tracker to capture the correct location and result.</p>
   <label>Team <select id="av-pbp-team"><option value="us">Tracked team</option><option value="opponent">Opponent</option></select></label>
   <label>Stat <select id="av-pbp-type"><option value="turnover">Turnover</option><option value="steal">Steal</option><option value="assist">Assist</option><option value="offensive_rebound">Offensive rebound</option><option value="defensive_rebound">Defensive rebound</option><option value="block">Block</option><option value="foul">Foul</option><option value="free_throw">Free throw</option></select></label>
   <label id="av-pbp-player-row">Player <select id="av-pbp-player"></select></label>
   <label id="av-pbp-result-row" hidden>Result <select id="av-pbp-result"><option value="true">MADE</option><option value="false">MISSED</option></select></label>
   <label>Link to <select id="av-pbp-parent"></select></label>
   <p id="av-pbp-status" role="status"></p><footer><button type="button" id="av-pbp-insert-save">Save event</button><button type="button" id="av-pbp-insert-cancel">Cancel</button></footer></form>`;
  document.body.append(insertDialog);
  let insertionBefore=null,insertionPeriod=null,insertBusy=false;
  function populateInsert(before=null){
    insertionBefore=before;
    const all=api.getEvents();
    const quarter=$('av-cn-shot-filter')?.value;
    insertionPeriod=quarter&&quarter!=='all'?Number(quarter):Number(api.getPeriod());
    const parent=$('av-pbp-parent');parent.replaceChildren(new Option('No link',''));
    for(const e of all.filter(x=>Number(x.period)===insertionPeriod)){
      parent.add(new Option(`${e.team==='us'?'Tracked':'Opponent'} · ${e.type.replaceAll('_',' ')} · ${String(e.id).slice(0,6)}`,e.id));
    }
    const player=$('av-pbp-player');player.replaceChildren(new Option('SKIP (unassigned)',''),
      ...(api.getPlayers?.()||[]).map(p=>new Option('#'+(p.number??'?'),p.id)));
    $('av-pbp-type').value='turnover';$('av-pbp-team').value='us';$('av-pbp-result').value='true';
    $('av-pbp-status').textContent='';refreshInsert();insertDialog.showModal();
  }
  function refreshInsert(){
    $('av-pbp-player-row').hidden=$('av-pbp-team').value!=='us';
    $('av-pbp-result-row').hidden=$('av-pbp-type').value!=='free_throw';
  }
  $('av-pbp-team').addEventListener('change',refreshInsert);
  $('av-pbp-type').addEventListener('change',refreshInsert);
  $('av-pbp-insert-cancel').addEventListener('click',()=>insertDialog.close());
  $('av-pbp-insert-save').addEventListener('click',async()=>{
    if(insertBusy)return;insertBusy=true;$('av-pbp-insert-save').disabled=true;
    try{
      const saved=await supabaseClient.rpc('apexvision_postgame_insert_review_event',{
        p_game_id:api.gameId,p_event_id:crypto.randomUUID(),p_type:$('av-pbp-type').value,
        p_team:$('av-pbp-team').value,p_period:insertionPeriod,
        p_player_id:$('av-pbp-team').value==='us'?($('av-pbp-player').value||null):null,
        p_made:$('av-pbp-type').value==='free_throw'?$('av-pbp-result').value==='true':null,
        p_linked_event_id:$('av-pbp-parent').value||null,
        p_before_event_id:insertionBefore
      });
      if(saved.error)throw saved.error;
      insertDialog.close();await api.refresh();await reloadOrder();renderReview();
      window.dispatchEvent(new CustomEvent('apex:postgame-events-updated'));
      api.notify('Inserted event saved.');
    }catch(err){$('av-pbp-status').textContent='Not saved: '+(err.message||err);}
    finally{insertBusy=false;$('av-pbp-insert-save').disabled=false;}
  });
  review.querySelector('#av-pbp-add').addEventListener('click',()=>populateInsert());

  function renderReview() {
    if (typeof api?.getEvents !== 'function') return;
    const events = api.getEvents() || [];
    const players = api.getPlayers?.() || [];
    const team = events.filter(e => e.team === 'us');
    const table = $('av-cn-box-table'); table.replaceChildren();
    const columns = ['Player',...statKeys];
    const head = document.createElement('thead');
    const header = document.createElement('tr');
    for (const name of columns) { const th = document.createElement('th'); th.textContent = name; header.append(th); }
    head.append(header); table.append(head);
    const body = document.createElement('tbody');
    const addRow = (name, s) => {
      const tr = document.createElement('tr');
      for (const v of [name,...statKeys.map(k => s[k])]) {
        const td = document.createElement('td'); td.textContent = String(v); tr.append(td);
      }
      body.append(tr);
    };
    for (const p of players) {
      const name = `#${p.number ?? '?'} ${[p.first_name,p.last_name].filter(Boolean).join(' ')}`.trim();
      addRow(name, getStats(team.filter(e => String(e.player_id) === String(p.id))));
    }
    addRow('TEAM TOTAL', getStats(team)); table.append(body);
    // Opponent has team-level stats only; do not invent player attribution.
    
    // Opponent team Box Score — regular table.
    const opponent = events.filter(e => e.team === 'opponent');
    const oppStats = getStats(opponent);

    $('av-cn-opponent-heading').textContent =
      (api.getGame?.()?.opponent || 'Opponent') + ' — Team Box Score';

    const oppContainer = $('av-cn-opponent-table');
    oppContainer.replaceChildren();

    // Keep the existing table element when present.
    const oppTable = oppContainer.tagName === 'TABLE'
      ? oppContainer
      : document.createElement('table');

    if (oppTable !== oppContainer) {
      oppContainer.appendChild(oppTable);
    }

    const oppHead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    for (const key of statKeys) {
      const th = document.createElement('th');
      th.textContent = key;
      headerRow.appendChild(th);
    }

    oppHead.appendChild(headerRow);
    oppTable.appendChild(oppHead);

    const oppBody = document.createElement('tbody');
    const statRow = document.createElement('tr');

    for (const key of statKeys) {
      const td = document.createElement('td');
      td.textContent = String(oppStats[key] ?? 0);
      statRow.appendChild(td);
    }

    oppBody.appendChild(statRow);
    oppTable.appendChild(oppBody);

    // Each team has its own per-quarter foul summary beneath its own Box Score.
    const totalPeriods = Math.max(
      4,
      ...events.map(e => Number(e.period) || 1)
    );

    for(const [target,teamName] of [['av-cn-tracked-fouls','us'],['av-cn-opponent-fouls','opponent']]){
      const foulContainer=$(target);
      if(!foulContainer)continue;
      foulContainer.replaceChildren();
      const heading=document.createElement('strong');heading.textContent='Team fouls by quarter';
      heading.className='av-cn-foul-label';foulContainer.append(heading);
      for(let i=1;i<=totalPeriods;i++){
        const count=events.filter(e=>e.team===teamName&&e.type==='foul'&&Number(e.period)===i).length;
        const label=document.createElement('span');
        label.textContent=`${i<=4?'Q'+i:'OT'+(i-4)}: ${count}`;
        foulContainer.append(label);
      }
    }

    
const selectedQuarter = $('av-cn-shot-filter')?.value;
const showAll = selectedQuarter === 'all';

const period = Number(
  selectedQuarter && !showAll
    ? selectedQuarter
    : (api.getPeriod?.() || $('post-period')?.value || 1)
);

const q = showAll
  ? 'All'
  : period <= 4 ? `Q${period}` : `OT${period - 4}`;

$('av-cn-period').textContent = q;

const list = $('av-cn-play-list');
list.replaceChildren();


const plays = events
  .filter(e => showAll || Number(e.period) === period)
  .slice()
  .sort((a, b) => {
    // In All view, group quarters in chronological order.
    if (showAll) {
      const quarterDifference =
        (Number(b.period) || 1) - (Number(a.period) || 1);

      if (quarterDifference !== 0) {
        return quarterDifference;
      }
    }

    // Keep the existing newest-first ordering within each quarter.
    return sequenceSort(a,b);
  });

    if (!plays.length) { const p = document.createElement('p'); p.textContent = `No recorded events for ${q}.`; list.append(p); }
    const byId = new Map(events.map(e => [String(e.id),e]));
    // Free throws are stored individually but displayed under their parent foul.
    // Build attempt labels from the entire game to preserve numbering.
    const ftSequences = new Map();
    for (const e of events) {
      if (e.type !== 'free_throw' || !e.linked_event_id) continue;
      const key = [e.linked_event_id, e.period, e.team, e.player_id ?? 'unknown'].join('|');
      if (!ftSequences.has(key)) ftSequences.set(key, []);
      ftSequences.get(key).push(e);
    }
    const ftLabels = new Map();
    for (const sequence of ftSequences.values()) {
      sequence.sort((a, b) =>
        String(a.created_at || '').localeCompare(String(b.created_at || '')) ||
        String(a.id || '').localeCompare(String(b.id || ''))
      );
      sequence.forEach((attempt, index) => {
        ftLabels.set(String(attempt.id), `FT ${index + 1} of ${sequence.length}`);
      });
    }
    const grouped = new Map();
    for(const e of plays){
      // Group linked FTs and turnovers with the originating foul/play.
      const linked = e.linked_event_id && byId.get(String(e.linked_event_id));
      if(linked && linked!==e && Number(linked.period)===Number(e.period)){
        if(!grouped.has(linked.id))grouped.set(linked.id,[]);
        grouped.get(linked.id).push(e);
      }
    }
    // Shooting-foul shots may precede their foul in save order: use explicit
    // foul/shot association rather than pretending the basket was entered twice.
    for(const foul of plays.filter(x=>x.type==='foul'&&x.foul_shot_id)){
      const shot=byId.get(String(foul.foul_shot_id));
      if(shot && Number(shot.period)===Number(foul.period)){
        if(!grouped.has(foul.id))grouped.set(foul.id,[]);
        if(!grouped.get(foul.id).some(e=>String(e.id)===String(shot.id)))grouped.get(foul.id).unshift(shot);
      }
    }
    const childIds=new Set([...grouped.values()].flat().map(e=>String(e.id)));
    const teamName=api.getGame?.()?.team_name||'Tracked team';
    const name=e=>{
      const p=players.find(x=>String(x.id)===String(e.player_id));
      return (e.team==='opponent'?(api.getGame?.()?.opponent||'Opponent'):teamName)+
        (p?' #'+(p.number??'?'):'');
    };
    const action=e=>{
      if(e.type==='shot'){
        const nx=Number(e.x),ny=Number(e.y);
        const distance=Number.isFinite(nx)&&Number.isFinite(ny)&&e.x!=null&&e.y!=null
          ? `${(Math.hypot(nx-(nx<430?57.25:802.75),ny-235)/30*3.28084).toFixed(1)} ft · ` : '';
        return `${distance}${e.points}PT ${e.made?'MADE':'MISS'}`;
      }
      if(e.type==='free_throw')return `${ftLabels.get(String(e.id)) || 'FT'} ${e.made?'MADE':'MISS'}`;
      if(e.type==='foul')return ({shooting:'Shooting foul',nonshooting:'Non-shooting foul',
        offensive:'Offensive foul',technical:'Technical foul'})[e.foul_class]||'Foul (classification unavailable)';
      return ({assist:'AST',offensive_rebound:'OREB',defensive_rebound:'DREB',
        team_offensive_rebound:'TEAM OREB',team_defensive_rebound:'TEAM DREB',
        steal:'STL',turnover:'TO',block:'BLK'})[e.type]||String(e.type||'EVENT').toUpperCase();
    };
    // Calculate cumulative score in chronological order, excluding non-counting
    // missed-foul attempts (which score zero regardless).
    const gameChronological=events.slice().sort((a,b)=>{
      const p=(Number(a.period)||1)-(Number(b.period)||1);
      return p||(-sequenceSort(a,b));
    });
    let tallyUs=0,tallyOpp=0;
    const scoreAfter=new Map();
    for(const event of gameChronological){
      const n=pointsFor(event);
      if(event.team==='us')tallyUs+=n;else if(event.team==='opponent')tallyOpp+=n;
      scoreAfter.set(String(event.id),[tallyUs,tallyOpp]);
    }
    for(const e of plays){
      if(childIds.has(String(e.id)))continue;
      const item=document.createElement('div');item.className='av-cn-play';
      item.dataset.rootId=String(e.id);
      item.dataset.period=String(e.period);
      const line=document.createElement('div');line.className='av-pbp-line';
      const handle=document.createElement('button');handle.type='button';handle.className='av-pbp-handle';
      handle.textContent='⠿';handle.title='Drag to reorder play';handle.setAttribute('aria-label','Drag to reorder play');
      handle.draggable=orderReady;
      handle.title=orderReady?'Drag to reorder within this quarter':'Play ordering requires the Play-by-Play database migration';
      handle.addEventListener('dragstart',ev=>{if(!handle.draggable){ev.preventDefault();return;}dragId=String(e.id);ev.dataTransfer?.setData('text/plain',dragId);if(ev.dataTransfer)ev.dataTransfer.effectAllowed='move';});
      item.addEventListener('dragstart',ev=>{if(ev.target===handle)return;ev.preventDefault();});
      handle.addEventListener('dragend',()=>{dragId=null;});
      item.addEventListener('dragover',ev=>{if(dragId&&dragId!==String(e.id)){const from=list.querySelector('.av-cn-play[data-root-id=\"'+CSS.escape(dragId)+'\"]');if(from?.dataset.period===item.dataset.period)ev.preventDefault();}});
      item.addEventListener('drop',ev=>{ev.preventDefault();
        if(!dragId||dragId===String(e.id))return;
        const moving=list.querySelector('.av-cn-play[data-root-id="'+CSS.escape(dragId)+'"]');
        if(!moving || moving.dataset.period!==item.dataset.period)return;
        list.insertBefore(moving,item);dragId=null;void commitOrder();
      });
      // Keep the reorder grip at the far right; the three-dot menu sits before it.
      // A touch grip moves the same complete play row as HTML drag on desktop.
      let touchMove=false, touchOriginY=0;
      handle.addEventListener('pointerdown', ev=>{
        if(!orderReady || ev.pointerType==='mouse')return;
        ev.preventDefault();touchMove=false;touchOriginY=ev.clientY;
        dragId=String(e.id);handle.setPointerCapture(ev.pointerId);
        item.classList.add('av-pbp-moving');
      });
      handle.addEventListener('pointermove',ev=>{
        if(dragId!==String(e.id) || !handle.hasPointerCapture(ev.pointerId))return;
        if(Math.abs(ev.clientY-touchOriginY)>5)touchMove=true;
        if(!touchMove)return;
        const over=document.elementFromPoint(ev.clientX,ev.clientY)?.closest('.av-cn-play[data-root-id]');
        if(!over || over===item || over.parentNode!==list || over.dataset.period!==item.dataset.period)return;
        const rect=over.getBoundingClientRect();
        list.insertBefore(item,ev.clientY>rect.top+rect.height/2?over.nextSibling:over);
      });
      const endTouch=ev=>{
        if(dragId!==String(e.id))return;
        if(handle.hasPointerCapture(ev.pointerId))handle.releasePointerCapture(ev.pointerId);
        dragId=null;item.classList.remove('av-pbp-moving');
        if(touchMove && ev.type==='pointerup')void commitOrder();
      };
      handle.addEventListener('pointerup',endTouch);
      handle.addEventListener('pointercancel',endTouch);
      let children=grouped.get(e.id)||[];
      // Fold nested children (e.g. rebound after FT 2/2) into the same play.
      const seenChildren=new Set(children.map(c=>String(c.id)));
      const queue=[...children];
      while(queue.length){
        const next=queue.shift();
        for(const nested of grouped.get(next.id)||[]){
          if(!seenChildren.has(String(nested.id))){
            seenChildren.add(String(nested.id));children.push(nested);queue.push(nested);
          }
        }
      }
      children=children.slice().sort((a,b)=>String(a.created_at||'').localeCompare(String(b.created_at||'')));
      // Turnover is the primary PBP event even when a steal was saved first.
      const turnoverChild=e.type==='steal'?children.find(c=>c.type==='turnover'):null;
      const primaryEvent=turnoverChild||e;
      if(turnoverChild)children=[e,...children.filter(c=>c!==turnoverChild)];
      const primary=document.createElement('span');
      const eventPeriod = Number(primaryEvent.period) || 1;
const eventQuarter = eventPeriod <= 4
  ? `Q${eventPeriod}`
  : `OT${eventPeriod - 4}`;

const shootingShot=e.type==='foul' && e.foul_class==='shooting'
  ? children.find(c=>c.type==='shot') : null;
primary.textContent=shootingShot
  ? `${eventQuarter} · ${name(shootingShot)} ${shootingShot.made?'made':'missed'} ${shootingShot.points}PT${shootingShot.made?' (And-One)':''} — Shooting foul on ${name(e)}`
  : `${eventQuarter} · ${name(primaryEvent)} — ${action(primaryEvent)}`;
      const details=document.createElement('div');details.className='av-pbp-details';
      details.append(primary);
      for(const child of children){
        if(shootingShot && String(child.id)===String(shootingShot.id))continue;
        if(child.out_of_bounds){
          const possession=document.createElement('span');possession.className='av-cn-linked';
          possession.textContent=`↳ Out of bounds — ${name(child)} ball`;
          details.append(possession);
        }
        const linked=document.createElement('span');linked.className='av-cn-linked';
        linked.textContent=`↳ ${name(child)} — ${action(child)}`;
        details.append(linked);
      }
      line.append(details);
      const score=document.createElement('strong');score.className='av-pbp-running-score';
      const result=scoreAfter.get(String(e.id))||[0,0];
      score.textContent=result.join('–');score.title='Tracked score after this event (tracked–opponent)';
      line.append(score);
      const more=document.createElement('details');more.className='av-pbp-more';
      const summary=document.createElement('summary');summary.textContent='⋮';summary.title='Play options';
      summary.setAttribute('aria-label','Play options');more.append(summary);
      const menu=document.createElement('div');menu.className='av-pbp-menu';
      // One compact entry for both editing existing branch events and adding links.
      // The second-level choices only appear if that action is selected.
      const fillMainMenu=()=>{
        menu.replaceChildren();
        menu.append(menuAction('Edit / link events',()=>{
          menu.replaceChildren();
          menu.append(menuAction('← Back to options',fillMainMenu));
          for(const target of [primaryEvent,...children]){
            menu.append(menuAction('Edit '+target.type.replaceAll('_',' '),()=>{
              more.open=false;
              window.dispatchEvent(new CustomEvent('apex:edit-event',{detail:{id:target.id}}));
            }));
          }
          menu.append(menuAction('+ Add linked event',()=>{
            more.open=false;
            populateInsert();
            $('av-pbp-parent').value=String(e.id);
          }));
        }));
        menu.append(menuAction('Insert before',()=>{more.open=false;populateInsert(String(e.id));}));
        menu.append(menuAction('Insert after',()=>{
          more.open=false;
          const next=item.nextElementSibling?.dataset.rootId||null;
          populateInsert(next);
        }));
        menu.append(menuAction('Delete / review links',()=>{
          more.open=false;
          window.dispatchEvent(new CustomEvent('apex:edit-event',{detail:{id:primaryEvent.id}}));
        }));
      };
      fillMainMenu();
      more.addEventListener('toggle',()=>{
        if(more.open){
          // Only one menu can be open; keep it above the other rows.
          list.querySelectorAll('.av-pbp-more[open]').forEach(other=>{
            if(other!==more)other.open=false;
          });
          item.classList.add('av-pbp-menu-active');
          fillMainMenu();
        }else item.classList.remove('av-pbp-menu-active');
      });
      more.append(menu);
      line.append(more);
      line.append(handle);
      item.append(line);
      list.append(item);
    }

  }
  // Dismiss an open event menu by tapping anywhere outside that menu.
  // This also prevents multiple stacked menus and obscured three-dot triggers.
  document.addEventListener('pointerdown',ev=>{
    const list=$('av-cn-play-list');
    if(!list || ev.target.closest?.('.av-pbp-more'))return;
    list.querySelectorAll('.av-pbp-more[open]').forEach(openMenu=>openMenu.open=false);
  },true);
  document.addEventListener('keydown',ev=>{
    if(ev.key!=='Escape')return;
    $('av-cn-play-list')?.querySelectorAll('.av-pbp-more[open]').forEach(openMenu=>openMenu.open=false);
  });
  function showPage(name) {
    const open = name === 'review';
    // Update the active page indicator
const dots = pageIndicator.querySelectorAll('.av-cn-dot');

dots[0].classList.toggle('active', !open);
dots[1].classList.toggle('active', open);
    review.hidden = !open;
    shot.hidden = open;
    document.body.classList.toggle('av-cn-review-open', open);
    review.setAttribute('aria-hidden', String(!open));
    setMenu(false);
    if (open) { void reloadOrder().then(renderReview); }
  }
  // Swipe LEFT from tracking to details; RIGHT from details to tracking.
  // Capture on document so a court/Quick Track child cannot interrupt the gesture.
  // A touch can be cancelled by browser gestures; keep touch and mouse separate.
  const gestureThreshold = 65;
  let touchStart = null;
  let mouseStart = null;
  const blocked = target => target instanceof Element && !!target.closest(
    'button, input, select, textarea, dialog, a, [contenteditable="true"], #av-cn-more-panel'
  );
  function eligible(target) {
    // Only start on the current content pane, not the fixed header/toolbar.
    const pane = review.hidden ? shot : review;
    return pane.contains(target) && !blocked(target);
  }
  function finishSwipe(start, x, y) {
    if (!start) return;
    const dx = x - start.x, dy = y - start.y;
    if (Math.abs(dx) < gestureThreshold || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    if (start.page === 'tracking' && review.hidden && dx < 0) showPage('review');
    if (start.page === 'review' && !review.hidden && dx > 0) showPage('tracking');
  }
  document.addEventListener('touchstart', event => {
    touchStart = null;
    if (event.touches.length !== 1 || !eligible(event.target)) return;
    const t = event.touches[0];
    touchStart = { x:t.clientX, y:t.clientY, page:review.hidden ? 'tracking' : 'review' };
  }, { capture:true, passive:true });
  document.addEventListener('touchend', event => {
    const start = touchStart;
    touchStart = null;
    if (!start || !event.changedTouches.length) return;
    const t = event.changedTouches[0];
    finishSwipe(start, t.clientX, t.clientY);
  }, { capture:true, passive:true });
  document.addEventListener('touchcancel', () => { touchStart = null; }, { capture:true, passive:true });

  // Desktop mouse-drag and Chrome device-emulation pointer fallback.
  document.addEventListener('pointerdown', event => {
    mouseStart = null;
    if (event.pointerType !== 'mouse' || event.button !== 0 || !eligible(event.target)) return;
    mouseStart = { x:event.clientX, y:event.clientY, page:review.hidden ? 'tracking' : 'review' };
  }, true);
  document.addEventListener('pointerup', event => {
    const start = mouseStart;
    mouseStart = null;
    if (start) finishSwipe(start, event.clientX, event.clientY);
  }, true);
  document.addEventListener('pointercancel', () => { mouseStart = null; }, true);

  // Keyboard accessibility, plus a way to test navigation independent of gestures.
  window.apexCombinedNavigation = Object.freeze({
    openDetails: () => showPage('review'),
    openTracking: () => showPage('tracking')
  });
  function scheduleMount() { requestAnimationFrame(() => requestAnimationFrame(mount)); }
  window.addEventListener('apex:postgame-ready', scheduleMount);
  window.addEventListener('resize', scheduleMount);
  window.addEventListener('apex:postgame-events-updated',()=>{if(!review.hidden)void reloadOrder().then(renderReview);});
  window.addEventListener('apex:shot-view-change', () => {
  if (!review.hidden) renderReview();
});
  $('post-period')?.addEventListener('change', () => { if (!review.hidden) renderReview(); });
  scheduleMount();
})();
