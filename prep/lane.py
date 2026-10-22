import numpy as np,sys
from shapely.geometry import LineString
from pyproj import Transformer
t=Transformer.from_crs(4326,32630,always_xy=True)
g=np.load(sys.argv[1]);x0=float(g['x0']);y1=float(g['y1']);R=20;D=sys.argv[2]
LANES={'L1 ruelle en terre (maison -> goudron, E-O)':[(-1.4975,12.318152),(-1.496875,12.318157)],'L2 ruelle N-S (canal -> route secondaire)':[(-1.496319,12.318379),(-1.496316,12.317662)]}
for nm,c in LANES.items():
    L=LineString([t.transform(*p) for p in c]);n=int(L.length//5)+1
    cells=sorted({(int((y1-L.interpolate(i*5).y)/R),int((L.interpolate(i*5).x-x0)/R)) for i in range(n)})
    print(nm,'%.0f m'%L.length,len(cells),'cells')
    for k in ['2026-08-03','2022-08-03','2025-07-24','2024-08-16','2020-09-05','T10','T50','T100']:
        h=np.load(f'{D}/res_{k}.npz')['hmax'].astype('f4');v=np.array([h[a,b] for a,b in cells])
        print('   %-10s min %.2f moy %.2f max %.2f  frac>0.3 %.0f%%'%(k,v.min(),v.mean(),v.max(),100*(v>0.3).mean()))
