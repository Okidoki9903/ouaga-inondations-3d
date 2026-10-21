const P=new pmtiles.Protocol();maplibregl.addProtocol('pmtiles',P.tile);
let META,PLACES,cur,timer;
const map=new maplibregl.Map({container:'map',style:'https://tiles.openfreemap.org/styles/positron',center:[-1.52,12.37],zoom:12.5,pitch:55,bearing:-15,maxPitch:75});
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
 PLACES.filter(p=>norm(p.name).includes(q)).slice(0,8).forEach(p=>{const d=document.createElement('div');d.textContent=p.name;d.onclick=()=>{sel=p;map.flyTo({center:[p.lon,p.lat],zoom:15,pitch:60});showInfo()};r.appendChild(d)})};
let sel=null;
function showInfo(){if(!sel)return;const st=sel.stats[cur];document.getElementById('info').innerHTML=`<b>${sel.name}</b><br>Scénario : ${META.scen[cur].label}<br>Profondeur max (rayon 400 m) : <b>${st[0].toFixed(2)} m</b><br>Surface sous &gt;20 cm : <b>${st[1].toFixed(1)} ha</b><br><span class="small">${sel.reported?('Inondation signalée : '+sel.reported):''}</span>`}
