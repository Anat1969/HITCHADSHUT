// כתבות ויצירות של "מה נבנה סביבי": נגזרות מסיפורי התוכניות (supabase/seed/*.story.json),
// מכללי התכנון שנלמדו (docs/planning-insights.md) ומהשוואת ייעודי הקרקע (docs/evolution-compare.md).
// הרכיב המשותף <app-creations> (AppOfApp-GH/public/creations.js) מציג אותן: כתבת A4 לכל נושא, יצירת כתבה מהמאגר,
// הורדה והדפסה, והעלאה לחדר של האפליקציה במוזיאון (TAARUCHA).
// הרצה: node tools/creations.mjs  → public/creations.json
// כללים: אין עובדה חדשה. כל טקסט נלקח מהנתונים, חוץ מכותרות ותוויות קצרות. בלי הייקו: הכתבה בגיליון אחד בלי לוותר על "ממה למה".
// פרטיות: בלי כתובות של בתים (מספרי בתים נמחקים), בלי שמות של יזמים, עורכי דין או דיירים.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SEED = path.join(ROOT, 'supabase/seed')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const warn = []

// ---------- נתונים ----------
const stories = {}
for (const f of fs.readdirSync(SEED).filter((f) => f.endsWith('.story.json'))) {
  const s = JSON.parse(fs.readFileSync(path.join(SEED, f), 'utf8'))
  s.slug = f.replace('.story.json', '')
  s.ch = Object.fromEntries(s.chapters.map((c) => [c.id, c]))
  stories[s.slug] = s
}

// כללי התכנון: "### N. כותרת", "**ראיה:**", "**כלל:**", "**ודאות:**"
const rules = {}
for (const block of read('docs/planning-insights.md').split(/\n### /).slice(1)) {
  const [head, ...rest] = block.split('\n')
  const m = head.match(/^(\d+)\.\s+(.*)$/)
  if (!m) continue
  const text = rest.join('\n').split('\n## ')[0]
  const field = (name) => {
    const r = text.match(new RegExp(`\\*\\*${name}:\\*\\*([\\s\\S]*?)(?=\\n\\*\\*[^*]+:\\*\\*|$)`))
    return r ? r[1].trim() : ''
  }
  rules[m[1]] = { n: m[1], title: m[2].trim(), evidence: field('ראיה'), rule: field('כלל'), certainty: field('ודאות') }
}

// השוואת ייעודי הקרקע: "- שצ"פ וכיכר: 16.9% ← 14.6% (...)" = מאושר ← מוצע
const landUse = {}
for (const l of read('docs/evolution-compare.md').split('\n')) {
  const m = l.match(/^- (.+?): ([\d.]+)% ← ([\d.]+)%/)
  if (m) landUse[m[1]] = { from: m[2], to: m[3] }
}
const compareNote = (read('docs/evolution-compare.md').match(/משוקלל בשטח, (\d+) תוכניות, (\d+) דונם/) || []).slice(1)

// ---------- עזרים ----------
const sentences = (t) => (t || '').split(/(?<=[.?!])\s+(?=[^\s])/).map((s) => s.trim()).filter(Boolean)
const first = (t) => sentences(t)[0] || ''
const words = (t) => (t || '').replace(/[*=]/g, '').split(/\s+/).filter(Boolean).length
// פרטיות: מספרי בתים נמחקים ("ברחוב הרב שאולי 7 עד 15" → "ברחוב הרב שאולי")
const noHouse = (t) => (t || '').replace(/(רחוב|ברחוב|בכתובות|ברחובות)\s+([^\d,.:]+?)\s\d+(?:,\s\d+)*(?:\sו-\d+)?(?:\sעד\s\d+)?(?=[\s,.]|$)/g, '$1 $2').replace(/\s{2,}/g, ' ')
const bold = (t) => (t || '').replace(/(?<!\d-|[\d*\/.,])(\d(?:[\d,.]*\d)?%?)(?![\d*\/]|-\d)/g, '**$1**')
const clean = (t) => noHouse(t).trim()
const check = (where, t, max) => { if (words(t) > max) warn.push(`${where}: ${words(t)} מילים (עד ${max})`) }

// תמונות שהאפליקציה כבר מגישה, עם הכיתוב שלהן ממסד המדיה
const IMG = {
  'tamal-2022': { image: 'creations/img/tamal-2022-shlaviut.jpg', credit: 'נספח שלביות, תמל/2022: שלושה שלבי ביצוע, מצפון לדרום (מסמך רקע, מבא"ת)' },
  'tamal-2023': { image: 'plans/tamal-2023/approved-1.jpg', credit: 'נספח מצב מאושר, תמל/2023 (מסמך רקע, מבא"ת)' },
  'tamal-2047': { image: 'plans/tamal-2047/approved-1.jpg', credit: 'תשריט מצב מאושר, תמל/2047 (מסמך רקע, מבא"ת)' },
  '603-0271296': { image: 'plans/603-0271296/approved-1.jpg', credit: 'תשריט מצב מאושר, 603-0271296 (מבא"ת)' },
  '603-0811588': { image: 'plans/603-0811588/docs/model-after.jpg', credit: 'מודל הבינוי של מה נבנה סביבי: נפח לדוגמה אחרי התוכנית' },
  'tamal-2023-mutza': { image: 'creations/img/tamal-2023-mutza.jpg', credit: 'תשריט מצב מוצע, תמל/2023: מסחר ותעסוקה מול שדרות הרצל (מבא"ת)' },
  'tamal-2047-mutza': { image: 'creations/img/tamal-2047-mutza.jpg', credit: 'תשריט מצב מוצע, תמל/2047 (מבא"ת)' },
  '3-03-104-66-both': { image: 'creations/img/3-03-104-66-shnei-matzavim.jpg', credit: 'תשריט 3/03/104/66: מצב מאושר מימין, מצב מוצע משמאל (מבא"ת)' },
  'model-allowed': { image: 'plans/603-0811588/docs/model-allowed.jpg', credit: 'מודל הבינוי של מה נבנה סביבי: המעטפת המותרת בכל מגרש' },
  '3-03-101-71a': { image: 'plans/3-03-101-71a/docs/tashrit-mutza.jpg', credit: 'תשריט מצב מוצע, 3/03/101/71א, 1:2,500 (מבא"ת)' },
}

// ---------- נושא מתוכנית ----------
// לכל תוכנית: הכותרת, "למה עכשיו" כציטוט, השקילה כתובנה, לפני ואחרי, ומה השכונה מקבלת.
function planCreations(s, { insight, quote } = {}) {
  const c = s.ch
  const out = []
  const img = IMG[s.slug]
  const head = clean(c.headline?.lead)
  if (img) out.push({ id: 'p', style: 'poster', title: s.headline, text: head, image: img.image, pos: img.pos, credit: img.credit, kicker: s.kicker })
  else out.push({ id: 'g', style: 'gradient', title: s.headline, text: head, kicker: s.kicker })
  if (quote) out.push({ id: 'q', style: 'quote', ...quote })
  else if (c.why?.lead) out.push({ id: 'q', style: 'quote', quote: clean(c.why.lead), who: `למה עכשיו · תוכנית ${s.plan_number}`, cite: (c.why.sources || []).slice(0, 2).join(', ') })
  if (insight) out.push({ id: 'i', style: 'insight', ...insight })
  else if (c.weigh) {
    const q = clean(first((c.weigh.questions || [])[0]))
    out.push({ id: 'i', style: 'insight', title: c.weigh.lead.replace(/\.$/, ''), text: q ? `==${bold(q)}==` : '' })
  }
  if (c.before?.lead && c.after?.lead) out.push({ id: 'f', style: 'fromto', title: 'מה התוכנית משנה', from: clean(c.before.lead), to: clean(c.after.lead), fromLabel: 'לפני', toLabel: 'אחרי', text: `${s.status.label} · ${s.plan_number}` })
  if (c.gets?.bullets?.length) {
    const body = c.gets.bullets.map(clean).filter((b) => words(b) <= 24).slice(0, 3).map(bold)
    out.push({ id: 'e', style: 'essay', title: c.gets.title, text: clean(c.gets.lead), body })
  }
  return out
}
function planTopic(slug, zone, extra = {}) {
  const s = stories[slug]
  if (!s) throw new Error('חסר סיפור: ' + slug)
  return { id: extra.id || 'plan-' + slug, zone, title: s.headline, sub: bold(clean(s.deck)), creations: planCreations(s, extra) }
}

// ---------- נושא מכלל תכנון ----------
function ruleQuote(n) {
  const r = rules[n]
  return { quote: first(r.rule.replace(/\*\*/g, '')), who: `כלל תכנון ${n}`, cite: 'כללי התכנון שנלמדו' }
}
const evidenceLines = (n) => rules[n].evidence.split('\n').map((l) => l.replace(/^- /, '').trim()).filter(Boolean)

// ---------- הנושאים: ידע, הבנה, יישום ----------
const LU = (k) => landUse[k] || warn.push('חסר ייעוד: ' + k) || { from: '?', to: '?' }
const scope = compareNote.length ? `משוקלל בשטח, **${compareNote[0]}** תוכניות, **${compareNote[1]}** דונם` : ''

const topics = [
  // ידע: עובדה עם מקור
  planTopic('tamal-2022', 'ידע', {
    id: 'maapilim',
  }),
  planTopic('tamal-2023', 'ידע', {
    id: 'ahad-haam',
    insight: { title: 'הפארק המאושר הופך לבית ספר', text: `==${bold(sentences(rules['11'].evidence).find((x) => x.includes('חושף')).replace(/^.*חושף ש/, ''))}==` },
  }),
  planTopic('3-03-101-71a', 'ידע', {
    id: 'port',
    insight: { title: rules['13'].title, text: `==${bold(first(rules['13'].rule))}==` },
  }),

  // הבנה: מנגנון, השוואה, ממה למה
  {
    id: 'open-space-bank', zone: 'הבנה', title: rules['5'].title,
    sub: bold(sentences(evidenceLines('5')[0])[1]),
    creations: [
      { id: 'p', style: 'poster', title: 'מה היה מותר כאן קודם', text: 'התשריט המאושר, מעוגן לקו הכחול של התוכנית.', ...IMG['tamal-2047'] },
      { id: 'q', style: 'quote', ...ruleQuote('5') },
      { id: 'f', style: 'fromto', title: 'השצ"פ בתוכניות ההתחדשות', from: `**${LU('שצ"פ וכיכר').from}%** משטח התוכניות`, to: `**${LU('שצ"פ וכיכר').to}%** משטח התוכניות`, fromLabel: 'מאושר', toLabel: 'מוצע', text: scope },
      { id: 'i', style: 'insight', title: 'ב-10 תוכניות אחרות השצ"פ גדל', text: '==הירידה נובעת משתי תוכניות==: אחד העם והאצטדיון.' },
      { id: 'e', style: 'essay', title: 'מאזן שצ"פ', text: 'השטח הפתוח המאושר מול המוצע.', body: [bold(evidenceLines('5')[2]), bold(evidenceLines('5')[3]), bold(sentences(rules['5'].rule)[1])] },
    ],
  },
  {
    id: 'tower-shade', zone: 'הבנה', title: 'המגדלים מסתירים את הגינה של עצמם',
    sub: bold(first(rules['4'].rule)),
    creations: [
      { id: 'p', style: 'poster', title: 'אותם מגדלים, יותר דירות', text: 'נפח לדוגמה בתוך המעטפת המותרת.', ...IMG['603-0811588'] },
      { id: 'q', style: 'quote', ...ruleQuote('12') },
      { id: 'i', style: 'insight', title: 'גגות השכנים עומדים בסף', text: `==${bold('השטחים הפתוחים של התוכנית עצמה מאבדים יותר מ-20% משמש החורף ב-8 תוכניות.')}==` },
      { id: 'f', style: 'fromto', title: 'מבחן השעתיים, תמל/2022', from: 'שעתיים שמש ב-21 במרץ: **96.1%** מהשטח', to: 'אחרי המגדלים: **95.5%**, יחס **0.99**', fromLabel: 'היום', toLabel: 'אחרי', text: '**17.6%** עד **21.4%** מהקרקע הסמוכה מאבדים שעת שמש או יותר.' },
      { id: 'e', style: 'essay', title: 'צל צר שנע מהר', text: 'קריטריון של "שעתיים לפחות" לא רואה את זה.', body: [bold('הצל של מגדל צר ונע מהר, והוא לוקח מעט שמש מהרבה מקומות.'), bold('בנאות ספיר הירידה היא 51%, בציזלינג 48%, בגאפנוב 43% ובהרב מימון 41%.'), 'מיקום שמש לפי NOAA, בסטייה של **0.016** מעלות מ-NREL SPA. צל ברשת של **2** מ\'.'] },
    ],
  },
  {
    id: 'mixed-ground', zone: 'הבנה', title: rules['6'].title,
    sub: bold(first(rules['6'].rule)),
    creations: [
      { id: 'p', style: 'poster', title: 'המסחר יורד לקומת הקרקע', ...IMG['tamal-2023-mutza'], text: `מגרש מסחרי נפרד: **${LU('מסחר ותעסוקה').from}%** ← **${LU('מסחר ותעסוקה').to}%**.` },
      { id: 'f', style: 'fromto', title: 'ייעוד מעורב', from: `**${LU('מעורב').from}%** משטח התוכניות`, to: `**${LU('מעורב').to}%** משטח התוכניות`, fromLabel: 'מאושר', toLabel: 'מוצע', text: scope },
      { id: 'q', style: 'quote', quote: first(clean(stories['603-0391219'].ch.why.paragraphs[0])), who: 'המרכז המסחרי של רובע א\' · 603-0391219', cite: stories['603-0391219'].ch.why.sources[0] },
      { id: 'i', style: 'insight', title: 'חזית פעילה צריכה מספר מחייב', text: '==שטח מינימלי ואורך חזית== בטבלה 5. אחרת הם יורדים בשלב ההיתר.' },
      { id: 'e', style: 'essay', title: 'מרכז רובע א\'', text: 'מה קרה לייעודים בתוכנית אחת.', body: ['מסחר: מ-**46%** ל-**2%**.', 'מעורב: מ-**5%** ל-**33%**.', 'שצ"פ וכיכר: מ-**14%** ל-**35%**.'] },
    ],
  },

  // יישום: מה עושים מחר
  {
    id: 'climate', zone: 'יישום', title: rules['9'].title,
    sub: 'כל 18 התוכניות נמדדו בשכונה 360. הציונים נעים בין **9** ל-**39** נקודות מתוך **120**, וכולם מתחת לדרגת ארד (**55**).',
    creations: [
      { id: 'p', style: 'poster', title: 'נמדדת הצורה, לא האקלים', text: 'המעטפת המותרת בכל מגרש.', ...IMG['model-allowed'] },
      { id: 'i', style: 'insight', title: 'נספח אקלים לכל תוכנית', text: '==ספים מדידים ומחייבים==: שמש, עצים, הצללה ואנרגיה מתחדשת.' },
      { id: 'q', style: 'quote', quote: 'הוראה כללית ("יינטעו עצים") לא מזכה בניקוד.', who: 'כלל תכנון 9', cite: 'מדידה בשכונה 360, גרסה 2.0, 30.10.2026' },
      { id: 'f', style: 'fromto', title: 'מה מקבל ניקוד', from: 'צמידות דופן וצפיפות: **18** מתוך **18**', to: 'אנרגיה מתחדשת, אתר בנייה, גינון: **0** תוכניות', fromLabel: 'צורה', toLabel: 'אקלים', text: 'הצללה: **2** מתוך **18**.' },
      { id: 'e', style: 'essay', title: 'מה מבקשים מחר בבוקר', text: 'לכל תוכנית התחדשות מצרפים נספח אקלים.', body: ['שעות שמש לשכנים ולשטחים הפתוחים.', 'כיסוי עצים והצללה ברחוב.', 'אנרגיה מתחדשת על הגגות.'] },
    ],
  },
  {
    id: 'two-numbers', zone: 'יישום', title: rules['2'].title,
    sub: bold(first(rules['2'].rule)),
    creations: [
      { id: 'p', style: 'poster', title: 'שני מספרים, שני מקורות', text: 'הוראות התוכנית מול מאגר data.gov.il.', ...IMG['tamal-2047-mutza'] },
      { id: 'q', style: 'quote', quote: clean(first(stories['tamal-2047'].ch.weigh.questions[0])), who: 'השקילה · תמל/2047', cite: 'הוראות התוכנית ומאגר מתחמי ההתחדשות העירונית' },
      { id: 'i', style: 'insight', title: '9 מתוך 17 מתחמים', text: '==פער שחוזר מעיד על תהליך==, למשל שינוי מאוחר שלא עודכן.' },
      { id: 'p2', style: 'post', title: 'הוראות מול המאגר', text: ['603-0704064', '603-0780734', 'tamal-2047'].map((k) => `${stories[k].plan_number}: ${first(stories[k].ch.weigh.questions[0]).replace(/^במאגר הממשלתי רשומות /, 'במאגר ')}`).map(bold).join('\n'), tags: ['פער', 'שקיפות', 'מספרים'] },
      { id: 'e', style: 'essay', title: 'מה עושים עם פער', text: 'מציגים את שני המספרים ואת מקורם.', body: ['לא בוחרים בשקט.', 'שואלים מה השתנה, ומתי.', bold('בשפירא: **324** דירות לפי ההוראות, **389** ב-data.gov.il.')] },
    ],
  },
  {
    id: 'approved-first', zone: 'יישום', title: rules['11'].title,
    sub: bold(first(rules['11'].rule)),
    creations: [
      { id: 'p', style: 'poster', title: 'מה היה מותר כאן קודם', text: 'מאושר ומוצע על גיליון אחד.', ...IMG['3-03-104-66-both'] },
      { id: 'q', style: 'quote', ...ruleQuote('11') },
      { id: 'i', style: 'insight', title: 'מסמך רקע נשכח', text: '==בשלוש תוכניות מתוך 17== התשריט המאושר היה ב-Drive.' },
      { id: 'f', style: 'fromto', title: 'מאושר ומוצע, זה לצד זה', from: 'תשריט מאושר: "רקע"', to: 'באותו קנה מידה ובאותה מסגרת', fromLabel: 'היום', toLabel: 'מבקשים', text: 'בתוכנית שאין לה תשריט מאושר נגיש, מבקשים אותו מהיזם או מהוועדה.' },
      { id: 'e', style: 'essay', title: 'שלושה סוגי "לפני"', text: 'ותווית לכל אחד.', body: ['**לפי התשריט המאושר:** התשריט עצמו, מעוגן לקו הכחול.', '**הערכה:** שורטט מהסריקה.', '**המצב הקיים:** חלקות רשומות מה-GIS העירוני.'] },
    ],
  },
]


// ---------- המאגר: כל תוכנית, וכל כלל תכנון ----------
const used = new Set(['tamal-2022', 'tamal-2023', '3-03-101-71a'])
const pool = []
for (const slug of Object.keys(stories).sort()) {
  if (used.has(slug)) continue
  pool.push(planTopic(slug, 'ידע', { id: slug }))
}
for (const n of ['1', '3', '4', '7', '8', '10']) {
  const r = rules[n]
  const ev = evidenceLines(n)
  pool.push({
    id: 'rule-' + n, zone: 'הבנה', title: r.title, sub: bold(first(ev[0].replace(/\*\*/g, ''))),
    creations: [
      { id: 'g', style: 'gradient', title: r.title, text: bold(first(r.rule.replace(/\*\*/g, ''))) },
      { id: 'q', style: 'quote', ...ruleQuote(n) },
      { id: 'i', style: 'insight', title: 'ודאות', text: `==${first(r.certainty)}==` },
      { id: 'e', style: 'essay', title: 'הראיה', text: `כלל תכנון ${n}`, body: ev.slice(0, 3).map((l) => bold(l.replace(/\*\*/g, ''))) },
    ],
  })
}

// ---------- בדיקות ----------
const ZONES = ['ידע', 'הבנה', 'יישום']
for (const t of [...topics, ...pool]) {
  if (!ZONES.includes(t.zone)) warn.push(`${t.id}: שלב לא מוכר`)
  check(`${t.id} כותרת`, t.title, pool.includes(t) ? 10 : 8)
  const styles = t.creations.map((c) => c.style)
  if (new Set(styles).size !== styles.length) warn.push(`${t.id}: עיצוב חוזר`)
  if (t.creations.length < 4 || t.creations.length > 6) warn.push(`${t.id}: ${t.creations.length} יצירות`)
  for (const c of t.creations) {
    if (c.title) check(`${t.id}/${c.id} כותרת`, c.title, 12)
    if (c.image && !fs.existsSync(path.join(ROOT, 'public', c.image))) warn.push(`${t.id}: חסרה תמונה ${c.image}`)
    if (/undefined|\?%/.test(JSON.stringify(c))) warn.push(`${t.id}/${c.id}: ערך חסר`)
    if (/\s\d+ עד \d+,?\s/.test(c.quote || '') && /רחוב/.test(c.quote || '')) warn.push(`${t.id}/${c.id}: כתובת`)
  }
}
if (topics.length < 6 || new Set(topics.map((t) => t.zone)).size < 3) warn.push('פחות מ-6 נושאים או שלב חסר')

const out = {
  app: {
    id: 'hitchadshut',
    name: 'מה נבנה סביבי',
    url: 'https://ashdod-ma-nivne.vercel.app',
    repo: 'Anat1969/HITCHADSHUT',
    description: 'התחדשות עירונית באשדוד, בשפה פשוטה: מה כל תוכנית עושה לרחוב, לקרקע ולשכונה, ומה למדנו מההשוואה בין התוכניות.',
    palette: { a: '#1D4ED8', b: '#8A1C1C', c: '#E2AE48', s: '#6EA65F', accent: '#1D4ED8', marker: '#f3dc8a', paper: '#FAFAF9', paper2: '#F1F1EF', ink: '#111111', 'b-wash': '#F3E6E6', 's-wash': '#e6efe3', serif: "'Frank Ruhl Libre', serif" },
    article: {
      layout: 'blueprint',
      css: '.ar-L-blueprint{--cr-bp:#1D4ED8}',
    },
  },
  topics,
  pool,
}
fs.writeFileSync(path.join(ROOT, 'public/creations.json'), JSON.stringify(out, null, 1) + '\n')
const n = topics.reduce((a, t) => a + t.creations.length, 0)
console.log(`creations.json: ${topics.length} נושאים, ${n} יצירות, ${pool.length} מקורות במאגר`)
if (warn.length) { console.log('אזהרות:\n- ' + warn.join('\n- ')); process.exitCode = 1 }
