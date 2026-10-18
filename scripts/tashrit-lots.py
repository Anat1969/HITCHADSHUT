"""Extract georeferenced lots (תאי שטח) from a vector "תשריט מצב מוצע" PDF.

Usage:
  python3 -I scripts/tashrit-lots.py <tashrit.pdf> <out.geojson> [--page N] [--table5 t5.json]
         [--grid 'x:166700@255.1,...'] [--lot-line '#003fff' --polygonize]

Runs (validated: re-run and diff against the committed supabase/seed/*.lots.geojson):
  603-0704064, 603-0391219: defaults.
  tamal-2021 (תשריט 2.pdf, 1:1000): defaults.
  tamal-2024 (תשריט.pdf, 1:500): --lot-line '#003fff' --polygonize.

How it works:
  - Words come from poppler `pdftotext -bbox` (ESRI exports often hide their Arial text from
    pdfplumber); pdfplumber words are the fallback.
  - ITM grid labels on the frame (1xxxxx = X, 3xxxxx-8xxxxx = Y) give an affine PDF->ITM fit.
    Labels are assumed centred on their grid tick. Residuals and the implied scale are printed.
  - Land-use polygons = filled vector paths inside the map frame (not black/white).
    The use name comes from the legend swatch (a filled rect outside the frame) of the same colour.
  - Outline mode (automatic when the frame has no coloured vector fills, e.g. Aspose exports
    where the colours are a raster under vector lines; tested on 603-0391219): lots = closed
    stroked paths in the one stroke colour whose rings hold the most lot labels. Nested lots are
    cut out of their parent; unlabelled outlines are dropped. The use colour is the most common
    non-white pixel colour inside the lot on a pdftoppm rendering, matched to the nearest
    legend swatch.
  - Lot numbers = integer words inside a small blue stroked box (the "תא שטח ומספרו" symbol);
    the word's box must sit inside the symbol (pdftotext gives rotated words huge boxes). All lot
    numbers share one text height; a word of another height in a box (an old parcel number, a
    spot height, a digit of a small symbol) is skipped, and the box is dropped if nothing is left.
  - --polygonize (outline mode, with --lot-line naming the lot-line colour): for drawings where
    the lots are one shared line network rather than closed rings per lot (tamal-2024). Every
    segment of that colour is noded and the faces become the lot candidates; faces without a label
    are dropped. Without --lot-line, outline mode picks the colour whose closed rings hold the
    most labels, which can be the cadastre (existing parcels) instead of the proposed lots.
  - --grid: georeferencing fallback for drawings whose grid labels are not text (e.g. an
    encoded font): give the label values read off a pdftoppm rendering of the frame, at the PDF
    position of their vector tick marks. Not needed so far: on every drawing processed, the labels
    came out of pdftotext even when pdfplumber saw only ESRI marker fonts.
    A box that falls in no lot ring goes to the nearest unlabelled ring.
  - ITM->WGS84 with pyproj when installed, else a built-in TM inverse + Helmert (same EPSG
    parameters; checked against pyproj to a few cm).

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


def parse_grid(spec):
    """--grid 'x:166700@255.1/18,y:633100@612.2/18': ITM grid values with the PDF position of their
    tick, for drawings whose labels are not readable as text (read them off a pdftoppm rendering of
    the frame, and take the tick positions from the vector tick marks). The first number is the PDF
    coordinate along the label's axis (x for an X label, y for a Y label); the optional second one is
    the other coordinate (the label row / column), which also bounds the map frame."""
    xs, ys = [], []
    for item in filter(None, re.split(r'[,\s]+', spec)):
        m = re.fullmatch(r'([xyXY]):(\d{6})@([\d.]+)(?:/([\d.]+))?', item)
        if not m:
            sys.exit(f'bad --grid entry {item!r}')
        axis, v, a, b = m.group(1).lower(), int(m.group(2)), float(m.group(3)), m.group(4)
        if axis == 'x':
            xs.append((a, float(b) if b else 0.0, v))
        else:
            ys.append((float(b) if b else 0.0, a, v))
    return xs, ys


def fit_grid(words, manual=None):
    xs, ys = manual or ([], [])
    xs, ys = list(xs), list(ys)
    for w in words if not manual else []:
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
# EPSG 'Israel 1993 to WGS 84 (2)', coordinate-frame convention (what PROJ picks, 0.5 m)
TOWGS84 = (23.772, 17.49, 17.859, 0.3132, 1.85274, -1.67299, -5.4262)


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
    k = 1 + s * 1e-6  # coordinate-frame rotation
    X = tx + k * (x + rz * y - ry * z)
    Y = ty + k * (-rz * x + y + rx * z)
    Z = tz + k * (ry * x - rx * y + z)
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
    rings = [r[:-1] if len(r) > 3 and r[0] == r[-1] else r for r in rings]
    if not rings and obj.get('pts') and len(obj['pts']) >= 3:
        rings = [list(obj['pts'])]
    return [[tuple(p) for p in r] for r in rings]


def polylines(obj):
    """Every subpath as an open polyline (Bezier segments reduced to their end points)."""
    out, cur = [], []
    for seg in obj.get('path') or []:
        op = seg[0]
        if op == 'm':
            if len(cur) >= 2:
                out.append(cur)
            cur = [tuple(seg[1])]
        elif op in ('l', 'c', 'v', 'y'):
            cur.append(tuple(seg[-1]))
        elif op == 'h' and cur:
            cur.append(cur[0])
    if len(cur) >= 2:
        out.append(cur)
    if not out and obj.get('pts') and len(obj['pts']) >= 2:
        out = [[tuple(p) for p in obj['pts']]]
    if not obj.get('path') and obj.get('object_type') == 'rect':
        out = [[(obj['x0'], obj['top']), (obj['x1'], obj['top']), (obj['x1'], obj['bottom']),
                (obj['x0'], obj['bottom']), (obj['x0'], obj['top'])]]
    return [[p for i, p in enumerate(l) if i == 0 or p != l[i - 1]] for l in out if len(set(l)) >= 2]


def closed_rings(obj):
    """Subpaths that close (an 'h' or back on their start point), for stroked outlines."""
    rings, cur = [], []

    def flush():
        if len(cur) >= 4 and math.dist(cur[0], cur[-1]) < 0.5:
            rings.append([tuple(p) for p in cur[:-1]])
    for seg in obj.get('path') or []:
        op = seg[0]
        if op == 'm':
            flush()
            cur = [seg[1]]
        elif op in ('l', 'c', 'v', 'y'):
            cur.append(seg[-1])
        elif op == 'h' and cur:
            cur.append(cur[0])
            flush()
            cur = []
    flush()
    if not obj.get('path') and obj.get('object_type') == 'rect':
        rings.append([(obj['x0'], obj['top']), (obj['x1'], obj['top']), (obj['x1'], obj['bottom']), (obj['x0'], obj['bottom'])])
    return rings


def sample_colours(pdf, page, polys, log, dpi=50):
    """Most common non-white colour inside each polygon on a raster rendering of the page."""
    import collections, os, tempfile
    from PIL import Image, ImageDraw, ImageFilter
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(['pdftoppm', '-r', str(dpi), '-f', str(page), '-l', str(page), '-png', pdf,
                        os.path.join(tmp, 'p')], check=True)
        im = Image.open(os.path.join(tmp, sorted(os.listdir(tmp))[0])).convert('RGB')
        im.load()
    k = dpi / 72
    for p in polys:
        mask = Image.new('L', im.size, 0)
        dr = ImageDraw.Draw(mask)
        dr.polygon([(x * k, y * k) for x, y in p['ring']], fill=255)
        for h in p.get('holes', []):
            dr.polygon([(x * k, y * k) for x, y in h], fill=0)
        eroded = mask.filter(ImageFilter.MinFilter(5))
        if eroded.getbbox():
            mask = eroded
        x0, y0, x1, y1 = mask.getbbox() or (0, 0, 0, 0)
        cnt, sums = collections.Counter(), {}
        mp, ip = mask.load(), im.load()
        for y in range(y0, y1):
            for x in range(x0, x1):
                if mp[x, y]:
                    c = ip[x, y]
                    if min(c) > 235 or max(c) < 64:
                        continue
                    q = tuple(v // 16 for v in c)
                    cnt[q] += 1
                    s = sums.setdefault(q, [0, 0, 0])
                    for i in range(3):
                        s[i] += c[i]
        if cnt:
            q, n = cnt.most_common(1)[0]
            p['color'] = tuple(v / n / 255 for v in sums[q])
        else:
            p['color'] = None
            log(f'no colour sampled for lot ring at {p["ring"][0]}')


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
    page_no, t5, grid, lot_line, polygonize = 1, None, None, None, False
    if '--page' in args:
        i = args.index('--page'); page_no = int(args[i + 1]); del args[i:i + 2]
    if '--table5' in args:
        i = args.index('--table5'); t5 = json.load(open(args[i + 1])); del args[i:i + 2]
    if '--lot-line' in args:
        i = args.index('--lot-line'); lot_line = args[i + 1].lower(); del args[i:i + 2]
    if '--polygonize' in args:
        args.remove('--polygonize'); polygonize = True
    if '--grid' in args:
        i = args.index('--grid'); grid = parse_grid(args[i + 1]); del args[i:i + 2]
    pdf_path, out_path = args
    page = pdfplumber.open(pdf_path).pages[page_no - 1]
    words = words_pdftotext(pdf_path, page_no) or page.extract_words()
    log = lambda *a: print(*a, file=sys.stderr)

    # 1. georeference
    g = fit_grid(words, grid)
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

    # 3. lot labels: integers inside a small blue stroked box
    boxes = [o for o in page.rects + page.curves if o.get('stroke') and not o.get('fill')
             and 3 < o['x1'] - o['x0'] < 40 and 6 < o['bottom'] - o['top'] < 40
             and (lambda s: s and s[2] > 0.5 and s[2] > s[0] + 0.3 and s[2] > s[1] + 0.2)(rgb(o.get('stroking_color')))]
    nums = [dict(w, cx=(w['x0'] + w['x1']) / 2, cy=(w['top'] + w['bottom']) / 2) for w in words
            if re.fullmatch(r'\d{1,3}', w['text'])]
    labels, picks = [], []
    for bx in boxes:  # one number per box: the word that fills it, closest to its centre
        bw, bh = bx['x1'] - bx['x0'], bx['bottom'] - bx['top']
        bcx, bcy = (bx['x0'] + bx['x1']) / 2, (bx['top'] + bx['bottom']) / 2
        cand = [w for w in nums if bx['x0'] - 1 <= w['cx'] <= bx['x1'] + 1 and bx['top'] - 1 <= w['cy'] <= bx['bottom'] + 1
                and w['x1'] - w['x0'] <= bw + 3 and w['bottom'] - w['top'] >= 0.8 * bh and in_frame(w['cx'], w['cy'])]
        if cand:
            key = lambda w: (-round(w['bottom'] - w['top']), math.hypot(w['cx'] - bcx, w['cy'] - bcy))
            picks.append((cand, key, min(cand, key=key)))
    # all lot numbers share one font size: drop words of another size (parcel numbers, heights,
    # stray digits in small symbols) and re-pick within the box
    if picks:
        import collections
        H = collections.Counter(round(w['bottom'] - w['top'], 1) for *_, w in picks).most_common(1)[0][0]
        for cand, key, w in picks:
            ok = [c for c in cand if abs((c['bottom'] - c['top']) - H) <= 0.05 * H]
            if ok:
                w = min(ok, key=key)
                labels.append((int(w['text']), w['cx'], w['cy']))
            else:
                log(f'box with "{w["text"]}" skipped: text height {w["bottom"] - w["top"]:.1f}, lot numbers are {H}')

    # 2b. outline mode: no coloured vector fills -> closed stroked rings of the lot-line colour
    outline = not polys
    if outline:
        groups = {}
        for o in page.curves + page.rects:
            col = rgb(o.get('stroking_color'))
            if not o.get('stroke') or o.get('fill') or not col:
                continue
            for r in closed_rings(o):
                cx = sum(p[0] for p in r) / len(r); cy = sum(p[1] for p in r) / len(r)
                area_pt = abs(shoelace(r))
                if in_frame(cx, cy) and area_pt * mpp * mpp > 5 and area_pt < (fx1 - fx0) * (fy1 - fy0) * 0.9:
                    groups.setdefault(hexc(col), []).append(dict(ring=r, color=None, area_pt=area_pt))
        score = {k: sum(any(inside((cx, cy), p['ring']) for p in v) for _, cx, cy in labels) for k, v in groups.items()}
        if lot_line:
            line_col = lot_line
        elif not score or max(score.values()) == 0:
            sys.exit('no filled polygons and no closed outlines around lot labels')
        else:
            line_col = max(score, key=score.get)
        if polygonize:  # lots drawn as a shared line network: node every segment and take the faces
            from shapely.geometry import LineString
            from shapely.ops import polygonize as faces, unary_union
            segs = []
            for o in page.curves + page.rects + page.lines:
                col = rgb(o.get('stroking_color'))
                if not o.get('stroke') or o.get('fill') or not col or hexc(col) != line_col:
                    continue
                for line in polylines(o):
                    if any(in_frame(x, y) for x, y in line):
                        segs.append(LineString(line))
            for face in faces(unary_union(segs)):
                r = list(face.exterior.coords)[:-1]
                area_pt = abs(shoelace(r))
                if area_pt * mpp * mpp > 5:
                    polys.append(dict(ring=r, color=None, area_pt=area_pt))
            log(f'outline mode: lot line colour {line_col}, {len(segs)} lines -> {len(polys)} faces')
        else:
            seen = set()
            for p in groups.get(line_col, []):
                key = (round(p['area_pt']), tuple(round(v) for v in min(p['ring'])))
                if key not in seen:  # outlines are often drawn twice
                    seen.add(key)
                    polys.append(p)
            log(f'outline mode: lot line colour {line_col}, {len(polys)} closed rings')


    for p in polys:
        p['lots'] = []
    stray = []
    for n, cx, cy in labels:
        hits = [p for p in polys if inside((cx, cy), p['ring'])]
        if hits:
            best = min(hits, key=lambda p: p['area_pt'])
            if n not in best['lots']:  # labels are sometimes drawn twice (halo)
                best['lots'].append(n)
        else:
            stray.append((n, cx, cy))
    for n, cx, cy in stray:
        if outline:
            free = [p for p in polys if not p['lots']]
            dist = lambda p: min(math.hypot(x - cx, y - cy) for x, y in p['ring'])
            near = min(free, key=dist) if free else None
            if near and dist(near) < 40:
                near['lots'].append(n)
                log(f'label {n} sits on a lot line; given to the nearest unlabelled ring')
            else:
                log(f'label {n} is outside every lot ring')
        else:
            log(f'label {n} is outside every filled polygon')
    if outline:
        from shapely.geometry import Polygon
        dropped = [p for p in polys if not p['lots']]
        polys = [p for p in polys if p['lots']]
        log(f'{len(dropped)} unlabelled rings dropped')
        for p in polys:
            shp = Polygon(p['ring']).buffer(0)
            for q in polys:
                if q is not p and q['area_pt'] < p['area_pt']:
                    qs = Polygon(q['ring']).buffer(0)
                    if shp.intersection(qs).area > 0.9 * qs.area:  # nested lot: cut it out
                        shp = shp.difference(qs)
            if shp.geom_type != 'Polygon':
                shp = max(getattr(shp, 'geoms', [shp]), key=lambda g: g.area)
            p['ring'] = list(shp.exterior.coords)[:-1]
            p['holes'] = [list(h.coords)[:-1] for h in shp.interiors]
        sample_colours(pdf_path, page_no, polys, log)

    # 4. legend: swatches outside the frame (with a map colour, in fill mode)
    legend = {}
    for o in page.rects + (page.curves if outline else []):
        col = rgb(o.get('non_stroking_color'))
        if not o.get('fill') or not col or in_frame((o['x0'] + o['x1']) / 2, (o['top'] + o['bottom']) / 2):
            continue
        if o['x1'] - o['x0'] > 80 or o['bottom'] - o['top'] > 80:
            continue
        if outline:
            if max(col) < 0.05 or min(col) > 0.95:
                continue
        elif not any(same(col, p['color']) for p in polys):
            continue
        txt = crop_text(pdf_path, page_no, max(0, o['x0'] - 260), o['top'] - 1, o['x0'] - 2, o['bottom'] + 1) \
            or crop_text(pdf_path, page_no, o['x1'] + 2, o['top'] - 1, min(page.width, o['x1'] + 260), o['bottom'] + 1)
        if txt:
            names = legend.setdefault(hexc(col), [])
            # first line with a letter: some Aspose sheets put a stray '#' glyph on the swatch row
            # (tamal-2023 sheet 2), which would otherwise become the use name
            u = norm_use(next((ln for ln in txt.splitlines() if re.search(r'[^\W\d_]', ln)),
                              txt.splitlines()[0]))
            if u not in names:
                names.append(u)
    if outline:  # snap each sampled colour to the nearest legend swatch
        sw = {k: tuple(int(k[i:i + 2], 16) / 255 for i in (1, 3, 5)) for k in legend}
        for p in polys:
            if p['color'] and sw:
                k = min(sw, key=lambda k: sum((u - v) ** 2 for u, v in zip(sw[k], p['color'])))
                if math.dist(sw[k], p['color']) < 0.2:
                    p['color'] = sw[k]
            p['color'] = p['color'] or (1, 1, 1)

    # 5. output
    to_wgs, how = make_to_wgs()
    t5lots = {l['lot']: l for l in (t5 or {}).get('lots', [])}
    feats, total = [], 0
    for p in sorted(polys, key=lambda p: (p['lots'] or [999])[0]):
        rings, area = [], 0
        for k, pr in enumerate([p['ring']] + p.get('holes', [])):
            itm = [to_itm(x, y) for x, y in pr]
            area += abs(shoelace(itm)) * (1 if k == 0 else -1)
            ring = [list(map(lambda v: round(v, 7), to_wgs(E, N))) for E, N in itm]
            if (shoelace(ring) < 0) == (k == 0):
                ring.reverse()  # RFC 7946: exterior counter-clockwise, holes clockwise
            ring.append(ring[0])
            rings.append(ring)
        total += area
        lot = p['lots'][0] if len(p['lots']) == 1 else (p['lots'] or None)
        use = ' / '.join(legend.get(hexc(p['color']), [])) or None
        props = dict(lot=lot, use_color=hexc(p['color']), use=use, area_m2=round(area, 1))
        if isinstance(lot, int) and lot in t5lots and t5lots[lot].get('use'):
            props['use'] = t5lots[lot]['use']
            props['use_legend'] = use
        feats.append(dict(type='Feature', properties=props, geometry=dict(type='Polygon', coordinates=rings)))
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
