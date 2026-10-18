import re,sys,json
from shapely.geometry import Polygon
from shapely.ops import unary_union
from shapely.validation import make_valid
NUM=r'-?[\d.]+'
def rings(d):
    toks=re.findall(r'[MLCZ]|'+NUM,d); out=[];cur=[];i=0;cmd=None
    while i<len(toks):
        t=toks[i]
        if t in 'MLCZ':
            cmd=t;i+=1
            if t=='Z':
                if len(cur)>2: out.append(cur)
                cur=[]
            elif t=='M':
                if len(cur)>2: out.append(cur)
                cur=[]
            continue
        if cmd in('M','L'):
            cur.append((float(toks[i]),float(toks[i+1])));i+=2
        elif cmd=='C':
            cur.append((float(toks[i+4]),float(toks[i+5])));i+=6
    if len(cur)>2: out.append(cur)
    return out
def load(svg, want=None, stroke=False):
    res=[]
    attr='stroke' if stroke else 'fill'
    for m in re.finditer(r'<path ([^>]*)/>',open(svg).read()):
        a=m.group(1)
        c=re.search(attr+r'="rgb\(([^)]*)\)"',a)
        if not c: continue
        col=c.group(1)
        if want and col not in want: continue
        d=re.search(r' d="([^"]*)"',a).group(1)
        tr=re.search(r'transform="matrix\(([^)]*)\)"',a)
        mt=[float(v) for v in tr.group(1).split(',')] if tr else None
        lw=re.search(r'stroke-width="([^"]*)"',a)
        res.append((col,d,mt,float(lw.group(1)) if lw else None))
    return res
def apply(mt,pts):
    if not mt: return pts
    a,b,c,d,e,f=mt
    return [(a*x+c*y+e,b*x+d*y+f) for x,y in pts]
if __name__=='__main__':
    svg=sys.argv[1]
    for col,d,mt,lw in load(svg):
        if col in ('0%, 0%, 0%','30.587769%, 30.587769%, 30.587769%','20.391846%, 20.391846%, 20.391846%','100%, 100%, 100%'): continue
        for r in rings(d):
            r=apply(mt,r)
            if len(r)<3: continue
            p=Polygon(r)
            if p.area<200: continue
            x0,y0,x1,y1=p.bounds
            print(col, round(p.area), [round(v) for v in (x0,y0,x1,y1)], len(r))
