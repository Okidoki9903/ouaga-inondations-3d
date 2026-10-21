// Analyse de liens de localisation (Google Maps, Apple Plans, WhatsApp, coordonnées, plus codes)
(function(g){
const N='(-?\\d{1,3}(?:\\.\\d+)?)';const SEP='\\s*(?:,|%2C|\\+|\\s)\\s*';
function ok(a,b){a=+a;b=+b;return isFinite(a)&&isFinite(b)&&Math.abs(a)<=90&&Math.abs(b)<=180?{lat:a,lon:b}:null}
const OLC='23456789CFGHJMPQRVWX';
function olcDecode(code,ref){code=code.toUpperCase().replace(/\s/g,'');const p=code.indexOf('+');if(p<0)return null;
 let c=code.replace('+','').replace(/0+$/,'');if(p<8){ // code court : récupérer avec la référence
  const pad=8-p;const res=Math.pow(20,2-pad/2);const half=res/2;
  const rl=Math.floor(ref.lat/res)*res, rn=Math.floor(ref.lon/res)*res; // préfixe
  const full=olcEncode(ref.lat,ref.lon).slice(0,pad)+code;const d=olcDecode(full,ref);if(!d)return null;
  let {lat,lon}=d;if(lat-ref.lat>half)lat-=res;else if(lat-ref.lat<-half)lat+=res;if(lon-ref.lon>half)lon-=res;else if(lon-ref.lon<-half)lon+=res;return {lat,lon}}
 let lat=-90,lon=-180,r=20;for(let i=0;i<Math.min(c.length,10);i+=2){const a=OLC.indexOf(c[i]),b=OLC.indexOf(c[i+1]);if(a<0||(c[i+1]!==undefined&&b<0))return null;lat+=a*r;lon+=(b<0?0:b)*r;if(i+2<Math.min(c.length,10))r/=20}
 let rlat=r,rlon=r;if(c.length>10){for(let i=10;i<c.length;i++){const v=OLC.indexOf(c[i]);if(v<0)return null;rlat/=5;rlon/=4;lat+=Math.floor(v/4)*rlat;lon+=(v%4)*rlon}}
 return {lat:lat+rlat/2,lon:lon+rlon/2}}
function olcEncode(lat,lon){let a=lat+90,b=lon+180,s='',r=20;for(let i=0;i<5;i++){const x=Math.floor(a/r),y=Math.floor(b/r);s+=OLC[x]+OLC[y];a-=x*r;b-=y*r;r/=20;if(i==3)s+='';}return s.slice(0,8)+'+'+s.slice(8)}
function parseLoc(s,ref){if(!s)return null;s=String(s).trim();let u=s;try{u=decodeURIComponent(s)}catch(e){}
 let m;
 if(m=u.match(new RegExp('!3d'+N+'!4d'+N)))return ok(m[1],m[2]);
 if(m=u.match(new RegExp('[?&](?:q|ll|sll|query|center|destination|daddr|coordinate|cp|address)='+'(?:loc:)?'+N+SEP+N)))return ok(m[1],m[2]);
 if(m=u.match(new RegExp('/place/'+N+SEP+N)))return ok(m[1],m[2]);
 if(m=u.match(new RegExp('/search/'+N+SEP+N)))return ok(m[1],m[2]);
 if(m=u.match(/\b([23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{0,3})\b/i)){const d=olcDecode(m[1],ref||{lat:12.37,lon:-1.52});if(d)return d}
 if(m=u.match(new RegExp('@'+N+','+N)))return ok(m[1],m[2]);
 if(m=u.match(new RegExp('geo:'+N+','+N)))return ok(m[1],m[2]);
 if(m=u.match(/(\d{1,2}(?:[.,]\d+)?)\s*°?\s*([NS])[\s,;]+(\d{1,3}(?:[.,]\d+)?)\s*°?\s*([EOW])/i)){const a=+m[1].replace(',','.')*(m[2].toUpperCase()=='S'?-1:1),b=+m[3].replace(',','.')*(/[OW]/i.test(m[4])?-1:1);return ok(a,b)}
 if(m=u.match(new RegExp('^\\s*'+N+'\\s*[,; ]\\s*'+N+'\\s*$')))return ok(m[1],m[2]);
 if(m=u.match(new RegExp('[?&]saddr='+N+SEP+N)))return ok(m[1],m[2]);
 return null}
function needsResolve(s){return /^(https?:\/\/)?(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs|maps\.apple|apple\.co)\b/i.test(String(s).trim())||(/^https?:\/\//i.test(s)&&!parseLoc(s))}
function findLink(t){const m=String(t||'').match(/https?:\/\/\S+/);return m?m[0]:String(t||'')}
g.LOC={parseLoc,needsResolve,findLink,olcDecode,olcEncode}})(typeof window!=='undefined'?window:globalThis);
