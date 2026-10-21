const P=new pmtiles.Protocol();maplibregl.addProtocol('pmtiles',P.tile);
let META,PLACES,cur,timer;
const map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/positron',center:[-1.52,12.37],zoom:12.5,pitch:55,bearing:-15,maxPitch:75,preserveDrawingBuffer:true,canvasContextAttributes:{preserveDrawingBuffer:true}});
map.addControl(new maplibregl.NavigationControl());
const overlay=new deck.MapboxOverlay({interleaved:true,layers:[]});map.addControl(overlay);
map.on('load',async()=>{
 map.addSource('b',{type:'vector',url:'pmtiles://'+location.origin+'/data/buildings.pmtiles'});
 map.addLayer({id:'b3d',type:'fill-extrusion',source:'b','source-layer':'b',minzoom:14,paint:{'fill-extrusion-color':'#d9cbb5','fill-extrusion-height':['get','h'],'fill-extrusion-opacity':0.85}});
 META=await (await fetch('data/meta.json')).json();PLACES=await (await fetch('data/places.json')).json();
 const s=document.getElementById('scen');
 for(const k of META.order){const o=document.createElement('option');o.value=k;o.textContent=META.scen[k].label;s.appendChild(o)}
 s.onchange=()=>setScen(s.value);setScen(META.order[0]);
 document.getElementById('about').innerHTML=META.about;
});
function setScen(k){cur=k;const S=META.scen[k];const h=document.getElementById('hour');h.max=S.hours-1;
 const pk=S.rain.indexOf(Math.max(...S.rain));h.value=Math.min(S.hours-1,pk+2);
 document.getElementById('src').textContent=S.src;draw();showInfo()}
function draw(){const S=META.scen[cur];const i=+document.getElementById('hour').value;const mx=document.getElementById('maxck').checked;
 const t=new Date(Date.parse(S.start+'Z')+(i+1)*3600e3);
 document.getElementById('hl').textContent=mx?'maximum':(S.start.startsWith('2000')?'H+'+(i+1):t.toISOString().slice(0,16).replace('T',' ')+' (heure de Ouaga = UTC)');
 const cum=S.rain.slice(0,i+1).reduce((a,b)=>a+b,0);document.getElementById('rain').textContent=`Pluie cette heure : ${(S.rain[i]||0).toFixed(1)} mm — cumul : ${cum.toFixed(1)} / ${S.rain.reduce((a,b)=>a+b,0).toFixed(1)} mm`;
 overlay.setProps({layers:[new deck.BitmapLayer({id:'w',bounds:META.bounds,image:`data/${cur}/${mx?'max':i}.png`,opacity:0.85})]})}
document.getElementById('hour').oninput=draw;document.getElementById('maxck').onchange=draw;
document.getElementById('play').onclick=e=>{if(timer){clearInterval(timer);timer=null;e.target.textContent='▶ Lecture';return}
 e.target.textContent='⏸ Pause';timer=setInterval(()=>{const h=document.getElementById('hour');h.value=(+h.value+1)%(+h.max+1);draw()},900)};
const norm=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
document.getElementById('q').oninput=e=>{const q=norm(e.target.value);const r=document.getElementById('res');r.innerHTML='';if(!q)return;
 PLACES.filter(p=>norm(p.name).includes(q)).slice(0,8).forEach(p=>{const d=document.createElement('div');d.textContent=p.name;d.onclick=()=>{sel=p;map.flyTo({center:[p.lon,p.lat],zoom:15,pitch:60});showInfo();document.getElementById('info').scrollIntoView({block:'nearest'})};r.appendChild(d)})};
let sel=null;
function showInfo(){if(!sel)return;const st=sel.stats[cur];document.getElementById('info').innerHTML=`<b>${sel.name}</b><br>Scénario : ${META.scen[cur].label}<br>Profondeur max (rayon 400 m) : <b>${st[0].toFixed(2)} m</b><br>Surface sous &gt;20 cm : <b>${st[1].toFixed(1)} ha</b><br><span class="small">${sel.reported?('Inondation signalée : '+sel.reported):''}</span>`}

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
    msg=`Dans le pire des modèles (${mx.toFixed(0)} mm), situation comparable au scénario <a href="#" onclick="document.getElementById('scen').value='${k}';setScen('${k}');return false">${S.label}</a>. Quartiers les plus exposés dans ce scénario : ${top}.`+(sel?`<br><b>${noms[di]}, ${sel.name} risque : ${riskWord(sel.stats[k][1])[0]}</b>`:'')}
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
 if(mk)mk.remove();mk=new maplibregl.Marker({color:'#d7301f'}).setLngLat([lon,lat]).addTo(map);
 if(fly)map.flyTo({center:[lon,lat],zoom:16,pitch:60});
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
 if(window.innerWidth<600){document.getElementById('panel').classList.remove('min');el.scrollIntoView({block:'start'})}}
map.on('click',e=>fiche(e.lngLat.lng,e.lngLat.lat,false));
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
map.on('load',()=>{const w=setInterval(()=>{if(!META||!PLACES)return;clearInterval(w);loadPrev();const q=new URLSearchParams(location.search);if(q.get('lat'))fiche(+q.get('lon'),+q.get('lat'),true)},200)});
