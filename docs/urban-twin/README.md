# תאום דיגיטלי עירוני: מצביע

התקן והמסמכים נמצאים במקום אחד, במאגר "תוכניות בינוי" (Anat1969/PLANS-GH):
1. `standard/urban-standard.mjs`: התקן. כאן עותק ב-`src/lib/urban-standard/`.
2. `docs/urban-twin/README.md`: מצב היישום וההחלטות שממתינות.
3. `docs/urban-twin/survey-and-gaps.md`, `data-schema.md`, `design-system.md`, `map-interaction-standard.md`.

מה ייחודי למאגר הזה:
1. `scripts/urban-standard/harvest-legend.py`: חילוץ צבעי המקרא מהתשריטים שב-`public/plans`.
2. `scripts/urban-standard/sync.mjs`: העתקת התקן ובדיקת זהות.
3. `tests/map-parity.cjs`: בדיקת הזהות של חוזה האינטראקציה בשלושת המנועים.
