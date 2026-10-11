"""Build model.json for plan 603-0811588 from the uploaded sources.

Sources (all from the plan portal export):
  - 3D KML: 34 building envelopes (with floors) + 546 surrounding existing buildings (with heights)
  - plan-boundary KML: blue line (11 polygons)
  - table 5 export (HTML 'xls')
Lot numbers were read from drawing sheets 2-3 and matched by position.
"""
import json, math, re, sys
from io import StringIO
import pandas as pd

UP = sys.argv[1]
OUT = sys.argv[2]
KML3D = UP + '/ccd9b2c3-603-0811588_______________________KML___3_.kml'
KMLB = UP + '/145eb00a-603-0811588_____________KML__________google_earth_1__1_.kml'
T5 = UP + '/fd36e2e9-603-0811588_____________________XLS_____________________XLS_1.xls'

LAT0 = 31.777
KX = 111320 * math.cos(math.radians(LAT0))
KY = 110540


def area_m2(ring):
    q = [(x * KX, y * KY) for x, y in ring]
    a = 0
    for i in range(len(q) - 1):
        a += q[i][0] * q[i + 1][1] - q[i + 1][0] * q[i][1]
    return abs(a) / 2


def centroid(ring):
    xs = [x for x, _ in ring[:-1]]
    ys = [y for _, y in ring[:-1]]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def scale_ring(ring, f):
    cx, cy = centroid(ring)
    return [[round(cx + (x - cx) * f, 7), round(cy + (y - cy) * f, 7)] for x, y in ring]


def parse_coords(txt):
    pts, z = [], None
    for a in txt.split():
        p = a.split(',')
        pts.append((float(p[0]), float(p[1])))
        if len(p) > 2 and p[2] != 'None':
            z = float(p[2])
    if pts[0] != pts[-1]:
        pts.append(pts[0])
    return pts, z


def num(v):
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    s = re.sub(r'\(\d+\)', '', str(v)).strip()
    try:
        return float(s)
    except ValueError:
        return None


def note(v):
    m = re.search(r'\((\d+)\)', str(v))
    return int(m.group(1)) if m else None


# ---------- table 5 ----------
t = pd.read_html(StringIO(open(T5, encoding='utf-8').read()))[0]
t.columns = ['x', 'yeud', 'use', 'lot', 'bldg', 'lot_size', 'main_above', 'serv_above', 'serv_below', 'total', 'pct',
             'coverage', 'units', 'density', 'height', 'floors_above', 'floors_below', 'set_r', 'set_l', 'set_b', 'set_f']
t = t[t['use'].notna()]
lots = {}
for _, r in t.iterrows():
    lot = int(r['lot'])
    d = lots.setdefault(lot, {'lot': lot, 'mixed': False})
    use = str(r['use'])
    if use == 'מסחר':
        d['mixed'] = True
        d['commercial_main'] = num(r['main_above'])
        d['commercial_service'] = num(r['serv_above'])
    elif use == 'מגורים':
        d['residential_main'] = num(r['main_above'])
        d['residential_service'] = num(r['serv_above'])
        if not d['mixed'] or 'units' not in d:
            d['units'] = num(r['units'])
    if use in ('מגורים', '<סך הכל>') and num(r['height']) is not None:
        d.update({
            'lot_size': num(r['lot_size']),
            'main_above': num(r['main_above']),
            'service_above': num(r['serv_above']),
            'service_below': num(r['serv_below']),
            'total_area': num(r['total']),
            'coverage_pct': num(r['coverage']),
            'units': num(r['units']),
            'density': num(r['density']),
            'height_m': num(r['height']),
            'floors_above': int(num(r['floors_above'])),
            'floors_below': int(num(r['floors_below'])),
            'setback_note': note(r['set_f']) or note(r['set_r']),
        })
for d in lots.values():
    d['units'] = int(d['units'])
    # Note (3): the unit count includes an addition of up to 20% over plan 3/124/03/3.
    d['units_before_est'] = round(d['units'] / 1.2)
    d['avg_unit_m2_after'] = round(d['residential_main' if d['mixed'] else 'main_above'] / d['units'])
    d['avg_unit_m2_before_est'] = round(d['residential_main' if d['mixed'] else 'main_above'] / d['units_before_est'])
    d['small_75_min'] = math.ceil(d['units'] * 0.16)
    d['micro_55_min'] = math.ceil(d['units'] * 0.04)

# ---------- 3D KML ----------
k = open(KML3D, encoding='utf-8', errors='replace').read()
pms = re.findall(r'<Placemark.*?</Placemark>', k, re.S)
env, context = [], []
for p in pms:
    ring, z = parse_coords(re.search(r'<coordinates>(.*?)</coordinates>', p, re.S).group(1))
    if 'יעוד' in p[:300]:
        fl = int(re.search(r'מספר קומות מעל הכניסה הקובעת</td>\s*<td>(\d+)', p).group(1))
        env.append({'ring': ring, 'floors': fl, 'c': centroid(ring), 'area': area_m2(ring)})
    elif '<name>' not in p:
        context.append({'ring': [[round(x, 6), round(y, 6)] for x, y in ring], 'h': z if z else 6.0})

# Lot numbers by position (read from drawing sheets 2 and 3; north-up).
ANCHORS = {
    601: (34.651485, 31.776945), 602: (34.651737, 31.777255), 603: (34.651989, 31.777564), 604: (34.652241, 31.777873),
    605: (34.652401, 31.778240), 606: (34.652912, 31.777918), 607: (34.652345, 31.777258), 608: (34.653027, 31.777132),
    609: (34.653342, 31.777543), 610: (34.653907, 31.777227), 611: (34.653593, 31.776816), 612: (34.653909, 31.776373),
    613: (34.654453, 31.777080), 614: (34.654741, 31.776939), 615: (34.654198, 31.776221), 616: (34.655004, 31.775766),
    617: (34.655446, 31.776513), 618: (34.655863, 31.776985), 619: (34.654070, 31.777832),
    620: [(34.652719, 31.778748), (34.653682, 31.778045)],
    622: (34.66121, 31.77642), 623: (34.6611, 31.777), 624: (34.6616, 31.7768), 625: (34.66183, 31.77712),
    626: (34.66229, 31.77773), 627: (34.6627, 31.77816), 628: (34.66168, 31.7786), 629: (34.66067, 31.77921),
    630: (34.66064, 31.77862), 631: (34.66038, 31.77834), 632: (34.66001, 31.77785), 633: (34.66062, 31.77715),
    634: (34.66046, 31.7767),
}
used = set()
assign = []
for lot, a in ANCHORS.items():
    for anchor in (a if isinstance(a, list) else [a]):
        best = min((i for i in range(len(env)) if i not in used),
                   key=lambda i: (env[i]['c'][0] - anchor[0]) ** 2 + (env[i]['c'][1] - anchor[1]) ** 2)
        dist = math.hypot((env[best]['c'][0] - anchor[0]) * KX, (env[best]['c'][1] - anchor[1]) * KY)
        assert dist < 8, (lot, dist)
        used.add(best)
        assign.append((lot, best))
assert len(used) == len(env) == 34

checks = []
features = []
by_lot = {}
for lot, i in assign:
    by_lot.setdefault(lot, []).append(i)
for lot, idx in sorted(by_lot.items()):
    d = lots[lot]
    for i in idx:
        if env[i]['floors'] != d['floors_above']:
            checks.append({'lot': lot, 'level': 'error', 'text': f"מספר הקומות בקובץ התלת-ממדי ({env[i]['floors']}) שונה מטבלה 5 ({d['floors_above']})"})
    env_area = sum(env[i]['area'] for i in idx)
    above = d['main_above'] + d['service_above']
    if d['mixed']:
        res_above = d['residential_main'] + d['residential_service']
        com_above = d['commercial_main'] + d['commercial_service']
    else:
        res_above, com_above = above, 0
    # Average residential floor plate, capped by coverage and by the envelope.
    plate = res_above / d['floors_above']
    cap = d['coverage_pct'] / 100 * d['lot_size']
    plate = min(plate, cap, env_area * 0.95)
    floor_h = d['height_m'] / d['floors_above']
    if floor_h < 2.9:
        checks.append({'lot': lot, 'level': 'warn', 'text': f"גובה {d['height_m']:.0f} מ' ל-{d['floors_above']} קומות הוא כ-{floor_h:.1f} מ' לקומה, נמוך מהמקובל. לבדיקה מול התוכנית."})
    if abs(env_area - d['lot_size']) / d['lot_size'] > 0.45:
        checks.append({'lot': lot, 'level': 'info', 'text': f"שטח המעטפת המותרת ({env_area:.0f} מ\"ר) לעומת גודל המגרש ({d['lot_size']:.0f} מ\"ר)."})
    d['envelope_m2'] = round(env_area)
    d['floor_plate_m2'] = round(plate)
    d['floor_height_m'] = round(floor_h, 2)
    podium_h = 6.0 if d['mixed'] else 0.0
    for i in idx:
        share = env[i]['area'] / env_area
        ring = env[i]['ring']
        f_tower = math.sqrt(plate * share / env[i]['area'])
        common = {'lot': lot, 'floors': d['floors_above'], 'height': d['height_m'], 'units': d['units'],
                  'units_before': d['units_before_est'], 'mixed': d['mixed']}
        features.append({'type': 'Feature', 'properties': {**common, 'kind': 'envelope', 'base': 0, 'top': d['height_m']},
                         'geometry': {'type': 'Polygon', 'coordinates': [[[round(x, 7), round(y, 7)] for x, y in ring]]}})
        if d['mixed']:
            com_plate = min(com_above / 1.6, env[i]['area'] * 0.98)  # up to 2 commercial levels within 6 m
            features.append({'type': 'Feature', 'properties': {**common, 'kind': 'podium', 'base': 0, 'top': podium_h},
                             'geometry': {'type': 'Polygon', 'coordinates': [scale_ring(ring, math.sqrt(com_plate * share / env[i]['area']))]}})
        features.append({'type': 'Feature', 'properties': {**common, 'kind': 'tower', 'base': podium_h, 'top': d['height_m']},
                         'geometry': {'type': 'Polygon', 'coordinates': [scale_ring(ring, f_tower)]}})
    cx = sum(env[i]['c'][0] for i in idx) / len(idx)
    cy = sum(env[i]['c'][1] for i in idx) / len(idx)
    d['center'] = [round(cx, 6), round(cy, 6)]

# ---------- plan boundary ----------
b = open(KMLB, encoding='utf-8').read()
blue = []
for c in re.findall(r'<coordinates>(.*?)</coordinates>', b, re.S):
    ring, _ = parse_coords(c)
    blue.append([[round(x, 7), round(y, 7)] for x, y in ring])

tot_units = sum(d['units'] for d in lots.values())
tot_before = sum(d['units_before_est'] for d in lots.values())
summary = {
    'lots': len(lots),
    'units_after': tot_units,
    'units_before_est': tot_before,
    'units_added_est': tot_units - tot_before,
    'small_75_min': sum(d['small_75_min'] for d in lots.values()),
    'micro_55_min': sum(d['micro_55_min'] for d in lots.values()),
    'floors_min': min(d['floors_above'] for d in lots.values()),
    'floors_max': max(d['floors_above'] for d in lots.values()),
    'height_max': max(d['height_m'] for d in lots.values()),
    'area_dunam': 93.937,
    'service_below_m2': sum(d['service_below'] for d in lots.values()),
    'commercial_lots': sorted(l for l, d in lots.items() if d['mixed']),
    'avg_unit_before_est': round(sum(d.get('residential_main', d['main_above']) for d in lots.values()) / tot_before),
    'avg_unit_after': round(sum(d.get('residential_main', d['main_above']) for d in lots.values()) / tot_units),
}

model = {
    'plan_number': '603-0811588',
    'sources': {
        'table5': 'טבלה 5, הוראות התכנית עמ׳ 13–16',
        'envelopes': 'קובץ KML תלת-ממדי מאתר תכנון זמין, 08/09/2025',
        'lot_numbers': 'תשריט מצב מוצע, גיליונות 2–3 (1:500)',
        'context': 'מבנים קיימים מתוך אותו קובץ KML',
    },
    'summary': summary,
    'lots': [lots[l] for l in sorted(lots)],
    'checks': checks,
    'massing': {'type': 'FeatureCollection', 'features': features},
    'boundary': {'type': 'FeatureCollection', 'features': [
        {'type': 'Feature', 'properties': {}, 'geometry': {'type': 'Polygon', 'coordinates': [r]}} for r in blue]},
    'context': {'type': 'FeatureCollection', 'features': [
        {'type': 'Feature', 'properties': {'h': c['h']}, 'geometry': {'type': 'Polygon', 'coordinates': [c['ring']]}} for c in context]},
}
json.dump(model, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
print(json.dumps(summary, ensure_ascii=False, indent=1))
print('checks:', json.dumps(checks, ensure_ascii=False, indent=1))
print('features', len(features), 'context', len(context))
