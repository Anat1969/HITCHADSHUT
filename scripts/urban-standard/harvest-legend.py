"""Harvest land-use legend swatches (colour + official name) from Mavat-generated tashrit PDFs.

Usage: python3 -I scripts/urban-standard/harvest-legend.py <out.json> <tashrit.pdf> [...]

A swatch = a small filled rectangle with a text label beside it on the same row.
Output: for each normalised name, every colour seen and the files it was seen in, so a colour is
"verified" only when it repeats across independent plans (the colour is set by the Mavat system,
not by the plan editor). Nothing is guessed: a name with conflicting colours is reported as such.
"""
import importlib.util, json, os, sys, datetime
import pdfplumber

here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('tl', os.path.join(here, '..', 'tashrit-lots.py'))
tl = importlib.util.module_from_spec(spec); spec.loader.exec_module(tl)

out_path, pdfs = sys.argv[1], sys.argv[2:]
seen = {}
for pdf in pdfs:
    try:
        doc = pdfplumber.open(pdf)
    except Exception as e:
        print(f'skip {pdf}: {e}', file=sys.stderr); continue
    for pno, page in enumerate(doc.pages, 1):
        n = 0
        for o in page.rects:
            if not o.get('fill'):
                continue
            col = tl.rgb(o.get('non_stroking_color'))
            if not col or min(col) > 0.97 or max(col) < 0.03:
                continue
            w, h = o['x1'] - o['x0'], o['bottom'] - o['top']
            if not (4 < w < 60 and 3 < h < 30 and 0.8 < w / h < 4.5):
                continue
            for x0, x1 in ((o['x1'] + 2, min(page.width, o['x1'] + 200)), (max(0, o['x0'] - 200), o['x0'] - 2)):
                txt = tl.crop_text(pdf, pno, x0, o['top'] - 1, x1, o['bottom'] + 1)
                line = next((l for l in txt.splitlines() if any(c.isalpha() for c in l)), '')
                if line and any('֐' <= c <= '׿' for c in line):
                    name = tl.norm_use(line)
                    rec = seen.setdefault(name, {})
                    rec.setdefault(tl.hexc(col), set()).add(os.path.relpath(pdf))
                    n += 1
                    break
        print(f'{pdf} p{pno}: {n} swatches', file=sys.stderr)

res = {'generated': datetime.date.today().isoformat(), 'method': __doc__.strip().splitlines()[0], 'names': {}}
for name, cols in sorted(seen.items()):
    res['names'][name] = [{'hex': k, 'files': sorted(v)} for k, v in sorted(cols.items(), key=lambda kv: -len(kv[1]))]
json.dump(res, open(out_path, 'w'), ensure_ascii=False, indent=1)
