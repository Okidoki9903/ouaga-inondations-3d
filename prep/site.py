import numpy as np,glob,json,sys,os
from pyproj import Transformer
t=Transformer.from_crs(4326,32630,always_xy=True)
g=np.load('grid.npz');z=g['z'];x0=float(g['x0']);y1=float(g['y1']);R=20;rd=g['rd'];wm=g['wm']>0
yy,xx=np.mgrid[0:z.shape[0],0:z.shape[1]]
for nm,lat,lon in [('police',12.31701,-1.496517),('palais',12.3156661,-1.4985654)]:
  x,y=t.transform(lon,lat);c=(x-x0)/R;r=(y1-y)/R
  m=((xx-c)**2+(yy-r)**2)<=(300/R)**2;mr=m&(rd>0)
  print(nm,'cells',m.sum(),'road cells',mr.sum(),'bf %.2f'%g['bf'][m].mean())
  for k in ['2020-09-05','2022-08-03','2024-08-16','2025-07-24','2026-08-03','T10','T50','T100']:
    for tag,f in [('v1','../baseline/res_%s.npz'%k),('v2','res_%s.npz'%k)]:
      if tag=='v2' and os.path.getmtime(f)<os.path.getmtime('grid.npz'): continue
      h=np.load(f)['hmax'].astype('f4');v=h[m];vr=h[mr]
      print('  %-10s %s max %.2f p90 %.2f p50 %.2f | lanes(road cells) p50 %.2f p90 %.2f max %.2f | ha>0.2 %.1f ha>0.5 %.1f'%(k,tag,v.max(),np.percentile(v,90),np.median(v),np.median(vr),np.percentile(vr,90),vr.max(),(v>.2).sum()*.04,(v>.5).sum()*.04))
for k in ['2020-09-05','2022-08-03','2024-08-16','2025-07-24','2026-08-03']:
  a=np.load('../baseline/res_%s.npz'%k)['hmax'].astype('f4');b=np.load('res_%s.npz'%k)['hmax'].astype('f4');a[wm]=0;b[wm]=0
  print(k,'city km2>0.1 v1 %.1f v2 %.1f ; >0.5 v1 %.1f v2 %.1f'%((a>.1).sum()*4e-4,(b>.1).sum()*4e-4,(a>.5).sum()*4e-4,(b>.5).sum()*4e-4))
