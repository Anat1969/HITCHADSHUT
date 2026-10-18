import sys,re,json
sys.path.insert(0,sys.argv[1])
from svgpaths import load,apply
from PIL import Image,ImageDraw
svg=sys.argv[2]
S={'65.881348%, 0%, 0%':'b','0%, 100%, 77.253723%':'u'}
segs=[]
for col,d,mt,lw in load(svg,set(S),stroke=True):
    if abs(lw-2.016)>0.01: continue
    # split subpaths
    for sub in re.split(r'(?=M)',d):
        pts=apply(mt,[(float(a),float(b)) for a,b in re.findall(r'(-?[\d.]+) (-?[\d.]+)',sub)])
        if len(pts)>=2 and max(x for x,y in pts)<2200: segs.append((S[col],pts))
json.dump(segs,open(sys.argv[3],'w'))
print(len(segs), sum(1 for s in segs if s[0]=='b'))
k=3
im=Image.new('RGB',(2200*k//2,2400*k//2),'white');dr=ImageDraw.Draw(im)
lots=sys.argv[4] if len(sys.argv)>4 else None
for t,p in segs:
    dr.line([(x*k/2,y*k/2) for x,y in p],fill=(170,0,0) if t=='b' else (0,180,150),width=3)
im.save(sys.argv[3]+'.png')
