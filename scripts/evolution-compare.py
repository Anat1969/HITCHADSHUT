# Cross-plan land-use evolution from supabase/seed/evolution/*.json (table 3.2, approved vs proposed).
# python3 -I scripts/evolution-compare.py  -> markdown table on stdout, and supabase/seed/evolution/_summary.json
import glob, json, os, re

LABEL = {'residential': 'מגורים', 'mixed': 'מעורב', 'public': 'מבני ציבור', 'open_public': 'שצ"פ וכיכר', 'open_private': 'שפ"פ', 'road': 'דרך, שביל וחניה', 'commerce': 'מסחר ותעסוקה', 'other': 'אחר'}

def cat(u):
    """Land-use family of a table 3.2 row. Mixed = housing with commerce, offices or public uses, or 'עירוני מעורב'."""
    if re.search(r'חני', u) and 'מסחר' not in u: return 'road'
    if 'מעורב' in u: return 'mixed'
    if 'מגורים' in u: return 'mixed' if re.search(r'מסחר|ציבור|תעסוקה|משרדים', u) else 'residential'
    if re.search(r'פרטי פתוח|שפ"פ', u): return 'open_private'
    if re.search(r'ציבורי פתוח|שצ"פ|כיכר|ככר', u): return 'open_public'
    if re.search(r'מסחר|תעסוקה', u): return 'mixed' if re.search(r'מבנים ומוסדות ציבור', u) else 'commerce'
    if 'ציבור' in u: return 'public'
    if re.search(r'דרך|דרכים|שביל', u): return 'road'
    return 'other'

def shares(rows, total):
    s = {}
    for r in rows: s[cat(r['use'])] = s.get(cat(r['use']), 0) + r['m2']
    return {k: v / total for k, v in s.items()}

out = []
for f in sorted(glob.glob('supabase/seed/evolution/*.json')):
    if os.path.basename(f).startswith('_'): continue
    d = json.load(open(f))
    a, p = shares(d['approved'], d['approved_total']), shares(d['proposed'], d['proposed_total'])
    out.append({'slug': os.path.basename(f)[:-5], 'plan': d['plan_number'], 'area': d['proposed_total'], 'approved': a, 'proposed': p,
                'uses_approved': len(d['approved']), 'uses_proposed': len(d['proposed'])})
json.dump(out, open('supabase/seed/evolution/_summary.json', 'w'), ensure_ascii=False, indent=1)
keys = ['residential', 'mixed', 'commerce', 'public', 'open_public', 'open_private', 'road']
print('| תוכנית | שטח (דונם) | ' + ' | '.join(LABEL[k] for k in keys) + ' | ייעודים |')
print('|---|---|' + '---|' * len(keys) + '---|')
for o in out:
    cells = []
    for k in keys:
        x, y = o['approved'].get(k, 0) * 100, o['proposed'].get(k, 0) * 100
        cells.append(f'{x:.0f} ← {y:.0f}' if (x or y) else '-')
    print(f"| {o['plan']} | {o['area']/1000:.1f} | " + ' | '.join(cells) + f" | {o['uses_approved']} ← {o['uses_proposed']} |")
# aggregate, area-weighted
tot = sum(o['area'] for o in out)
print()
for k in keys:
    x = sum(o['approved'].get(k, 0) * o['area'] for o in out) / tot * 100
    y = sum(o['proposed'].get(k, 0) * o['area'] for o in out) / tot * 100
    print(f"- {LABEL[k]}: {x:.1f}% ← {y:.1f}% (משוקלל בשטח, {len(out)} תוכניות, {tot/1000:.0f} דונם)")
