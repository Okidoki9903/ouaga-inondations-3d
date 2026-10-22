import numpy as np,json,os
from multiprocessing import Pool
from PIL import Image
from rasterio.transform import from_origin,from_bounds
from rasterio.warp import reproject,Resampling
G=np.load('grid.npz');R=float(G['R']);T=from_origin(float(G['x0']),float(G['y1']),R,R);wm=G['wm']>0
B=(-1.65,12.25,-1.40,12.48);OW,OH=2100,1935;OT=from_bounds(*B,OW,OH)
order=list(json.load(open('scen.json')));A='/workspace/ouaga-flood/app/docs/data/d/'
def enc(a):
    o=np.zeros((OH,OW),'f4');reproject(a,o,src_transform=T,src_crs='EPSG:32630',dst_transform=OT,dst_crs='EPSG:4326',resampling=Resampling.bilinear)
    return Image.fromarray(np.clip(np.round(o*100),0,255).astype('u1'),'L')
def job(a):
    k,i=a;r=np.load(f'res_{k}.npz');d=(r['d'][i] if i!='max' else r['hmax']).astype('f4');d[wm]=0
    os.makedirs(A+k,exist_ok=True);im=enc(d);im.save(A+f'{k}/{i}.png',optimize=True)
    os.makedirs(A[:-2]+'dm/'+k,exist_ok=True);im.resize((OW//2,OH//2),Image.BOX).save(A[:-2]+f'dm/{k}/{i}.png',optimize=True);return a
if __name__=='__main__':
    jobs=[]
    for k in order:
        n=np.load(f'res_{k}.npz')['d'].shape[0];jobs+=[(k,i) for i in range(n)]+[(k,'max')]
    with Pool(8) as p:
        for x in p.imap_unordered(job,jobs): pass
