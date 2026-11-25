/* Mobile-only next team event; uses the same games and team_events tables as Game Hub. */
(() => {
  const title = document.getElementById('dashboard-mobile-event-title');
  const detail = document.getElementById('dashboard-mobile-event-details');
  if (!title || !detail) return;
  let request = 0;
  const dateKey = date => [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
  const toLabel = key => {
    const [y,m,d] = key.split('-').map(Number);
    return new Date(y,m-1,d).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
  };
  async function refresh() {
    const token = ++request;
    const team = sessionStorage.getItem('selectedTeamId');
    const season = sessionStorage.getItem('selectedSeasonId');
    if (!team || !season || typeof supabaseClient === 'undefined') {
      title.textContent = 'No team schedule selected';
      detail.textContent = 'Select a team and season to see upcoming events.';
      return;
    }
    title.textContent = 'Loading schedule…';
    detail.textContent = '';
    const today = dateKey(new Date());
    const [gameResult, eventResult] = await Promise.all([
      supabaseClient.from('games').select('*').eq('team_id',team).eq('seasons_id',season).gte('date',today).order('date',{ascending:true}).limit(30),
      supabaseClient.from('team_events').select('*').eq('team_id',team).eq('seasons_id',season).gte('event_date',today).order('event_date',{ascending:true}).limit(30)
    ]);
    if (token !== request || team !== sessionStorage.getItem('selectedTeamId') || season !== sessionStorage.getItem('selectedSeasonId')) return;
    if (gameResult.error || eventResult.error) {
      title.textContent = 'Schedule unavailable';
      detail.textContent = 'Open Games to check your team events.';
      console.warn('Next team event query failed', gameResult.error || eventResult.error);
      return;
    }
    const entries = [
      ...(gameResult.data || []).filter(g => g.status === 'scheduled').map(g => ({ date:String(g.date||'').slice(0,10), time:g.time||'', name:'Game vs '+(g.opponent||'TBD'), type:'Game' })),
      ...(eventResult.data || []).map(e => ({ date:String(e.event_date||'').slice(0,10), time:e.event_time||e.start_time||'', name:e.title||({practice:'Practice',meeting:'Team Meeting',training:'Training'}[e.event_type]||'Team Event'), type:e.event_type||'Event' }))
    ].filter(e => /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date >= today);
    entries.sort((a,b) => a.date.localeCompare(b.date) || String(a.time).localeCompare(String(b.time)));
    if (!entries.length) {
      title.textContent = 'No upcoming team events';
      detail.textContent = 'Your next scheduled activity will appear here.';
      return;
    }
    const next = entries[0];
    title.textContent = next.name;
    detail.textContent = toLabel(next.date) + (next.time ? ' · ' + String(next.time).slice(0,5) : '') + ' · ' + next.type;
  }
  document.addEventListener('DOMContentLoaded', async () => {
    try { if (window.pageLayoutReady) await window.pageLayoutReady; await refresh(); }
    catch(error) { title.textContent = 'Schedule unavailable'; detail.textContent = 'Open Games to check your team events.'; console.warn(error); }
  });
  window.addEventListener('seasonChanged', () => { refresh().catch(console.warn); });
})();
