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
export default {async fetch(req,env,ctx){
 const u=new URL(req.url);if(u.pathname==='/api/forecast')return forecast(ctx);
 if(u.pathname==='/api/resolve')return resolve(u.searchParams.get('u')||'');const ext=(u.pathname.endsWith('/')?'html':u.pathname.split('.').pop());
 const res=await env.ASSETS.fetch(req);if(!res.ok&&res.status!==206)return res;
 const h=new Headers(res.headers);h.set('Content-Type',T[ext]||h.get('Content-Type'));h.set('Accept-Ranges','bytes');h.set('Access-Control-Allow-Origin','*');
 const rg=req.headers.get('Range');
 if(rg&&res.status===200){const m=/bytes=(\d+)-(\d*)/.exec(rg);if(m){const buf=await res.arrayBuffer();const s=+m[1];const e=m[2]?Math.min(+m[2],buf.byteLength-1):buf.byteLength-1;
  h.set('Content-Range',`bytes ${s}-${e}/${buf.byteLength}`);h.set('Content-Length',String(e-s+1));return new Response(buf.slice(s,e+1),{status:206,headers:h})}}
 return new Response(res.body,{status:res.status,headers:h})}};
