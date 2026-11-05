import sys, numpy as np
from PIL import Image
im=np.array(Image.open(sys.argv[1]).convert('L')).astype(int)
H,W=im.shape
up=lambda x:91.6-0.00433*x
lo=lambda x:120.5-0.00437*x
dark=im<150
res=[]
for xl in range(150,W-150):
    yl=int(round(lo(xl)-3))
    if not dark[yl,xl]: continue
    best=None
    for dx in range(-45,46):
        if abs(dx)<12: continue
        xu=xl+dx; yu=int(round(up(xu)+3))
        n=60; ok=0
        for t in np.linspace(0,1,n):
            x=int(round(xl+t*(xu-xl))); y=int(round(yl+t*(yu-yl)))
            ok+=dark[y-1:y+2,x-1:x+2].any()
        f=ok/n
        if f>0.97 and (best is None or f>best[0]): best=(f,dx)
    if best: res.append((xl,best[1]))
# cluster
cl=[]
for xl,dx in res:
    if cl and xl-cl[-1][-1][0]<=4: cl[-1].append((xl,dx))
    else: cl.append([(xl,dx)])
for c in cl:
    xs=[a for a,b in c]; dxs=[b for a,b in c]
    xm=np.mean(xs); print(round(xm,1), round(lo(xm),1), int(np.median(dxs)), len(c))
