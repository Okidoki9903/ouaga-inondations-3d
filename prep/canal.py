import numpy as np,json,heapq,math,sys
from numba import njit
from pyproj import Transformer
G=np.load('grid.npz');z=G['z'].astype('f8');H,W=z.shape;R=20.;x0=float(G['x0']);y1=float(G['y1'])
t=Transformer.from_crs(4326,32630,always_xy=True)
def rc(lon,lat):
    x,y=t.transform(lon,lat);return int((y1-y)/R),int((x-x0)/R)
@njit(cache=True)
def fill_d8(z):
    H,W=z.shape;f=z.copy();done=np.zeros((H,W),np.bool_);D=np.full((H,W),-1,np.int8)
    # simple priority flood using arrays-based heap

    hp=[(0.0,0,0)];hp.pop()
    for i in range(H):
        for j in range(W):
            if i==0 or j==0 or i==H-1 or j==W-1:
                heapq.heappush(hp,(f[i,j],i,j));done[i,j]=True
    di=(-1,-1,0,1,1,1,0,-1);dj=(0,1,1,1,0,-1,-1,-1)
    while hp:
        e,i,j=heapq.heappop(hp)
        for k in range(8):
            a=i+di[k];b=j+dj[k]
            if a<0 or b<0 or a>=H or b>=W or done[a,b]: continue
            done[a,b]=True
            if f[a,b]<=e: f[a,b]=e+1e-5
            D[a,b]=(k+4)%8  # direction from (a,b) to (i,j)
            heapq.heappush(hp,(f[a,b],a,b))
    return f,D
f,D=fill_d8(z)
np.save('d8.npy',D)
# upstream of outlet cell: BFS reverse
def upstream(i0,j0):
    di=(-1,-1,0,1,1,1,0,-1);dj=(0,1,1,1,0,-1,-1,-1)
    m=np.zeros((H,W),bool);st=[(i0,j0)];m[i0,j0]=True
    while st:
        i,j=st.pop()
        for k in range(8):
            a=i-di[k];b=j-dj[k]
            if 0<=a<H and 0<=b<W and not m[a,b] and D[a,b]==k: m[a,b]=True;st.append((a,b))
    return m
# outlet: highest-accumulation cell within 60 m of the N5 bridge
acc=None
import scipy.ndimage as nd
pts={'pont_N5':(-1.48975,12.31885),'police':(-1.496517,12.31701)}
res={}
for nm,(lon,lat) in pts.items():
    i,j=rc(lon,lat);best=None
    for a in range(i-3,i+4):
        for b in range(j-3,j+4):
            m=upstream(a,b);s=m.sum()
            if best is None or s>best[0]: best=(s,a,b,m)
    res[nm]=best;print(nm,'outlet',best[1],best[2],'catchment km2 %.2f'%(best[0]*R*R/1e6))
np.savez_compressed('canal_catch.npz',**{nm:v[3] for nm,v in res.items()},out=np.array([[v[1],v[2]] for v in res.values()]))
