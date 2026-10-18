"""Extract georeferenced lots (תאי שטח) from a vector "תשריט מצב מוצע" PDF.

Usage:
  python3 -I scripts/tashrit-lots.py <tashrit.pdf> <out.geojson> [--page N] [--table5 t5.json]

How it works:
  - Words come from poppler `pdftotext -bbox` (ESRI exports often hide their Arial text from
    pdfplumber); pdfplumber words are the fallback.
  - ITM grid labels on the frame (1xxxxx = X, 3xxxxx-8xxxxx = Y) give an affine PDF->ITM fit.
    Labels are assumed centred on their grid tick. Residuals and the implied scale are printed.
  - Land-use polygons = filled vector paths inside the map frame (not black/white).
    The use name comes from the legend swatch (a filled rect outside the frame) of the same colour.
  - Lot numbers = integer words inside a small blue stroked box (the "תא שטח ומספרו" symbol).
  - ITM->WGS84 with pyproj when installed, else a built-in TM inverse + Helmert (EPSG:2039 towgs84).

Limits:
  - Hatch overlays (zchut maavar, kikar grid) are ignored; only the solid fill decides the use.
  - Two legend entries with the same fill (e.g. מגורים ד / מגורים ה) give "a / b"; pass --table5
    (the table5.json shape) to take the use from table 3.1/5 by lot number instead.
  - Bezier segments are reduced to their end points (planning polygons are straight lines).
  - Assumes a north-up layout; a rotated frame still fits, but labels must sit on the ticks.
"""
import json, math, re, subprocess, sys

import pdfplumber

try:
    import numpy as np
except ImportError:  # pragma: no cover
    np = None

KNOWN_USES = [
    'מגורים א', 'מגורים ב', 'מגורים ג', 'מגורים ד', 'מגורים ה', 'מגורים מיוחד', 'מגורים ומסחר',
    'מגורים מסחר ותעסוקה', 'שטח פרטי פתוח', 'שטח ציבורי פתוח', 'ככר עירונית', 'כיכר עירונית',
    'דרך מאושרת', 'דרך מוצעת', 'דרך משולבת', 'שביל', 'חניון', 'מבנים ומוסדות ציבור', 'מסחר',
    'תעסוקה', 'מסחר ותעסוקה', 'מסחר תעסוקה ומבנים ומוסדות ציבור', 'מלונאות', 'מתקנים הנדסיים',
]
BIDI = re.compile('[‎‏‪-‮⁦-⁩]')


def norm_use(raw):
    t = BIDI.sub('', raw).replace('צבור', 'ציבור').replace(',', ' ').replace("'", '')
    t = re.sub(r'\s+', ' ', t).strip()
    flat = t.replace(' ', '')
    for k in KNOWN_USES:
        if k.replace(' ', '') == flat:
            return k
    return t


def words_pdftotext(pdf, page):
    try:
        out = subprocess.run(['pdftotext', '-bbox', '-f', str(page), '-l', str(page), pdf, '-'],
                             capture_output=True, text=True, check=True).stdout
    except (OSError, subprocess.CalledProcessError):
        return []
    rx = r'<word xMin="([\d.-]+)" yMin="([\d.-]+)" xMax="([\d.-]+)" yMax="([\d.-]+)">([^<]*)</word>'
    return [dict(x0=float(a), top=float(b), x1=float(c), bottom=float(d), text=t)
            for a, b, c, d, t in re.findall(rx, out)]


def crop_text(pdf, page, x0, top, x1, bottom):
    try:
        return subprocess.run(['pdftotext', '-f', str(page), '-l', str(page), '-x', str(int(x0)),
                               '-y', str(int(top)), '-W', str(int(x1 - x0)), '-H', str(int(bottom - top)),
                               pdf, '-'], capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return ''


def lstsq(rows, vals):
    """Least squares for vals ~ rows @ coef, falling back to fewer unknowns when singular."""
    A = np.array(rows, float)
    coef, _, rank, _ = np.linalg.lstsq(A, np.array(vals, float), rcond=None)
    return coef, rank


def fit_grid(words):
    xs, ys = [], []
    for w in words:
        if not re.fullmatch(r'\d{6}', w['text']):
            continue
        v = int(w['text'])
        cx, cy = (w['x0'] + w['x1']) / 2, (w['top'] + w['bottom']) / 2
        horiz = (w['x1'] - w['x0']) > (w['bottom'] - w['top'])
        if 100000 <= v < 300000 and horiz:
            xs.append((cx, cy, v))
        elif 300000 <= v < 900000 and not horiz:
            ys.append((cx, cy, v))
    if len({v for *_, v in xs}) < 2 or len({v for *_, v in ys}) < 2:
        sys.exit('not enough ITM grid labels (need 2 X and 2 Y values)')
    out = {}
    for name, pts in (('X', xs), ('Y', ys)):
        coef, rank = lstsq([[px, py, 1] for px, py, _ in pts], [v for *_, v in pts])
        if rank < 3:  # all labels on one row/column: assume no rotation
            main = 0 if name == 'X' else 1
            c2, _ = lstsq([[p[main], 1] for p in pts], [v for *_, v in pts])
            coef = [c2[0], 0, c2[1]] if main == 0 else [0, c2[0], c2[1]]
        res = [v - (coef[0] * px + coef[1] * py + coef[2]) for px, py, v in pts]
        out[name] = (list(map(float, coef)), res, pts)
    return out


# --- ITM (EPSG:2039) -> WGS84 without pyproj -------------------------------------------
GRS80 = (6378137.0, 1 / 298.257222101)
WGS84 = (6378137.0, 1 / 298.257223563)
TOWGS84 = (-24.0024, -17.1032, -17.8444, -0.33077, -1.85269, 1.66969, 5.4262)


def tm_inverse(E, N, a=GRS80[0], f=GRS80[1], lat0=31.7343936111111, lon0=35.2045169444444,
               k0=1.0000067, FE=219529.584, FN=626907.39):
    e2 = f * (2 - f)
    ep2 = e2 / (1 - e2)

    def M(phi):
        return a * ((1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256) * phi
                    - (3 * e2 / 8 + 3 * e2**2 / 32 + 45 * e2**3 / 1024) * math.sin(2 * phi)
                    + (15 * e2**2 / 256 + 45 * e2**3 / 1024) * math.sin(4 * phi)
                    - (35 * e2**3 / 3072) * math.sin(6 * phi))
    m = M(math.radians(lat0)) + (N - FN) / k0
    mu = m / (a * (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256))
    e1 = (1 - math.sqrt(1 - e2)) / (1 + math.sqrt(1 - e2))
    p1 = (mu + (3 * e1 / 2 - 27 * e1**3 / 32) * math.sin(2 * mu)
          + (21 * e1**2 / 16 - 55 * e1**4 / 32) * math.sin(4 * mu)
          + (151 * e1**3 / 96) * math.sin(6 * mu) + (1097 * e1**4 / 512) * math.sin(8 * mu))
    C1 = ep2 * math.cos(p1)**2
    T1 = math.tan(p1)**2
    N1 = a / math.sqrt(1 - e2 * math.sin(p1)**2)
    R1 = a * (1 - e2) / (1 - e2 * math.sin(p1)**2)**1.5
    D = (E - FE) / (N1 * k0)
    lat = p1 - (N1 * math.tan(p1) / R1) * (D**2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1**2 - 9 * ep2) * D**4 / 24
                                          + (61 + 90 * T1 + 298 * C1 + 45 * T1**2 - 252 * ep2 - 3 * C1**2) * D**6 / 720)
    lon = math.radians(lon0) + (D - (1 + 2 * T1 + C1) * D**3 / 6
                                + (5 - 2 * C1 + 28 * T1 - 3 * C1**2 + 8 * ep2 + 24 * T1**2) * D**5 / 120) / math.cos(p1)
    return lat, lon


def helmert_to_wgs84(lat, lon):
    def to_xyz(lat, lon, a, f):
        e2 = f * (2 - f)
        n = a / math.sqrt(1 - e2 * math.sin(lat)**2)
        return n * math.cos(lat) * math.cos(lon), n * math.cos(lat) * math.sin(lon), n * (1 - e2) * math.sin(lat)
    x, y, z = to_xyz(lat, lon, *GRS80)
    tx, ty, tz, rx, ry, rz, s = TOWGS84
    rx, ry, rz = (math.radians(r / 3600) for r in (rx, ry, rz))
    k = 1 + s * 1e-6  # position-vector convention (PROJ towgs84)
    X = tx + k * (x - rz * y + ry * z)
    Y = ty + k * (rz * x + y - rx * z)
    Z = tz + k * (-ry * x + rx * y + z)
    a, f = WGS84
    e2 = f * (2 - f)
    p = math.hypot(X, Y)
    lat2 = math.atan2(Z, p * (1 - e2))
    for _ in range(6):
        n = a / math.sqrt(1 - e2 * math.sin(lat2)**2)
        lat2 = math.atan2(Z + e2 * n * math.sin(lat2), p)
    return math.degrees(math.atan2(Y, X)), math.degrees(lat2)


def make_to_wgs():
    try:
        from pyproj import Transformer
        t = Transformer.from_crs(2039, 4326, always_xy=True)
        return t.transform, 'pyproj'
    except Exception:
        return (lambda E, N: helmert_to_wgs84(*tm_inverse(E, N))), 'built-in TM+Helmert'


# --- geometry helpers --------------------------------------------------------------------
def rings_of(obj):
    rings, cur = [], []
    for seg in obj.get('path') or []:
        op = seg[0]
        if op == 'm':
            if len(cur) >= 3:
                rings.append(cur)
            cur = [seg[1]]
        elif op in ('l', 'c', 'v', 'y'):
            cur.append(seg[-1])
        elif op == 'h' and cur:
            if len(cur) >= 3:
                rings.append(cur)
            cur = []
    if len(cur) >= 3:
        rings.append(cur)
    if not rings and obj.get('pts') and len(obj['pts']) >= 3:
        rings = [list(obj['pts'])]
    return [[tuple(p) for p in r] for r in rings]


def shoelace(r):
    return sum(r[i][0] * r[(i + 1) % len(r)][1] - r[(i + 1) % len(r)][0] * r[i][1] for i in range(len(r))) / 2


def inside(pt, ring):
    x, y = pt
    c = False
    for i in range(len(ring)):
        x1, y1 = ring[i]
        x2, y2 = ring[(i + 1) % len(ring)]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            c = not c
    return c


def rgb(c):
    if c is None:
        return None
    c = tuple(c) if isinstance(c, (list, tuple)) else (c,)
    if len(c) == 1:
        return (c[0],) * 3
    if len(c) == 4:  # CMYK
        C, M, Y, K = c
        return ((1 - C) * (1 - K), (1 - M) * (1 - K), (1 - Y) * (1 - K))
    return c[:3]


def hexc(c):
    return '#%02x%02x%02x' % tuple(round(v * 255) for v in c)


def same(a, b, tol=0.02):
    return a and b and all(abs(x - y) <= tol for x, y in zip(a, b))


def main():
    args = sys.argv[1:]
    page_no, t5 = 1, None
    if '--page' in args:
        i = args.index('--page'); page_no = int(args[i + 1]); del args[i:i + 2]
    if '--table5' in args:
        i = args.index('--table5'); t5 = json.load(open(args[i + 1])); del args[i:i + 2]
    pdf_path, out_path = args
    page = pdfplumber.open(pdf_path).pages[page_no - 1]
    words = words_pdftotext(pdf_path, page_no) or page.extract_words()
    log = lambda *a: print(*a, file=sys.stderr)

    # 1. georeference
    g = fit_grid(words)
    (a, b, c), resx, ptsx = g['X']
    (d, e, f), resy, ptsy = g['Y']
    to_itm = lambda x, y: (a * x + b * y + c, d * x + e * y + f)
    mpp = math.sqrt(abs(a * e - b * d))
    log(f'grid labels: {len(ptsx)} X, {len(ptsy)} Y; residuals X max {max(map(abs, resx)):.3f} m, '
        f'Y max {max(map(abs, resy)):.3f} m')
    log(f'{mpp:.4f} m per PDF point -> scale 1:{mpp / 0.000352778:.0f}; rotation '
        f'{math.degrees(math.atan2(-d, a)):.3f} deg')
    fx0 = max(p[0] for p in ptsy if p[0] < page.width / 2) if any(p[0] < page.width / 2 for p in ptsy) else min(p[0] for p in ptsx) - 30
    fx1 = min(p[0] for p in ptsy if p[0] > fx0 + 50) if any(p[0] > fx0 + 50 for p in ptsy) else max(p[0] for p in ptsx) + 30
    fy0 = min(p[1] for p in ptsx)
    fy1 = max(p[1] for p in ptsx) if max(p[1] for p in ptsx) > fy0 + 50 else page.height
    in_frame = lambda x, y: fx0 < x < fx1 and fy0 < y < fy1

    # 2. filled land-use polygons in the frame
    polys = []
    for o in page.curves + page.rects:
        if not o.get('fill'):
            continue
        col = rgb(o.get('non_stroking_color'))
        if not col or max(col) < 0.05 or min(col) > 0.95:
            continue
        for r in rings_of(o):
            cx = sum(p[0] for p in r) / len(r); cy = sum(p[1] for p in r) / len(r)
            area_pt = abs(shoelace(r))
            if in_frame(cx, cy) and area_pt * mpp * mpp > 5 and area_pt < (fx1 - fx0) * (fy1 - fy0) * 0.9:
                polys.append(dict(ring=r, color=col, area_pt=area_pt))

    # 3. legend: swatches outside the frame with a map colour
    legend = {}
    for o in page.rects:
        col = rgb(o.get('non_stroking_color'))
        if not o.get('fill') or in_frame((o['x0'] + o['x1']) / 2, (o['top'] + o['bottom']) / 2):
            continue
        if not any(same(col, p['color']) for p in polys) or o['x1'] - o['x0'] > 80:
            continue
        txt = crop_text(pdf_path, page_no, max(0, o['x0'] - 260), o['top'] - 1, o['x0'] - 2, o['bottom'] + 1) \
            or crop_text(pdf_path, page_no, o['x1'] + 2, o['top'] - 1, min(page.width, o['x1'] + 260), o['bottom'] + 1)
        if txt:
            names = legend.setdefault(hexc(col), [])
            u = norm_use(txt.splitlines()[0])
            if u not in names:
                names.append(u)

    # 4. lot labels: integers inside a small blue stroked box
    boxes = [o for o in page.rects + page.curves if o.get('stroke') and not o.get('fill')
             and 3 < o['x1'] - o['x0'] < 40 and 3 < o['bottom'] - o['top'] < 40
             and (lambda s: s and s[2] > 0.5 and s[2] > s[0] + 0.3)(rgb(o.get('stroking_color')))]
    labels = []
    for w in words:
        if not re.fullmatch(r'\d{1,3}', w['text']):
            continue
        cx, cy = (w['x0'] + w['x1']) / 2, (w['top'] + w['bottom']) / 2
        if in_frame(cx, cy) and any(bx['x0'] - 1 <= cx <= bx['x1'] + 1 and bx['top'] - 1 <= cy <= bx['bottom'] + 1 for bx in boxes):
            labels.append((int(w['text']), cx, cy))
    for p in polys:
        p['lots'] = []
    for n, cx, cy in labels:
        hits = [p for p in polys if inside((cx, cy), p['ring'])]
        if hits:
            best = min(hits, key=lambda p: p['area_pt'])
            if n not in best['lots']:  # labels are sometimes drawn twice (halo)
                best['lots'].append(n)
        else:
            log(f'label {n} is outside every filled polygon')

    # 5. output
    to_wgs, how = make_to_wgs()
    t5lots = {l['lot']: l for l in (t5 or {}).get('lots', [])}
    feats, total = [], 0
    for p in sorted(polys, key=lambda p: (p['lots'] or [999])[0]):
        itm = [to_itm(x, y) for x, y in p['ring']]
        area = abs(shoelace(itm))
        total += area
        ring = [list(map(lambda v: round(v, 7), to_wgs(E, N))) for E, N in itm]
        if shoelace(ring) < 0:
            ring.reverse()  # RFC 7946: exterior counter-clockwise
        ring.append(ring[0])
        lot = p['lots'][0] if len(p['lots']) == 1 else (p['lots'] or None)
        use = ' / '.join(legend.get(hexc(p['color']), [])) or None
        props = dict(lot=lot, use_color=hexc(p['color']), use=use, area_m2=round(area, 1))
        if isinstance(lot, int) and lot in t5lots and t5lots[lot].get('use'):
            props['use'] = t5lots[lot]['use']
            props['use_legend'] = use
        feats.append(dict(type='Feature', properties=props, geometry=dict(type='Polygon', coordinates=[ring])))
    fc = dict(type='FeatureCollection', name=pdf_path.rsplit('/', 1)[-1],
              properties=dict(source='תשריט מצב מוצע', crs_note=f'EPSG:4326 from ITM grid fit ({how})',
                              m_per_pt=round(mpp, 5), grid_residual_max_m=round(max(map(abs, resx + resy)), 3)),
              features=feats)
    json.dump(fc, open(out_path, 'w'), ensure_ascii=False, indent=1)
    log(f'{len(feats)} polygons, {len({l[0] for l in labels})} lot numbers, total {total:.1f} m2, ITM->WGS84 via {how}')
    for ft in feats:
        log('  lot', ft['properties']['lot'], ft['properties']['area_m2'], ft['properties']['use'])


if __name__ == '__main__':
    main()
