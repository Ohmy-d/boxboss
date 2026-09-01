<!DOCTYPE html>
<html lang="en">


<script src="https://unpkg.com/leaflet/dist/leaflet.js"></script>
<script>
// CLOCK
(function tickClock(){
  document.getElementById('clock').textContent = new Date().toLocaleTimeString('en-GB',{hour12:false});
  setTimeout(tickClock, 1000);
})();

// MAP
var map = L.map('map').setView([20,10],2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(map);

function makeIcon(st){
  var c={active:'#00ff9d',idle:'#ffb700',ended:'#ff3d6b'}[st]||'#00d4ff';
  var anim=st==='active'?'animation:blink 1.2s infinite;':'';
  return L.divIcon({
    className:'',
    html:'<div style="width:12px;height:12px;background:'+c+';border-radius:50%;border:2px solid rgba(255,255,255,.7);box-shadow:0 0 10px '+c+';'+anim+'"></div>',
    iconSize:[12,12],iconAnchor:[6,6],popupAnchor:[0,-10]
  });
}

var markers={}, knownIds=new Set(), allData=[], searchTerm='';
var activeFilter=new Set(['active','idle','ended']);

// FILTER BUTTONS
document.querySelectorAll('.filter-btn').forEach(function(btn){
  btn.addEventListener('click',function(){
    var f=btn.dataset.filter;
    if(activeFilter.has(f)){activeFilter.delete(f);btn.classList.remove('active');}
    else{activeFilter.add(f);btn.classList.add('active');}
    renderTable(allData);
  });
});
document.getElementById('searchBox').addEventListener('input',function(e){
  searchTerm=e.target.value.toLowerCase();
  renderTable(allData);
});

// HELPERS
function fmtDur(s){
  if(!s||s===0)return'0s';
  if(s<60)return s+'s';
  var m=Math.floor(s/60),r=s%60;
  if(m<60)return m+'m '+r+'s';
  return Math.floor(m/60)+'h '+(m%60)+'m';
}
function f(v){return(v&&v!=='Unknown')?v:'—';}
function trunc(v,n){v=f(v);return v.length>n?'<span class="truncate" title="'+v+'">'+v.slice(0,n)+'…</span>':v;}

// SOURCE BADGE
function srcBadge(src){
  src=src||'';
  if(src.indexOf('gps')>-1) return '<span class="src-badge gps">GPS+OSM</span>';
  if(src.indexOf('ipapi+nominatim')>-1) return '<span class="src-badge ip">IP+OSM</span>';
  if(src.indexOf('ipapi')>-1) return '<span class="src-badge ip">IP</span>';
  if(src==='local') return '<span class="src-badge local">LOCAL</span>';
  return '<span class="src-badge ip">—</span>';
}

// LOCATION BREAKDOWN PANEL (most recent active session)
function updateLocationPanel(data){
  var active=data.filter(function(l){return l.status==='active';});
  var panel=document.getElementById('locationPanel');
  if(!active.length){panel.style.display='none';return;}
  panel.style.display='block';
  var last=active[active.length-1];
  var fields=[
    ['EXACT PLACE / BUILDING', last.place_name, true],
    ['ROAD / STREET',          last.road,        false],
    ['VILLAGE / HAMLET',       last.village,     false],
    ['SUBURB / QUARTER',       last.suburb,      false],
    ['TOWN / CITY',            last.city,        false],
    ['DISTRICT / COUNTY',      last.district,    false],
    ['REGION / STATE',         last.region,      false],
    ['COUNTRY',                last.country,     false],
    ['COORDINATES',            last.latitude!=null?(+last.latitude).toFixed(5)+', '+(+last.longitude).toFixed(5):null, false],
    ['LOCATION SOURCE',        last.source,      false],
    ['IP ADDRESS',             last.ip,          false],
    ['FULL ADDRESS',           last.display_name,false],
  ];
  var html='';
  fields.forEach(function(f){
    var val=f[1]&&f[1]!=='Unknown'?f[1]:null;
    var cls=f[2]?'loc-val place':'loc-val'+(val?'':' unknown');
    html+='<div class="loc-item"><div class="loc-key">'+f[0]+'</div><div class="'+cls+'" title="'+(val||'Unknown')+'">'+(val||'Unknown')+'</div></div>';
  });
  document.getElementById('locationGrid').innerHTML=html;
}

// MARKERS
function updateMarkers(data){
  data.forEach(function(log){
    if(log.latitude==null||log.longitude==null)return;
    var st=log.status||'ended';
    var sid=log.session_id;
    var popup='<b style="color:#00d4ff">'+f(log.ip)+'</b><br>'
      +(log.place_name&&log.place_name!=='Unknown'?'<span style="color:#00ff9d">'+log.place_name+'</span><br>':'')
      +(log.village&&log.village!=='Unknown'?log.village+', ':'')
      +(log.district&&log.district!=='Unknown'?log.district+'<br>':'')
      +(log.region&&log.region!=='Unknown'?log.region+', ':'')
      +f(log.country)
      +'<br><span style="color:#3a6070;font-size:10px">'+(log.device||'').slice(0,55)+'</span>'
      +'<br><span style="color:#00ff9d">'+st.toUpperCase()+'</span>';
    if(!markers[sid]){
      markers[sid]=L.marker([+log.latitude,+log.longitude],{icon:makeIcon(st)}).addTo(map).bindPopup(popup);
    } else {
      markers[sid].setLatLng([+log.latitude,+log.longitude]);
      markers[sid].setIcon(makeIcon(st));
      markers[sid].setPopupContent(popup);
    }
  });
}

// STATS
function updateStats(data){
  var active=data.filter(function(l){return l.status==='active';}).length;
  var idle=data.filter(function(l){return l.status==='idle';}).length;
  var unique=new Set(data.map(function(l){return l.visitor_id;})).size;
  var countries=new Set(data.map(function(l){return l.country;}).filter(function(c){return c&&c!=='Unknown';})).size;
  var districts=new Set(data.map(function(l){return l.district;}).filter(function(d){return d&&d!=='Unknown';})).size;
  var places=data.filter(function(l){return l.place_name&&l.place_name!=='Unknown';}).length;
  var durs=data.map(function(l){return l.duration||0;});
  var avg=durs.length?Math.round(durs.reduce(function(a,b){return a+b;},0)/durs.length):0;
  document.getElementById('s-active').textContent=active;
  document.getElementById('s-total').textContent=data.length;
  document.getElementById('s-unique').textContent=unique;
  document.getElementById('s-idle').textContent=idle;
  document.getElementById('s-avg').textContent=fmtDur(avg);
  document.getElementById('s-countries').textContent=countries;
  document.getElementById('s-districts').textContent=districts;
  document.getElementById('s-places').textContent=places;
}

// TABLE
function renderTable(data){
  var tbody=document.getElementById('tableBody');
  var sorted=data.slice().reverse();
  var filtered=sorted.filter(function(l){
    var st=l.status||'ended';
    if(!activeFilter.has(st))return false;
    if(searchTerm){
      var h=[l.ip,l.country,l.region,l.district,l.city,l.town,l.village,l.suburb,
             l.road,l.place_name,l.display_name,l.visitor_id,l.session_id,l.device,l.status]
            .join(' ').toLowerCase();
      if(h.indexOf(searchTerm)<0)return false;
    }
    return true;
  });
  document.getElementById('shown-count').textContent=filtered.length+' sessions';
  if(!filtered.length){tbody.innerHTML='<tr><td colspan="17" class="no-data">// NO MATCHING SESSIONS</td></tr>';return;}
  tbody.innerHTML='';
  filtered.forEach(function(log){
    var st=log.status||'ended';
    var isNew=!knownIds.has(log.session_id);
    var tr=document.createElement('tr');
    if(isNew)tr.classList.add('new-row');
    var lat=log.latitude!=null?(+log.latitude).toFixed(4):'—';
    var lon=log.longitude!=null?(+log.longitude).toFixed(4):'—';
    var coords=lat!=='—'?(lat+','+lon):'—';
    var place=log.place_name&&log.place_name!=='Unknown'
      ?'<span class="c-place truncate" style="max-width:160px" title="'+log.place_name+'">'+log.place_name.slice(0,28)+(log.place_name.length>28?'…':'')+'</span>'
      :'<span class="c-muted">—</span>';
    tr.innerHTML=
      '<td><span class="pill '+st+'"><span class="sdot"></span>'+st.toUpperCase()+'</span></td>'
      +'<td class="c-muted">'+f(log.open_time)+'</td>'
      +'<td class="c-muted">'+f(log.last_seen)+'</td>'
      +'<td>'+place+'</td>'
      +'<td class="c-green">'+trunc(log.village,22)+'</td>'
      +'<td>'+trunc(log.town||log.city,22)+'</td>'
      +'<td class="c-purple">'+trunc(log.district,24)+'</td>'
      +'<td>'+trunc(log.region,22)+'</td>'
      +'<td>'+trunc(log.country,18)+'</td>'
      +'<td class="c-muted">'+trunc(log.road,20)+'</td>'
      +'<td class="c-muted" style="font-size:10px">'+coords+'</td>'
      +'<td>'+srcBadge(log.source)+'</td>'
      +'<td class="c-muted">'+f(log.ip)+'</td>'
      +'<td>'+fmtDur(log.duration)+'</td>'
      +'<td class="c-muted">'+(log.pings||1)+'</td>'
      +'<td class="c-accent">'+(log.visitor_id||'').slice(0,14)+'…</td>'
      +'<td class="c-muted truncate" style="max-width:160px" title="'+(log.device||'')+'">'+((log.device||'').slice(0,40))+'</td>';
    tbody.appendChild(tr);
  });
}

// MAIN LOOP
async function update(){
  try{
    var res=await fetch('logs.json?_='+Date.now());
    if(!res.ok)return;
    var data=await res.json();
    allData=data;
    updateStats(data);
    updateMarkers(data);
    updateLocationPanel(data);
    renderTable(data);
    data.forEach(function(l){if(l.session_id)knownIds.add(l.session_id);});
  }catch(e){console.warn('Update error:',e);}
}
update();
setInterval(update,3000);
