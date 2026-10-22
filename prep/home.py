import numpy as np,json,sys
from pyproj import Transformer
from shapely.geometry import LineString,Point
from shapely.ops import transform as stf
t=Transformer.from_crs(4326,32630,always_xy=True)
HL=(-1.4966787,12.3182225)
nr=json.load(open('../data/near.json'));main=[c for t_,c in nr['ww'] if len(c)>500][0]
L=stf(t.transform,LineString(main));hx,hy=t.transform(*HL);print('dist canal m %.0f'%L.distance(Point(hx,hy)))
g=np.load(sys.argv[1] if len(sys.argv)>1 else 'grid.npz');x0=float(g['x0']);y1=float(g['y1']);R=20;rd=g['rd'];z=g['z']
r=(y1-hy)/R;c=(hx-x0)/R;yy,xx=np.mgrid[0:rd.shape[0],0:rd.shape[1]];d2=(yy-r)**2+(xx-c)**2
ml=(d2<=(60/R)**2)&(rd>0);mh=d2<=1.0
print('z home %.1f lane cells %d'%(z[int(r),int(c)],ml.sum()))
for k in ['2022-08-03','2025-07-24','2026-08-03','2024-08-16','2020-09-05','T10','T50','T100']:
  h=np.load(f'res_{k}.npz')['hmax'].astype('f4')
  print('%-10s home %.2f  lane(60m) max %.2f med %.2f'%(k,h[mh].max(),h[ml].max(),np.median(h[ml])))
