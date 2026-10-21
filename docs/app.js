const P=new pmtiles.Protocol();maplibregl.addProtocol('pmtiles',P.tile);
const MOB=innerWidth<700;let META,PLACES,STATS,cur,timer=null,selPlace=null,PIN=null;
const $=id=>document.getElementById(id);
const OV={center:[-1.525,12.36],zoom:MOB?11.4:12.3,pitch:25,bearing:-12};
const style={version:8,glyphs:'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
 sources:{sat:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:19,attribution:'Imagerie © Esri, Maxar, Earthstar Geographics'},
  b:{type:'vector',url:'pmtiles://'+location.origin+'/data/buildings.pmtiles',attribution:'Bâtiments © Microsoft / Google Open Buildings, OSM'}},
 layers:[{id:'bg',type:'background',paint:{'background-color':'#0b1220'}},{id:'sat',type:'raster',source:'sat',paint:{'raster-fade-duration':150}},
  {id:'b-ao',type:'line',source:'b','source-layer':'b',minzoom:14.5,paint:{'line-color':'#000','line-opacity':0.45,'line-width':['interpolate',['linear'],['zoom'],15,1.5,18,5],'line-blur':['interpolate',['linear'],['zoom'],15,1,18,4]}},
  {id:'b3d',type:'fill-extrusion',source:'b','source-layer':'b',minzoom:14,paint:{'fill-extrusion-color':'#e9e3d7','fill-extrusion-height':['interpolate',['linear'],['zoom'],14,0,14.6,['get','h']],'fill-extrusion-opacity':1,'fill-extrusion-vertical-gradient':true}},
  {id:'b-edge',type:'line',source:'b','source-layer':'b',minzoom:15.5,paint:{'line-color':'#3b3b3b','line-opacity':0.55,'line-width':0.6}}]};
const map=new maplibregl.Map({container:'map',style,...OV,maxPitch:75,preserveDrawingBuffer:true,canvasContextAttributes:{preserveDrawingBuffer:true},attributionControl:{compact:MOB}});
map.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'top-right');
// ---- couche eau : texture de profondeur (cm, 8 bits) interpolée bilinéairement par le GPU, isoligne lissée dans le shader
class WaterLayer extends deck.BitmapLayer{getShaders(){const s=super.getShaders();s.inject={'fs:#main-end':`
 float d=texture(bitmapTexture,uv).r*2.55; float night=tintColor.r; float thr=tintColor.b; float edgeK=tintColor.g;
 float px=max(fwidth(d),1e-4); float a=smoothstep(thr-px,thr+px,d);
 vec3 shallow=mix(vec3(0.42,0.88,1.0),vec3(0.25,0.75,1.0),night); vec3 deep=mix(vec3(0.02,0.42,0.86),vec3(0.15,0.45,1.0),night);
 vec3 col=mix(shallow,deep,smoothstep(0.1,1.2,d))*(1.0+0.6*night);
 float al=mix(0.50,0.82,smoothstep(0.08,1.0,d))+0.12*night;
 float e=1.0-smoothstep(0.0,1.6*px,abs(d-thr));
 vec2 sc=gl_FragCoord.xy; float dash=step(0.5,fract((sc.x+sc.y)/14.0));
 e*=dash*edgeK; col=mix(col,vec3(1.0),e); al=max(al*a,e*0.95);
 if(al<0.01) discard; fragColor=vec4(col,al*opacity);`};return s}}
WaterLayer.layerName='WaterLayer';
const overlay=new deck.MapboxOverlay({interleaved:true,layers:[]});map.addControl(overlay);
const IMG={};function img(k,i){const u=`data/${MOB?'dm':'d'}/${k}/${i}.png`;if(!IMG[u]){IMG[u]=new Promise(r=>{const m=new Image();m.crossOrigin='anonymous';m.onload=()=>r(m);m.src=u})}return IMG[u]}
let wA={i:null,img:null,op:1},wB={i:null,img:null,op:0},fadeT=0,NIGHT=0;
function startOf(S){return Date.parse((S.start.startsWith('2000')?'2000-01-01T15:00':S.start)+'Z')}
function nightAt(t){const h=new Date(t).getUTCHours()+new Date(t).getUTCMinutes()/60;return h<5.5||h>19.5?1:h<6.5?6.5-h:h>18.5?h-18.5:0}
function layers(){const L=[];const Z=map.getZoom();const B=META.bounds;
 for(const w of [wB,wA]) if(w.img&&w.op>0.01)L.push(new WaterLayer({id:'w'+(w===wA?'A':'B'),bounds:B,image:w.img,opacity:w.op,tintColor:[NIGHT*255,Z>=14.5?255:Z>=13.5?(Z-13.5)*255:0,(Z>=15?0.06:Z>=13?0.06+(15-Z)*0.03:0.12)*255],beforeId:'b-ao',textureParameters:{minFilter:'linear',magFilter:'linear'},updateTriggers:{}}));
 if(PIN)L.push(new deck.ColumnLayer({id:'pin',data:[PIN],getPosition:d=>[d.lon,d.lat],radius:MOB?14:9,elevationScale:1,getElevation:140,getFillColor:[249,115,22,235],extruded:true,material:false}),
  new deck.ScatterplotLayer({id:'pinglow',data:[PIN],getPosition:d=>[d.lon,d.lat],radiusUnits:'meters',getRadius:38,getFillColor:[249,115,22,90],stroked:true,getLineColor:[255,180,90,220],lineWidthMinPixels:2}));
 overlay.setProps({layers:L})}
async function showFrame(i){const S=META.scen[cur];const key=$('maxck').checked?'max':i;const im=await img(cur,key);
 if(wA.i===cur+key)return; wB={...wA};wA={i:cur+key,img:im,op:0};fadeT=performance.now();
 for(const n of [i+1,i+2]) if(n<S.hours)img(cur,n);
 const step=()=>{const f=Math.min(1,(performance.now()-fadeT)/450);wA.op=f;wB.op=1-f;layers();if(f<1)requestAnimationFrame(step)};step()}
function setLight(n){NIGHT=n;map.setPaintProperty('sat','raster-brightness-max',1-0.72*n);map.setPaintProperty('sat','raster-saturation',-0.45*n);
 const mix=(a,b)=>'#'+a.map((x,j)=>Math.round(x+(b[j]-x)*n).toString(16).padStart(2,'0')).join('');
 map.setPaintProperty('b3d','fill-extrusion-color',mix([233,227,215],[58,64,82]));map.setPaintProperty('b-edge','line-color',n>0.5?'#0b0f1a':'#3b3b3b')}
map.on('load',async()=>{
 [META,PLACES,STATS]=await Promise.all(['meta','places','stats'].map(f=>fetch(`data/${f}.json`).then(r=>r.json())));
 for(const k of META.order){const o=document.createElement('option');o.value=k;o.textContent=META.scen[k].label;$('scen').appendChild(o)}
 $('about').innerHTML=META.about+'<p>Fond : imagerie satellite Esri World Imagery. Hauteurs de bâtiments : estimations (3,5 / 6 / 9 m), pas des mesures.</p>';
 pills();$('scen').onchange=()=>setScen($('scen').value);setScen(META.order[0]);loadPrev();
 const q=new URLSearchParams(location.search);if(q.get('lat'))pinAt(+q.get('lon'),+q.get('lat'),null,true)});
const PILLS=['Zone 1','Tanghin','Nioko','Somgandé','Wemtenga','Rimkiéta','Toécin','Kalgondin','Bonheur Ville','Nagrin','Gounghin','Ouaga 2000','Dassasgho','Pissy'];
function pills(){const p=$('pills');const mk=(t,f,rep)=>{const b=document.createElement('button');b.className='pill'+(rep?' rep':'');b.textContent=t;b.onclick=()=>{[...p.children].forEach(c=>c.classList.remove('on'));b.classList.add('on');f()};p.appendChild(b);return b};
 mk("Vue d'ensemble",()=>{map.flyTo({...OV,duration:2500,padding:{top:0,bottom:0,left:0,right:0}});PIN=null;selPlace=null;$('left').classList.add('hidden');history.replaceState(null,'',location.pathname);layers()}).classList.add('on');
 const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 for(const n of PILLS){const pl=PLACES.find(x=>norm(x.name)===norm(n));if(pl)mk(pl.name,()=>pinPlace(pl),!!pl.reported)}}
function pinPlace(p){selPlace=p;pinAt(p.lon,p.lat,p,true)}
async function pinAt(lon,lat,place,fly){PIN={lon,lat,place};$('left').classList.remove('hidden');
 if(fly)map.flyTo({center:[lon,lat],zoom:MOB?15.6:16.2,pitch:MOB?42:56,bearing:map.getBearing()-20,duration:3000,essential:true,padding:MOB?{bottom:320,top:120}:{left:300,right:290}});
 await fiche(lon,lat,false);PIN.name=place?place.name:LASTF.near;await pinSeries();layers();draw()}
async function pinSeries(){if(!PIN||!PM)return;const[b0,b1,b2,b3]=PM.bounds;const j=Math.floor((PIN.lon-b0)/(b2-b0)*PM.w),i=Math.floor((b3-PIN.lat)/(b3-b1)*PM.h);
 const off=(i*PM.w+j)*16;const r=await fetch(`data/ser_${cur}.bin`,{headers:{Range:`bytes=${off}-${off+15}`}});PIN.ser=[...new Uint8Array(await r.arrayBuffer())].map(v=>v*0.02);PIN.k=cur}
let zt;map.on('zoom',()=>{clearTimeout(zt);zt=setTimeout(layers,120)});
map.on('click',e=>{selPlace=null;pinAt(e.lngLat.lng,e.lngLat.lat,null,false)});
const pops=[];
function callouts(){pops.forEach(p=>p.remove());pops.length=0;const ev={'2020-09-05':'5 sept. 2020','2022-08-03':'3 août 2022','2024-08-16':'16 août 2024','2025-07-24':'24 juil. 2025','2026-08-03':'2-3 août 2026'}[cur];if(!ev)return;
 const seen=new Set();for(const p of PLACES){if(!p.reported.includes(ev))continue;const n=p.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace('kalgodin','kalgondin');if(seen.has(n))continue;seen.add(n);
  pops.push(new maplibregl.Popup({closeButton:false,closeOnClick:false,className:'callout',offset:12}).setLngLat([p.lon,p.lat]).setHTML(MOB?`<b>⚠ ${p.name}</b>`:`<b>${p.name} : inondation signalée</b><span>${p.reported} · simulé : jusqu'à ${p.stats[cur][0].toFixed(1)} m</span>`).addTo(map))}}
function setScen(k){cur=k;const S=META.scen[k];$('scen').value=k;const h=$('hour');h.max=S.hours-1;const pk=S.rain.indexOf(Math.max(...S.rain));h.value=Math.min(S.hours-1,pk+2);
 $('src').textContent=S.src;$('s_label').textContent=S.label;sparks();callouts();(PIN?pinSeries():Promise.resolve()).then(draw)}
function sparks(){const S=META.scen[cur],T=STATS[cur],n=S.hours;const ser=[['Pluie','mm/h',S.rain.slice(0,n),'#0ea5e9'],['Surface inondée','km²',T.area,'#06b6d4'],['Bâtiments touchés','',T.bld,'#f97316'],['Niveau des barrages','cm',T.lake,'#6366f1']];
 $('sparks').innerHTML=ser.map(([l,u,v,c],j)=>{const mx=Math.max(...v,1e-6);const pts=v.map((y,x)=>`${(x/(n-1)*100).toFixed(2)},${(32-y/mx*30).toFixed(2)}`).join(' ');
  return `<div class="sp" style="${MOB&&j>1?'display:none':''}"><div class="lab">${l}<b id="sv${j}"></b></div><svg viewBox="0 0 100 34" preserveAspectRatio="none"><polygon points="0,34 ${pts} 100,34" fill="${c}22"/><polyline points="${pts}" fill="none" stroke="${c}" stroke-width="1.2" vector-effect="non-scaling-stroke"/><line id="ph${j}" x1="0" x2="0" y1="0" y2="34" stroke="#0f172a" stroke-width="1" vector-effect="non-scaling-stroke"/></svg></div>`}).join('');PIN&&(PIN.u=ser)}
const fmt=x=>x>=1000?(x/1000).toFixed(1).replace('.',',')+' k':String(Math.round(x));
function draw(){if(!META)return;const S=META.scen[cur],T=STATS[cur];const f=+$('hour').value,i=Math.round(f);const mx=$('maxck').checked;
 const t=startOf(S)+(f+1)*3600e3;const syn=S.start.startsWith('2000');const d=new Date(t);
 $('hl').textContent=mx?'Maximum de l\'événement':(syn?`Pluie de projet · H+${(f+1).toFixed(0)} · ${String(d.getUTCHours()).padStart(2,'0')}h`:d.toLocaleString('fr-FR',{timeZone:'UTC',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' (heure de Ouaga)');
 setLight(mx?0:nightAt(t));showFrame(i);
 const cum=S.rain.slice(0,i+1).reduce((a,b)=>a+b,0),tot=S.rain.reduce((a,b)=>a+b,0);
 $('s_area').textContent=T.area[i].toFixed(1).replace('.',',');$('s_bld').textContent=fmt(T.bld[i]);$('s_rain').textContent=(S.rain[i]||0).toFixed(1).replace('.',',');$('s_lake').textContent='+'+Math.round(T.lake[i]-T.lake[0]);
 $('s_cum').textContent=`${cum.toFixed(0)} / ${tot.toFixed(0)} mm`;
 const vals=[(S.rain[i]||0).toFixed(1)+' mm',T.area[i].toFixed(1)+' km²',fmt(T.bld[i]),'+'+Math.round(T.lake[i]-T.lake[0])+' cm'];
 for(let j=0;j<4;j++){const l=$('ph'+j);if(l){const x=f/(S.hours-1)*100;l.setAttribute('x1',x);l.setAttribute('x2',x)}const v=$('sv'+j);if(v)v.textContent=vals[j]}
 if(PIN&&PIN.ser){const sr=PIN.ser.slice(0,S.hours);const dm=Math.max(...sr,0.2);const X=x=>x/(S.hours-1)*300,Y=y=>84-y/dm*76;
  $('pinname').textContent=PIN.name||'Point choisi';$('pinsub').textContent=`${PIN.lat.toFixed(4)}, ${PIN.lon.toFixed(4)} · ${S.label}`;
  const now=mx?Math.max(...sr):sr[i];$('pindepth').innerHTML=`${Math.round(now*100)} cm <small>d'eau ${mx?'(max)':'en ce moment'}</small>`;
  const pk=sr.indexOf(Math.max(...sr));$('pinwhen').textContent=`Max ${Math.round(sr[pk]*100)} cm à H+${pk+1}`;
  $('pinchart').innerHTML=`<polygon points="0,84 ${sr.map((y,x)=>X(x)+','+Y(y)).join(' ')} 300,84" fill="#06b6d422"/><polyline points="${sr.map((y,x)=>X(x)+','+Y(y)).join(' ')}" fill="none" stroke="#06b6d4" stroke-width="2"/><line x1="${X(f)}" x2="${X(f)}" y1="0" y2="90" stroke="#f9731688"/><circle cx="${X(f)}" cy="${Y(sr[Math.min(i,sr.length-1)])}" r="5" fill="#f97316" stroke="#fff" stroke-width="2"/>`}}
$('hour').oninput=draw;$('maxck').onchange=()=>{wA.i=null;draw()};
$('lclose').onclick=()=>{$('left').classList.add('hidden');PIN=null;layers()};$('rtog').onclick=()=>{$('right').classList.toggle('min');$('rtog').textContent=$('right').classList.contains('min')?'▴':'▾'};
if(MOB){$('right').classList.add('min');$('rtog').textContent='▴'}
let last=0;function tick(ts){if(!timer)return;if(last){const h=$('hour');let v=+h.value+(ts-last)/1000*0.5*(+$('speed').value);if(v>+h.max)v=0;h.value=v;draw()}last=ts;requestAnimationFrame(tick)}
$('play').onclick=()=>{if(timer){timer=null;$('play').textContent='▶';return}timer=1;last=0;$('play').textContent='❚❚';requestAnimationFrame(tick)};
const norm2=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
$('q').oninput=e=>{const q=norm2(e.target.value);const r=$('res');r.innerHTML='';if(!q)return;
 PLACES.filter(p=>norm2(p.name).includes(q)).slice(0,8).forEach(p=>{const d=document.createElement('div');d.textContent=p.name;d.onclick=()=>{r.innerHTML='';$('q').value=p.name;pinPlace(p)};r.appendChild(d)})};
// ---------- Prévision ----------
const sum=a=>a.reduce((x,y)=>x+(y||0),0);
const MODELS={ecmwf_ifs025:'ECMWF',gfs_seamless:'GFS (NOAA)',icon_seamless:'ICON (DWD)',meteofrance_seamless:'Météo-France'};
function nearestScen(mm){let best=null,bd=1e9;for(const k of META.order){const t=sum(META.scen[k].rain);const d=Math.abs(t-mm);if(d<bd){bd=d;best=k}}return best}
function riskWord(ha){return ha>=8?['très élevé','#7a0177']:ha>=4?['élevé','#d7301f']:ha>=1.5?['moyen','#fc8d59']:['faible','#41ab5d']}
async function loadPrev(){const el=document.getElementById('prev');
 try{const j=await (await fetch('/api/forecast')).json();const H=j.hourly,t=H.time;const days=[...new Set(t.map(x=>x.slice(0,10)))].slice(0,3);
  const noms=['Aujourd\'hui','Demain','Après-demain'];let html='';window.PREV=[];
  days.forEach((d,di)=>{const tot={};for(const m in MODELS){const v=H['precipitation_'+m];if(!v)continue;tot[m]=sum(v.filter((_,i)=>t[i].startsWith(d)))}
   const vals=Object.values(tot).filter(x=>x!=null).sort((a,b)=>a-b);if(!vals.length)return;
   const med=vals[Math.floor((vals.length-1)/2)],mx=vals[vals.length-1],mn=vals[0];PREV.push({d,med,mx});
   const det=Object.entries(tot).map(([m,v])=>MODELS[m]+' '+v.toFixed(1)).join(' · ');
   let msg,col;
   if(mx<10){msg='Pas de pluie forte annoncée : risque d\'inondation faible.';col='#41ab5d'}
   else{const k=nearestScen(mx);const S=META.scen[k];const top=PLACES.map(p=>[p,p.stats[k][1]]).sort((a,b)=>b[1]-a[1]).slice(0,6).map(x=>x[0].name).join(', ');
    col=mx>=60?'#d7301f':mx>=30?'#fc8d59':'#fdd49e';
    msg=`Dans le pire des modèles (${mx.toFixed(0)} mm), situation comparable au scénario <a href="#" onclick="document.getElementById('scen').value='${k}';setScen('${k}');return false">${S.label}</a>. Quartiers les plus exposés dans ce scénario : ${top}.`+(selPlace?`<br><b>${noms[di]}, ${selPlace.name} risque : ${riskWord(selPlace.stats[k][1])[0]}</b>`:'')}
   html+=`<div class="prevday" style="border-color:${col}"><b>${noms[di]} (${d.split('-').reverse().join('/')})</b> : ${med.toFixed(1)} mm (médiane des modèles ; fourchette ${mn.toFixed(1)}–${mx.toFixed(1)} mm)<br>${msg}<br><span style="color:#777">${det}</span></div>`});
  el.innerHTML=html+`<div style="color:#666">⚠️ Prévision automatique, point unique (centre de Ouaga), mise à jour ${new Date(j.fetched).toISOString().slice(11,16)} UTC. Les orages sahéliens sont très localisés : la pluie réelle peut être bien plus forte ou nulle à quelques km. Ce n'est pas une alerte officielle : suivez l'ANAM et la Protection civile.</div>`;
 }catch(e){el.textContent='Prévision indisponible pour le moment.'}}
// ---------- Fiche parcelle ----------
let PM=null,mk=null,LASTF=null;
const LV=[[0.1,'faible','#41ab5d'],[0.3,'moyen','#fc8d59'],[0.8,'élevé','#d7301f'],[1e9,'très élevé','#7a0177']];
function lvl(d){return LV.find(l=>d<l[0])}
function hav(a,b,c,d){const R=6371e3,r=Math.PI/180;const x=Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2;return 2*R*Math.asin(Math.sqrt(x))}
async function fiche(lon,lat,fly){if(!PM)PM=await (await fetch('data/parcel.json')).json();
 const[b0,b1,b2,b3]=PM.bounds;const j=Math.floor((lon-b0)/(b2-b0)*PM.w),i=Math.floor((b3-lat)/(b3-b1)*PM.h);
 const el=document.getElementById('fiche');if(i<0||j<0||i>=PM.h||j>=PM.w){el.innerHTML='<div class="card">Point hors de la zone simulée.</div>';return}
 const off=(i*PM.w+j)*PM.stride;const buf=new Uint8Array(await (await fetch('data/parcel.bin',{headers:{Range:`bytes=${off}-${off+PM.stride-1}`}})).arrayBuffer());
 const rows=PM.order.map((k,n)=>({k,label:META.scen[k].label,d:buf[n]*PM.depth_unit_m,h:buf[8+n]}));const dist=buf[16]|(buf[17]<<8);
 const ev=rows.filter(r=>!r.k.startsWith('T'));const dmax=Math.max(...ev.map(r=>r.d));const dT=Math.max(...rows.map(r=>r.d));const L=lvl(dmax);
 const near=PLACES.map(p=>[p,hav(lat,lon,p.lat,p.lon)]).sort((a,b)=>a[1]-b[1])[0];
 LASTF={lon,lat,rows,dist,L,dmax,dT,near:near[0].name,nd:near[1]};
 
 history.replaceState(null,'',`?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`);
 const W=300,bw=W/rows.length;const mxd=Math.max(1,dT);
 const svg=`<svg width="100%" viewBox="0 0 ${W} 110">${rows.map((r,n)=>`<rect x="${n*bw+3}" y="${90-r.d/mxd*80}" width="${bw-6}" height="${r.d/mxd*80}" fill="${lvl(r.d)[2]}"/><text x="${n*bw+bw/2}" y="104" font-size="9" text-anchor="middle">${r.k.startsWith('T')?r.k:r.k.slice(2,7).replace('-','/')}</text><text x="${n*bw+bw/2}" y="${86-r.d/mxd*80}" font-size="9" text-anchor="middle">${r.d.toFixed(1)}</text>`).join('')}</svg>`;
 el.innerHTML=`<div class="card"><b>📍 Fiche parcelle</b> <span class="small">${lat.toFixed(5)}, ${lon.toFixed(5)}</span><br>
 Près de : <b>${near[0].name}</b> (${(near[1]/1000).toFixed(1)} km)<br>
 Niveau de risque (événements 2020-2026) : <span class="lvl" style="background:${L[2]}">${L[1]}</span><br>
 Profondeur max simulée : <b>${dmax.toFixed(2)} m</b> (jusqu'à ${dT.toFixed(2)} m en pluie centennale)<br>
 Canal / cours d'eau / talweg le plus proche (OSM) : <b>${dist<3000?Math.round(dist/10)*10+' m':'> 3 km'}</b>
 ${svg}<div class="small">Profondeur max (m) par scénario, cellule de ~40 m</div>
 <table><tr><th>Scénario</th><th>Prof. max</th><th>Heures &gt;10 cm</th></tr>${rows.map(r=>`<tr><td>${r.label}</td><td>${r.d.toFixed(2)} m</td><td>${r.h} h</td></tr>`).join('')}</table>
 <button class="btn" onclick="pdf()">📄 Télécharger la fiche PDF</button><button class="btn" onclick="navigator.share?navigator.share({title:'Fiche inondation Ouaga',url:location.href}):navigator.clipboard.writeText(location.href).then(()=>this.textContent='Lien copié ✓')">🔗 Partager</button>
 <div class="small">Simulation indicative, pas un document officiel.</div></div>`;
}

function loadScript(u){return new Promise((ok,ko)=>{const s=document.createElement('script');s.src=u;s.onload=ok;s.onerror=ko;document.head.appendChild(s)})}
async function pdf(){if(!window.jspdf)await loadScript('https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js');
 const F=LASTF;const{jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});
 await new Promise(r=>{map.once('render',r);map.triggerRepaint()});let img=null;try{img=map.getCanvas().toDataURL('image/jpeg',0.85)}catch(e){}
 doc.setFillColor(8,81,156);doc.rect(0,0,210,22,'F');doc.setTextColor(255);doc.setFontSize(16);doc.text('Fiche parcelle - risque d\'inondation (simulation)',12,10);doc.setFontSize(10);doc.text('Ouagadougou - '+new Date().toLocaleDateString('fr-FR'),12,17);
 doc.setTextColor(0);let y=30;doc.setFontSize(11);
 [[`Position : ${F.lat.toFixed(5)}, ${F.lon.toFixed(5)}`],[`Quartier le plus proche : ${F.near} (${(F.nd/1000).toFixed(1)} km)`],[`Niveau de risque (evenements 2020-2026) : ${F.L[1].toUpperCase()}`],[`Profondeur max simulee : ${F.dmax.toFixed(2)} m (jusqu'a ${F.dT.toFixed(2)} m en pluie centennale)`],[`Distance au canal / cours d'eau / talweg le plus proche (OSM) : ${F.dist<3000?Math.round(F.dist/10)*10+' m':'> 3 km'}`]].forEach(l=>{doc.text(l[0],12,y);y+=6});
 if(img){const c=map.getCanvas();const w=186,h=Math.min(95,w*c.height/c.width);doc.addImage(img,'JPEG',12,y,w,h);doc.setDrawColor(215,48,31);doc.setLineWidth(0.8);doc.circle(12+w/2,y+h/2,2.5);y+=h+6}
 doc.setFontSize(10);doc.setFont(undefined,'bold');doc.text('Scenario',12,y);doc.text('Prof. max',140,y);doc.text('Heures > 10 cm',168,y);doc.setFont(undefined,'normal');y+=5;
 F.rows.forEach(r=>{doc.text(doc.splitTextToSize(r.label,125)[0],12,y);doc.text(r.d.toFixed(2)+' m',140,y);doc.text(String(r.h)+' h',168,y);y+=5.5});
 y+=4;doc.setFontSize(8.5);doc.setTextColor(80);
 const disc='AVERTISSEMENT : cette fiche est issue d\'une simulation numerique indicative (modele hydraulique simplifie, relief Copernicus GLO-30 a 30 m, pluies ERA5 / observations de presse reparties heure par heure, pluies de projet T10/T50/T100 approximatives). Elle ne tient pas compte de l\'etat reel des caniveaux, des remblais recents ni des ouvrages. Ce n\'est PAS un document officiel et ne remplace ni une etude technique ni les avis de l\'ANAM, de la Protection civile ou de la Mairie. Sources : OpenStreetMap (contributeurs), Microsoft/Google Open Buildings, ESA WorldCover, Copernicus DEM, ECMWF ERA5. Site : '+location.origin;
 doc.text(doc.splitTextToSize(disc,186),12,y);doc.save(`fiche-inondation-ouaga-${F.lat.toFixed(4)}_${F.lon.toFixed(4)}.pdf`)}
