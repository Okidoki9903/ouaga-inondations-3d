// Cloudflare Worker : sert docs/ (Workers Static Assets), corrige Content-Type et gère Range (PMTiles)
const T={webmanifest:'application/manifest+json',css:'text/css; charset=utf-8',jpg:'image/jpeg',svg:'image/svg+xml',html:'text/html; charset=utf-8',js:'application/javascript; charset=utf-8',json:'application/json; charset=utf-8',png:'image/png',pmtiles:'application/octet-stream'};
async function forecast(ctx){
 const key=new Request('https://cache.local/forecast-v1');const c=caches.default;let r=await c.match(key);if(r)return r;
 const api='https://api.open-meteo.com/v1/forecast?latitude=12.37&longitude=-1.52&hourly=precipitation&forecast_days=3&timezone=GMT&models=ecmwf_ifs025,gfs_seamless,icon_seamless,meteofrance_seamless';
 const up=await fetch(api);if(!up.ok)return new Response(JSON.stringify({error:'open-meteo '+up.status}),{status:502,headers:{'Content-Type':'application/json'}});
 const j=await up.json();j.fetched=new Date().toISOString();
 r=new Response(JSON.stringify(j),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=1800','Access-Control-Allow-Origin':'*'}});
 ctx.waitUntil(c.put(key,r.clone()));return r}
const ALLOW=/^(maps\.app\.goo\.gl|goo\.gl|g\.co|maps\.google\.[a-z.]+|www\.google\.[a-z.]+|google\.[a-z.]+|consent\.google\.[a-z.]+|maps\.apple\.com|maps\.apple|apple\.co|wa\.me)$/i;
const J=(o,st=200)=>new Response(JSON.stringify(o),{status:st,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=86400'}});
async function resolve(link){let u;try{u=new URL(link)}catch(e){return J({error:'lien invalide'},400)}
 for(let i=0;i<6;i++){if(u.protocol!=='https:'&&u.protocol!=='http:'||!ALLOW.test(u.hostname))return J({error:'hôte non autorisé',host:u.hostname},400);
  if(/\/sorry\//.test(u.pathname)&&u.searchParams.get('continue'))u=new URL(u.searchParams.get('continue'));
  if(i>0&&!/^(maps\.app\.goo\.gl|goo\.gl|g\.co|apple\.co)$/i.test(u.hostname))return J({url:u.toString()});
  const r=await fetch(u.toString(),{redirect:'manual',headers:{'User-Agent':'Mozilla/5.0 (compatible; OuagaInondations/1.0)','Accept-Language':'fr'}});
  const loc=r.headers.get('Location');if(r.status>=300&&r.status<400&&loc){u=new URL(loc,u);
   const cont=u.searchParams.get('continue');if(/consent\./.test(u.hostname)&&cont){u=new URL(cont)}continue}
  let body='';if(r.ok){body=(await r.text()).slice(0,300000)}
  const m=body.match(/(?:center=|ll=|@|!3d)(-?\d{1,2}\.\d+)(?:,|%2C|!4d)(-?\d{1,3}\.\d+)/);
  return J({url:u.toString(),hint:m?m[1]+','+m[2]:null})}
 return J({url:u.toString()})}

// ---------- Témoignages citoyens (D1 + photos en KV), admin privé ----------
const HAUT=['cheville','genou','cuisse','taille','sous_porte','cour','maison'];
const NS={'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow'};
const JN=(o,st=200)=>new Response(JSON.stringify(o),{status:st,headers:{'Content-Type':'application/json; charset=utf-8',...NS}});
async function sha(s){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
const clip=(v,n)=>String(v||'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n);
async function temoignage(req,env){
 if(req.method!=='POST')return JN({error:'méthode'},405);
 const len=+req.headers.get('Content-Length')||0;if(len>2_200_000)return JN({error:'envoi trop gros (max 1,5 Mo de photo)'},413);
 const ip=req.headers.get('CF-Connecting-IP')||'?';const ih=(await sha(ip+'|ouaga-tem')).slice(0,24);
 const c=await env.DB.prepare("SELECT SUM(created>datetime('now','-1 hour')) h, COUNT(*) d FROM temoignages WHERE ip_hash=? AND created>datetime('now','-1 day')").bind(ih).first();
 if((c.h||0)>=5||(c.d||0)>=20)return JN({error:'Trop d\'envois depuis cette connexion. Réessayez plus tard.'},429);
 let f;try{f=await req.formData()}catch(e){return JN({error:'formulaire invalide'},400)}
 if(f.get('site'))return JN({ok:true});// pot de miel anti-robots
 const lat=+f.get('lat'),lon=+f.get('lon');if(!(lat>12.25&&lat<12.48&&lon>-1.65&&lon<-1.40))return JN({error:'point hors de la zone (Ouagadougou)'},400);
 const h=String(f.get('hauteur')||'');if(!HAUT.includes(h))return JN({error:'hauteur manquante'},400);
 const scen=clip(f.get('scen'),20),autre=clip(f.get('autre_date'),30);if(!scen&&!autre)return JN({error:'date manquante'},400);
 let photo=f.get('photo'),pb=0,buf=null;
 if(photo&&typeof photo!=='string'&&photo.size>0){if(photo.size>1_600_000)return JN({error:'photo trop lourde'},413);buf=new Uint8Array(await photo.arrayBuffer());
  if(!(buf[0]===0xFF&&buf[1]===0xD8))return JN({error:'photo : JPEG attendu'},400);pb=buf.length}
 const r=await env.DB.prepare('INSERT INTO temoignages(created,ip_hash,lat,lon,quartier,scen,autre_date,hauteur,texte,publier,contact,photo_bytes,ua) VALUES(datetime(\'now\'),?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id')
  .bind(ih,Math.round(lat*1e5)/1e5,Math.round(lon*1e5)/1e5,clip(f.get('quartier'),80),scen,autre,h,clip(f.get('texte'),1000),f.get('publier')==='1'?1:0,clip(f.get('contact'),40),pb,clip(req.headers.get('User-Agent'),120)).first();
 if(buf){const key='p/'+r.id;await env.PHOTOS.put(key,buf,{metadata:{type:'image/jpeg'}});await env.DB.prepare('UPDATE temoignages SET photo_key=? WHERE id=?').bind(key,r.id).run()}
 return JN({ok:true,id:r.id})}
function eq(a,b){if(!a||!b||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
function authed(req,env){const ck=(req.headers.get('Cookie')||'').match(/adm=([^;]+)/);const t=new URL(req.url).searchParams.get('t');return eq(t||'',env.ADMIN_TOKEN)||eq(ck?ck[1]:'',env.ADMIN_TOKEN)}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function admin(req,env,u){
 if(!env.ADMIN_TOKEN||!authed(req,env))return new Response('Accès refusé',{status:401,headers:NS});
 const t=u.searchParams.get('t');if(t)return new Response(null,{status:302,headers:{...NS,Location:'/admin','Set-Cookie':`adm=${t}; Path=/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`}});
 const p=u.pathname;
 if(p.startsWith('/admin/photo/')){const v=await env.PHOTOS.get('p/'+(+p.split('/').pop()),'arrayBuffer');return v?new Response(v,{headers:{'Content-Type':'image/jpeg',...NS}}):new Response('',{status:404})}
 if(p==='/admin/delete'&&req.method==='POST'){const id=+(await req.formData()).get('id');await env.PHOTOS.delete('p/'+id);await env.DB.prepare('DELETE FROM temoignages WHERE id=?').bind(id).run();return new Response(null,{status:303,headers:{...NS,Location:'/admin'}})}
 const rows=(await env.DB.prepare('SELECT * FROM temoignages ORDER BY id DESC LIMIT 2000').all()).results;
 const cols=['id','created','lat','lon','quartier','scen','autre_date','hauteur','texte','publier','contact','photo_bytes'];
 if(p==='/admin.csv'||p==='/admin/csv'){const q=v=>'"'+String(v??'').replace(/"/g,'""')+'"';return new Response('\ufeff'+[cols.join(';'),...rows.map(r=>cols.map(c=>q(r[c])).join(';'))].join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="temoignages.csv"',...NS}})}
 const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Témoignages (privé)</title><style>body{font:13px system-ui;margin:12px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:4px;vertical-align:top;text-align:left}img{width:120px;border-radius:4px}</style>
<h2>Témoignages citoyens (${rows.length}) – privé</h2><p><a href="/admin/csv">Exporter CSV</a></p><table><tr>${['#','Date','Point','Quartier','Orage','Hauteur','Texte','Publier','Contact','Photo',''].map(x=>`<th>${x}</th>`).join('')}</tr>
${rows.map(r=>`<tr><td>${r.id}</td><td>${esc(r.created)} UTC</td><td><a href="/?lat=${r.lat}&lon=${r.lon}" target="_blank">${r.lat}, ${r.lon}</a></td><td>${esc(r.quartier)}</td><td>${esc(r.scen||'')} ${esc(r.autre_date||'')}</td><td>${esc(r.hauteur)}</td><td>${esc(r.texte)}</td><td>${r.publier?'oui':'non'}</td><td>${esc(r.contact)}</td><td>${r.photo_key?`<a href="/admin/photo/${r.id}" target="_blank"><img loading="lazy" src="/admin/photo/${r.id}"></a>`:''}</td><td><form method="post" action="/admin/delete" onsubmit="return confirm('Supprimer #${r.id} ?')"><input type="hidden" name="id" value="${r.id}"><button>Supprimer</button></form></td></tr>`).join('')}</table>`;
 return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8',...NS}})}
export default {async fetch(req,env,ctx){
 const u=new URL(req.url);if(u.pathname==='/api/temoignage')return temoignage(req,env);if(u.pathname==='/admin'||u.pathname.startsWith('/admin/')||u.pathname==='/admin.csv')return admin(req,env,u);if(u.pathname==='/api/forecast')return forecast(ctx);
 if(u.pathname==='/api/resolve')return resolve(u.searchParams.get('u')||'');const ext=(u.pathname.endsWith('/')?'html':u.pathname.split('.').pop());
 const res=await env.ASSETS.fetch(req);if(!res.ok&&res.status!==206)return res;
 const h=new Headers(res.headers);h.set('Content-Type',T[ext]||h.get('Content-Type'));h.set('Accept-Ranges','bytes');h.set('Access-Control-Allow-Origin','*');
 const rg=req.headers.get('Range');
 if(rg&&res.status===200){const m=/bytes=(\d+)-(\d*)/.exec(rg);if(m){const buf=await res.arrayBuffer();const s=+m[1];const e=m[2]?Math.min(+m[2],buf.byteLength-1):buf.byteLength-1;
  h.set('Content-Range',`bytes ${s}-${e}/${buf.byteLength}`);h.set('Content-Length',String(e-s+1));return new Response(buf.slice(s,e+1),{status:206,headers:h})}}
 return new Response(res.body,{status:res.status,headers:h})}};
