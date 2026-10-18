import sys,pdfplumber
pdf=pdfplumber.open(sys.argv[1]); p=pdf.pages[int(sys.argv[2])]
ws=p.extract_words(keep_blank_chars=False)
rows={}
for w in ws:
    rows.setdefault(round(w['top']/4),[]).append(w)
for k in sorted(rows):
    print(int(k*4), ' | '.join(f"{w['text'][::-1] if any('֐'<=c<='׿' for c in w['text']) else w['text']}@{int(w['x0'])}" for w in sorted(rows[k],key=lambda w:-w['x0'])))
