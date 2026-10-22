# Fetch OGIMET SYNOP 65503 + IEM METAR DFFD around each past event; extract precip groups and present weather.
import json,requests,time,datetime as dt,re,sys
S=json.load(open('scen.json'))
TR={'1':6,'2':12,'3':18,'4':24,'5':1,'6':2,'7':3,'8':9,'9':15}
def rr(s):
    v=int(s); return 0.0 if v==990 else (round((v-990)/10,1) if v>990 else float(v))
def parse(line):
    p=line.split(',');t=dt.datetime(*map(int,p[1:6]));msg=p[6].replace('=','').split()
    body=msg[3:];out={'t':t.isoformat(),'p':[],'ww':None}
    sec=1
    for g in body:
        if g=='333': sec=3;continue
        if g in('444','555'): break
        if sec==1 and len(g)==5 and g[0]=='7' and g[1:3].isdigit() and out['ww'] is None and body.index(g)>2: out['ww']=int(g[1:3])
        if len(g)==5 and g[0]=='6' and g[1:4].isdigit() and g[4] in TR and body.index(g)>1:
            out['p'].append((TR[g[4]],rr(g[1:4]),sec))
    return out
res={}
for k,v in S.items():
    if k.startswith('T'): continue
    s=dt.datetime.fromisoformat(v['start']);a=s-dt.timedelta(hours=18);b=s+dt.timedelta(hours=30)
    u=f"https://www.ogimet.com/cgi-bin/getsynop?block=65503&begin={a:%Y%m%d%H%M}&end={b:%Y%m%d%H%M}"
    txt=requests.get(u,timeout=60).text;open(f'obs/synop_{k}.txt','w').write(txt)
    m=requests.get(f"https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py?station=DFFD&data=metar&year1={a.year}&month1={a.month}&day1={a.day}&hour1={a.hour}&year2={b.year}&month2={b.month}&day2={b.day}&hour2={b.hour}&tz=Etc/UTC&format=onlycomma",timeout=60).text
    open(f'obs/metar_{k}.csv','w').write(m)
    obs=[parse(l) for l in txt.splitlines() if l.startswith('65503')]
    res[k]=obs;print(k,len(obs),len(m.splitlines()))
    for o in obs:
        if o['p'] or (o['ww'] and o['ww']>=50) or (o['ww'] in(17,29,91,92,95,97)): print('  ',o)
    time.sleep(20)
json.dump(res,open('obs/synop_parsed.json','w'),indent=0)
