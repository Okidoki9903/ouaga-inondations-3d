import osmium,json
B=(-1.65,12.25,-1.40,12.48);inb=lambda x,y:B[0]<=x<=B[2] and B[1]<=y<=B[3]
out=[]
class H(osmium.SimpleHandler):
    def way(s,w):
        t=w.tags.get('highway')
        if not t: return
        try: c=[(round(n.lon,6),round(n.lat,6)) for n in w.nodes]
        except: return
        if len(c)>1 and any(inb(*p) for p in c): out.append({'t':t,'s':w.tags.get('surface',''),'c':c})
H().apply_file('bf.osm.pbf',locations=True)
json.dump(out,open('roads.json','w'))
from collections import Counter;print(len(out),Counter(r['t'] for r in out).most_common(15))
