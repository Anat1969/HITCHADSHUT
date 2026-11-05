import numpy as np, cv2, json, sys
from scipy import ndimage as ndi
sys.path.insert(0,'.')
from georef import px2itm, T4, a as GA, b as GB
from shapely.geometry import Polygon, mapping
from pyproj import Transformer
im=cv2.imread('../hanamal/imgA-000.jpg',0)
M4=np.load('zones3.npy'); names=json.load(open('zone_names.json')); I={n:i for i,n in enumerate(names)}
f=2; H,W=im.shape[0]//f, im.shape[1]//f
M=cv2.resize(M4.astype(np.int16),(W,H),interpolation=cv2.INTER_NEAREST).astype(int)
g=im[:H*f,:W*f].reshape(H,f,W,f).min(axis=(1,3))
dark=cv2.morphologyEx((g<110).astype(np.uint8),cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
px=(f*0.8796)**2
B=np.zeros((H,W),int); nid=0; zone_of={}
for z in ['port','ind','beige','bulk','empl','edu']:
    if z in ('port','ind','beige'):
        zm=((M==I[z])&(dark==0)).astype(np.uint8)
        zm=cv2.morphologyEx(zm,cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
        lab,n=ndi.label(zm); sz=ndi.sum(np.ones_like(lab),lab,range(1,n+1))*px
        keep=[k+1 for k in np.where(sz>=1500)[0]]
    else:
        lab,n=ndi.label(M==I[z]); sz=ndi.sum(np.ones_like(lab),lab,range(1,n+1))*px
        keep=[k+1 for k in np.where(sz>=1500)[0]]
    # seeds
    seeds=np.zeros((H,W),int)
    for k in keep:
        nid+=1; seeds[lab==k]=nid; zone_of[nid]=z
    # grow within zone
    zonem=M==I[z]
    d,(iy,ix)=ndi.distance_transform_edt(seeds==0,return_indices=True)
    grown=seeds[iy,ix]; grown[~zonem]=0
    # a pixel belongs only if seed is from this zone (always) and within 80 px
    grown[d>80]=0
    B[zonem&(grown>0)]=grown[zonem&(grown>0)]
np.save('blocks.npy',B)
def conv(x,y):
    E,N=px2itm(x*f,y*f); return T4.transform(E,N)
T=Transformer.from_crs('EPSG:4326','EPSG:2039',always_xy=True)
feats=[]
for i in range(1,nid+1):
    m=(B==i).astype(np.uint8)
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,np.ones((5,5),np.uint8))
    cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    polys=[]
    for c in cs:
        if cv2.contourArea(c)*px<300: continue
        ap=cv2.approxPolyDP(c,1.5,True).reshape(-1,2)
        if len(ap)<3: continue
        polys.append(Polygon([conv(x+.5,y+.5) for x,y in ap]).buffer(0))
    if not polys: continue
    from shapely.ops import unary_union
    P=unary_union(polys)
    area=sum(Polygon([T.transform(*p) for p in q.exterior.coords]).area for q in (P.geoms if hasattr(P,'geoms') else [P]))
    feats.append({"type":"Feature","properties":{"block":i,"zone":zone_of[i],"area_m2":round(area)},"geometry":mapping(P)})
json.dump({"type":"FeatureCollection","features":feats},open('blocks.geojson','w'))
from collections import Counter
print(len(feats), Counter(f['properties']['zone'] for f in feats))
print({z:round(sum(f['properties']['area_m2'] for f in feats if f['properties']['zone']==z)/1000,1) for z in set(zone_of.values())})
