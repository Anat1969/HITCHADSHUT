"""Trace building lines (קווי בניין) on a vector "תשריט מצב מוצע" PDF into per-lot envelopes.

Usage:
  python3 -I scripts/tashrit-building-lines.py <tashrit.pdf> <lots.geojson> <out.geojson> [--page N] [--table5 t5.json]
         [--debug faces.geojson] [--snap M] [--only 201-215,304] [--append earlier.geojson]

  <lots.geojson> is the output of scripts/tashrit-lots.py for the plan (any drawing of it: the lots are
  in ITM/WGS84, so an enlargement sheet of the same plan works with the main sheet's lots).
  Output: GeoJSON EPSG:4326, one feature per face, properties {lot, kind: 'envelope'|'tower', area_m2}.
  A lot with no building lines gets no feature (the model then uses the whole lot).
  --snap: SNAP in metres (default 0.3, for 1:500; 0.6 on a 1:1000 sheet, where dash gaps are twice as long).
  --only: lot numbers/ranges to process. --append: keep the lots of an earlier run (another sheet)
  that this run does not produce; features then carry 'drawing', and properties.runs lists the runs.

Runs (validated: re-run and diff against the committed supabase/seed/*.envelopes.geojson):
  603-0704064, 603-0391219: --table5 <plan>.table5.json.
  tamal-2024 (תשריט.pdf, 1:500): --table5 tamal-2024.table5.json.
  tamal-2021: two sheets, public lots from the 1:1000 sheet, the residential part from the 1:500 enlargement:
    A = <1:1000 sheet> ... --table5 tamal-2021.table5.json --snap 0.6 --only 301-316
    <1:500 enlargement> ... --table5 tamal-2021.table5.json --only 201-215,304 --append A

How it works:
  - Page loading, the ITM grid fit and ITM->WGS84 come from scripts/tashrit-lots.py (importlib).
  - Legend: short stroked segments outside the map frame, grouped by row. The text next to each row
    (pdftotext crop) names the style; its stroke colours are the style's colours. Planning-portal
    exports draw the dashes as separate short segments, so a style is told apart by colour only.
      קו בניין / קו-בנין / קו בניין עילי  -> building line
      ... מגדל / גבוה                     -> tower line
      ... תחתי / תת קרקעי, ... מרפסות     -> ignored (underground, balcony lines)
    A colour that also belongs to an ignored style is dropped from the building styles.
  - In the frame, every stroked segment of a building-line colour is taken to ITM metres.
  - Per lot (lots geojson taken back to ITM): all building-line segments (any style) plus the lot
    boundary are buffered by SNAP metres (bridges dash gaps and small misses), the lot minus that
    band falls apart into faces, and each face is grown back by SNAP and clipped to the lot.
  - A face belongs to the envelope when building lines run along >= 40% of its outline and less
    than 40% of it is bare lot line (a lot line with no building line on it). That drops the
    setback strips between a building line and the lot line, and keeps strips between an inner
    line and a "קו בניין 0" drawn on the lot line. Slivers (< 10 m2, < 2 m wide) are dropped.
  - Building lines that only run on the lot line (>= 60% of it, nothing inside): setback 0 all
    round, envelope = the lot. Lines on < 60% of the lot line and nothing inside: a neighbour's
    line, the lot gets nothing.
  - Tower: faces of a tower-style legend line when there is one. Otherwise, with --table5, a lot
    of >= TOWER_FLOORS floors whose envelope is split by inner lines: the largest face is the tower
    and the rest is the base (603-0704064 lot 1: the inner "עילי" line is labelled "קו בניין
    למגדל" on the map; 603-0391219 lot 5: the "עילי" line holds the floors above the base).
  - With --table5, lots without floors_above/main_above (open space, roads, parking below
    ground) are skipped.

Limits:
  - Map labels on the lines (e.g. "קו בניין למגדל") are rotated and split into letters by the
    export, so they are not read; the tower comes from the legend name or the split rule.
  - A building line that stops more than ~2*SNAP short of another line leaves the face open;
    the envelope then merges with its setback strip and is dropped (check the overlay). Same
    when the only other lines are underground ones (603-0391219 lot 2): the lot gets nothing.
  - Balcony lines (קו בניין 0 למרפסות) and underground lines are ignored.
  - The split rule also fires on 10-floor lots whose "עילי" line sets back the upper floors
    (tamal-2021 lots 203, 207): the "tower" there is the upper-floor footprint, not a high-rise.
  - No tower line and a single face (tamal-2024 lots 1-4, tamal-2021 lot 202): no tower feature.
"""
import importlib.util, json, math, os, re, sys

from shapely.geometry import LineString, Polygon, MultiPolygon, shape
from shapely.ops import unary_union
import shapely
import shapely.geometry.polygon

HERE = '/home/user/HITCHADSHUT/scripts'  # copy: import the repo's tashrit-lots.py
_spec = importlib.util.spec_from_file_location('tashrit_lots', os.path.join(HERE, 'tashrit-lots.py'))
TL = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(TL)

SNAP = 0.3  # m
TOWER_FLOORS = 10  # with --table5: a lot this tall whose envelope splits into faces has a tower
log = lambda *a: print(*a, file=sys.stderr)


def classify(text):
    t = TL.BIDI.sub('', text).replace('-', ' ').replace('ניין', 'נין')
    t = re.sub(r'\s+', ' ', t)
    if 'קו' not in t or 'בנין' not in t:
        return None
    if 'תחת' in t or 'תת' in t or 'מרפס' in t:
        return 'ignore'
    if 'מגדל' in t or 'גבוה' in t:
        return 'tower'
    return 'building'


def main():
    global SNAP
    args = sys.argv[1:]
    page_no, dbg, only, prev = 1, None, None, None
    if '--append' in args:
        i = args.index('--append'); prev = json.load(open(args[i + 1])); del args[i:i + 2]
    if '--snap' in args:
        i = args.index('--snap'); SNAP = float(args[i + 1]); del args[i:i + 2]
    if '--only' in args:
        i = args.index('--only'); only = set()
        for part in args[i + 1].split(','):
            lo, _, hi = part.partition('-')
            only.update(range(int(lo), int(hi or lo) + 1))
        del args[i:i + 2]
    if '--page' in args:
        i = args.index('--page'); page_no = int(args[i + 1]); del args[i:i + 2]
    t5 = None
    if '--table5' in args:
        i = args.index('--table5'); t5 = json.load(open(args[i + 1])); del args[i:i + 2]
    if '--debug' in args:
        i = args.index('--debug'); dbg = args[i + 1]; del args[i:i + 2]
    pdf_path, lots_path, out_path = args
    page = TL.pdfplumber.open(pdf_path).pages[page_no - 1]
    words = TL.words_pdftotext(pdf_path, page_no) or page.extract_words()

    # 1. georeference + frame (same rules as tashrit-lots.py)
    g = TL.fit_grid(words)
    (a, b, c), resx, ptsx = g['X']
    (d, e, f), resy, ptsy = g['Y']
    to_itm = lambda x, y: (a * x + b * y + c, d * x + e * y + f)
    mpp = math.sqrt(abs(a * e - b * d))
    log(f'grid fit: {mpp:.4f} m/pt, residual max {max(map(abs, resx + resy)):.3f} m')
    fx0 = max(p[0] for p in ptsy if p[0] < page.width / 2) if any(p[0] < page.width / 2 for p in ptsy) else min(p[0] for p in ptsx) - 30
    fx1 = min(p[0] for p in ptsy if p[0] > fx0 + 50) if any(p[0] > fx0 + 50 for p in ptsy) else max(p[0] for p in ptsx) + 30
    fy0 = min(p[1] for p in ptsx)
    fy1 = max(p[1] for p in ptsx) if max(p[1] for p in ptsx) > fy0 + 50 else page.height
    in_frame = lambda x, y: fx0 < x < fx1 and fy0 < y < fy1

    objs = [o for o in page.curves + page.lines if o.get('stroke') and o.get('stroking_color') and o.get('pts')]

    # 2. legend line samples: horizontal stroked segments outside the frame, one row each
    rows = {}
    for o in objs:
        if in_frame((o['x0'] + o['x1']) / 2, (o['top'] + o['bottom']) / 2):
            continue
        if o['bottom'] - o['top'] > 1 or o['x1'] - o['x0'] > 60:
            continue
        key = round((o['top'] + o['bottom']) / 2)
        r = rows.setdefault(key, dict(x0=o['x0'], x1=o['x1'], cols=set()))
        r['x0'], r['x1'] = min(r['x0'], o['x0']), max(r['x1'], o['x1'])
        r['cols'].add(TL.hexc(TL.rgb(o['stroking_color'])))
    styles = []
    for y, r in sorted(rows.items()):
        if r['x1'] - r['x0'] < 15 or r['x1'] - r['x0'] > 80:
            continue
        txt = TL.crop_text(pdf_path, page_no, max(0, r['x0'] - 260), y - 7, r['x0'] - 2, y + 7) \
            or TL.crop_text(pdf_path, page_no, r['x1'] + 2, y - 7, min(page.width, r['x1'] + 260), y + 7)
        # copy (603-0780734): this export splits the legend text into one glyph per line, so the
        # last line is a single letter. Join the lines bottom-up and classify by the letters.
        lines = [TL.BIDI.sub('', l).strip() for l in (txt.splitlines() if txt else [])]
        lines = [l for l in lines if l]
        txt = ''.join(reversed(lines))
        kind = classify(txt)
        letters = set(txt)
        if kind is None and set('קובנ') <= letters and len(txt) <= 14:
            kind = 'tower' if set('על') <= letters else 'building'  # "קו בנין עילי": sec 4.1.2 א 10, tower line above the podium
        if kind == 'building' and 'עיל' in txt:
            kind = 'tower'  # copy: "קו בניין עילי" = tower line above the podium (603-0780734 sec 4.1.2 א 10)
        if kind:
            styles.append(dict(name=txt, kind=kind, cols=r['cols'], y=y))
    ignored = set().union(*[s['cols'] for s in styles if s['kind'] == 'ignore']) if styles else set()
    for s in styles:
        if s['kind'] != 'ignore':
            s['cols'] = s['cols'] - ignored
        log(f"legend: {s['name']!r} -> {s['kind']}, colours {sorted(s['cols'])}")
    styles = [s for s in styles if s['kind'] != 'ignore' and s['cols']]
    if not styles:
        sys.exit('no building-line styles in the legend')

    # 3. segments in the frame, per style, in ITM metres
    segs = {i: [] for i in range(len(styles))}
    for o in objs:
        col = TL.hexc(TL.rgb(o['stroking_color']))
        for i, s in enumerate(styles):
            if col in s['cols']:
                pts = [p for p in o['pts']]
                if all(in_frame(*p) for p in pts):
                    segs[i].append(LineString([to_itm(*p) for p in pts]))
    for i, s in enumerate(styles):
        log(f"  {s['name']}: {len(segs[i])} segments, {sum(l.length for l in segs[i]):.0f} m")

    # 4. lots back to ITM
    from pyproj import Transformer
    inv = Transformer.from_crs(4326, 2039, always_xy=True)
    lots = []
    for ft in json.load(open(lots_path))['features']:
        lot = ft['properties'].get('lot')
        if not isinstance(lot, int):
            continue
        geo = shape(ft['geometry'])
        polys = list(geo.geoms) if isinstance(geo, MultiPolygon) else [geo]
        itm = unary_union([Polygon([inv.transform(*p) for p in pg.exterior.coords],
                                   [[inv.transform(*p) for p in h.coords] for h in pg.interiors]) for pg in polys])
        lots.append((lot, itm.buffer(0)))

    # 5. faces per lot
    def faces(lot_poly, lines):
        near = [l for l in lines if l.distance(lot_poly) < SNAP]
        if not near:
            return None, None
        band = unary_union(near).buffer(SNAP)
        inner = band.intersection(lot_poly.buffer(-2 * SNAP))
        if inner.area < 1:  # lines only on the lot line: setback 0 all round, or a neighbour's line
            on = lot_poly.boundary.intersection(band).length / lot_poly.boundary.length
            return ([], band) if on > 0.6 else (None, None)
        cut = unary_union([band, lot_poly.boundary.buffer(SNAP)])
        rest = lot_poly.difference(cut)
        near_bl = band.buffer(SNAP * 1.5)
        near_lot = lot_poly.boundary.buffer(SNAP * 2.5)
        out = []
        for fc in getattr(rest, 'geoms', [rest]):
            if fc.area < 2:
                continue
            fg = fc.buffer(SNAP, join_style='mitre').intersection(lot_poly)
            fg = max(getattr(fg, 'geoms', [fg]), key=lambda q: q.area) if fg.geom_type != 'Polygon' else fg
            ring = fc.exterior
            bl = ring.intersection(near_bl).length / ring.length
            bare = ring.intersection(near_lot).difference(near_bl).length / ring.length
            rad = shapely.maximum_inscribed_circle(fc, 0.1).length + SNAP
            out.append(dict(geom=fg, bl=bl, bare=bare, rad=rad))
        return out, band

    def pick(fs):
        """Building faces: enclosed by building lines, not a setback strip along a bare lot line."""
        if not fs:
            return []
        return [q for q in fs if q['bl'] >= 0.4 and q['bare'] < 0.4 and q['rad'] >= 1.0 and q['geom'].area >= 10]

    to_wgs, how = TL.make_to_wgs()
    feats, dfeats = [], []

    def emit(lot, kind, geom, extra=None, target=feats):
        geoms = getattr(geom, 'geoms', [geom])
        for gm in geoms:
            if gm.geom_type != 'Polygon' or gm.area < 1:
                continue
            gm = shapely.geometry.polygon.orient(gm.simplify(0.05), 1.0)
            rings = [[[round(v, 7) for v in to_wgs(*p)] for p in r.coords] for r in [gm.exterior, *gm.interiors]]
            props = dict(lot=lot, kind=kind, area_m2=round(gm.area, 1))
            props.update(extra or {})
            target.append(dict(type='Feature', properties=props, geometry=dict(type='Polygon', coordinates=rings)))

    bstyles = [i for i, s in enumerate(styles) if s['kind'] == 'building']
    tstyles = [i for i, s in enumerate(styles) if s['kind'] == 'tower']
    blines = [l for i in bstyles for l in segs[i]]
    tlines = [l for i in tstyles for l in segs[i]]
    t5lots = {l['lot']: l for l in (t5 or {}).get('lots', [])}
    for lot, lp in sorted(lots, key=lambda t: t[0]):
        if only is not None and lot not in only:
            continue
        row = t5lots.get(lot)
        if t5 and not (row and (row.get('floors_above') or row.get('main_above'))):
            continue  # nothing built above ground in this lot (open space, road, parking below)
        fs, band = faces(lp, blines + tlines)
        if fs is None:
            log(f'lot {lot}: no building lines')
            continue
        env_faces = pick(fs)
        for q in fs:
            emit(lot, 'face', q['geom'], dict(bl=round(q['bl'], 2), bare=round(q['bare'], 2), rad=round(q['rad'], 1),
                                              chosen=q in env_faces), dfeats)
        if fs == []:
            env = lp  # building lines run on the lot line all round (setback 0)
        elif env_faces:
            env = unary_union([q['geom'] for q in env_faces]).buffer(0.05).buffer(-0.05).intersection(lp)
            if env.area > 0.98 * lp.area:
                env = lp  # only corner slivers missing: the lot itself
        else:
            log(f'lot {lot}: building lines do not close a face; skipped')
            continue
        tow = None
        if tlines:
            tf, _ = faces(lp, tlines)
            tp = pick(tf or [])
            if tp:
                tow = unary_union([q['geom'] for q in tp]).intersection(env)
        elif row and (row.get('floors_above') or 0) >= TOWER_FLOORS and len(env_faces) >= 2:
            # inner building lines split the envelope: the main face is the tower, the rest the base
            big = max(env_faces, key=lambda q: q['geom'].area)
            if big['geom'].area < 0.9 * env.area:
                tow = big['geom'].intersection(env)
        emit(lot, 'envelope', env)
        if tow is not None and not tow.is_empty:
            emit(lot, 'tower', tow)
        log(f'lot {lot}: lot {lp.area:.0f} m2, envelope {env.area:.0f} m2 in {len(env_faces) or 1} face(s)'
            + (f', tower {tow.area:.0f} m2' if tow is not None and not tow.is_empty else ''))

    fc = dict(type='FeatureCollection', name=os.path.basename(pdf_path),
              properties=dict(source='תשריט מצב מוצע, קווי בניין', crs_note=f'EPSG:4326 from ITM grid fit ({how})',
                              snap_m=SNAP, legend=[dict(name=s['name'], kind=s['kind'], colours=sorted(s['cols'])) for s in styles]),
              features=feats)
    if prev:  # earlier run on another drawing: keep its lots that this run did not produce
        done = {ft['properties']['lot'] for ft in feats}
        kept = [ft for ft in prev['features'] if ft['properties']['lot'] not in done]
        for ft in kept:
            ft['properties'].setdefault('drawing', prev.get('name'))
        for ft in feats:
            ft['properties']['drawing'] = fc['name']
        fc['features'] = sorted(kept + feats, key=lambda ft: ft['properties']['lot'])
        fc['properties']['runs'] = (prev['properties'].get('runs') or [dict(drawing=prev.get('name'), snap_m=prev['properties'].get('snap_m'),
                                                                            legend=prev['properties'].get('legend'))]) \
            + [dict(drawing=fc['name'], snap_m=SNAP, legend=fc['properties']['legend'])]
    json.dump(fc, open(out_path, 'w'), ensure_ascii=False, indent=1)
    if dbg:
        json.dump(dict(type='FeatureCollection', features=dfeats), open(dbg, 'w'), ensure_ascii=False)
    log(f'{len(feats)} features -> {out_path}')


if __name__ == '__main__':
    main()
