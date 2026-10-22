# Sub-domain re-run of the same local-inertial scheme around the Ouaga 2000 canal, logging fluxes through cross-sections.
import numpy as np,json,sys,math,re
from numba import njit
src=open('solve.py').read();exec(src[src.index('@njit'):src.index('rain=S')].replace('@njit(cache=True,fastmath=True)','@njit(fastmath=True)'),globals())
from rasterio.features import rasterize
from rasterio.transform import from_origin
from shapely.geometry import LineString
from shapely.ops import transform as stf
from pyproj import Transformer
from scipy.ndimage import distance_transform_edt,binary_dilation
G=np.load('grid.npz');C=np.load('canal_catch.npz');cm=C['pont_N5'];(io,jo),(ip,jp)=C['out']
S=json.load(open('scen.json'));R=20.
ii,jj=np.where(cm);a0,a1,b0,b1=ii.min()-40,ii.max()+41,jj.min()-40,jj.max()+41
cut=lambda k:G[k][a0:a1,b0:b1]
z=cut('z').astype('f4');n2=(cut('n')**2).astype('f4');import os;FI=float(os.environ.get('INF','1'));inf=(cut('inf')*FI/1000/3600.).astype('f4');Hh,Ww=z.shape
io-=a0;jo-=b0;ip-=a0;jp-=b0;cmc=cm[a0:a1,b0:b1]
# main stream channel (OSM way from head to N5) + reach buffer
tr=Transformer.from_crs(4326,32630,always_xy=True);T=from_origin(float(G['x0'])+b0*R,float(G['y1'])-a0*R,R,R)
nr=json.load(open('../data/near.json'));main=[c for t,c in nr['ww'] if len(c)>500][0]
k1=min(range(len(main)),key=lambda k:(main[k][0]+1.48975)**2+(main[k][1]-12.31885)**2);reach=LineString(main[:k1+1])
ch=rasterize([(stf(tr.transform,reach),1)],(Hh,Ww),transform=T,all_touched=True).astype(bool)
chb=binary_dilation(ch,iterations=1)
dist=distance_transform_edt(~ch)*R;nb=(dist<=300)&~chb
print('crop',Hh,Ww,'catch km2',cmc.sum()*R*R/1e6,'reach km',round(stf(tr.transform,reach).length/1000,2),'channel cells',ch.sum(),'nb ha',nb.sum()*R*R/1e4)
def sec(i,j,hw=10): return slice(max(i-hw,0),i+hw+1),j
out={}
for k in (sys.argv[1:] or list(S)):
    h=np.zeros_like(z);qx=np.zeros((Hh,Ww+1),'f4');qy=np.zeros((Hh+1,Ww),'f4')
    HM=np.zeros_like(z);rain=S[k]['rain'];NH=len(rain)+6;t=0.;hm=0.01;Q=[];Qp=[];ts=[];Vnb=[];Ann=[]
    while t<NH*3600-1e-6:
        hr=int(t//3600);r=np.float32((rain[hr] if hr<len(rain) else 0)/1000/3600.)
        dt=min(0.7*R/math.sqrt(9.81*max(hm,0.01)),(hr+1)*3600-t,10.)
        hm=step(z,h,qx,qy,n2,inf,r,np.float32(dt),np.float32(R));t+=dt;np.maximum(HM,h,out=HM)
        s,j=sec(io,jo);q=float(qx[s,j].sum()*R);s2,j2=sec(ip,jp);q2=float(qx[s2,j2].sum()*R)
        Q.append(q);Qp.append(q2);ts.append(dt)
        if len(ts)%20==0: Vnb.append((t,float(h[nb].sum()*R*R),float(((h>0.2)&nb).sum()*R*R/1e4),float(h[nb].max())))
    Q=np.array(Q);ts=np.array(ts);tt=np.cumsum(ts)
    V=float((np.clip(Q,0,None)*ts).sum());pk=float(Q.max());strong=float(ts[Q>max(1.0,0.25*pk)].sum()/60)
    Vp=float((np.clip(np.array(Qp),0,None)*ts).sum())
    vn=max(Vnb,key=lambda x:x[1])
    raint=sum(rain);out[k]=dict(rain_mm=raint,V_bridge_m3=round(V),tanks10k=round(V/10),Qpeak_m3s=round(pk,1),Qpeak_Ls=round(pk*1000,-2),t_peak_h=round(float(tt[Q.argmax()])/3600,2),strong_flow_min=round(strong),runoff_coef=round(float(V)/(raint/1000*cmc.sum()*R*R),2),V_police_section_m3=round(Vp),Qpeak_police_m3s=round(float(max(Qp)),1),nb_max_stored_m3=round(vn[1]),nb_ha_gt20cm=round(vn[2],1),nb_max_depth_m=round(vn[3],2))
    t2=Transformer.from_crs(4326,32630,always_xy=True);px,py=t2.transform(-1.496517,12.31701);pr=(float(G['y1'])-py)/R-a0;pc=(px-float(G['x0']))/R-b0
    YY,XX=np.mgrid[0:Hh,0:Ww];lm=(((YY-pr)**2+(XX-pc)**2)<=225)&(cut('rd')>0)
    out[k]['lanes_police_p50_m']=round(float(np.median(HM[lm])),2);out[k]['lanes_police_p90_m']=round(float(np.percentile(HM[lm],90)),2)
    print(k,out[k],flush=True)
    np.save(f'canal_h_{k}.npy',h.astype('f2'))
json.dump(out,open(f'canal_{"_".join(sys.argv[1:]) or "all"}_inf{FI}.json','w'),indent=1)
