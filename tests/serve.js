const http=require('http'),fs=require('fs'),path=require('path');const D='/workspace/ouaga-flood/app/docs';
const MT={html:'text/html',js:'application/javascript',css:'text/css',json:'application/json',png:'image/png',svg:'image/svg+xml'};
http.createServer((q,r)=>{let p=decodeURIComponent(q.url.split('?')[0]);if(p=='/')p='/index.html';const f=path.join(D,p);
 if(!fs.existsSync(f)){r.writeHead(404);return r.end()}const st=fs.statSync(f);const h={'Content-Type':MT[f.split('.').pop()]||'application/octet-stream','Accept-Ranges':'bytes'};
 const m=/bytes=(\d+)-(\d+)?/.exec(q.headers.range||'');if(m){const a=+m[1],b=m[2]?+m[2]:st.size-1;r.writeHead(206,{...h,'Content-Range':`bytes ${a}-${b}/${st.size}`,'Content-Length':b-a+1});fs.createReadStream(f,{start:a,end:b}).pipe(r)}
 else{r.writeHead(200,{...h,'Content-Length':st.size});fs.createReadStream(f).pipe(r)}}).listen(8787);
