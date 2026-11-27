/* ApexVision printable coaches game report. Read-only; Save as PDF through browser print. */
(() => {
'use strict';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>Number.isFinite(Number(x))?Number(x):0;
const percent=(m,a)=>n(a)?(n(m)/n(a)*100).toFixed(1)+'%':'—';
const td=x=>'<td>'+esc(x)+'</td>';
const teamOf=s=>['opponent','them','away'].includes(String(s.team||'').toLowerCase())?'opponent':'us';
const color=(key,fallback)=>{
  const css=getComputedStyle(document.body).getPropertyValue(key).trim()||
            getComputedStyle(document.documentElement).getPropertyValue(key).trim();
  return /^#[0-9a-f]{3,8}$/i.test(css)?css:fallback;
};
const row=(name,a,b)=>'<tr><th>'+esc(name)+'</th>'+td(a)+td(b)+'</tr>';

window.apexOpenCoachesReport=function({game,tracked,opponent,fullCourt,offenseCourt,defenseCourt}={}){
  if(!game||!tracked||!opponent)return;
  const win=window.open('','_blank');
  if(!win){alert('Allow pop-ups to open the coaches report.');return;}
  const blue=color('--team-primary','#233f85'),accent=color('--team-secondary','#b47b38');
  const us=esc(game.team||'Tracked Team'),them=esc(game.opponent||'Opponent');
  const players=Array.isArray(game.players)?game.players:[];
  const shots=Array.isArray(game.shots)?game.shots:[];
  const quarters=Array.isArray(game.quarters)?game.quarters:[];
  const observed=Boolean(opponent.observed);
  const leader=field=>{
    const player=players.reduce((best,p)=>!best||n(p[field])>n(best[field])?p:best,null);
    return player?'#'+esc(player.number||'?')+' '+esc(player.name||'Player')+' · '+n(player[field]):'Not recorded';
  };
  const playerRows=players.map(p=>'<tr>'+
    [('#'+(p.number||'?')+' '+(p.name||'')),p.pts,p.fgm+'-'+p.fga,p.threeMade+'-'+p.threeAtt,
      p.ftm+'-'+p.fta,p.reb,p.ast,p.stl,p.blk,p.tov,p.pf].map(td).join('')+'</tr>').join('');
  const total=(name,t)=>'<tr class="total"><th>'+esc(name)+'</th>'+
    [t.pts,t.fgm+'-'+t.fga,t.threeMade+'-'+t.threeAtt,t.ftm+'-'+t.fta,
      t.reb,t.ast,t.stl,t.blk,t.tov,t.pf].map(td).join('')+'</tr>';
  const comparisons=[
    ['Points',game.ourScore,game.opponentScore],
    ['Field goals',tracked.fgm+' / '+tracked.fga,observed?opponent.fgm+' / '+opponent.fga:'Not tracked'],
    ['FG%',percent(tracked.fgm,tracked.fga),observed?percent(opponent.fgm,opponent.fga):'Not tracked'],
    ['Three-pointers',tracked.threeMade+' / '+tracked.threeAtt,observed?opponent.threeMade+' / '+opponent.threeAtt:'Not tracked'],
    ['3PT%',percent(tracked.threeMade,tracked.threeAtt),observed?percent(opponent.threeMade,opponent.threeAtt):'Not tracked'],
    ['Free throws',tracked.ftm+' / '+tracked.fta,observed?opponent.ftm+' / '+opponent.fta:'Not tracked'],
    ['FT%',percent(tracked.ftm,tracked.fta),observed?percent(opponent.ftm,opponent.fta):'Not tracked'],
    ['Rebounds',tracked.reb,observed?opponent.reb:'Not tracked'],
    ['Offensive / Defensive REB',tracked.oreb+' / '+tracked.dreb,observed?opponent.oreb+' / '+opponent.dreb:'Not tracked'],
    ['Assists',tracked.ast,observed?opponent.ast:'Not tracked'],
    ['Steals',tracked.stl,observed?opponent.stl:'Not tracked'],
    ['Blocks',tracked.blk,observed?opponent.blk:'Not tracked'],
    ['Turnovers',tracked.tov,observed?opponent.tov:'Not tracked'],
    ['Fouls',tracked.pf,observed?opponent.pf:'Not tracked']
  ];
  const allRows=comparisons.map(a=>row(a[0],a[1],a[2])).join('');
  const quarterRows=quarters.map((q,i)=>row(i<4?'Q'+(i+1):'OT'+(i-3),q.us,q.opponent)).join('');
  const title='ApexVision Coaches Report - '+(game.team||'Team')+' vs '+(game.opponent||'Opponent');
  const date=esc(game.date||'');
  const header='<div class="head"><div><div class="brand">APEXVISION.</div><div class="subbrand">COACHES GAME REPORT</div></div>'+
    '<div class="header-meta">'+date+'<br>'+esc(game.location||'')+'</div></div>';
  const footer=(page,section)=>'<footer>APEXVISION · Detailed Coaches Report <span>'+page+' / 3 · '+section+'</span></footer>';
  const tableHead='<thead><tr><th>Player / Team</th><th>PTS</th><th>FG</th><th>3PT</th><th>FT</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>PF</th></tr></thead>';
  const style=[
    ':root{--team-primary:'+blue+';--team-secondary:'+accent+';--primary:'+blue+';--ink:#182b48;--line:#dbe3ed;--muted:#536987}',
    '*{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:var(--ink);background:#dce4ee;margin:0}',
    '.toolbar{position:sticky;top:0;background:#10213e;color:white;z-index:10;padding:12px 25px;display:flex;justify-content:space-between;align-items:center}',
    '.toolbar button{background:var(--primary);color:white;border:1px solid white;padding:10px 18px;border-radius:8px;cursor:pointer;font-weight:800}',
    '.page{background:white;width:277mm;min-height:190mm;margin:16px auto;padding:12mm 14mm;box-shadow:0 2px 15px #8899ad55;break-after:page;overflow:hidden}',
    '.page:last-child{break-after:auto}.head{display:flex;justify-content:space-between;border-bottom:4px solid var(--primary);padding-bottom:11px;margin-bottom:15px}',
    '.brand{font-size:20px;font-weight:900;color:var(--primary);letter-spacing:1px}.subbrand{font-size:10px;letter-spacing:2px;color:var(--muted);font-weight:800}',
    '.header-meta{text-align:right;font-size:11px;color:var(--muted);line-height:1.7}h1{color:var(--primary);font-size:23px;margin:0 0 13px}h2{color:var(--primary);font-size:15px;margin:0 0 10px}',
    '.scoreboard{display:grid;grid-template-columns:1fr 90px 1fr;align-items:center;background:#f2f6fc;border:1px solid var(--line);border-radius:10px;padding:16px;margin-bottom:16px}',
    '.scoreboard div{text-align:center}.scoreboard b{display:block;font-size:16px}.scoreboard strong{font-size:37px;color:var(--primary)}.scoreboard small{font-weight:900;color:var(--muted)}',
    '.cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}.panel{padding:12px;border:1px solid var(--line);border-radius:9px;margin-bottom:15px;break-inside:avoid}',
    'table{border-collapse:collapse;width:100%;font-size:11px}th,td{padding:7px 8px;border-bottom:1px solid var(--line);text-align:right}th:first-child,td:first-child{text-align:left}',
    'thead th{background:#e9eff8;color:var(--primary);font-weight:800}tbody tr:nth-child(even){background:#f7f9fc}tr.total{background:#e0ebf9;font-weight:800}',
    '.leaders{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.leader{padding:11px;background:#f0f4fa;border-radius:8px}.leader small{display:block;font-size:10px;color:var(--muted)}.leader b{display:block;font-size:12px;margin-top:5px}',
    '.boxscore{font-size:10px}.boxscore td,.boxscore th{padding:8px 6px}',
    'body > section.page:first-of-type .panel{padding:9px;margin-bottom:10px}body > section.page:first-of-type th,body > section.page:first-of-type td{padding:4px 7px;font-size:10px}body > section.page:first-of-type .scoreboard{padding:10px;margin-bottom:10px}body > section.page:first-of-type .leader{padding:8px}',
    '.court-card{border:1px solid var(--line);border-radius:9px;padding:10px;margin:0 auto 14px;break-inside:avoid}',
    '.court-card h2{margin:0 0 9px}.court-card svg{display:block;width:100%;height:auto;max-height:100%}.court-card.full{max-width:850px}.court-card.full svg{max-height:74mm;width:auto;max-width:100%;margin:auto}',
    '.halves{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.halves .court-card svg{max-height:65mm;width:auto;max-width:100%;margin:auto}',
    '.small{font-size:10px;color:var(--muted);line-height:1.4}.legend{font-size:11px;text-align:center;margin:9px 0 0}',
    'footer{border-top:1px solid var(--line);padding-top:8px;margin-top:12px;font-size:10px;color:var(--muted)}footer span{float:right}',
    '@page{size:A4 landscape;margin:0}@media print{html,body{width:297mm;background:white}.toolbar{display:none}.page{width:297mm;min-height:210mm;height:auto;margin:0;padding:11mm 14mm;box-shadow:none;break-after:page}.page:last-child{break-after:auto}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}'
  ].join('\n');

  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>'+style+'</style></head><body>'+
    '<div class="toolbar"><span>Coaches Report · Choose <b>Save as PDF</b> in the print dialog</span><button onclick="window.print()">Print / Save PDF</button></div>'+
    '<section class="page">'+header+'<h1>Game Overview</h1>'+
    '<div class="scoreboard"><div><b>'+us+'</b><strong>'+n(game.ourScore)+'</strong></div><div><small>FINAL</small></div><div><b>'+them+'</b><strong>'+n(game.opponentScore)+'</strong></div></div>'+
    '<div class="cols"><div class="panel"><h2>Scoring by Quarter</h2><table><thead><tr><th>Period</th><th>'+us+'</th><th>'+them+'</th></tr></thead><tbody>'+
    (quarterRows||'<tr><td colspan="3">No quarter breakdown recorded</td></tr>')+
    '<tr class="total"><th>Final</th>'+td(game.ourScore)+td(game.opponentScore)+'</tr></tbody></table></div>'+
    '<div class="panel"><h2>Tracked Team Leaders</h2><div class="leaders"><div class="leader"><small>POINTS</small><b>'+leader('pts')+'</b></div><div class="leader"><small>REBOUNDS</small><b>'+leader('reb')+'</b></div><div class="leader"><small>ASSISTS</small><b>'+leader('ast')+'</b></div></div><p class="small">Player leaders are calculated only from the tracked team roster.</p></div></div>'+
    '<div class="panel"><h2>Team Comparison</h2><table><thead><tr><th>Statistic</th><th>'+us+'</th><th>'+them+'</th></tr></thead><tbody>'+allRows+'</tbody></table></div>'+
    footer('1','Overview')+'</section>'+
    '<section class="page">'+header+'<h1>Detailed Box Score</h1>'+
    '<div class="panel"><h2>'+us+' — Players & Team Totals</h2><table class="boxscore">'+tableHead+'<tbody>'+(
      playerRows||'<tr><td colspan="11">No tracked player statistics recorded</td></tr>')+
      total(game.team+' — Team Total',tracked)+
      (observed?total(game.opponent+' — Team Total',opponent):'<tr><td colspan="11">No opponent statistics recorded</td></tr>')+
      '</tbody></table><p class="small">Team-level events (including team rebounds) are included in team totals. Opponent data is team-level only.</p></div>'+
    '<div class="panel"><h2>Shooting Breakdown</h2><table><thead><tr><th>Statistic</th><th>'+us+'</th><th>'+them+'</th></tr></thead><tbody>'+
    comparisons.filter(a=>['Field goals','FG%','Three-pointers','3PT%','Free throws','FT%'].includes(a[0])).map(a=>row(a[0],a[1],a[2])).join('')+
    '</tbody></table></div>'+footer('2','Box Score')+'</section>'+
    '<section class="page">'+header+'<h1>Shot Location Analysis</h1>'+
    '<div class="court-card full"><h2>Full Court · Both Teams</h2>'+(fullCourt||'<p>No shots recorded</p>')+
    '<div class="legend">● Made &nbsp; ○ Missed · Markers use team colours</div></div>'+
    '<div class="halves"><div class="court-card"><h2>Offence · '+us+'</h2>'+
    '<p class="small">'+shots.filter(s=>teamOf(s)==='us').length+' recorded shot locations</p>'+
    (offenseCourt||'<p>No shots recorded</p>')+'</div><div class="court-card"><h2>Defence · '+them+'</h2>'+
    '<p class="small">'+shots.filter(s=>teamOf(s)==='opponent').length+' recorded opponent shots</p>'+
    (defenseCourt||'<p>No shots recorded</p>')+'</div></div>'+
    '<p class="small">Half courts display actual shot markers (filled = made; open = missed), without zone percentages or overlays.</p>'+
    footer('3','Shot Maps')+'</section></body></html>';

  win.document.open();win.document.write(html);win.document.close();win.focus();
};
})();