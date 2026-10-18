import sys,json,pdfplumber,time
t=time.time()
p=pdfplumber.open(sys.argv[1]).pages[0]
objs=p.objects
out={'w':float(p.width),'h':float(p.height)}
for k in ('curve','line','rect','char','image'):
    L=objs.get(k,[])
    out[k]=[{'pts':[(round(x,2),round(y,2)) for x,y in (o.get('pts') or [])],'x0':o['x0'],'x1':o['x1'],'top':o['top'],'bottom':o['bottom'],
             'stroke':o.get('stroking_color'),'fill':o.get('non_stroking_color'),'f':o.get('fill'),'s':o.get('stroke'),'lw':o.get('linewidth')} for o in L]
    print(k,len(L),file=sys.stderr)
json.dump(out,open(sys.argv[2],'w'),default=str)
print('done',time.time()-t,file=sys.stderr)
