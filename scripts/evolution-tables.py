# Extracts table 3.2 (areas by land use, approved vs proposed) from a Mavat provisions PDF with a text layer.
# python3 -I scripts/evolution-tables.py <horaot.pdf> <plan_number>  -> JSON on stdout
# Scanned provisions have no text layer: read table 3.2 by eye and write the same JSON by hand.
import json, re, subprocess, sys

pdf, plan = sys.argv[1], sys.argv[2]
txt = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True).stdout
# The portal's watermark ("תכנון זמין", print counter) lands at the start of table rows: strip it first.
lines = [re.sub(r'תכנון זמין|מונה הדפסה \d+', '', re.sub('[\u202a-\u202e]', '', l)).rstrip() for l in txt.splitlines()]
num = re.compile(r'^\s*([\d.,]+)\s+([\d.,]+)\s+(.+?)\s*$')

def block(start):
    rows, total = [], None
    for l in lines[start + 1:]:
        if 'סה"כ' in l:
            m = re.findall(r'[\d.,]+', l)
            total = float(m[1].replace(',', '')) if len(m) > 1 else None
            break
        m = num.match(l)
        if m:
            pct, m2, use = m.groups()
            rows.append({'use': use.strip(), 'm2': round(float(m2.replace(',', '')), 1), 'pct': float(pct.replace(',', ''))})
    return rows, total

i32 = next((i for i, l in enumerate(lines) if re.search(r'טבלת שטחים\s+3\.2', l)), None)
if i32 is None:
    sys.exit(f'{plan}: table 3.2 not found (scanned?)')
ia = next(i for i in range(i32, len(lines)) if 'מצב מאושר' in lines[i])
ip = next(i for i in range(ia + 1, len(lines)) if 'מצב מוצע' in lines[i])
approved, ta = block(ia)
proposed, tp = block(ip)
out = {'plan_number': plan, 'source': 'הוראות התכנית, טבלה 3.2', 'approved': approved, 'approved_total': ta, 'proposed': proposed, 'proposed_total': tp}
for k, rows, tot in (('approved', approved, ta), ('proposed', proposed, tp)):
    s = round(sum(r['m2'] for r in rows), 1)
    out[f'{k}_sum_check'] = {'sum': s, 'total': tot, 'ok': tot is not None and abs(s - tot) <= max(2, 0.002 * tot)}
json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
