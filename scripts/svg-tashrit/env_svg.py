"""603-1259092 envelopes from building lines in the SVG export (no text layer, pdfplumber too slow).
Legend: קו-בנין = stroke #a80000 w2.016 ('b'); קו בנין עילי = #00ffc5 w2.016 ('u').
Per lot: faces of (lot - lines buffered SNAP); a face belongs to a style when that style's lines run along
>=40% of its outline and <40% of it is bare lot line. Envelope = 'b' faces, or the whole lot when 'b'
lines run only on the lot line. Tower = 'u' faces (inner above-ground line) for lots with >=12 floors."""
import sys, json
import numpy as np
from shapely.geometry import LineString, Polygon, shape, mapping
from shapely.ops import unary_union, transform
from pyproj import Transformer
segs = json.load(open(sys.argv[1])); lots = json.load(open(sys.argv[2])); t5 = {l['lot']: l for l in json.load(open(sys.argv[3]))['lots']}
out = sys.argv[4]
AX, BX, AY, BY = 0.17670855005309752, 166350 - 0.17670855005309752*238.25, -0.17671947973479005, 634200 + 0.17671947973479005*151.73
XT = [(238.25,166350),(521.27,166400),(804.15,166450),(1087.18,166500),(1370.05,166550),(1653.08,166600),(1935.96,166650)]
YT = [(151.73,634200),(434.75,634150),(717.62,634100),(1000.63,634050),(1283.5,634000),(1566.52,633950),(1849.39,633900),(2132.26,633850)]
AX, BX = np.polyfit([a for a,_ in XT],[b for _,b in XT],1); AY, BY = np.polyfit([a for a,_ in YT],[b for _,b in YT],1)
fw = Transformer.from_crs(4326, 2039, always_xy=True); bw = Transformer.from_crs(2039, 4326, always_xy=True)
L = {'b': [], 'u': []}
for t, p in segs:
    L[t].append(LineString([(AX*x+BX, AY*y+BY) for x, y in p]))
SNAP = 0.3
feats = []
def faces(lot, lines):
    band = unary_union([l for l in lines]).buffer(SNAP)
    rest = lot.difference(band).difference(lot.exterior.buffer(SNAP))
    parts = list(getattr(rest, 'geoms', [rest]))
    return [p.buffer(SNAP).intersection(lot) for p in parts if p.area > 10]
def frac_along(face, lines, d=0.8):
    ring = face.exterior; band = unary_union(lines).buffer(d)
    return ring.intersection(band).length / ring.length
for f in lots['features']:
    lot = f['properties']['lot']; r = t5.get(lot)
    if not r or not (r.get('floors_above') or r.get('main_above')): continue
    g = transform(lambda x, y, z=None: fw.transform(x, y), shape(f['geometry'])).buffer(0)
    near = {k: [l.intersection(g.buffer(1.0)) for l in v if l.distance(g) < 1.0] for k, v in L.items()}
    near = {k: [l for l in v if not l.is_empty] for k, v in near.items()}
    allines = near['b'] + near['u']
    fs = faces(g, allines) if allines else []
    bare = lambda fc: fc.exterior.intersection(g.exterior.buffer(0.8)).difference(unary_union(allines).buffer(0.8) if allines else Polygon()).length / fc.exterior.length
    env = [fc for fc in fs if near['b'] and frac_along(fc, near['b']) >= 0.4 and bare(fc) < 0.4]
    blen = sum(l.length for l in near['b']); online = sum(l.intersection(g.exterior.buffer(0.8)).length for l in near['b'])
    tow = [fc for fc in fs if near['u'] and frac_along(fc, near['u']) >= 0.4] if (r.get('floors_above') or 0) >= 12 else []
    tow = [max(tow, key=lambda x: x.area)] if tow else []  # the face inside the 'עילי' line; the strips outside it are base
    note = ''
    if not env:
        if near['b'] and online / max(blen, 1e-9) > 0.8:
            env = [g]; note = 'קו בניין על גבול המגרש: נסיגה 0'
        elif tow or near['u']:
            env = [g]; note = 'אין קו בניין פנימי: כל המגרש'
    e = unary_union(env) if env else None
    print(lot, 'b', round(blen), 'onlot', round(online), 'u', round(sum(l.length for l in near['u'])), 'faces', [round(x.area) for x in fs],
          'env', round(e.area) if e else None, 'tower', [round(x.area) for x in tow], note, file=sys.stderr)
    for kind, geo in (('envelope', e), ('tower', unary_union(tow) if tow else None)):
        if geo is None or geo.is_empty: continue
        w = transform(lambda x, y, z=None: bw.transform(x, y), geo)
        feats.append({'type': 'Feature', 'properties': {'lot': lot, 'kind': kind, 'area_m2': round(geo.area, 1)}, 'geometry': mapping(w)})
json.dump({'type': 'FeatureCollection', 'name': 'תשריט מצב מוצע - חתום להפקדה',
           'properties': {'source': 'תשריט מצב מוצע, קווי בניין', 'crs_note': 'EPSG:4326 from ITM grid ticks (pyproj)', 'snap_m': SNAP,
                          'legend': [{'name': 'קו-בנין', 'kind': 'building', 'colours': ['#a80000']}, {'name': 'קו בנין עילי', 'kind': 'tower', 'colours': ['#00ffc5']}]},
           'features': feats}, open(out, 'w'), ensure_ascii=False)
