import numpy as np, cv2, json, sys
from scipy import ndimage as ndi
sys.path.insert(0,'.')
from georef import px2itm, T4
from shapely.geometry import Polygon, mapping
from shapely.ops import transform as stx
M=np.load('zones2.npy'); names=json.load(open('zone_names.json')); I={n:i for i,n in enumerate(names)}
f=4; px=(f*0.8796)**2
H,W=M.shape; yy,xx=np.mgrid[0:H,0:W]
blk=(xx>=245)&(xx<=480)&(yy>=425)&(yy<=575)
M[(M==I['empl'])&~blk]=-2
# absorb small components (<3000 m2) into neighbours, iterate
for it in range(3):
    for i in range(len(names)):
        lab,n=ndi.label(M==i)
        if n==0: continue
        sz=ndi.sum(np.ones_like(lab),lab,range(1,n+1))*px
        for j in np.where(sz<3000)[0]: M[lab==j+1]=-2
    inside=M!=-1
    known=M>=0
    d,(iy,ix)=ndi.distance_transform_edt(~known,return_indices=True)
    F=M[iy,ix]; F[~inside]=-1; M=F
np.save('zones3.npy',M)
for i,nm in enumerate(names): print(nm, round((M==i).sum()*px/1000,1))
feats=[]
def conv(x,y):
    E,N=px2itm(x*f,y*f); return T4.transform(E,N)
for i,nm in enumerate(names):
    lab,n=ndi.label(M==i)
    for k in range(1,n+1):
        m=(lab==k).astype(np.uint8)
        cs,h=cv2.findContours(m,cv2.RETR_CCOMP,cv2.CHAIN_APPROX_SIMPLE)
        h=h[0]
        for ci,c in enumerate(cs):
            if h[ci][3]!=-1 or len(c)<3: continue
            ext=cv2.approxPolyDP(c,1.0,True).reshape(-1,2)
            holes=[cv2.approxPolyDP(cs[j],1.0,True).reshape(-1,2) for j in range(len(cs)) if h[j][3]==ci and len(cs[j])>=3]
            if len(ext)<3: continue
            P=Polygon([conv(x+.5,y+.5) for x,y in ext],[[conv(x+.5,y+.5) for x,y in hh] for hh in holes if len(hh)>=3]).buffer(0)
            if P.is_empty: continue
            feats.append({"type":"Feature","properties":{"zone":nm},"geometry":mapping(P)})
json.dump({"type":"FeatureCollection","features":feats},open('zones_raw.geojson','w'))
print(len(feats))
