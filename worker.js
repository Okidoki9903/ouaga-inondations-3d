// Cloudflare Worker : sert docs/ (Workers Static Assets), corrige Content-Type et gère Range (PMTiles)
const T={css:'text/css; charset=utf-8',jpg:'image/jpeg',svg:'image/svg+xml',html:'text/html; charset=utf-8',js:'application/javascript; charset=utf-8',json:'application/json; charset=utf-8',png:'image/png',pmtiles:'application/octet-stream'};
async function forecast(ctx){
 const key=new Request('https://cache.local/forecast-v1');const c=caches.default;let r=await c.match(key);if(r)return r;
 const api='https://api.open-meteo.com/v1/forecast?latitude=12.37&longitude=-1.52&hourly=precipitation&forecast_days=3&timezone=GMT&models=ecmwf_ifs025,gfs_seamless,icon_seamless,meteofrance_seamless';
 const up=await fetch(api);if(!up.ok)return new Response(JSON.stringify({error:'open-meteo '+up.status}),{status:502,headers:{'Content-Type':'application/json'}});
 const j=await up.json();j.fetched=new Date().toISOString();
 r=new Response(JSON.stringify(j),{headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'public, max-age=1800','Access-Control-Allow-Origin':'*'}});
 ctx.waitUntil(c.put(key,r.clone()));return r}
export default {async fetch(req,env,ctx){
 const u=new URL(req.url);if(u.pathname==='/api/forecast')return forecast(ctx);const ext=(u.pathname.endsWith('/')?'html':u.pathname.split('.').pop());
 const res=await env.ASSETS.fetch(req);if(!res.ok&&res.status!==206)return res;
 const h=new Headers(res.headers);h.set('Content-Type',T[ext]||h.get('Content-Type'));h.set('Accept-Ranges','bytes');h.set('Access-Control-Allow-Origin','*');
 const rg=req.headers.get('Range');
 if(rg&&res.status===200){const m=/bytes=(\d+)-(\d*)/.exec(rg);if(m){const buf=await res.arrayBuffer();const s=+m[1];const e=m[2]?Math.min(+m[2],buf.byteLength-1):buf.byteLength-1;
  h.set('Content-Range',`bytes ${s}-${e}/${buf.byteLength}`);h.set('Content-Length',String(e-s+1));return new Response(buf.slice(s,e+1),{status:206,headers:h})}}
 return new Response(res.body,{status:res.status,headers:h})}};
