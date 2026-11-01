"""Approved state (מצב מאושר) of a plan from its vector "תשריט מצב מאושר" PDF, for the land-use evolution map.

Usage:
  python3 -I scripts/approved-state.py <approved.pdf> <model.json> <evolution.json> <out.geojson> [--page N]

The approved drawing has no ITM grid labels, so it is anchored to the plan boundary instead:
  - The blue line (the plan boundary) is the set of blue stroked paths; its bounding box in PDF
    points is matched to the bounding box of model.boundary in ITM (north-up, no rotation).
    The aspect ratios must agree within 3% and the implied scale must be a round drawing scale.
  - Land-use polygons = filled vector paths, named by their legend swatch (same rules as
    scripts/tashrit-lots.py, whose helpers are reused), clipped to the plan boundary and
    dissolved by use.
  - Check: the area of each use against table 3.2 (approved state) in evolution.json. The
    per-use and total errors are printed and written to the output's properties.
Needs shapely and pyproj.
"""
import importlib.util, json, math, os, re, sys

import pdfplumber
from pyproj import Transformer
from shapely.geometry import Polygon, shape, mapping
from shapely.ops import unary_union
from shapely.validation import make_valid

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('tl', os.path.join(HERE, 'tashrit-lots.py'))
tl = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tl)

args = sys.argv[1:]
page_no = 1
if '--page' in args:
    i = args.index('--page'); page_no = int(args[i + 1]); del args[i:i + 2]
pdf_path, model_path, evo_path, out_path = args
log = lambda *a: print(*a, file=sys.stderr)
model = json.load(open(model_path))
evo = json.load(open(evo_path))
page = pdfplumber.open(pdf_path).pages[page_no - 1]

to_itm = Transformer.from_crs(4326, 2039, always_xy=True).transform
to_wgs = Transformer.from_crs(2039, 4326, always_xy=True).transform
boundary = unary_union([make_valid(shape(f['geometry'])) for f in model['boundary']['features']])
bnd_itm = unary_union([Polygon([to_itm(*p) for p in poly.exterior.coords])
                       for poly in getattr(boundary, 'geoms', [boundary])])
bx0, by0, bx1, by1 = bnd_itm.bounds

# 1. blue line in the PDF: stroked paths whose colour is mostly blue
def is_blue(c):
    c = tl.rgb(c)
    return bool(c) and c[2] > 0.8 and c[0] < 0.25 and c[1] < 0.5

pts = []
for o in page.curves + page.rects + page.lines:
    if o.get('stroke') and not o.get('fill') and is_blue(o.get('stroking_color')) and (o.get('linewidth') or 0) >= 0.5:
        for line in tl.polylines(o):
            pts += line
if not pts:
    sys.exit('no blue line found')
# the frame and the legend can hold blue strokes too: keep the densest cluster around the median
xs, ys = sorted(p[0] for p in pts), sorted(p[1] for p in pts)
mx, my = xs[len(xs) // 2], ys[len(ys) // 2]
spread = max(page.width, page.height) * 0.45
core = [p for p in pts if abs(p[0] - mx) < spread and abs(p[1] - my) < spread]
px0, px1 = min(p[0] for p in core), max(p[0] for p in core)
py0, py1 = min(p[1] for p in core), max(p[1] for p in core)
sx, sy = (bx1 - bx0) / (px1 - px0), (by1 - by0) / (py1 - py0)
log(f'blue line bbox {px1 - px0:.0f} x {py1 - py0:.0f} pt; boundary {bx1 - bx0:.1f} x {by1 - by0:.1f} m')
log(f'scale x {sx:.4f} m/pt (1:{sx / 0.000352778:.0f}), y {sy:.4f} m/pt (1:{sy / 0.000352778:.0f}), '
    f'aspect mismatch {abs(sx / sy - 1) * 100:.1f}%')
if abs(sx / sy - 1) > 0.03:
    sys.exit('aspect mismatch above 3%: the drawing is rotated or the blue line was not isolated')
s = (sx + sy) / 2
pdf2itm = lambda x, y: (bx0 + (x - px0) * s, by1 - (y - py0) * s)

# 2. filled land-use polygons around the plan, named by legend swatch
pad = 0.15 * max(px1 - px0, py1 - py0)
near = lambda x, y: px0 - pad < x < px1 + pad and py0 - pad < y < py1 + pad
polys = []
for o in page.curves + page.rects:
    if not o.get('fill'):
        continue
    col = tl.rgb(o.get('non_stroking_color'))
    if not col or max(col) < 0.05 or min(col) > 0.95:
        continue
    for r in tl.rings_of(o):
        if len(r) < 3:
            continue
        cx, cy = sum(p[0] for p in r) / len(r), sum(p[1] for p in r) / len(r)
        if near(cx, cy) and abs(tl.shoelace(r)) * s * s > 5:
            polys.append((col, r))
legend = {}
for o in page.rects:
    col = tl.rgb(o.get('non_stroking_color'))
    if not o.get('fill') or not col or near((o['x0'] + o['x1']) / 2, (o['top'] + o['bottom']) / 2):
        continue
    if o['x1'] - o['x0'] > 80 or o['bottom'] - o['top'] > 80 or not any(tl.same(col, c) for c, _ in polys):
        continue
    txt = tl.crop_text(pdf_path, page_no, max(0, o['x0'] - 260), o['top'] - 1, o['x0'] - 2, o['bottom'] + 1) \
        or tl.crop_text(pdf_path, page_no, o['x1'] + 2, o['top'] - 1, min(page.width, o['x1'] + 260), o['bottom'] + 1)
    if txt:
        u = tl.norm_use(next((ln for ln in txt.splitlines() if re.search(r'[^\W\d_]', ln)), txt.splitlines()[0]))
        legend.setdefault(tl.hexc(col), u)
log('legend:', legend)

# 3. clip to the boundary, dissolve by use; later (upper) paths win where fills overlap
by_use, covered = {}, None
for col, r in reversed(polys):
    use = legend.get(tl.hexc(col))
    if not use:
        continue
    g = make_valid(Polygon([pdf2itm(*p) for p in r])).intersection(bnd_itm)
    if covered is not None:
        g = g.difference(covered)
    if g.is_empty or g.area < 1:
        continue
    covered = g if covered is None else covered.union(g)
    by_use[use] = by_use[use].union(g) if use in by_use else g

# 4. check against table 3.2
t32 = {}
for row in evo['approved']:
    t32[tl.norm_use(row['use'])] = t32.get(tl.norm_use(row['use']), 0) + row['m2']
total_t = evo['approved_total']
uncovered = bnd_itm.area - (covered.area if covered is not None else 0)
log(f'boundary {bnd_itm.area:.0f} m2 (table 3.2 total {total_t:.0f}); not coloured {uncovered:.0f} m2')
feats, worst = [], 0.0
for use, g in sorted(by_use.items(), key=lambda kv: -kv[1].area):
    t = t32.get(use)
    err = (g.area - t) / t if t else None
    if err is not None:
        worst = max(worst, abs(err))
    log(f'  {use:28s} {g.area:9.0f} m2   table 3.2 {t if t else "-":>9}   {"" if err is None else f"{err * 100:+.1f}%"}')
    geom = mapping(g)
    def conv(c):
        return [list(to_wgs(*p)) for p in c]
    if geom['type'] == 'Polygon':
        geom['coordinates'] = [conv(ring) for ring in geom['coordinates']]
    elif geom['type'] == 'MultiPolygon':
        geom['coordinates'] = [[conv(ring) for ring in poly] for poly in geom['coordinates']]
    else:
        continue
    feats.append({'type': 'Feature', 'geometry': geom,
                  'properties': {'use': use, 'area_m2': round(g.area), 'table32_m2': t,
                                 'error_pct': None if err is None else round(err * 100, 1)}})
out = {'type': 'FeatureCollection', 'features': feats,
       'properties': {'source': os.path.basename(pdf_path), 'anchor': 'blue line bbox to model.boundary',
                      'scale_m_per_pt': round(s, 5), 'aspect_mismatch_pct': round(abs(sx / sy - 1) * 100, 2),
                      'max_use_error_pct': round(worst * 100, 1), 'uncoloured_m2': round(uncovered)}}
json.dump(out, open(out_path, 'w'), ensure_ascii=False)
log(f'{len(feats)} uses written; worst use error {worst * 100:.1f}%')
