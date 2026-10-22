import pandas as pd,sys
B=(-1.65,12.25,-1.40,12.48);out=[]
for ch in pd.read_csv(sys.stdin,usecols=['latitude','longitude','area_in_meters','confidence'],chunksize=2_000_000):
    m=(ch.longitude>B[0])&(ch.longitude<B[2])&(ch.latitude>B[1])&(ch.latitude<B[3])
    out.append(ch[m]);print(len(ch),m.sum(),flush=True)
pd.concat(out).to_csv('ob_ouaga.csv',index=False)
