"""Building plans (תוכניות בינוי, תב/xxxx) from the PLANS-GH app, for the map and the city model.
   python3 -I scripts/sync-building-plans.py [plans-gh checkout] > public/building-plans.json
Reads seed-data.json (committee opinions) and plans-geo.js (lots by gush and helka, from the city GIS) of
https://github.com/Anat1969/PLANS-GH. The key is the building plan number (תב/1815 -> "1815").
No developer or architect names: the title keeps the place and the lots only."""
import json, re, sys, os

root = sys.argv[1] if len(sys.argv) > 1 else '../anat1969/plans-gh'
seed = json.load(open(os.path.join(root, 'seed-data.json')))
geo = open(os.path.join(root, 'plans-geo.js'), encoding='utf-8').read()
parcels = json.loads(re.search(r'window\.PLAN_PARCELS_BY_PLANNUM=(\{.*?\});\n', geo, re.S).group(1))

PLACES = r'ריב[י]?ירה|מרינה|רובע מיוחד|מער דרום|פארק מים|רובע ט"ז|רובע ט\''

def clean(title, num):
    """Place and lots only: no developers, companies, people or street addresses."""
    place = re.search(PLACES, title)
    lots = re.search(r'מגרש(?:ים)?\s*[\dא-ת]{0,1}[\d,\- ]*\d[א-ת]?', title)
    parts = [place.group(0).replace('ריבירה', 'ריביירה') if place else None, lots.group(0).strip() if lots else None]
    t = ' · '.join(x for x in parts if x)
    if 'שינוי' in title:
        t = (t + ' · ' if t else '') + ('שינוי קווי בניין' if 'קווי בניין' in title else 'שינוי לתוכנית')
    return t or f'תוכנית בינוי {num}'

out = []
for num, o in seed['opinions'].items():
    m = re.search(r'\|תואם לתוכנית\s*\|([^|]+)\|', o.get('text', ''))
    p = parcels.get(num, {})
    out.append({
        'plan_number': f'תב/{num}',
        'title': clean(o.get('projectName') or '', num),
        'committee_date': o.get('committeeDate'),
        'decision': (o.get('decision') or '').strip().rstrip('.'),
        'underlying_plan': m.group(1).strip() if m else None,
        'gush': p.get('gush'), 'helka': p.get('helka'),
        'center': [p['c'][1], p['c'][0]] if p.get('c') else None,
        'geometry': p.get('g'),
    })
out.sort(key=lambda x: x['plan_number'])
json.dump({'source': 'PLANS-GH (seed-data.json, plans-geo.js): חוות דעת הוועדה וחלקות מה-GIS העירוני',
           'app': 'https://anat1969.github.io/PLANS-GH/', 'plans': out}, sys.stdout, ensure_ascii=False, indent=1)
