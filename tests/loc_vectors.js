require('../docs/loc.js');const {parseLoc,needsResolve}=globalThis.LOC;
const T=[
['https://www.google.com/maps/@12.3714277,-1.5196603,15z',12.3714,-1.5197],
['https://www.google.com/maps/place/Rimki%C3%A9ta/@12.3812,-1.5856,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d12.37818!4d-1.58558',12.3782,-1.5856],
['https://maps.google.com/?q=12.36819,-1.52709',12.3682,-1.5271],
['https://maps.google.com/maps?q=12.36819%2C-1.52709&z=17&hl=fr',12.3682,-1.5271],
['https://www.google.com/maps/search/?api=1&query=12.3725,-1.4952',12.3725,-1.4952],
['https://www.google.com/maps/place/12.3725,-1.4952',12.3725,-1.4952],
['https://www.google.com/maps/dir/?api=1&destination=12.36,-1.50',12.36,-1.50],
['https://maps.apple.com/?ll=12.3682,-1.5271&q=Zone%201',12.3682,-1.5271],
['https://maps.apple.com/?q=12.3682,-1.5271',12.3682,-1.5271],
['https://maps.apple.com/place?coordinate=12.3682,-1.5271&name=Pin',12.3682,-1.5271],
['https://maps.apple.com/?address=Ouagadougou&ll=12.37,-1.52',12.37,-1.52],
['Ma position : https://maps.google.com/maps?q=12.3682%2C-1.5271&z=17&hl=fr',12.3682,-1.5271],
['12.3682, -1.5271',12.3682,-1.5271],['12.3682 -1.5271',12.3682,-1.5271],
['12°22\'05" N','x'],['12.37 N, 1.52 O',12.37,-1.52],
['geo:12.37,-1.52',12.37,-1.52],
['7CQ3WFC2+QQ',null],['WFC2+QQ Ouagadougou',null],
['https://maps.app.goo.gl/abc123','R'],['bonjour','N']];
let bad=0;for(const [s,a,b] of T){if(a==='R'){console.log(needsResolve(s)?'OK resolve':'FAIL',s);continue}const r=parseLoc(s);
 if(a==='N'||a==='x'){console.log(r?'(parsed) '+JSON.stringify(r):'OK null',s);continue}
 if(a===null){console.log('pluscode',s,JSON.stringify(r));continue}
 const good=r&&Math.abs(r.lat-a)<1e-3&&Math.abs(r.lon-b)<1e-3;if(!good)bad++;console.log(good?'OK':'FAIL',s,JSON.stringify(r))}
console.log('fails',bad);console.log(globalThis.LOC.olcEncode(12.3682,-1.5271))
for(const s of ['https://www.google.com/maps/place/9C4R%2BMPV+Th%C3%A9%C3%A2tre+du+Cartel,+Porte+46,+rue+9.32,+Goughin,+Ouagadougou/data=!4m2!3m1!1s0xe2e952245c31801:0xad196419140525ce!17m2','https://maps.google.com/?geocode=FZ6VuwAd-Uvp_w%3D%3D;FTeWuwAds03p_yl_DqQcNr0uDjFwTNNfcpGdRw%3D%3D&daddr=7GV7+F28,+Ouaga+2000,+Ouagadougou&saddr=12.2935344,-1.4878803&dirflg=d'])console.log('REAL',JSON.stringify(parseLoc(s)))
