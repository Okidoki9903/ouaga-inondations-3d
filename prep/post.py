import numpy as np,json,os,rasterio
from rasterio.warp import reproject,Resampling
from rasterio.transform import from_origin,from_bounds
from PIL import Image
from pyproj import Transformer
G=np.load('grid.npz');H=int(G['H']);W=int(G['W']);R=float(G['R'])
T=from_origin(float(G['x0']),float(G['y1']),R,R);wm=G['wm']
B=(-1.65,12.25,-1.40,12.48);OW,OH=1400,1290
OT=from_bounds(*B,OW,OH)
S=json.load(open('scen.json'));order=list(S)
A='/workspace/ouaga-flood/app/docs/data/'
def col(d):
    rgba=np.zeros(d.shape+(4,),'u1')
    for lo,c in [(0.05,(158,202,225,150)),(0.2,(66,146,198,190)),(0.5,(8,81,156,215)),(1.0,(63,0,125,235))]:
        rgba[d>=lo]=c
    return rgba
def to4326(a):
    o=np.zeros((OH,OW),'f4');reproject(a.astype('f4'),o,src_transform=T,src_crs='EPSG:32630',dst_transform=OT,dst_crs='EPSG:4326',resampling=Resampling.max);return o
# places
osm=json.load(open('../data/osm_ouaga.json'));geo=json.load(open('../data/geocoded.json'))
from shapely.geometry import shape
pl={}
for p in osm['place']+geo: pl.setdefault(p['name'].strip().lower(),{'name':p['name'],'lon':p['lon'],'lat':p['lat']})
for a in osm['admin']:
    if a['level'] in('neighbourhood','suburb'):
        c=shape(a['geom']).centroid;pl.setdefault(a['name'].lower(),{'name':a['name'],'lon':c.x,'lat':c.y})
rep={'tanghin':'5 sept. 2020','somgandé':'5 sept. 2020','somgande':'5 sept. 2020','toukin':'5 sept. 2020','nioko':'5 sept. 2020','zone 1':'5 sept. 2020 ; 3 août 2022','wemtenga':'3 août 2022','rimkiéta':'16 août 2024','toécin':'16 août 2024','kalgondin':'24 juil. 2025','kalgodin':'24 juil. 2025','bonheur ville':'2-3 août 2026','nagrin':'2-3 août 2026'}
places=list(pl.values())
tr=Transformer.from_crs(4326,32630,always_xy=True)
for p in places:
    p['reported']=rep.get(p['name'].lower(),'');p['stats']={}
    x,y=tr.transform(p['lon'],p['lat']);p['c']=(int((y1:=float(G['y1'])-y)/R),int((x-float(G['x0']))/R))
meta={'bounds':[B[0],B[1],B[2],B[3]],'order':order,'scen':{}}
val=[]
for k in order:
    r=np.load(f'res_{k}.npz');d=r['d'].astype('f4');hm=r['hmax'].astype('f4')
    d[:,wm>0]=0;hm[wm>0]=0  # hide reservoirs themselves
    os.makedirs(A+k,exist_ok=True)
    for i in range(d.shape[0]): Image.fromarray(col(to4326(d[i]))).save(A+f'{k}/{i}.png',optimize=True)
    Image.fromarray(col(to4326(hm))).save(A+f'{k}/max.png',optimize=True)
    meta['scen'][k]={**S[k],'hours':int(d.shape[0]),'rain':S[k]['rain']+[0]*6}
    rr=20
    for p in places:
        i,j=p['c'];w=hm[max(i-rr,0):i+rr,max(j-rr,0):j+rr]
        p['stats'][k]=[round(float(w.max()) if w.size else 0,2),round(float((w>0.2).sum())*R*R/1e4,1)]
for p in places: p.pop('c')
places.sort(key=lambda p:p['name'])
json.dump(places,open(A+'places.json','w'),ensure_ascii=False)
meta['about']=open('about.html').read()
json.dump(meta,open(A+'meta.json','w'),ensure_ascii=False)
# validation table
med={k:np.median([p['stats'][k][1] for p in places]) for k in order}
lines=['| Quartier signalé | Événement | Prof. max simulée (m) | ha >20 cm (r=400 m) | Médiane ha tous quartiers |','|---|---|---|---|---|']
ev={'5 sept. 2020':'2020-09-05','3 août 2022':'2022-08-03','16 août 2024':'2024-08-16','24 juil. 2025':'2025-07-24','2-3 août 2026':'2026-08-03'}
for p in places:
    for e in p['reported'].split(' ; ') if p['reported'] else []:
        k=ev[e];lines.append(f"| {p['name']} | {e} | {p['stats'][k][0]} | {p['stats'][k][1]} | {med[k]} |")
open('../VALIDATION.md','w').write('\n'.join(lines));print('\n'.join(lines))
