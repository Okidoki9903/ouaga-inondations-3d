import numpy as np,json,os,sys
from multiprocessing import Pool
from scipy.ndimage import zoom,gaussian_filter
from rasterio.features import shapes
from rasterio.transform import from_origin,from_bounds
from rasterio.warp import reproject,Resampling
from shapely.geometry import shape,mapping
from shapely.ops import transform as stf
from pyproj import Transformer
G=np.load('grid.npz');R=float(G['R']);x0=float(G['x0']);y1=float(G['y1']);wm=G['wm']>0
F=3;Tup=from_origin(x0,y1,R/F,R/F);T=from_origin(x0,y1,R,R)
tr=Transformer.from_crs(32630,4326,always_xy=True).transform
order=list(json.load(open('scen.json')));A='/workspace/ouaga-flood/app/docs/data/'
CL=[0.05,0.3,1.0]
def polys(d):
    u=gaussian_filter(zoom(d,F,order=1),1.2);feats=[]
    for ci,th in enumerate(CL):
        m=(u>=th).astype('u1')
        for g,v in shapes(m,mask=m>0,transform=Tup):
            s=shape(g)
            if s.area<300: continue
            s=s.simplify(4)
            if s.is_empty:continue
            s=stf(tr,s);gj=mapping(s)
            def rd(c): return [[round(x,6),round(y,6)] for x,y in c]
            if gj['type']=='Polygon': co=[rd(r) for r in gj['coordinates']]
            else: continue
            feats.append({'type':'Feature','properties':{'c':ci},'geometry':{'type':'Polygon','coordinates':co}})
    return {'type':'FeatureCollection','features':feats}
def job(a):
    k,i=a;r=np.load(f'res_{k}.npz');d=(r['d'][i] if i!='max' else r['hmax']).astype('f4');d[wm]=0
    os.makedirs(A+'w/'+k,exist_ok=True);json.dump(polys(d),open(A+f'w/{k}/{i}.json','w'),separators=(',',':'));return k,i
if __name__=='__main__':
    jobs=[]
    for k in order:
        n=np.load(f'res_{k}.npz')['d'].shape[0];jobs+=[(k,i) for i in range(n)]+[(k,'max')]
    with Pool(os.cpu_count()) as p:
        for x in p.imap_unordered(job,jobs): print(x,flush=True)
