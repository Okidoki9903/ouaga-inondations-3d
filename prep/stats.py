import numpy as np,json
from rasterio.transform import from_origin,from_bounds
from rasterio.warp import reproject,Resampling
from pyproj import Transformer
G=np.load('grid.npz');R=float(G['R']);x0=float(G['x0']);y1=float(G['y1']);wm=G['wm']>0;H,W=wm.shape
T=from_origin(x0,y1,R,R);order=list(json.load(open('scen.json')));A='/workspace/ouaga-flood/app/docs/data/'
import os
if not os.path.exists('bidx.npy'):
    tr=Transformer.from_crs(4326,32630,always_xy=True);xs=[];ys=[]
    for l in open('../data/buildings.geojsonl'):
        i=l.find('"coordinates": [[[');s=l[i+18:l.find(']',i+18)].split(',');xs.append(float(s[0]));ys.append(float(s[1]))
    X,Y=tr.transform(np.array(xs),np.array(ys));r=((y1-Y)/R).astype(int);c=((X-x0)/R).astype(int);ok=(r>=0)&(r<H)&(c>=0)&(c<W)
    np.save('bidx.npy',np.stack([r[ok],c[ok]]))
bi=np.load('bidx.npy');print('buildings',bi.shape[1])
OW,OH=700,645;B=(-1.65,12.25,-1.40,12.48);OT=from_bounds(*B,OW,OH)
st={}
for k in order:
    d=np.load(f'res_{k}.npz')['d'].astype('f4');n=d.shape[0];w=d.copy();w[:,wm]=0
    area=[round(float((w[i]>0.05).sum())*R*R/1e6,2) for i in range(n)]
    bt=[int((w[i][bi[0],bi[1]]>0.1).sum()) for i in range(n)]
    lake=[round(float(d[i][wm].mean())*100,1) for i in range(n)]
    st[k]={'area':area,'bld':bt,'lake':lake};print(k,max(area),max(bt),max(lake))
    ser=np.zeros((OH,OW,16),'u1')
    for i in range(n):
        o=np.zeros((OH,OW),'f4');reproject(w[i],o,src_transform=T,src_crs='EPSG:32630',dst_transform=OT,dst_crs='EPSG:4326',resampling=Resampling.max);ser[:,:,i]=np.clip(np.round(o/0.02),0,255)
    ser.tofile(A+f'ser_{k}.bin')
json.dump(st,open(A+'stats.json','w'))
