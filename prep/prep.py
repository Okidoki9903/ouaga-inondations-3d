import json,gzip,numpy as np,rasterio
from rasterio.warp import reproject,Resampling
from rasterio.features import rasterize
from rasterio.transform import from_origin
from pyproj import Transformer
from shapely.geometry import shape,LineString,mapping
from shapely.ops import transform as stf
D='/workspace/ouaga-flood/'
B=(-1.65,12.25,-1.40,12.48)
tr=Transformer.from_crs(4326,32630,always_xy=True)
x0,y0=tr.transform(B[0],B[1]);x1,y1=tr.transform(B[2],B[3])
R=20.0
x0=np.floor(x0/R)*R;y1=np.ceil(y1/R)*R
W=int((x1-x0)/R);H=int((y1-y0)/R)
T=from_origin(x0,y1,R,R);crs='EPSG:32630'
print('grid',W,H)
z=np.zeros((H,W),'f4')
with rasterio.open(D+'cop30_N12W002.tif') as s:
    reproject(rasterio.band(s,1),z,dst_transform=T,dst_crs=crs,resampling=Resampling.bilinear)
wc=np.zeros((H,W),'u1')
with rasterio.open(D+'data/wc.tif') as s:
    reproject(rasterio.band(s,1),wc,dst_transform=T,dst_crs=crs,resampling=Resampling.mode)
P=lambda g:stf(tr.transform,g)
osm=json.load(open(D+'data/osm_ouaga.json'))
# channels: lower DEM
burn={'canal':2.0,'drain':1.0,'river':2.0,'stream':1.0,'ditch':0.5,'wadi':1.0}
for k,d in burn.items():
    gs=[P(LineString(w['c'])) for w in osm['waterway'] if w['type']==k and len(w['c'])>1]
    if gs:
        m=rasterize([(g,1) for g in gs],(H,W),transform=T,all_touched=True)
        z-=m*d; print(k,len(gs),m.sum())
wat=[P(shape(w['geom'])) for w in osm['water']]
wm=rasterize([(g,1) for g in wat],(H,W),transform=T)
# reservoirs (barrages 1-2-3): treat as storage, lower bed 2m below surface
z-=wm*2.0
# buildings
bf=np.zeros((H,W),'f4');feats=open(D+'data/buildings.geojsonl','w');n=0
cx=[];cy=[];ca=[]
for line in gzip.open(D+'ms_033313321.csv.gz','rt'):
    f=json.loads(line);c=f['geometry']['coordinates'][0]
    lon,lat=c[0]
    if not(B[0]<lon<B[2] and B[1]<lat<B[3]): continue
    g=P(shape(f['geometry']));a=g.area
    h=3.5 if a<150 else (6 if a<600 else 9)
    feats.write(json.dumps({'type':'Feature','properties':{'h':h},'geometry':f['geometry']})+'\n');n+=1
    p=g.centroid;cx.append(p.x);cy.append(p.y);ca.append(a)
feats.close()
cx=np.array(cx);cy=np.array(cy);ca=np.array(ca)
c=((cx-x0)/R).astype(int);r=((y1-cy)/R).astype(int);ok=(c>=0)&(c<W)&(r>=0)&(r<H)
np.add.at(bf,(r[ok],c[ok]),ca[ok]);bf=np.clip(bf/(R*R),0,0.9)
print('buildings',n,'mean frac',bf.mean())
# infiltration mm/h by WorldCover class (assumed, Sahel lateritic soils)
inf={10:15,20:12,30:10,40:10,50:3,60:6,80:0,90:5,95:5,100:8}
fi=np.vectorize(lambda v:inf.get(int(v),5))(wc).astype('f4')
fi=fi*(1-bf)  # roofs impervious
n_man=(0.035+0.15*bf).astype('f4'); n_man[wc==50]=np.maximum(n_man[wc==50],0.05)
np.savez_compressed('grid.npz',z=z,inf=fi,n=n_man,bf=bf,wm=wm,x0=x0,y1=y1,R=R,W=W,H=H)
print('z',z.min(),z.max())
