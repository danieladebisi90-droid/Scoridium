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
    </section>
    <section id="av-cn-plays" class="av-cn-card av-cn-plays-card" aria-label="Play-by-Play">
      <div class="av-cn-review-heading"><h3>Play-by-Play</h3><span id="av-cn-period">Q1</span></div>
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
        s.FGA++; if (pts === 3) s['3PA']++;
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

    const period = Number(api.getPeriod?.() || $('post-period')?.value || 1);
    const q = period <= 4 ? `Q${period}` : `OT${period - 4}`;
    $('av-cn-period').textContent = q;
    const list = $('av-cn-play-list'); list.replaceChildren();
    const plays = events.filter(e => Number(e.period) === period).slice()
      .sort((a,b) => String(b.created_at || b.id || '').localeCompare(String(a.created_at || a.id || '')));
    if (!plays.length) { const p = document.createElement('p'); p.textContent = `No recorded events for ${q}.`; list.append(p); }
    const byId = new Map(plays.map(e => [String(e.id),e]));
    const grouped = new Map();
    for(const e of plays){
      const linked = e.linked_event_id && byId.get(String(e.linked_event_id));
      if(linked && linked!==e){
        if(!grouped.has(linked.id))grouped.set(linked.id,[]);
        grouped.get(linked.id).push(e);
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
      if(e.type==='shot')return `${e.points}PT ${e.made?'MADE':'MISS'}`;
      if(e.type==='free_throw')return `FT ${e.made?'MADE':'MISS'}`;
      return ({assist:'AST',offensive_rebound:'OREB',defensive_rebound:'DREB',
        team_offensive_rebound:'TEAM OREB',team_defensive_rebound:'TEAM DREB',
        steal:'STL',turnover:'TO',block:'BLK',foul:'PF'})[e.type]||String(e.type||'EVENT').toUpperCase();
    };
    for(const e of plays){
      if(childIds.has(String(e.id)))continue;
      const item=document.createElement('div');item.className='av-cn-play';
      let children=grouped.get(e.id)||[];
      // Turnover is the primary PBP event even when a steal was saved first.
      const turnoverChild=e.type==='steal'?children.find(c=>c.type==='turnover'):null;
      const primaryEvent=turnoverChild||e;
      if(turnoverChild)children=[e,...children.filter(c=>c!==turnoverChild)];
      const primary=document.createElement('span');primary.textContent=`${q} · ${name(primaryEvent)} — ${action(primaryEvent)}`;
      item.append(primary);
      if(children.length){
        const linked=document.createElement('span');linked.className='av-cn-linked';
        linked.textContent=' ('+children.map(c=>`${name(c)} — ${action(c)}`).join(', ')+')';
        item.append(linked);
      }
      list.append(item);
    }

  }
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
    if (open) renderReview();
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
  window.addEventListener('apex:postgame-events-updated', () => { if (!review.hidden) renderReview(); });
  $('post-period')?.addEventListener('change', () => { if (!review.hidden) renderReview(); });
  scheduleMount();
})();
