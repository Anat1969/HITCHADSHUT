"""603-1259092: lots from the fill polygons of the תשריט (pdftocairo -svg), since the PDF has no
text layer (all text is glyph outlines) and the repo script needs text labels.
Georef: ITM grid ticks found as vector lines on the frame; label values read from the glyph runs.
Lot numbers: positions read off a 100dpi rendering (the blue 'תא שטח' boxes)."""
import sys, json
sys.path.insert(0, sys.argv[4])
from svgpaths import load, rings, apply
from shapely.geometry import Polygon, Point, mapping
from shapely.ops import transform
from pyproj import Transformer
svg, out, t5p = sys.argv[1], sys.argv[2], sys.argv[3]
XT = [(238.25,166350),(521.27,166400),(804.15,166450),(1087.18,166500),(1370.05,166550),(1653.08,166600),(1935.96,166650)]
YT = [(151.73,634200),(434.75,634150),(717.62,634100),(1000.63,634050),(1283.5,634000),(1566.52,633950),(1849.39,633900),(2132.26,633850)]
import numpy as np
ax, bx = np.polyfit([a for a,_ in XT],[b for _,b in XT],1)
ay, by = np.polyfit([a for a,_ in YT],[b for _,b in YT],1)
rx = max(abs(ax*a+bx-b) for a,b in XT); ry = max(abs(ay*a+by-b) for a,b in YT)
print('m/pt x', ax, 'y', ay, 'resid', rx, ry, file=sys.stderr)
COL = {'100%, 49.803162%, 0%':'#ff7f00','100%, 0%, 24.705505%':'#ff003f','74.900818%, 100%, 0%':'#bfff00',
       '79.998779%, 59.999084%, 39.99939%':'#cc9966','86.274719%, 64.704895%, 42.744446%':'#dca56d','0%, 59.999084%, 44.7052%':'#00997f'}
LEG = {'#ff7f00':"מגורים ד' / מגורים ה'",'#ff003f':'דרך מוצעת','#bfff00':'שטח ציבורי פתוח','#cc9966':'מבנים ומוסדות ציבור','#dca56d':'ככר עירונית','#00997f':'שביל'}
LAB = {1:(1094,686),50:(1233,477),40:(1290,595),2:(1460,738),30:(1256,883),5:(1446,994),20:(1588,1012),21:(1246,1081),
       60:(1007,1278),22:(667,1448),61:(634,1561),32:(1585,1249),3:(553,1735),34:(265,1905),70:(498,1948),4:(1683,1044),33:(1708,1544)}
USE = {1:"מגורים ה'",3:"מגורים ה'",2:"מגורים ד'",4:"מגורים ד'",5:"מגורים ד'",60:'מבנים ומוסדות ציבור',61:'מבנים ומוסדות ציבור',
       30:'שטח ציבורי פתוח',32:'שטח ציבורי פתוח',33:'שטח ציבורי פתוח',34:'שטח ציבורי פתוח',50:'ככר עירונית',20:'דרך מוצעת',21:'דרך מוצעת',22:'דרך מוצעת',70:'דרך מוצעת',40:'שביל'}
t5 = {l['lot']: l for l in json.load(open(t5p))['lots']}
polys = []
for col, d, mt, _ in load(svg, set(COL)):
    for r in rings(d):
        r = apply(mt, r)
        p = Polygon(r).buffer(0)
        if p.area < 500 or p.bounds[0] > 2200: continue
        polys.append((COL[col], p))
toitm = lambda x, y, z=None: (ax*np.asarray(x)+bx, ay*np.asarray(y)+by)
tr = Transformer.from_crs(2039, 4326, always_xy=True)
feats = []; used = set()
for lot, (x, y) in LAB.items():
    pt = Point(x, y)
    cand = [(i, c, p) for i, (c, p) in enumerate(polys) if p.contains(pt) and i not in used]
    if not cand:
        i, (c, p) = min(enumerate(polys), key=lambda e: e[1][1].distance(pt)); print('nearest for', lot, file=sys.stderr)
    else:
        i, c, p = min(cand, key=lambda e: e[2].area)
    used.add(i)
    g = transform(toitm, p)
    w = transform(lambda x, y, z=None: tr.transform(x, y), g)
    props = {'lot': lot, 'use_color': c, 'use': USE[lot], 'area_m2': round(g.area, 1), 'use_legend': LEG[c]}
    if lot in t5: props['table5_lot_size'] = t5[lot]['lot_size']
    feats.append({'type': 'Feature', 'properties': props, 'geometry': mapping(w)})
    print(lot, c, round(g.area), t5.get(lot, {}).get('lot_size'), file=sys.stderr)
print('unused fills:', [(c, round(p.area)) for i, (c, p) in enumerate(polys) if i not in used], file=sys.stderr)
fc = {'type': 'FeatureCollection', 'name': 'תשריט מצב מוצע - חתום להפקדה',
      'properties': {'source': 'תשריט מצב מוצע (חתום להפקדה, 26/07/2026), פוליגוני מילוי', 'crs_note': 'EPSG:4326 from ITM grid ticks (pyproj)',
                     'm_per_pt': round(float(ax), 5), 'grid_residual_max_m': round(float(max(rx, ry)), 3)}, 'features': feats}
json.dump(fc, open(out, 'w'), ensure_ascii=False)
