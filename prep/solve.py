import numpy as np,json,sys,math
from numba import njit
k=sys.argv[1];S=json.load(open('scen.json'))[k]
G=np.load('grid.npz');z=G['z'].astype('f4');H,W=z.shape;dx=float(G['R'])
n2=(G['n']**2).astype('f4');inf=(G['inf']/1000/3600.).astype('f4');wm=G['wm']
h=np.where(wm>0,0.0,0.0).astype('f4')
qx=np.zeros((H,W+1),'f4');qy=np.zeros((H+1,W),'f4')
@njit(cache=True,fastmath=True)
def step(z,h,qx,qy,n2,inf,r,dt,dx):
    H,W=h.shape;g=9.81
    for i in range(H):
        for j in range(1,W):
            e1=z[i,j-1]+h[i,j-1];e2=z[i,j]+h[i,j]
            hf=max(e1,e2)-max(z[i,j-1],z[i,j])
            if hf>1e-3:
                q=qx[i,j];nn=0.5*(n2[i,j-1]+n2[i,j])
                qn=(q-g*hf*dt*(e2-e1)/dx)/(1+g*dt*nn*abs(q)/hf**(7/3))
                qc=hf*math.sqrt(g*hf)
                qx[i,j]=min(max(qn,-qc),qc)
            else: qx[i,j]=0
        qx[i,0]=-math.sqrt(g*h[i,0])*h[i,0]*0.3;qx[i,W]=math.sqrt(g*h[i,W-1])*h[i,W-1]*0.3
    for i in range(1,H):
        for j in range(W):
            e1=z[i-1,j]+h[i-1,j];e2=z[i,j]+h[i,j]
            hf=max(e1,e2)-max(z[i-1,j],z[i,j])
            if hf>1e-3:
                q=qy[i,j];nn=0.5*(n2[i-1,j]+n2[i,j])
                qn=(q-g*hf*dt*(e2-e1)/dx)/(1+g*dt*nn*abs(q)/hf**(7/3))
                qc=hf*math.sqrt(g*hf)
                qy[i,j]=min(max(qn,-qc),qc)
            else: qy[i,j]=0
    for j in range(W):
        qy[0,j]=-math.sqrt(g*h[0,j])*h[0,j]*0.3;qy[H,j]=math.sqrt(g*h[H-1,j])*h[H-1,j]*0.3
    hm=0.0
    for i in range(H):
        for j in range(W):
            v=h[i,j]+dt/dx*(qx[i,j]-qx[i,j+1]+qy[i,j]-qy[i+1,j])+r*dt-inf[i,j]*dt
            if v<0: v=0
            h[i,j]=v
            if v>hm: hm=v
    return hm
rain=S['rain'];NH=len(rain)+6
out=np.zeros((NH,H,W),'f2');hmax=np.zeros((H,W),'f4')
t=0.0;hm=float(h.max())
for hr in range(NH):
    r=np.float32((rain[hr] if hr<len(rain) else 0)/1000/3600.)
    te=(hr+1)*3600.
    while t<te-1e-6:
        dt=min(0.7*dx/math.sqrt(9.81*max(hm,0.01)),te-t,10.)
        hm=step(z,h,qx,qy,n2,inf,r,np.float32(dt),np.float32(dx));t+=dt
    out[hr]=h;np.maximum(hmax,h,out=hmax)
    print(k,hr,'max',round(hm,2),'area>10cm km2',round((h[wm==0]>0.1).sum()*dx*dx/1e6,2),flush=True)
np.savez_compressed(f'res_{k}.npz',d=out,hmax=hmax.astype('f2'))
