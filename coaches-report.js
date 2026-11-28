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
  const glance=[['FG%',percent(tracked.fgm,tracked.fga),observed?percent(opponent.fgm,opponent.fga):'—'],
    ['3PT%',percent(tracked.threeMade,tracked.threeAtt),observed?percent(opponent.threeMade,opponent.threeAtt):'—'],
    ['FT%',percent(tracked.ftm,tracked.fta),observed?percent(opponent.ftm,opponent.fta):'—'],
    ['Rebounds',tracked.reb,observed?opponent.reb:'—'],
    ['Assists',tracked.ast,observed?opponent.ast:'—'],
    ['Turnovers',tracked.tov,observed?opponent.tov:'—']];
  const glanceHTML=glance.map(([label,a,b])=>'<div class="glance-cell"><div class="glance-label">'+esc(label)+
    '</div><div class="glance-values"><strong>'+esc(a)+'</strong><span>vs</span><strong>'+esc(b)+
    '</strong></div><div class="glance-names"><small>'+us+'</small><small>'+them+'</small></div></div>').join('');
  const title='ApexVision Coaches Report - '+(game.team||'Team')+' vs '+(game.opponent||'Opponent');
  const date=esc(game.date||'');
  const header='<div class="head"><div class="brand-stack"><div class="brand"><span class="brand-mark">A</span>APEXVISION<span class="brand-dot">.</span></div><div class="subbrand">PERFORMANCE INTELLIGENCE / COACHES REPORT</div></div>'+
    '<div class="header-meta">'+date+'<br>'+esc(game.location||'')+'</div></div>';
  const footer=(page,section)=>'<footer><span class="footer-left">APEXVISION · GAME INTELLIGENCE</span><span class="footer-right">'+section.toUpperCase()+' · '+String(page).padStart(2,'0')+' / 03</span></footer>';
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
    '@page{size:A4 landscape;margin:0}@media print{html,body{width:297mm;background:white}.toolbar{display:none}.page{width:297mm;min-height:210mm;height:auto;margin:0;padding:11mm 14mm;box-shadow:none;break-after:page}.page:last-child{break-after:auto}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}',
    "\n/* Report redesign v2: print-page-safe editorial layout */\n.page{display:flex;flex-direction:column;gap:0;padding:11mm 13mm;min-height:0;height:205mm;overflow:hidden;border-radius:0}\n.page>.head{flex:0 0 auto}\n.head{padding-bottom:8px;margin-bottom:13px}\n.brand{font-size:21px;letter-spacing:1.5px}\n.subbrand{letter-spacing:2.2px}\nh1{font-size:25px;margin:0 0 10px}\nh2{font-size:14px;margin-bottom:8px}\n.panel{padding:12px 14px;margin-bottom:12px;border-radius:10px}\n.scoreboard{background:var(--primary);color:white;border:0;padding:14px 16px;margin-bottom:14px;border-radius:10px}\n.scoreboard b{font-size:17px;color:white}\n.scoreboard strong{font-size:44px;color:white;line-height:1.15}\n.scoreboard small{color:#dae4fa;letter-spacing:1px}\n.cols{gap:12px}\n.cols>.panel{margin-bottom:12px}\n.cols th,.cols td{padding:5px 8px}\n.leaders{gap:7px}\n.leader{padding:9px 8px;background:#f0f4fa}\n.leader b{font-size:12px}\n.leader small{font-size:9px;letter-spacing:.5px;font-weight:700}\n.section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px}\n.section-title h2{margin:0}\n.section-title>span{color:var(--muted);font-size:9px;font-weight:800;letter-spacing:1px}\n.glance-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}\n.glance-cell{padding:11px 12px;border:1px solid var(--line);border-radius:9px;background:#f7f9fc;min-width:0}\n.glance-label{font-weight:800;font-size:11px;color:var(--primary);margin-bottom:8px}\n.glance-values{display:flex;align-items:center;justify-content:space-between;gap:7px}\n.glance-values strong{font-size:22px;color:var(--primary);white-space:nowrap}\n.glance-values span{font-size:9px;color:var(--muted);text-transform:uppercase}\n.glance-names{display:flex;justify-content:space-between;gap:8px;color:var(--muted);font-size:9px;margin-top:5px}\n.glance-names small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:48%}\nfooter{margin-top:auto;padding-top:8px;font-size:9px;flex:0 0 auto}\n.boxscore{font-size:11px}\n.boxscore td,.boxscore th{padding:8px 7px}\n.compact-comparison td,.compact-comparison th{padding:5px 9px;font-size:10px}\n.compact-comparison tbody tr:nth-child(2n){background:#f4f7fb} .report-comparison-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;align-items:start} .report-comparison-grid>div{min-width:0} .report-comparison-grid h3{margin:0 0 6px;padding:0 1px;font-size:11px;color:var(--primary)} .report-comparison-grid table{table-layout:fixed} .report-comparison-grid th:first-child{width:48%} .report-comparison-grid th:not(:first-child){width:26%} .report-comparison-grid td,.report-comparison-grid th{padding:5px 7px;font-size:10px} .report-comparison-grid th:not(:first-child){white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.court-page h1{margin-bottom:9px}\n.court-page .court-card{margin-bottom:10px}\n.court-page .court-card.full{width:100%;max-width:none;padding:8px 11px}\n.court-page .court-card.full svg{display:block;width:100%;max-width:100%;max-height:79mm;height:auto;margin:auto}\n.court-page .halves{width:100%;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr))}\n.court-page .halves .court-card{width:100%;max-width:none;padding:10px 11px;margin-bottom:6px}\n.court-page .halves .court-card svg{display:block;max-height:71mm;height:auto;width:100%;max-width:100%;margin:auto}\n.court-page .court-card .small{margin:0 0 4px}\n.court-page .legend{margin:5px 0 0}\n.court-page>p.small{margin:3px 0 2px}\n@page{size:A4 landscape;margin:0}\n@media print{\n html,body{margin:0!important;width:297mm!important;min-width:0!important;background:white!important}\n .toolbar{display:none!important}\n .page{width:297mm!important;height:205mm!important;min-height:0!important;max-height:205mm!important;overflow:hidden!important;margin:0!important;padding:10mm 13mm!important;box-shadow:none!important;break-after:page!important;page-break-after:always!important}\n .page:last-child{break-after:auto!important;page-break-after:auto!important}\n .court-page .court-card.full svg{max-height:72mm!important}\n .court-page .halves .court-card svg{max-height:74mm!important}\n *{-webkit-print-color-adjust:exact;print-color-adjust:exact}\n}"
    ,"\n/* Coaches Report / editorial v3 */\n:root{--deep:#102038;--wash:#f6f8fb;--hairline:#e4ebf4}\nbody{font-family:Inter,Arial,Helvetica,sans-serif;color:#1c2d44;-webkit-font-smoothing:antialiased}\n.page{background:white}\n.head{align-items:center;border-bottom:1px solid var(--hairline);padding:0 0 11px;margin:0 0 12px;min-height:41px}\n.brand-stack{display:flex;flex-direction:column;gap:5px}\n.brand{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:900;color:var(--deep);letter-spacing:1.5px}\n.brand-mark{display:inline-flex;align-items:center;justify-content:center;background:var(--primary);color:white;width:28px;height:28px;border-radius:7px;font-size:18px;letter-spacing:0}\n.brand-dot{color:var(--team-secondary)}\n.subbrand{margin-left:36px;font-size:8px;letter-spacing:1.3px;color:#71849b}\n.header-meta{font-size:10px;line-height:1.8;color:#667891;font-weight:700}\n.page-title{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:11px}\n.page-title h1{font-size:25px;font-weight:900;letter-spacing:-.7px;color:var(--deep);margin:0}\n.eyebrow{margin:0 0 4px;color:var(--primary);font-size:9px;font-weight:900;letter-spacing:1.6px}\n.page-title-tag{font-size:8px;letter-spacing:1.1px;color:#748399;font-weight:800;padding-bottom:3px;white-space:nowrap}\nh2{font-size:12px;color:var(--deep);font-weight:900}\n.panel,.court-card{border:1px solid var(--hairline);border-radius:9px;box-shadow:0 1px 0 #eef2f7}\n.scoreboard{position:relative;grid-template-columns:minmax(0,1fr) 76px minmax(0,1fr);background:var(--deep);border:0;border-radius:12px;padding:13px 24px;min-height:85px;margin-bottom:12px;overflow:hidden}\n.scoreboard:before{content:\"\";position:absolute;left:0;top:0;bottom:0;width:5px;background:var(--team-secondary)}\n.scoreboard .score-team small{display:block;font-size:8px;letter-spacing:1.15px;color:#b2c2d5;margin-bottom:2px}\n.scoreboard .score-team b{font-size:15px;font-weight:900;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n.scoreboard .score-team strong{font-size:37px;font-weight:900;letter-spacing:-1px;color:#fff;line-height:1.05}\n.score-center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px}\n.score-pill{font-size:8px!important;letter-spacing:1.3px!important;font-weight:900!important;border:1px solid #ffffff66;border-radius:18px;padding:4px 10px;color:#fff!important}\n.score-separator{font-size:20px;color:#9aacc4}\nthead th{background:#eef3f9;border-bottom:1px solid #dce6f0;color:#304963;font-size:9px}\ntable{font-variant-numeric:tabular-nums}\ntbody tr:nth-child(even){background:#f7f9fc}\nth,td{border-bottom-color:#e7edf4}\ntr.total th,tr.total td{background:#eaf1fa;color:#192f50;font-weight:900;border-top:1px solid #cbd9e9}\n.leader{background:#f3f6fa;border:1px solid #e7edf5}\n.leader small{color:#77879d}\n.leader b{color:#18304e}\n.glance-cell{background:#f7f9fc;border-top:3px solid var(--primary);padding:9px 11px}\n.glance-label{font-size:10px;color:#4f6684;margin-bottom:5px}\n.glance-values strong{color:var(--deep);font-size:20px}\n.glance-names{color:#75849a}\n.box-page>.panel{margin-bottom:10px}\n.boxscore th,.boxscore td{padding:6px 6px!important;font-size:10px}\n.boxscore td:first-child{font-weight:700}\n.report-comparison-grid h3{color:#49617e;font-size:10px}\n.report-comparison-grid td,.report-comparison-grid th{padding:4px 7px!important}\n.court-page .court-card.full svg{max-height:72mm}\n.court-page .halves .court-card svg{max-height:67mm}\n.legend{font-weight:700;font-size:9px;color:#5f718b}\n.small{font-size:9px;line-height:1.45;color:#74849a}\nfooter{border-top:1px solid var(--hairline);font-weight:800;letter-spacing:.6px;color:#77879a;font-size:8px}\nfooter .footer-left{float:none}footer .footer-right{float:right}\n@media print{.page{height:205mm!important;min-height:0!important;max-height:205mm!important;padding:10mm 13mm!important}.scoreboard{background:var(--deep)!important}.court-page .court-card.full svg{max-height:69mm!important}.court-page .halves .court-card svg{max-height:66mm!important}}\n"
  ].join('\n');

  const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>'+style+'</style></head><body>'+
    '<div class="toolbar"><span>Coaches Report · Choose <b>Save as PDF</b> in the print dialog</span><button onclick="window.print()">Print / Save PDF</button></div>'+
    '<section class="page overview-page">'+header+'<div class="page-title"><div><p class="eyebrow">01 / MATCH SUMMARY</p><h1>Game Overview</h1></div><span class="page-title-tag">FINAL RESULT</span></div>'+
    '<div class="scoreboard"><div class="score-team"><small>TRACKED TEAM</small><b>'+us+'</b><strong>'+n(game.ourScore)+'</strong></div><div class="score-center"><span class="score-pill">FINAL</span><span class="score-separator">—</span></div><div class="score-team"><small>OPPONENT</small><b>'+them+'</b><strong>'+n(game.opponentScore)+'</strong></div></div>'+
    '<div class="cols"><div class="panel"><h2>Scoring by Quarter</h2><table><thead><tr><th>Period</th><th>'+us+'</th><th>'+them+'</th></tr></thead><tbody>'+
    (quarterRows||'<tr><td colspan="3">No quarter breakdown recorded</td></tr>')+
    '<tr class="total"><th>Final</th>'+td(game.ourScore)+td(game.opponentScore)+'</tr></tbody></table></div>'+
    '<div class="panel"><h2>Tracked Team Leaders</h2><div class="leaders"><div class="leader"><small>POINTS</small><b>'+leader('pts')+'</b></div><div class="leader"><small>REBOUNDS</small><b>'+leader('reb')+'</b></div><div class="leader"><small>ASSISTS</small><b>'+leader('ast')+'</b></div></div><p class="small">Player leaders are calculated only from the tracked team roster.</p></div></div>'+
    '<div class="panel overview-pulse"><div class="section-title"><h2>Game at a Glance</h2><span>TEAM PERFORMANCE</span></div><div class="glance-grid">'+glanceHTML+'</div></div>'+
    footer('1','Overview')+'</section>'+
    '<section class="page box-page">'+header+'<div class="page-title"><div><p class="eyebrow">02 / PLAYER &amp; TEAM DATA</p><h1>Detailed Box Score</h1></div><span class="page-title-tag">STATISTICAL BREAKDOWN</span></div>'+
    '<div class="panel"><h2>'+us+' — Players & Team Totals</h2><table class="boxscore">'+tableHead+'<tbody>'+(
      playerRows||'<tr><td colspan="11">No tracked player statistics recorded</td></tr>')+
      total(game.team+' — Team Total',tracked)+
      (observed?total(game.opponent+' — Team Total',opponent):'<tr><td colspan="11">No opponent statistics recorded</td></tr>')+
      '</tbody></table><p class="small">Team-level events (including team rebounds) are included in team totals. Opponent data is team-level only.</p></div>'+
    '<div class="panel compact-comparison"><div class="section-title"><h2>Team Comparison</h2><span>FULL GAME TOTALS</span></div>'+
      '<div class="report-comparison-grid">'+
        '<div><h3>Shooting &amp; Scoring</h3><table><thead><tr><th>Statistic</th><th>'+us+'</th><th>'+them+'</th></tr></thead><tbody>'+
          comparisons.slice(0,7).map(a=>row(a[0],a[1],a[2])).join('')+'</tbody></table></div>'+
        '<div><h3>Rebounds, Playmaking &amp; Defence</h3><table><thead><tr><th>Statistic</th><th>'+us+'</th><th>'+them+'</th></tr></thead><tbody>'+
          comparisons.slice(7).map(a=>row(a[0],a[1],a[2])).join('')+'</tbody></table></div>'+
      '</div></div>'+footer('2','Box Score & Comparison')+'</section>'+
    '<section class="page court-page">'+header+'<div class="page-title"><div><p class="eyebrow">03 / SPATIAL ANALYSIS</p><h1>Shot Location Analysis</h1></div><span class="page-title-tag">MADE &amp; MISSED</span></div>'+
    '<div class="court-card full"><div class="section-title"><h2>Full Court · Both Teams</h2><span>ALL RECORDED SHOTS</span></div>'+(fullCourt||'<p>No shots recorded</p>')+
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