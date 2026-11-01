"""Georeference a "תשריט מצב מאושר" (vector or scanned) to the plan's blue line, for the evolution map.

Usage:
  python3 -I scripts/approved-overlay.py <approved.pdf> <model.json> <evolution.json> <out_dir>
         [--page N] [--crop x0,y0,x1,y1] [--scales 500,1000,...] [--part K] [--angle DEG] [--ref parcels]

Why raster: approved drawings often have no ITM grid labels and no text layer (encoded fonts), and
scans have no vectors at all. Every approved drawing does show the plan's blue line, so:
  1. Render the page; mask the blue pixels (and dilate them).
  2. Draw model.boundary (ITM) as a line raster at the drawing scale, for each candidate scale.
  3. FFT cross-correlation gives the offset; the scale with the highest peak z-score wins. The
     z-score and the share of boundary pixels that land on blue are written as the confidence.
  4. Crop the page around the plan, write approved.png and its ITM/WGS84 bounds (north-up).
  5. Colour classes inside the boundary: pixel area per colour cluster, printed beside table 3.2
     (approved) so the colour -> use mapping is checked by area, not guessed.
--crop takes fractions of the page (for a sheet that holds both states, e.g. 3/03/104/66).
--part K registers only the K-th largest part of a boundary in several parts (tamal-2023).
"""
import json, math, os, subprocess, sys, tempfile

import numpy as np
from PIL import Image, ImageDraw
from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import unary_union

args = sys.argv[1:]
page, crop, scales, part = 1, None, [250, 500, 1000, 1250, 2500], None
if '--page' in args:
    i = args.index('--page'); page = int(args[i + 1]); del args[i:i + 2]
if '--crop' in args:
    i = args.index('--crop'); crop = [float(v) for v in args[i + 1].split(',')]; del args[i:i + 2]
if '--part' in args:
    i = args.index('--part'); part = int(args[i + 1]); del args[i:i + 2]
if '--scales' in args:
    i = args.index('--scales'); scales = [int(v) for v in args[i + 1].split(',')]; del args[i:i + 2]
ref, angle = 'boundary', None
if '--angle' in args:  # known rotation: search only around it (faint scans lose the line at the coarse resolution)
    i = args.index('--angle'); angle = float(args[i + 1]); del args[i:i + 2]
if '--ref' in args:  # 'parcels': the model's lots, when model.boundary is the compound and not the plan's blue line
    i = args.index('--ref'); ref = args[i + 1]; del args[i:i + 2]
pdf, model_path, evo_path, out_dir = args
log = lambda *a: print(*a, file=sys.stderr)
os.makedirs(out_dir, exist_ok=True)
model, evo = json.load(open(model_path)), json.load(open(evo_path))
to_itm = Transformer.from_crs(4326, 2039, always_xy=True).transform
to_wgs = Transformer.from_crs(2039, 4326, always_xy=True).transform
bnd = unary_union([shape(f['geometry']) for f in model[ref]['features']]).buffer(0)
polys = sorted(getattr(bnd, 'geoms', [bnd]), key=lambda g: -g.area)
if part is not None:  # a plan in separate parts: each approved drawing may show only one of them
    polys = [polys[part]]
rings0 = [[to_itm(*p) for p in poly.exterior.coords] for poly in polys]
CX = sum(p[0] for r in rings0 for p in r) / sum(len(r) for r in rings0)
CY = sum(p[1] for r in rings0 for p in r) / sum(len(r) for r in rings0)


def rotate(pts, deg):
    """Rotate ITM points about the boundary centroid (a drawing that is not north-up)."""
    a = math.radians(deg); ca, sa = math.cos(a), math.sin(a)
    return [(CX + (x - CX) * ca - (y - CY) * sa, CY + (x - CX) * sa + (y - CY) * ca) for x, y in pts]


def render(dpi):
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(['pdftoppm', '-r', str(dpi), '-f', str(page), '-l', str(page), '-png', pdf, f'{d}/p'], check=True)
        f = sorted(os.listdir(d))[0]
        im = Image.open(f'{d}/{f}').convert('RGB')
    if crop:
        w, h = im.size
        im = im.crop((int(crop[0] * w), int(crop[1] * h), int(crop[2] * w), int(crop[3] * h)))
    return im


def dilate(m, r):
    out = m.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(m, dy, 0), dx, 1)
    return out


def blue_mask(im):
    a = np.asarray(im).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    return (b > 150) & (b > r + 70) & (b > g + 40)


def frame(deg):
    rr = [rotate(r, deg) for r in rings0]
    return rr, min(p[0] for r in rr for p in r), max(p[0] for r in rr for p in r), \
        min(p[1] for r in rr for p in r), max(p[1] for r in rr for p in r)


def boundary_raster(rr, e0, n1, W, H, mpp, width=2):
    im = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(im)
    for r in rr:
        d.line([((x - e0) / mpp + 4, (n1 - y) / mpp + 4) for x, y in r], fill=255, width=width)
    return np.asarray(im) > 0


def register(dpi, scales, angles):
    im = render(dpi)
    bm = dilate(blue_mask(im), 1).astype(float)
    Fb = {}
    best = None
    for S in scales:
        mpp = 0.0254 / dpi * S
        for deg in angles:
            rr, e0, e1, n0, n1 = frame(deg)
            W, H = int((e1 - e0) / mpp) + 8, int((n1 - n0) / mpp) + 8
            if H > bm.shape[0] or W > bm.shape[1]:
                continue
            br = boundary_raster(rr, e0, n1, W, H, mpp).astype(float)
            if br.sum() < 20:
                continue
            HH, WW = bm.shape[0] + H, bm.shape[1] + W
            if (HH, WW) not in Fb:
                Fb[(HH, WW)] = np.fft.rfft2(bm - bm.mean(), s=(HH, WW))
            c = np.fft.irfft2(Fb[(HH, WW)] * np.conj(np.fft.rfft2(br - br.mean(), s=(HH, WW))), s=(HH, WW))
            c = c[:bm.shape[0] - H + 1, :bm.shape[1] - W + 1]
            i = np.unravel_index(np.argmax(c), c.shape)
            z = (c[i] - c.mean()) / c.std()
            oy, ox = i
            hit = float((bm[oy:oy + H, ox:ox + W][br > 0] > 0).mean())
            # z alone favours small rasters (few pixels, sharp peak): rank by the share of the
            # boundary that lands on blue, among peaks that stand out (z > 6)
            if z > (4 if angle is not None else 6) and (best is None or (hit, z) > (best["hit"], best["z"])):
                best = dict(z=float(z), S=S, mpp=mpp, ox=int(ox), oy=int(oy), hit=hit, deg=deg, e0=e0, n1=n1, rr=rr, W=W, H=H)
    if best:
        log(f'  {dpi} dpi: 1:{best["S"]}  rotation {best["deg"]:.2f} deg  z {best["z"]:.1f}  boundary on blue {best["hit"] * 100:.0f}%')
    return im, best


# coarse: every scale and every 2 degrees; then refine the angle at higher resolutions
_, b = register(12, scales, [a for a in range(0, 360, 2)]) if angle is None else (None, {'S': scales[0], 'deg': angle})
if not b:
    sys.exit('no registration found')
_, b = register(30, [b['S']], [b['deg'] + d / 2 for d in range(-4, 5)])
DPI = 60
im, b = register(DPI, [b['S']], [b['deg'] + d / 4 for d in range(-2, 3)])
z, S, mpp, ox, oy, hit, deg = b['z'], b['S'], b['mpp'], b['ox'], b['oy'], b['hit'], b['deg']
log(f'registered at 1:{S}, rotation {deg:.2f} deg, z {z:.1f}, boundary on blue {hit * 100:.0f}%')
# image pixel (u, v) -> rotated frame -> ITM
def pix2itm(u, v):
    x, y = b['e0'] + (u - ox - 4) * mpp, b['n1'] - (v - oy - 4) * mpp
    return rotate([(x, y)], -deg)[0]
margin = 40 / mpp
u0, v0 = max(0, int(ox + 4 - margin)), max(0, int(oy + 4 - margin))
u1, v1 = min(im.width, int(ox + b['W'] + margin)), min(im.height, int(oy + b['H'] + margin))
cut = im.crop((u0, v0, u1, v1))
cut.save(os.path.join(out_dir, 'approved.png'), optimize=True)
corners = [to_wgs(*pix2itm(u, v)) for u, v in ((u0, v0), (u1, v0), (u1, v1), (u0, v1))]  # TL, TR, BR, BL of the image
rings = b['rr']
we, nn = b['e0'] + (u0 - ox - 4) * mpp, b['n1'] - (v0 - oy - 4) * mpp  # rotated-frame origin of the cut

# colour classes inside the boundary
mask = Image.new('L', cut.size, 0)
d = ImageDraw.Draw(mask)
for r in rings:
    d.polygon([((x - we) / mpp, (nn - y) / mpp) for x, y in r], fill=255)
a = np.asarray(cut).astype(int)[np.asarray(mask) > 0]
q = (a // 32) * 32 + 16  # 8 levels per channel
keys, counts = np.unique(q.reshape(-1, 3), axis=0, return_counts=True)
px_m2 = mpp * mpp
classes = sorted(({'rgb': [int(v) for v in k], 'm2': round(float(n) * px_m2)} for k, n in zip(keys, counts)), key=lambda c: -c['m2'])
classes = [c for c in classes if c['m2'] > 0.005 * bnd.area * 0 + 50][:14]
log(f'boundary {sum(c["m2"] for c in classes)} m2 in the top classes; table 3.2 (approved):')
for r in evo['approved']:
    log(f'  {r["use"]:30s} {r["m2"]:>9}')
log('colour classes inside the boundary:')
for c in classes:
    log(f'  rgb{tuple(c["rgb"])}  {c["m2"]:>8} m2')
meta = {'image': 'approved.png', 'corners_wgs84': [[round(x, 7), round(y, 7)] for x, y in corners],
        'size_px': [cut.width, cut.height], 'rotation_deg': round(deg, 2), 'scale': S, 'm_per_px': round(mpp, 4), 'z': round(float(z), 1), 'boundary_on_blue_pct': round(float(hit) * 100),
        'source': os.path.basename(pdf), 'page': page, 'crop': crop, 'classes': classes}
json.dump(meta, open(os.path.join(out_dir, 'approved.json'), 'w'), ensure_ascii=False, indent=1)
log(f'wrote {out_dir}/approved.png ({cut.width}x{cut.height}) and approved.json')
