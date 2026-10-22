const P=new pmtiles.Protocol();maplibregl.addProtocol('pmtiles',P.tile);
const MOB=innerWidth<700;let HV=false,META,PLACES,STATS,cur,timer=null,selPlace=null,PIN=null;
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
 // R = heure i, G = heure i+1 (cm/2.55) ; transparentColor.r = fraction entre les deux (montée progressive), .g = intensité de pluie, desaturate = phase d'animation [0,1)
 vec4 tx=texture(bitmapTexture,uv); float fr=transparentColor.r; float rain=transparentColor.g; float ph=desaturate*6.2831853;
 float d=mix(tx.r,tx.g,fr)*2.55; float night=tintColor.r; float thr=tintColor.b; float edgeK=tintColor.g;
 float px=max(fwidth(d),1e-4); float a=smoothstep(thr-px*1.5,thr+px*1.5,d);
 vec2 g=vec2(dFdx(d),dFdy(d)); float gl=length(g);
 vec2 p=gl_FragCoord.xy;
 // ondulations animées (normales procédurales), plus fortes sous la pluie
 float w1=sin(p.x*0.11+p.y*0.07+ph*3.0), w2=sin(p.x*-0.05+p.y*0.13+ph*2.0), w3=sin((p.x+p.y)*0.21-ph*5.0);
 vec3 nrm=normalize(vec3((w1*0.6+w3*rain*0.8)*0.35,(w2*0.6+w3*rain*0.8)*0.35,1.0));
 float spec=pow(max(dot(reflect(normalize(vec3(-0.3,-0.4,-1.0)),nrm),vec3(0.0,0.0,1.0)),0.0),24.0);
 // scintillement d'écoulement le long de la pente de profondeur (canaux)
 vec2 dir=gl>1e-5?g/gl:vec2(0.0); float flow=smoothstep(0.25,0.8,d)*smoothstep(0.002,0.02,gl);
 float st=0.5+0.5*sin(dot(p,dir)*0.35-ph*4.0);
 vec3 shallow=mix(vec3(0.42,0.88,1.0),vec3(0.25,0.75,1.0),night); vec3 deep=mix(vec3(0.02,0.42,0.86),vec3(0.15,0.45,1.0),night);
 vec3 muddy=vec3(0.55,0.48,0.36);
 vec3 col=mix(shallow,deep,smoothstep(0.1,1.2,d));col=mix(col,muddy*0.9+col*0.1,0.25*smoothstep(0.05,0.6,d));
 col*= (1.0+0.6*night)*(0.92+0.08*nrm.x); col+=vec3(spec*0.55*(1.0-0.5*night)); col+=vec3(flow*st*0.18);
 float al=mix(0.45,0.82,smoothstep(0.05,1.0,d))+0.12*night;
 float e=1.0-smoothstep(0.0,1.6*px,abs(d-thr));
 float dash=step(0.5,fract((p.x+p.y)/14.0));
 e*=dash*edgeK; col=mix(col,vec3(1.0),e); al=max(al*a,e*0.95);
 if(al<0.01) discard; fragColor=vec4(col,al*opacity);`};return s}}
WaterLayer.layerName='WaterLayer';
const overlay=new deck.MapboxOverlay({interleaved:true,layers:[]});map.addControl(overlay);
const IMG={};function img(k,i){const u=`data/${MOB?'dm':'d'}/${k}/${i}.png`;if(!IMG[u]){IMG[u]=new Promise(r=>{const m=new Image();m.crossOrigin='anonymous';m.onload=()=>r(m);m.src=u})}return IMG[u]}
// deux heures consécutives empaquetées dans une texture (R=i, G=i+1) → interpolation GPU, l'eau monte progressivement
const PAIR={};let PKEYS=[];
async function pair(k,a,b){const key=k+a+'|'+b;if(PAIR[key])return PAIR[key];
 const p=(async()=>{const[A,B]=await Promise.all([img(k,a),img(k,b)]);const w=A.width,h=A.height;
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(A,0,0);const da=x.getImageData(0,0,w,h);x.clearRect(0,0,w,h);x.drawImage(B,0,0);const db=x.getImageData(0,0,w,h);
  const o=da.data,q=db.data;for(let n=0;n<o.length;n+=4){o[n+1]=q[n];o[n+2]=0;o[n+3]=255}x.putImageData(da,0,0);return c})();
 PAIR[key]=p;PKEYS.push(key);while(PKEYS.length>(MOB?4:8))delete PAIR[PKEYS.shift()];return p}
let W={img:null,fr:0},NIGHT=0,RAIN=0;
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
function startOf(S){return Date.parse((S.start.startsWith('2000')?'2000-01-01T15:00':S.start)+'Z')}
function nightAt(t){const h=new Date(t).getUTCHours()+new Date(t).getUTCMinutes()/60;return h<5.5||h>19.5?1:h<6.5?6.5-h:h>18.5?h-18.5:0}
function layers(){const L=[];const Z=map.getZoom();const B=META.bounds;
 if(W.img)L.push(new WaterLayer({id:'w',bounds:B,image:W.img,opacity:1,desaturate:RM?0:(performance.now()/6000)%1,transparentColor:[W.fr*255,Math.min(1,RAIN)*255,0,255],tintColor:[NIGHT*255,Z>=14.5?255:Z>=13.5?(Z-13.5)*255:0,(Z>=15?0.06:Z>=13?0.06+(15-Z)*0.03:0.12)*255],beforeId:'b-ao',textureParameters:{minFilter:'linear',magFilter:'linear'}}));
 if(PIN)L.push(new deck.ColumnLayer({id:'pin',data:[PIN],getPosition:d=>[d.lon,d.lat],radius:MOB?14:9,elevationScale:1,getElevation:140,getFillColor:[249,115,22,235],extruded:true,material:false}),
  new deck.ScatterplotLayer({id:'pinglow',data:[PIN],getPosition:d=>[d.lon,d.lat],radiusUnits:'meters',getRadius:38,getFillColor:[249,115,22,90],stroked:true,getLineColor:[255,180,90,220],lineWidthMinPixels:2}));
 if(HV&&PLACES){const H=META.harvest;L.push(new deck.ScatterplotLayer({id:'hv',data:PLACES.filter(p=>p.roof),getPosition:d=>[d.lon,d.lat],radiusUnits:'meters',getRadius:d=>Math.sqrt(vol(d.roof,H.annual_mm))*2.2,getFillColor:[17,24,39,120],stroked:true,getLineColor:[34,211,238,230],lineWidthMinPixels:1.5,pickable:true,onClick:i=>{pinPlace(i.object);return true}}))}
 overlay.setProps({layers:L})}
let FQ=0;async function showFrame(f){const S=META.scen[cur];const mx=$('maxck').checked;const i=Math.min(Math.floor(f),S.hours-1),j=Math.min(i+1,S.hours-1);
 const q=++FQ;const c=mx?await pair(cur,'max','max'):await pair(cur,i,j);if(q!==FQ)return;W.img=c;W.fr=mx?0:Math.min(1,f-i);
 if(!mx&&j+1<S.hours)pair(cur,j,Math.min(j+1,S.hours-1));layers()}
function setLight(n){NIGHT=n;const r=Math.min(1,RAIN);map.setPaintProperty('sat','raster-brightness-max',(1-0.72*n)*(1-0.38*r));map.setPaintProperty('sat','raster-saturation',-0.45*n-0.4*r*(1-n));map.setPaintProperty('sat','raster-contrast',-0.15*r);
 const mix=(a,b)=>'#'+a.map((x,j)=>Math.round(x+(b[j]-x)*n).toString(16).padStart(2,'0')).join('');
 map.setPaintProperty('b3d','fill-extrusion-color',mix([233,227,215],[58,64,82]));map.setPaintProperty('b-edge','line-color',n>0.5?'#0b0f1a':'#3b3b3b')}
map.on('load',async()=>{
 [META,PLACES,STATS]=await Promise.all(['meta','places','stats'].map(f=>fetch(`data/${f}.json`).then(r=>r.json())));
 for(const k of META.order){const o=document.createElement('option');o.value=k;o.textContent=META.scen[k].label;$('scen').appendChild(o)}
 $('about').innerHTML=META.about+'<p>Fond : imagerie satellite Esri World Imagery. Hauteurs de bâtiments : estimations (3,5 / 6 / 9 m), pas des mesures.</p>';
 harvestPanel();$('hvck').onchange=e=>{HV=e.target.checked;layers()};
 pills();$('scen').onchange=()=>setScen($('scen').value);setScen(META.order[0]);loadPrev();
 const q=new URLSearchParams(location.search);if(q.get('lat'))pinAt(+q.get('lon'),+q.get('lat'),null,true);
 const sh=[q.get('u'),q.get('url'),q.get('t'),q.get('text'),q.get('title')].filter(Boolean).join(' ');if(sh)handleLoc(sh)});
const PILLS=['Zone 1','Tanghin','Nioko','Somgandé','Wemtenga','Rimkiéta','Toécin','Kalgondin','Bonheur Ville','Nagrin','Gounghin','Ouaga 2000','Dassasgho','Pissy'];
function pills(){const p=$('pills');const mk=(t,f,rep)=>{const b=document.createElement('button');b.className='pill'+(rep?' rep':'');b.textContent=t;b.onclick=()=>{[...p.children].forEach(c=>c.classList.remove('on'));b.classList.add('on');f()};p.appendChild(b);return b};
 mk("Vue d'ensemble",()=>{map.flyTo({...OV,duration:2500,padding:{top:0,bottom:0,left:0,right:0}});PIN=null;selPlace=null;$('left').classList.add('hidden');history.replaceState(null,'',location.pathname);layers()}).classList.add('on');
 const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 for(const n of PILLS){const pl=PLACES.find(x=>norm(x.name)===norm(n));if(pl)mk(pl.name,()=>pinPlace(pl),!!pl.reported)}}
function pinPlace(p){selPlace=p;pinAt(p.lon,p.lat,p,true)}
async function pinAt(lon,lat,place,fly){PIN={lon,lat,place};$('left').classList.remove('hidden');
 if(fly)map.flyTo({center:[lon,lat],zoom:MOB?15.6:16.2,pitch:MOB?42:56,bearing:map.getBearing()-20,duration:3000,essential:true,padding:MOB?{bottom:320,top:120}:{left:300,right:290}});
 await fiche(lon,lat,false);harvestPanel();PIN.name=place?place.name:LASTF.near;await pinSeries();layers();draw()}
async function pinSeries(){if(!PIN||!PM)return;const[b0,b1,b2,b3]=PM.bounds;const j=Math.floor((PIN.lon-b0)/(b2-b0)*PM.w),i=Math.floor((b3-PIN.lat)/(b3-b1)*PM.h);
 const off=(i*PM.w+j)*16;const r=await fetch(`data/ser_${cur}.bin`,{headers:{Range:`bytes=${off}-${off+15}`}});PIN.ser=[...new Uint8Array(await r.arrayBuffer())].map(v=>v*0.02);PIN.k=cur}
let zt;map.on('zoom',()=>{clearTimeout(zt);zt=setTimeout(layers,120)});
map.on('click',e=>{selPlace=null;pinAt(e.lngLat.lng,e.lngLat.lat,null,false)});
const pops=[];
function callouts(){pops.forEach(p=>p.remove());pops.length=0;const ev={'2020-09-05':'5 sept. 2020','2022-08-03':'3 août 2022','2024-08-16':'16 août 2024','2025-07-24':'24 juil. 2025','2026-08-03':'2-3 août 2026'}[cur];if(!ev)return;
 const seen=new Set();for(const p of PLACES){if(!p.reported.includes(ev))continue;const n=p.name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace('kalgodin','kalgondin');if(seen.has(n))continue;seen.add(n);
  pops.push(new maplibregl.Popup({closeButton:false,closeOnClick:false,className:'callout',offset:12}).setLngLat([p.lon,p.lat]).setHTML(MOB?`<b>⚠ ${p.name}</b>`:`<b>${p.name} : inondation signalée</b><span>${p.reported} · simulé : jusqu'à ${p.stats[cur][0].toFixed(1)} m</span>`).addTo(map))}}
function setScen(k){cur=k;const S=META.scen[k];$('scen').value=k;const h=$('hour');h.max=S.hours-1;const pk=S.rain.indexOf(Math.max(...S.rain));h.value=Math.min(S.hours-1,pk+2);
 $('src').textContent=S.src;$('s_label').textContent=S.label;sparks();callouts();if(PLACES)harvestPanel();ficheHV();(PIN?pinSeries():Promise.resolve()).then(draw)}
function sparks(){const S=META.scen[cur],T=STATS[cur],n=S.hours;const ser=[['Pluie','mm/h',S.rain.slice(0,n),'#0ea5e9'],['Surface inondée','km²',T.area,'#06b6d4'],['Bâtiments touchés','',T.bld,'#f97316'],['Niveau des barrages','cm',T.lake,'#6366f1']];
 $('sparks').innerHTML=ser.map(([l,u,v,c],j)=>{const mx=Math.max(...v,1e-6);const pts=v.map((y,x)=>`${(x/(n-1)*100).toFixed(2)},${(32-y/mx*30).toFixed(2)}`).join(' ');
  return `<div class="sp" style="${MOB&&j>1?'display:none':''}"><div class="lab">${l}<b id="sv${j}"></b></div><svg viewBox="0 0 100 34" preserveAspectRatio="none"><polygon points="0,34 ${pts} 100,34" fill="${c}22"/><polyline points="${pts}" fill="none" stroke="${c}" stroke-width="1.2" vector-effect="non-scaling-stroke"/><line id="ph${j}" x1="0" x2="0" y1="0" y2="34" stroke="#0f172a" stroke-width="1" vector-effect="non-scaling-stroke"/></svg></div>`}).join('');PIN&&(PIN.u=ser)}
const fmt=x=>x>=1000?(x/1000).toFixed(1).replace('.',',')+' k':String(Math.round(x));
function draw(){if(!META)return;const S=META.scen[cur],T=STATS[cur];const f=+$('hour').value,i=Math.round(f);const mx=$('maxck').checked;
 const t=startOf(S)+(f+1)*3600e3;const syn=S.start.startsWith('2000');const d=new Date(t);
 $('hl').textContent=mx?'Maximum de l\'événement':(syn?`Pluie de projet · H+${(f+1).toFixed(0)} · ${String(d.getUTCHours()).padStart(2,'0')}h`:d.toLocaleString('fr-FR',{timeZone:'UTC',weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' (heure de Ouaga)');
 const rr=(S.rain[Math.floor(f)]||0)*(1-(f%1))+(S.rain[Math.floor(f)+1]||0)*(f%1);RAIN=mx?0:Math.min(1,rr/30);RAINMM=mx?0:rr;
 setLight(mx?0:nightAt(t));showFrame(f);
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
$('hour').oninput=draw;$('maxck').onchange=()=>draw();
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
 const rows=PM.order.map((k,n)=>({k,label:META.scen[k].label,d:buf[n]*PM.depth_unit_m,h:buf[8+n]}));const dist=buf[16]|(buf[17]<<8);const roof=PM.stride>=20?(buf[18]|(buf[19]<<8)):0;
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
 <button class="btn wa" onclick="shareWA()">📲 Partager mon résultat sur WhatsApp</button><button class="btn" onclick="pdf()">📄 Télécharger la fiche PDF</button><button class="btn" onclick="shareNative(this)">🔗 Partager</button>
 <button class="btn alt" onclick="openTem()">🙋 Chez moi, c'était différent</button>
 <div class="small">Simulation indicative, pas un document officiel.</div></div>
 <div class="card hv"><b>${TANK} Eau récupérable des toits</b><br><span id="fhv"></span>
 <div class="hvown">Votre toit : <input id="myroof" type="number" min="10" max="5000" value="${META.harvest.house_m2}" inputmode="numeric"> m² <span id="myroofv"></span></div></div>`;
 const mr=$('myroof'),upd=()=>{$('myroofv').innerHTML=harvestLine(+mr.value||0)};mr.oninput=upd;LASTF.roof=roof;LASTF.upd=upd;ficheHV();
}
// ---------- Eau récupérable (toits) ----------
function ficheHV(){const e=$('fhv');if(!e||!LASTF)return;e.innerHTML=harvestHTML(LASTF.roof,`Toits dans cette cellule (~${PM.roof_cell_m2||1530} m² de terrain)`);LASTF.upd&&LASTF.upd()}
const TANK='<svg class="tank" viewBox="0 0 14 18" width="12" height="15"><ellipse cx="7" cy="3" rx="6" ry="2.2" fill="#334155"/><rect x="1" y="3" width="12" height="13" fill="#111827"/><ellipse cx="7" cy="16" rx="6" ry="2" fill="#111827"/><rect x="5.5" y="0" width="3" height="2" fill="#475569"/></svg>';
const nf=x=>Math.round(x).toLocaleString('fr-FR');
function storm(){const k=nearestRealStorm();return {k,mm:sum(META.scen[k].rain)}}
function nearestRealStorm(){return cur&&!cur.startsWith('T')?cur:'2024-08-16'}
function vol(m2,mm){return m2*mm/1000*META.harvest.capture}
function tanks(v){const L=v*1000;return META.harvest.tanks.map(t=>`<span class="tk">${TANK}${L/t>=10?nf(L/t):(L/t).toFixed(1).replace('.',',')} × ${t>=1000?t/1000+' 000':t} L</span>`).join(' ')}
function harvestLine(m2){const H=META.harvest,s=storm(),vs=vol(m2,s.mm),va=vol(m2,H.annual_mm);
 return `<b>${vs.toFixed(1).replace('.',',')} m³</b> par orage (${s.mm.toFixed(0)} mm) · <b>${nf(va)} m³/an</b><br><span class="small">soit par an ${tanks(va)}</span>`}
function harvestHTML(m2,lab){const H=META.harvest,s=storm(),vs=vol(m2,s.mm),va=vol(m2,H.annual_mm);
 return `<span class="small">${lab} : ${nf(m2)} m² de toits</span><br>Par orage type « ${META.scen[s.k].label} » (${s.mm.toFixed(0)} mm) : <b>${nf(vs)} m³</b><br>${tanks(vs)}<br>Par an (${H.annual_mm} mm) : <b>${nf(va)} m³</b><br>${tanks(va)}`}
function harvestPanel(){const H=META.harvest,s=storm();const top=PLACES.filter(p=>p.roof).sort((a,b)=>b.roof-a.roof).slice(0,8);
 const sel=PIN&&PIN.place&&PIN.place.roof?PIN.place:selPlace;
 $('harv').innerHTML=(sel?`<div class="card hv"><b>${TANK} ${sel.name}</b> (carré ~800 m autour du centre)<br>${harvestHTML(sel.roof,'Toits')}</div>`:'')+
 `<div class="small">Exemple : maison avec <b>${H.house_m2} m²</b> de toit → ${harvestLine(H.house_m2)}</div>
 <table class="ht"><tr><th>Quartier (carré ~800 m)</th><th>Toits m²</th><th>m³/orage</th><th>m³/an</th></tr>${top.map(p=>`<tr><td><a href="#" onclick="pinPlace(PLACES[${PLACES.indexOf(p)}]);return false">${p.name}</a></td><td>${nf(p.roof)}</td><td>${nf(vol(p.roof,s.mm))}</td><td>${nf(vol(p.roof,H.annual_mm))}</td></tr>`).join('')}</table>
 <div class="small">Pluie annuelle : ${H.annual_mm} mm (${H.annual_src} ; ${H.era5_note}). Capture : ${Math.round(H.capture*100)} % (${H.capture_note}). Orage = scénario affiché (${s.mm.toFixed(0)} mm). Cuves = cuves verticales en polyéthylène noir (1 000 à 10 000 L). Surfaces de toits : Microsoft + Google Open Buildings v3 (empreintes, pas de vérification terrain).</div>`}

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
 if(F.roof!=null){const H=META.harvest;y+=2;doc.text(`Eau recuperable des toits de la cellule (${F.roof} m2, capture ${Math.round(H.capture*100)} %) : ${Math.round(vol(F.roof,H.annual_mm))} m3/an (pluie ${H.annual_mm} mm, CHIRPS)`,12,y);y+=5}
 y+=4;doc.setFontSize(8.5);doc.setTextColor(80);
 const disc='AVERTISSEMENT : cette fiche est issue d\'une simulation numerique indicative (modele hydraulique simplifie, relief FABDEM 30 m (CC BY-NC-SA 4.0), rues OSM abaissees de 20-40 cm, pluies observees a l\'aeroport (SYNOP 65503) ou par la presse, sinon ERA5, pluies de projet T10/T50/T100 approximatives). Elle ne tient pas compte de l\'etat reel des caniveaux, des remblais recents ni des ouvrages. Ce n\'est PAS un document officiel et ne remplace ni une etude technique ni les avis de l\'ANAM, de la Protection civile ou de la Mairie. Sources : OpenStreetMap (contributeurs), Microsoft/Google Open Buildings, ESA WorldCover, FABDEM (Univ. Bristol), FABDEM (Univ. Bristol, CC BY-NC-SA 4.0), Copernicus DEM, OGIMET/Iowa Mesonet, ECMWF ERA5, CHIRPS. Site : '+location.origin;
 doc.text(doc.splitTextToSize(disc,186),12,y);doc.save(`fiche-inondation-ouaga-${F.lat.toFixed(4)}_${F.lon.toFixed(4)}.pdf`)}

// ---------- Liens de localisation ----------
function toast(m,err){const t=$('toast');t.textContent=m;t.className=err?'err':'';t.style.display='block';clearTimeout(t._h);t._h=setTimeout(()=>t.style.display='none',err?6000:3000)}
function inCov(p){const[b0,b1,b2,b3]=META.bounds;return p.lon>b0&&p.lon<b2&&p.lat>b1&&p.lat<b3}
async function handleLoc(text){if(!text)return false;const link=LOC.findLink(text);let p=LOC.parseLoc(text)||LOC.parseLoc(link);
 if(!p&&LOC.needsResolve(link)){toast('Lecture du lien…');try{const r=await (await fetch('/api/resolve?u='+encodeURIComponent(link))).json();
  if(r.error){toast('Lien non pris en charge ('+r.error+').',true);return false}p=LOC.parseLoc(r.url)||(r.hint&&LOC.parseLoc(r.hint))}catch(e){}}
 if(!p){toast("Impossible de trouver des coordonnées dans ce texte. Collez un lien Google Maps / Apple Plans / WhatsApp, ou « 12.37, -1.52 ».",true);return false}
 if(!inCov(p)){toast(`Ce point (${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}) est hors de la zone couverte (Ouagadougou et environs).`,true);return false}
 if(!META){setTimeout(()=>handleLoc(text),500);return true}
 toast('📍 Point trouvé : '+p.lat.toFixed(5)+', '+p.lon.toFixed(5));selPlace=null;$('res').innerHTML='';
 if(MOB)$('q').blur();await pinAt(p.lon,p.lat,null,true);return true}
const looksLoc=s=>/https?:\/\/|geo:|^\s*-?\d{1,2}\.\d+\s*[, ;]\s*-?\d{1,3}\.\d+\s*$|[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2}/i.test(s);
$('q').addEventListener('keydown',e=>{if(e.key==='Enter'){const v=$('q').value;if(looksLoc(v)||!$('res').firstChild)handleLoc(v);else $('res').firstChild.click()}});
$('q').addEventListener('paste',()=>setTimeout(()=>{const v=$('q').value;if(looksLoc(v))handleLoc(v)},30));
$('paste').onclick=async()=>{let t='';try{t=await navigator.clipboard.readText()}catch(e){}
 if(!t||!looksLoc(t))t=prompt('Collez ici un lien Google Maps, Apple Plans ou une position WhatsApp :',t||'');if(t)handleLoc(t)};
$('geo').onclick=()=>{if(!navigator.geolocation){toast('Géolocalisation indisponible sur cet appareil.',true);return}toast('Recherche de votre position…');
 navigator.geolocation.getCurrentPosition(pos=>{const p={lat:pos.coords.latitude,lon:pos.coords.longitude};if(!inCov(p)){toast('Votre position est hors de la zone couverte (Ouagadougou).',true);return}selPlace=null;pinAt(p.lon,p.lat,null,true)},
  e=>toast(e.code===1?'Accès à la position refusé.':'Position introuvable.',true),{enableHighAccuracy:true,timeout:15000})};

// ---------- Pluie animée (canvas 2D au-dessus de la carte) ----------
let RAINMM=0;const RC=document.createElement('canvas');RC.id='rain';document.body.appendChild(RC);const rx=RC.getContext('2d');
function rsz(){const dpr=Math.min(devicePixelRatio||1,MOB?1.5:2);RC.width=innerWidth*dpr;RC.height=innerHeight*dpr;rx.setTransform(dpr,0,0,dpr,0,0)}addEventListener('resize',rsz);rsz();
const DROPS=[],SPL=[];const NMAX=MOB?260:800;
for(let n=0;n<NMAX;n++)DROPS.push({x:Math.random(),y:Math.random(),v:0.6+Math.random()*0.6,l:0.6+Math.random()*0.8});
let lt=0,lastW=0;
function rainLoop(ts){requestAnimationFrame(rainLoop);if(MOB&&ts-lt<33)return;const dt=Math.min(0.05,(ts-lt)/1000||0.016);lt=ts;
 const Wd=innerWidth,Hd=innerHeight;rx.clearRect(0,0,Wd,Hd);
 const I=RM?0:Math.min(1,RAINMM/30);const n=Math.round(NMAX*Math.min(1,Math.sqrt(I)));
 if(n>0){const ang=0.18,len=(10+26*I);rx.strokeStyle=`rgba(210,225,240,${0.25+0.35*I})`;rx.lineWidth=MOB?1:1.2;rx.beginPath();
  for(let k=0;k<n;k++){const d=DROPS[k];d.y+=d.v*dt*(1.4+1.6*I);d.x+=d.v*dt*0.25;if(d.y>1){d.y-=1.05;d.x=Math.random();if(Math.random()<0.25*I&&SPL.length<(MOB?40:120))SPL.push({x:Math.random()*Wd,y:Hd*(0.3+0.7*Math.random()),t:0})}if(d.x>1)d.x-=1;
   const X=d.x*Wd,Y=d.y*Hd;rx.moveTo(X,Y);rx.lineTo(X-len*ang*d.l,Y-len*d.l)}rx.stroke()}
 // éclaboussures / ronds dans l'eau
 rx.strokeStyle='rgba(230,240,255,0.5)';rx.lineWidth=1;
 for(let k=SPL.length-1;k>=0;k--){const s=SPL[k];s.t+=dt*2.2;if(s.t>1){SPL.splice(k,1);continue}rx.globalAlpha=1-s.t;rx.beginPath();rx.ellipse(s.x,s.y,2+10*s.t,1+4*s.t,0,0,6.283);rx.stroke()}rx.globalAlpha=1;
 // eau vivante : ré-rendu de la couche ~20-30 i/s
 if(!RM&&W.img&&ts-lastW>(MOB?66:40)){lastW=ts;layers()}}
requestAnimationFrame(rainLoop);

// ---------- Partage WhatsApp ----------
const EVD={'2020-09-05':'le 5 septembre 2020','2022-08-03':'le 3 août 2022','2024-08-16':'le 16 août 2024','2025-07-24':'le 24 juillet 2025','2026-08-03':'dans la nuit du 2 au 3 août 2026'};
function shareText(){const F=LASTF;if(!F)return '';const link=`${location.origin}/?lat=${F.lat.toFixed(5)}&lon=${F.lon.toFixed(5)}`;
 const ev=F.rows.filter(r=>!r.k.startsWith('T')).sort((a,b)=>b.d-a.d)[0];const q=F.near;
 if(!ev||ev.d<0.05){const t=F.rows.find(r=>r.k==='T100');return `Chez moi à ${q}, l'outil Ouaga Inondations 3D ne simule pas d'eau lors des grands orages 2020-2026`+(t&&t.d>=0.05?` (mais jusqu'à ${Math.round(t.d*100)} cm en pluie centennale)`:'')+`. Et chez toi ? ${link}`}
 const mm=Math.round(sum(META.scen[ev.k].rain));
 return `Chez moi à ${q}, l'outil Ouaga Inondations 3D dit que l'eau est montée à ${Math.round(ev.d*100)} cm ${EVD[ev.k]||ev.label} (orage de ${mm} mm). Et chez toi ? ${link}`}
function shareWA(){const t=shareText();if(!t)return;window.open('https://wa.me/?text='+encodeURIComponent(t),'_blank','noopener')}
async function shareNative(b){const t=shareText();try{if(navigator.share){await navigator.share({title:'Ouaga Inondations 3D',text:t});return}}catch(e){if(e.name==='AbortError')return}
 try{await navigator.clipboard.writeText(t);b.textContent='Texte copié ✓'}catch(e){prompt('Copiez ce texte :',t)}}
// ---------- Témoignage « Chez moi, c'était différent » ----------
function openTem(){const F=LASTF;let d=$('tem');if(!d){d=document.createElement('div');d.id='tem';document.body.appendChild(d)}
 const ev=META.order.filter(k=>!k.startsWith('T'));
 d.innerHTML=`<form id="temf" class="temc" autocomplete="on"><button type="button" class="x" onclick="$('tem').remove()">✕</button>
 <div class="big">🙋 Chez moi, c'était différent</div><div class="muted">Aidez-nous à corriger la simulation : dites-nous ce que vous avez vu.</div>
 <label>Point (lat, lon)<input name="pt" required value="${F?F.lat.toFixed(5)+', '+F.lon.toFixed(5):''}" inputmode="decimal"></label>
 <label>Quartier<input name="quartier" maxlength="80" value="${F?esc(F.near):''}"></label>
 <label>Orage<select name="scen">${ev.map(k=>`<option value="${k}">${META.scen[k].label}</option>`).join('')}<option value="">Autre date…</option></select></label>
 <label id="adl" style="display:none">Autre date<input name="autre_date" type="date" min="2000-01-01"></label>
 <fieldset><legend>Hauteur d'eau devant chez vous</legend>
 ${[['cheville','à la cheville (~10 cm)'],['genou','au genou (~50 cm)'],['cuisse','à la cuisse (~75 cm)'],['taille','à la taille (~1 m)'],['sous_porte','sous la porte'],['cour','dans la cour seulement'],['maison','entrée dans la maison']].map(([v,l])=>`<label class="rad"><input type="radio" name="hauteur" value="${v}" required> ${l}</label>`).join('')}</fieldset>
 <label>Photo (facultatif)<input name="photo0" type="file" accept="image/*"></label>
 <label class="rad"><input type="checkbox" name="publier" value="1"> Vous pouvez publier ma photo</label>
 <label>Ce que vous avez vu (facultatif)<textarea name="texte" maxlength="1000" rows="3"></textarea></label>
 <label>Contact WhatsApp (facultatif)<input name="contact" maxlength="40" inputmode="tel" placeholder="+226 …"></label>
 <input name="site" class="hp" tabindex="-1" autocomplete="off">
 <div class="small">🔒 Confidentialité : votre témoignage n'est pas affiché publiquement. Il sert uniquement à vérifier et améliorer la simulation. Le numéro de contact n'est utilisé que pour vous recontacter à propos de ce témoignage ; la photo n'est publiée que si vous cochez la case. Pour faire effacer vos données, écrivez-nous via le contact indiqué dans « Sources et limites ».</div>
 <button class="btn" type="submit" id="temsub">Envoyer</button><span id="temmsg" class="small"></span></form>`;
 const f=$('temf');f.scen.onchange=()=>{$('adl').style.display=f.scen.value?'none':'block'};
 f.onsubmit=async e=>{e.preventDefault();const m=$('temmsg'),b=$('temsub');const pt=f.pt.value.split(/[ ,;]+/).map(Number);
  if(pt.length<2||!isFinite(pt[0])||!isFinite(pt[1])){m.textContent='Point invalide (ex. 12.31822, -1.49668).';return}
  const fd=new FormData();fd.set('lat',pt[0]);fd.set('lon',pt[1]);for(const k of['quartier','scen','autre_date','texte','contact','site'])fd.set(k,f[k].value);
  fd.set('hauteur',f.querySelector('input[name=hauteur]:checked').value);fd.set('publier',f.publier.checked?'1':'0');
  b.disabled=true;m.textContent='Envoi…';
  try{const file=f.photo0.files[0];if(file){m.textContent='Préparation de la photo…';const j=await shrink(file);if(j)fd.set('photo',j,'photo.jpg')}
   const r=await fetch('/api/temoignage',{method:'POST',body:fd});const o=await r.json();
   if(o.ok){f.innerHTML='<div class="big">Merci ! 🙏</div><p>Votre témoignage a bien été reçu. Il nous aidera à corriger la carte.</p><button class="btn" type="button" onclick="$(\'tem\').remove()">Fermer</button>';window.TEMID=o.id}
   else{m.textContent='Erreur : '+(o.error||r.status);b.disabled=false}}catch(err){m.textContent='Envoi impossible, réessayez.';b.disabled=false}}}
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function shrink(file){const url=URL.createObjectURL(file);try{const im=await new Promise((ok,ko)=>{const i=new Image();i.onload=()=>ok(i);i.onerror=ko;i.src=url});
 let w=im.naturalWidth,h=im.naturalHeight,s=Math.min(1,1600/Math.max(w,h));const c=document.createElement('canvas');
 for(let q of[0.82,0.72,0.6,0.5]){c.width=Math.round(w*s);c.height=Math.round(h*s);c.getContext('2d').drawImage(im,0,0,c.width,c.height);
  const b=await new Promise(r=>c.toBlob(r,'image/jpeg',q));if(b&&b.size<1_500_000)return b;s*=0.8}return null}finally{URL.revokeObjectURL(url)}}
