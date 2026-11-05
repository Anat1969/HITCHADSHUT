import numpy as np, cv2, json
from pyproj import Transformer
# similarity transform fitted from all frame ticks (old Israeli grid, Cassini)
upL=lambda x:120.5-0.00437*x; boL=lambda x:2646.6-0.0043*x
pts=[]
for x,v in [(1247,116000),(2121,116500),(3001,117000),(3871.5,117500),(4745.7,118000),(5626,118500)]: pts.append(('E',x,upL(x),v))
for x,v in [(387.5,136500),(1135,137000),(1881,137500),(2631,138000),(4128,139000),(4880,139500)]: pts.append(('N',x,upL(x),v))
for x,v in [(917.5,117500),(1799,118000),(2675,118500),(3551,119000),(4423,119500),(5295,120000)]: pts.append(('E',x,boL(x),v))
for x,v in [(317,135000),(1062.5,135500),(2568,136500),(3314,137000),(4066,137500),(4815,138000),(5561,138500)]: pts.append(('N',x,boL(x),v))
A=[];B=[]
for k,x,y,v in pts:
    A.append([x,y,1,0] if k=='E' else [-y,x,0,1]); B.append(v)
A=np.array(A,float);B=np.array(B,float); p,*_=np.linalg.lstsq(A,B,rcond=None)
res=A@p-B
a,b,c,d=p
T=Transformer.from_crs('EPSG:28193','EPSG:2039',always_xy=True)
T4=Transformer.from_crs('EPSG:2039','EPSG:4326',always_xy=True)
def px2itm(x,y):
    E=a*x+b*y+c; N=b*x-a*y+d
    return T.transform(E,N+1000000)
if __name__=='__main__':
    print('resid m', np.round(res,1), 'rms', np.sqrt((res**2).mean()))
    print('scale',np.hypot(a,b))
    json.dump(dict(a=a,b=b,c=c,d=d),open('georef.json','w'))
