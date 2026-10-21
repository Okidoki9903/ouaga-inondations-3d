// Cloudflare Worker : sert docs/ (Workers Static Assets), corrige Content-Type et gère Range (PMTiles)
const T={jpg:'image/jpeg',svg:'image/svg+xml',html:'text/html; charset=utf-8',js:'application/javascript; charset=utf-8',json:'application/json; charset=utf-8',png:'image/png',pmtiles:'application/octet-stream'};
export default {async fetch(req,env){
 const u=new URL(req.url);const ext=(u.pathname.endsWith('/')?'html':u.pathname.split('.').pop());
 const res=await env.ASSETS.fetch(req);if(!res.ok&&res.status!==206)return res;
 const h=new Headers(res.headers);h.set('Content-Type',T[ext]||h.get('Content-Type'));h.set('Accept-Ranges','bytes');h.set('Access-Control-Allow-Origin','*');
 const rg=req.headers.get('Range');
 if(rg&&res.status===200){const m=/bytes=(\d+)-(\d*)/.exec(rg);if(m){const buf=await res.arrayBuffer();const s=+m[1];const e=m[2]?Math.min(+m[2],buf.byteLength-1):buf.byteLength-1;
  h.set('Content-Range',`bytes ${s}-${e}/${buf.byteLength}`);h.set('Content-Length',String(e-s+1));return new Response(buf.slice(s,e+1),{status:206,headers:h})}}
 return new Response(res.body,{status:res.status,headers:h})}};
