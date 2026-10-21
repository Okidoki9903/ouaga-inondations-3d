import numpy as np,json
from rasterio.warp import reproject,Resampling
from rasterio.transform import from_origin,from_bounds
from rasterio.features import rasterize
from shapely.geometry import shape
from scipy.ndimage import distance_transform_edt
G=np.load('grid.npz');R=float(G['R']);T=from_origin(float(G['x0']),float(G['y1']),R,R);wm=G['wm']
B=(-1.65,12.25,-1.40,12.48);OW,OH=700,645;OT=from_bounds(*B,OW,OH)
order=list(json.load(open('scen.json')))
def rp(a,rs=Resampling.max):
    o=np.zeros((OH,OW),'f4');reproject(a.astype('f4'),o,src_transform=T,src_crs='EPSG:32630',dst_transform=OT,dst_crs='EPSG:4326',resampling=rs);return o
out=np.zeros((OH,OW,18),'u1')
for n,k in enumerate(order):
    r=np.load(f'res_{k}.npz');d=r['d'].astype('f4');hm=r['hmax'].astype('f4');d[:,wm>0]=0;hm[wm>0]=0
    out[:,:,n]=np.clip(np.round(rp(hm)/0.02),0,255)
    out[:,:,8+n]=np.clip(rp((d>0.1).sum(0)),0,255)
o=json.load(open('../data/osm_ouaga.json'))
from shapely.geometry import LineString
geoms=[LineString(w['c']) for w in o['waterway'] if len(w['c'])>1]
m=rasterize([(g,1) for g in geoms],out_shape=(OH,OW),transform=OT,all_touched=True)
dx=(B[2]-B[0])/OW*111320*np.cos(np.radians(12.37));dy=(B[3]-B[1])/OH*110600
dist=distance_transform_edt(m==0,sampling=(dy,dx));dist=np.clip(dist,0,65535).astype('<u2')
out[:,:,16:18]=dist.view('u1').reshape(OH,OW,2)
out.tofile('../app/docs/data/parcel.bin')
json.dump({'w':OW,'h':OH,'bounds':B,'stride':18,'order':order,'depth_unit_m':0.02,'hours_thr_m':0.1,'waterways':len(geoms)},open('../app/docs/data/parcel.json','w'))
print(out.shape,len(geoms),dist.max())
