<?php

?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TRACE — Visitor Intelligence</title>
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css"/>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{
    --bg: #0A0E13;
    --panel: #11161D;
    --panel-2: #161C25;
    --border: #1E2630;
    --text: #E7EDF3;
    --muted: #7C8B99;
    --accent: #2DD4BF;
    --accent-dim: rgba(45,212,191,0.15);
    --amber: #F5A623;
    --amber-dim: rgba(245,166,35,0.15);
    --radius: 10px;
  }
  *{ box-sizing:border-box; }
  html,body{ height:100%; }
  body{
    margin:0;
    background:
      radial-gradient(1200px 600px at 85% -10%, rgba(45,212,191,0.06), transparent 60%),
      var(--bg);
    color:var(--text);
    font-family:'Inter', system-ui, sans-serif;
    -webkit-font-smoothing:antialiased;
  }
  .mono{ font-family:'JetBrains Mono', monospace; }

  header{
    display:flex; align-items:center; justify-content:space-between;
    padding:18px 28px;
    border-bottom:1px solid var(--border);
    background:linear-gradient(180deg, rgba(255,255,255,0.02), transparent);
  }
  .brand{ display:flex; align-items:center; gap:12px; }
  .brand-mark{
    width:34px; height:34px; border-radius:8px;
    background:conic-gradient(from 180deg, var(--accent), #17847a, var(--accent));
    position:relative;
    box-shadow:0 0 0 1px var(--border), 0 8px 20px -6px rgba(45,212,191,0.5);
  }
  .brand-mark::after{
    content:""; position:absolute; inset:9px; border-radius:50%;
    background:var(--bg); box-shadow:0 0 0 1px rgba(45,212,191,0.4);
  }
  .brand h1{
    font-family:'Space Grotesk', sans-serif;
    font-size:18px; font-weight:700; letter-spacing:0.5px; margin:0;
  }
  .brand span{ color:var(--muted); font-weight:500; }
  .status{ display:flex; align-items:center; gap:18px; color:var(--muted); font-size:13px; }
  .status .dot{
    display:inline-block; width:8px; height:8px; border-radius:50%;
    background:var(--accent); margin-right:7px;
    box-shadow:0 0 0 3px var(--accent-dim);
    animation:pulse 2s ease-in-out infinite;
  }
  @keyframes pulse{ 0%,100%{ opacity:1; } 50%{ opacity:.45; } }
  #clock{ color:var(--text); }

  main{ padding:22px 28px 40px; max-width:1500px; margin:0 auto; }

  .stats{
    display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:20px;
  }
  .stat{
    background:var(--panel); border:1px solid var(--border); border-radius:var(--radius);
    padding:16px 18px; position:relative; overflow:hidden;
  }
  .stat::before{
    content:""; position:absolute; left:0; top:0; bottom:0; width:2px; background:var(--accent);
    opacity:0.7;
  }
  .stat .label{
    font-size:11px; text-transform:uppercase; letter-spacing:1.2px; color:var(--muted); font-weight:600;
  }
  .stat .value{
    font-family:'Space Grotesk', sans-serif; font-size:30px; font-weight:700; margin-top:6px;
  }
  .stat .sub{ font-size:12px; color:var(--muted); margin-top:2px; }

  .grid{
    display:grid; grid-template-columns:1.6fr 1fr; gap:16px; align-items:start;
  }
  .panel{
    background:var(--panel); border:1px solid var(--border); border-radius:var(--radius);
    overflow:hidden;
  }
  .panel-head{
    display:flex; align-items:center; justify-content:space-between;
    padding:13px 16px; border-bottom:1px solid var(--border);
  }
  .panel-head h2{
    font-family:'Space Grotesk', sans-serif; font-size:13px; font-weight:600;
    letter-spacing:0.6px; text-transform:uppercase; margin:0; color:var(--text);
  }
  .panel-head .count{ font-size:12px; color:var(--muted); }
  .panel-head .hint{ font-size:11px; color:var(--muted); }

  #globeViz{ height:580px; width:100%; background:#000814; position:relative; cursor:grab; }
  #globeViz:active{ cursor:grabbing; }
  .maplibregl-ctrl-attrib{ font-size:10px; }

  /* pin markers */
  .geo-pin-wrap{ display:flex; flex-direction:column; align-items:center; cursor:pointer; }
  .geo-pin{ width:26px; height:35px; position:relative; filter:drop-shadow(0 3px 5px rgba(0,0,0,.5)); }
  .geo-pin svg{ display:block; width:100%; height:100%; }
  .geo-ring{
    position:absolute; left:50%; top:35%; width:10px; height:10px; margin:-5px 0 0 -5px;
    border-radius:50%; background:rgba(245,166,35,.55);
    animation:ringPulse 1.6s ease-out infinite;
  }
  @keyframes ringPulse{ 0%{ transform:scale(.6); opacity:.8; } 100%{ transform:scale(4.5); opacity:0; } }
  .geo-tag{
    margin-bottom:3px; padding:2px 7px; border-radius:5px; white-space:nowrap;
    font-family:'Inter', sans-serif; font-size:11px; font-weight:600; line-height:1.4;
    background:rgba(10,14,19,0.9); color:#0A0E13;
    background:#0A0E13; color:#E7EDF3;
    border:1px solid rgba(45,212,191,0.55);
    box-shadow:0 2px 6px rgba(0,0,0,0.5);
  }
  .geo-tag.new{ border-color:rgba(245,166,35,0.65); color:#FFD9A0; }
  .geo-pin-wrap.new{ animation:dropIn .5s ease; }
  @keyframes dropIn{ from{ transform:translateY(-14px); opacity:0; } to{ transform:translateY(0); opacity:1; } }

  .geo-popup{ font-family:'Inter', sans-serif; font-size:12.5px; line-height:1.6; color:#1a1a1a; }
  .geo-popup b{ color:#17847a; }
  .maplibregl-popup-content{ border-radius:8px; padding:12px 14px; }

  .feed{ max-height:580px; overflow-y:auto; }
  .feed-row{
    display:flex; flex-direction:column; gap:3px;
    padding:11px 16px; border-bottom:1px solid var(--border);
    animation:enter .35s ease;
  }
  .feed-row:last-child{ border-bottom:none; }
  .feed-row.new{ background:var(--amber-dim); }
  @keyframes enter{ from{ opacity:0; transform:translateY(-4px); } to{ opacity:1; transform:none; } }
  .feed-top{ display:flex; justify-content:space-between; font-size:12.5px; }
  .feed-id{ color:var(--accent); font-weight:600; }
  .feed-time{ color:var(--muted); }
  .feed-place{ font-size:12px; color:var(--text); margin-top:1px; }
  .feed-bottom{ display:flex; justify-content:space-between; font-size:11.5px; color:var(--muted); margin-top:2px; }
  .feed-device{ max-width:220px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }

  table{ width:100%; border-collapse:collapse; font-size:13px; }
  thead th{
    position:sticky; top:0; background:var(--panel-2);
    text-align:left; padding:10px 14px; font-size:11px; text-transform:uppercase;
    letter-spacing:0.8px; color:var(--muted); border-bottom:1px solid var(--border);
  }
  tbody td{ padding:10px 14px; border-bottom:1px solid var(--border); white-space:nowrap; }
  tbody td.place-cell{ white-space:normal; max-width:260px; }
  tbody tr:hover{ background:rgba(255,255,255,0.02); }
  tbody tr.new-row{ background:var(--amber-dim); }
  .badge{
    display:inline-block; padding:2px 8px; border-radius:20px; font-size:11px;
    background:var(--accent-dim); color:var(--accent); border:1px solid rgba(45,212,191,0.3);
  }
  .badge.src-ip{ background:rgba(124,139,153,0.15); color:var(--muted); border-color:rgba(124,139,153,0.3); }
  .badge.src-local{ background:var(--amber-dim); color:var(--amber); border-color:rgba(245,166,35,0.3); }
  .badge.warn{ background:rgba(239,68,68,0.15); color:#F87171; border-color:rgba(239,68,68,0.35); }
  .isp-cell{ white-space:normal; max-width:200px; }
  .isp-cell .isp-name{ font-weight:600; }
  .isp-cell .net-type{ display:block; font-size:11px; color:var(--muted); margin-top:2px; }
  .table-wrap{ max-height:340px; overflow:auto; }
  .empty{ padding:40px 16px; text-align:center; color:var(--muted); font-size:13px; }

  @media (max-width: 980px){
    .stats{ grid-template-columns:repeat(2,1fr); }
    .grid{ grid-template-columns:1fr; }
    #globeViz{ height:400px; }
  }
  
  .map-container{margin:22px 28px 0;border:1px solid var(--border);border-radius:10px;overflow:hidden;}
.section-header{background:var(--surface);padding:10px 18px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);}
.section-title{font-family:var(--font-mono);font-size:11px;color:var(--accent);letter-spacing:.1em;}
#map{height:360px;width:100%;filter:brightness(.82) saturate(.65) hue-rotate(180deg);}


</style>
</head>
<body>

<header>
  <div class="brand">
    <div class="brand-mark"></div>
    <h1>TRACE <span>/ Visitor Intelligence</span></h1>
  </div>
  <div class="status">
    <span><span class="dot"></span>Live</span>
    <span class="mono" id="clock">--:--:--</span>
    <span class="mono" style="opacity:.5;">build 2026-07-16a</span>
  </div>
</header>

<main>
  <div class="stats">
    <div class="stat">
      <div class="label">Total Visitors</div>
      <div class="value mono" id="statTotal">0</div>
      <div class="sub">all-time recorded</div>
    </div>
    <div class="stat">
      <div class="label">Active Now</div>
      <div class="value mono" id="statActive">0</div>
      <div class="sub">session open, no exit yet</div>
    </div>
    <div class="stat">
      <div class="label">Countries</div>
      <div class="value mono" id="statCountries">0</div>
      <div class="sub">distinct locations</div>
    </div>
    <div class="stat">
      <div class="label">Avg. Duration</div>
      <div class="value mono" id="statAvg">0s</div>
      <div class="sub">completed sessions</div>
    </div>
  </div>

  <div class="grid">
    <div class="panel">
      <div class="panel-head">
        <h2>Live Globe</h2>
        <span class="hint">drag to rotate · scroll to zoom · tap a pin</span>
      </div>
      <div id="globeViz"></div>
    </div>
    <div class="panel">
      <div class="panel-head">
        <h2>Live Feed</h2>
        <span class="count mono" id="feedCount">0 events</span>
      </div>
      <div class="feed" id="feed"><div class="empty">Waiting for visitors…</div></div>
    </div>
  </div>

  <div class="panel" style="margin-top:16px;">
    <div class="panel-head">
      <h2>All Visitors</h2>
      <span class="count mono" id="tableCount">0 rows</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Visitor</th><th>IP</th><th>Source</th><th>Country</th><th>Region</th>
            <th>City</th><th>Place</th><th>ISP / Network</th><th>Device</th><th>Opened</th><th>Duration</th>
          </tr>
        </thead>
        <tbody id="tableBody"><tr><td colspan="11" class="empty">No data yet</td></tr></tbody>
      </table>
    </div>
  </div>
</main>

<script src="https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js"></script>
<script>
  
  
(function(){
  const KEY="vault_unlocked", TTL=5*60*1000;
  const entry=sessionStorage.getItem(KEY);
  if(!entry){sessionStorage.setItem("vault_redirect","system.php");window.location.replace("as.html");throw 0}
  if(Date.now()-parseInt(entry,10)>TTL){sessionStorage.removeItem(KEY);sessionStorage.setItem("vault_redirect","system.php");window.location.replace("as.html");throw 0}
})();

(function(){
  "use strict";

  // Real OpenStreetMap tiles draped on a 3D globe projection: actual tile
  // pyramid, so labels/roads/landmarks stay crisp at every zoom level
  // (a static satellite texture, used previously, cannot do this).
  const map = new maplibregl.Map({
    container: 'globeViz',
    style: {
      version: 8,
      sources: {
        'osm-tiles': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          minzoom: 0,
          maxzoom: 19,
          attribution: '&copy; OpenStreetMap contributors'
        }
      },
      layers: [
        { id: 'osm', type: 'raster', source: 'osm-tiles' }
      ],
      projection: { type: 'globe' },
      sky: {}
    },
    center: [10, 15],
    zoom: 1.2,
    attributionControl: { compact: true }
  });

  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

  function pinSVG(hex1, hex2){
    return `<svg viewBox="0 0 34 46" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="pg${hex1.replace('#','')}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${hex1}"/>
          <stop offset="100%" stop-color="${hex2}"/>
        </linearGradient>
      </defs>
      <path d="M17 0C7.6 0 0 7.6 0 17c0 12.7 17 29 17 29s17-16.3 17-29C34 7.6 26.4 0 17 0z" fill="url(#pg${hex1.replace('#','')})"/>
      <circle cx="17" cy="17" r="7" fill="#ffffff"/>
    </svg>`;
  }

  // ---- slow auto-rotate, pauses on ANY user gesture (drag, wheel-zoom, pinch, rotate) ----
  // Using event.originalEvent to tell a real user gesture apart from our own
  // programmatic jumpTo() calls below -- movestart/moveend fire for both,
  // so without this check the spin loop would immediately re-trigger itself
  // and never register as "resting", and would also keep fighting the
  // browser's own zoom handling over who owns map.center (the cause of the
  // rotation speeding up / drifting to a different spot while pinch-zooming).
  let userInteracting = false;
  let resumeTimer;

  map.on('movestart', (e) => {
    if (e.originalEvent) {
      userInteracting = true;
      clearTimeout(resumeTimer);
    }
  });
  map.on('moveend', (e) => {
    if (e.originalEvent) {
      resumeTimer = setTimeout(() => { userInteracting = false; }, 4000);
    }
  });


  function spin(){
    // Only auto-rotate at whole-earth zoom levels; a close-up zoomed view
    // rotating underneath your finger is disorienting and is exactly what
    // caused the "changes location while zooming in" complaint.
    if (!userInteracting && map.getZoom() < 3) {
      const c = map.getCenter();
      map.jumpTo({ center: [c.lng + 0.035, c.lat] });
    }
    requestAnimationFrame(spin);
  }
  map.on('load', () => requestAnimationFrame(spin));

  function esc(str){
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  let activeMarkers = [];
  function clearMarkers(){ activeMarkers.forEach(m => m.remove()); activeMarkers = []; }

  let knownIds = new Set();
  let firstLoad = true;

  function fmtTime(){
    const d = new Date();
    document.getElementById('clock').textContent = d.toLocaleTimeString('en-GB', { hour12:false });
  }
  fmtTime();
  setInterval(fmtTime, 1000);

  function sourceBadge(src){
    if(src === 'GPS') return '<span class="badge">GPS</span>';
    if(src === 'Local Network') return '<span class="badge src-local">LOCAL</span>';
    return '<span class="badge src-ip">IP</span>';
  }

  function ispSummary(log){
    const isp = (log.isp && log.isp !== 'Unknown') ? log.isp : null;
    const net = (log.network_type && log.network_type !== 'Unknown') ? log.network_type : null;
    if(!isp && !net) return 'Unknown';
    return [isp, net].filter(Boolean).join(' · ');
  }

  async function update(){
    let data;
    try{
      const res = await fetch('logs.json', { cache:'no-store' });
      data = await res.json();
      if(!Array.isArray(data)) data = [];
    }catch(err){
      console.error('Failed to load logs.json', err);
      return;
    }

    const total = data.length;
    const active = data.filter(l => !l.duration || l.duration === 0).length;
    const countries = new Set(data.map(l => l.country).filter(Boolean));
    const completed = data.filter(l => l.duration > 0);
    const avg = completed.length
      ? Math.round(completed.reduce((s,l) => s + (l.duration||0), 0) / completed.length)
      : 0;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statActive').textContent = active;
    document.getElementById('statCountries').textContent = countries.size;
    document.getElementById('statAvg').textContent = avg + 's';

    // ---- table ----
    const tbody = document.getElementById('tableBody');
    if(total === 0){
      tbody.innerHTML = '<tr><td colspan="11" class="empty">No data yet</td></tr>';
    } else {
      tbody.innerHTML = '';
      data.slice().reverse().forEach(log => {
        const tr = document.createElement('tr');
        if(!knownIds.has(log.visitor_id) && !firstLoad) tr.classList.add('new-row');
        const isVpn = /vpn|proxy/i.test(log.network_type || '');
        tr.innerHTML = `
          <td class="mono">${esc(log.visitor_id)}</td>
          <td class="mono">${esc(log.ip)}</td>
          <td>${sourceBadge(log.source)}</td>
          <td>${esc(log.country)}</td>
          <td>${esc(log.region)}</td>
          <td>${esc(log.city)}</td>
          <td class="place-cell">${esc(log.place)}</td>
          <td class="isp-cell">
            <span class="isp-name">${esc(log.isp || 'Unknown')}</span>
            <span class="net-type">${esc(log.network_type || 'Unknown')}</span>
            ${isVpn ? '<span class="badge warn" style="margin-top:4px;">VPN/PROXY</span>' : ''}
          </td>
          <td>${esc((log.device||'').slice(0,40))}</td>
          <td class="mono">${esc(log.open_time)}</td>
          <td class="mono">${log.duration ?? 0}s</td>
        `;
        tbody.appendChild(tr);
      });
    }
    document.getElementById('tableCount').textContent = total + ' rows';

    // ---- live feed ----
    const feed = document.getElementById('feed');
    const newest = data.slice(-8).reverse();
    if(newest.length === 0){
      feed.innerHTML = '<div class="empty">Waiting for visitors…</div>';
    } else {
      feed.innerHTML = '';
      newest.forEach(log => {
        const row = document.createElement('div');
        row.className = 'feed-row' + (!knownIds.has(log.visitor_id) && !firstLoad ? ' new' : '');
        row.innerHTML = `
          <div class="feed-top">
            <span class="feed-id mono">${esc(log.visitor_id)}</span>
            <span class="feed-time mono">${esc(log.open_time)}</span>
          </div>
          <div class="feed-place">${esc(log.city)}, ${esc(log.region)} — ${esc(log.country)}</div>
          <div class="feed-place" style="color:var(--muted); font-size:11px;">${esc(ispSummary(log))}</div>
          <div class="feed-bottom">
            <span class="feed-device">${esc(log.device)}</span>
            <span>${sourceBadge(log.source)}</span>
          </div>`;
        feed.appendChild(row);
      });
    }
    document.getElementById('feedCount').textContent = data.length + ' events';

    // ---- globe pin markers ----
    clearMarkers();
    data.forEach(log => {
      if(log.latitude == null || log.longitude == null) return;
      if(log.latitude === 0 && log.longitude === 0) return;
      const isNew = !knownIds.has(log.visitor_id) && !firstLoad;

      const cityName = (log.city && log.city !== 'Unknown') ? log.city
                      : (log.country && log.country !== 'Unknown') ? log.country
                      : 'Unresolved';

      const color1 = isNew ? '#FFC46B' : '#5EEAD4';
      const color2 = isNew ? '#F5A623' : '#17847a';

      const wrap = document.createElement('div');
      wrap.className = 'geo-pin-wrap' + (isNew ? ' new' : '');

      const tag = document.createElement('div');
      tag.className = 'geo-tag' + (isNew ? ' new' : '');
      tag.textContent = cityName;

      const pin = document.createElement('div');
      pin.className = 'geo-pin';
      pin.innerHTML = pinSVG(color1, color2);
      if(isNew){
        const ring = document.createElement('div');
        ring.className = 'geo-ring';
        pin.appendChild(ring);
      }

      wrap.appendChild(tag);
      wrap.appendChild(pin);

      const popupHtml = `<div class="geo-popup">
        <b>${esc(log.visitor_id)}</b><br>
        ${esc(log.ip)} ${sourceBadge(log.source)}<br>
        ${esc(log.city)}, ${esc(log.region)}, ${esc(log.country)}<br>
        <span style="color:#666;">${esc(log.place)}</span><br>
        <span style="color:#666;">${esc(ispSummary(log))}</span><br>
        <span style="color:#666;">${esc((log.device||'').slice(0,60))}</span>
      </div>`;

      const marker = new maplibregl.Marker({ element: wrap, anchor: 'bottom' })
        .setLngLat([log.longitude, log.latitude])
        .setPopup(new maplibregl.Popup({ offset: 30, closeButton: false }).setHTML(popupHtml))
        .addTo(map);

      activeMarkers.push(marker);
    });

    knownIds = new Set(data.map(l => l.visitor_id));
    firstLoad = false;
  }

  update();
  setInterval(update, 2000);
})();
</script>
</body>
</html>
