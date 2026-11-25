/**
 * תקן התאום העירוני של אשדוד: ספרייה אחת לשתי האפליקציות.
 *   - "תוכניות בינוי" (Anat1969/PLANS-GH): המקור. הקובץ הזה.
 *   - "מה נבנה סביבי" (Anat1969/HITCHADSHUT): עותק זהה ב-src/lib/urban-standard/, מסונכרן ב-
 *     `node scripts/urban-standard/sync.mjs <PLANS-GH>`, ובדיקה שנכשלת אם העותק שונה.
 *
 * ארבעה חלקים:
 *   1. LAND_USE: קודי ייעוד ושימוש, עם מקור ומצב אימות. אין צבע בלי מקור.
 *   2. STATUS: ארבעה ממדי סטטוס נפרדים (סטטוטורי, טיפול בתוכנית בינוי, רמת פירוט, אישור מודל).
 *   3. LOOK: מטריצת הייצוג. כל ממד מידע מקבל ערוץ חזותי משלו, ואין ערוץ עם שתי משמעויות.
 *   4. INTERACTION: חוזה האינטראקציה של המפות (Map Interaction Standard), ומתאמים ל-Leaflet,
 *      MapLibre ו-Three.js OrbitControls, כך שאותה פעולה נותנת אותה תוצאה בכל מפה.
 * המסמך המלא: docs/urban-twin/ בשני המאגרים.
 */
export const VERSION = '1.0.0';

/* ───────────── 1. קודי ייעוד ושימוש ───────────── */
/**
 * verified:
 *   'mavat-output' = הצבע נקרא ממשבצת המקרא בתשריטים שהפיקה מערכת מבא"ת, וחוזר זהה בכמה תוכניות
 *                    (HITCHADSHUT: scripts/urban-standard/harvest-legend.py, והתוצאה ב-PLANS-GH: data/urban-standard/legend-harvest.json).
 *   'pending'      = אין אימות. הצבע ניטרלי, והמקרא אומר "לבדיקה מקצועית".
 * הטבלה הרשמית (טבלת ייעודי הקרקע של נוהל מבא"ת וקובץ Mavat.ctb) לא הושגה: אתרי מינהל התכנון חסומים
 * מהסביבה. לכן האימות הוא מול פלט המערכת הרשמית, ולא מול הטבלה עצמה. זה מסומן כך בכל מקום.
 */
export const NEUTRAL = '#d9d8d4';
export const LAND_USE = {
 "residential": {
  "label": "מגורים",
  "mavat": "מגורים ד",
  "color": "#ff7f00",
  "verified": "mavat-output",
  "plans": [
   "603-0477232",
   "603-0590729",
   "tamal-2023"
  ],
  "note": "מגורים ד וה (רוויה). מגורים ב: #ffbf00, מגורים ודיור מיוחד: #ffdf7f. כשידוע שם הייעוד במגרש, הצבע לפי השם (MAVAT_BY_NAME)."
 },
 "mixed": {
  "label": "מגורים, מסחר ותעסוקה",
  "mavat": "מגורים מסחר ותעסוקה",
  "color": "#9c9c9c",
  "verified": "mavat-output",
  "plans": [
   "603-0477232",
   "tamal-2023"
  ],
  "note": "צבע משבצת המקרא. אם בתשריט יש גם קווקוו, הוא לא נבדק. חלוקה לקומות רק מנתוני התוכנית."
 },
 "commerce": {
  "label": "מסחר ותעסוקה",
  "mavat": "מסחר ותעסוקה",
  "color": "#adadad",
  "verified": "mavat-output",
  "plans": [
   "603-0477232",
   "603-0590729",
   "tamal-1062"
  ],
  "note": "מסחר לבד לא הופיע במקרא, ולכן קטגוריית המסחר מוצגת כמסחר ותעסוקה."
 },
 "employment": {
  "label": "תעסוקה",
  "mavat": "תעסוקה",
  "color": "#ff00c5",
  "verified": "mavat-single",
  "plans": [
   "603-0477232"
  ],
  "note": ""
 },
 "industry": {
  "label": "תעשייה, נמל ואחסנה",
  "mavat": null,
  "color": null,
  "verified": "pending",
  "plans": [],
  "note": "אין משבצת מקרא בתשריטי המאגר. ניטרלי עד אימות."
 },
 "hotel": {
  "label": "מלונאות",
  "mavat": null,
  "color": null,
  "verified": "pending",
  "plans": [],
  "note": "אין משבצת מקרא בתשריטי המאגר. ניטרלי עד אימות."
 },
 "public": {
  "label": "מבנים ומוסדות ציבור",
  "mavat": "מבנים ומוסדות ציבור",
  "color": "#cc9966",
  "verified": "mavat-output",
  "plans": [
   "603-0477232",
   "603-0590729",
   "tamal-1062",
   "tamal-2023",
   "tamal-2047"
  ],
  "note": ""
 },
 "open": {
  "label": "שטח ציבורי פתוח",
  "mavat": "שטח ציבורי פתוח",
  "color": "#bfff00",
  "verified": "mavat-output",
  "plans": [
   "603-0477232",
   "603-0590729",
   "tamal-1062",
   "tamal-2023",
   "tamal-2047"
  ],
  "note": "גם ספורט ונופש ופארק/גן ציבורי באותו צבע."
 },
 "road": {
  "label": "דרך",
  "mavat": "דרך מאושרת",
  "color": "#ccb266",
  "verified": "mavat-output",
  "plans": [
   "603-0477232",
   "tamal-1062",
   "tamal-2023",
   "tamal-2047"
  ],
  "note": "דרך מוצעת במבא\"ת באדום (#ff003f). מוצגת כך רק כשהשם במגרש ידוע."
 }
};
/** כל שם ייעוד שנקרא ממקרא תשריט, עם צבעו והתוכניות שבהן הופיע. */
export const MAVAT_BY_NAME = {
 "דיור מיוחד": {
  "color": "#ffdf7f",
  "verified": "mavat-single",
  "plans": [
   "tamal-1062"
  ]
 },
 "דיור מיוחד מסחר ותעסוקה": {
  "color": "#ffdf7f",
  "verified": "mavat-single",
  "plans": [
   "603-0477232"
  ]
 },
 "דרך מאושרת": {
  "color": "#ccb266",
  "verified": "mavat-output",
  "plans": [
   "603-0477232",
   "tamal-1062",
   "tamal-2023",
   "tamal-2047"
  ]
 },
 "דרך מוצעת": {
  "color": "#ff003f",
  "verified": "mavat-output",
  "plans": [
   "603-0477232",
   "tamal-1062",
   "tamal-2047"
  ]
 },
 "דרך משולבת": {
  "color": "#bfff00",
  "verified": "mavat-single",
  "plans": [
   "603-0477232"
  ]
 },
 "ככר עירונית": {
  "color": "#dca56d",
  "verified": "mavat-single",
  "plans": [
   "tamal-2047"
  ]
 },
 "מבנים ומוסדות ציבור": {
  "color": "#cc9966",
  "verified": "mavat-output",
  "plans": [
   "603-0477232",
   "603-0590729",
   "tamal-1062",
   "tamal-2023",
   "tamal-2047"
  ]
 },
 "מגורים": {
  "color": "#ffdf7f",
  "verified": "mavat-single",
  "plans": [
   "tamal-1062"
  ]
 },
 "מגורים ב": {
  "color": "#ffbf00",
  "verified": "mavat-single",
  "plans": [
   "603-0590729"
  ]
 },
 "מגורים ד": {
  "color": "#ff7f00",
  "verified": "mavat-output",
  "plans": [
   "603-0477232",
   "603-0590729",
   "tamal-2023"
  ]
 },
 "מגורים ה": {
  "color": "#ff7f00",
  "verified": "mavat-single",
  "plans": [
   "tamal-2047"
  ]
 },
 "מגורים מסחר ותעסוקה": {
  "color": "#9c9c9c",
  "verified": "mavat-output",
  "plans": [
   "603-0477232",
   "tamal-2023"
  ]
 },
 "מסחר ומבנים ומוסדות ציבור": {
  "color": "#adadad",
  "verified": "mavat-single",
  "plans": [
   "tamal-2047"
  ]
 },
 "מסחר ותעסוקה": {
  "color": "#adadad",
  "verified": "mavat-output",
  "plans": [
   "603-0477232",
   "603-0590729",
   "tamal-1062"
  ]
 },
 "מרכז תחבורה": {
  "color": "#ff003f",
  "verified": "mavat-single",
  "plans": [
   "tamal-1062"
  ]
 },
 "מתקנים הנדסיים": {
  "color": "#7f7fff",
  "verified": "mavat-single",
  "plans": [
   "tamal-1062"
  ]
 },
 "ספורט ונופש": {
  "color": "#bfff00",
  "verified": "mavat-single",
  "plans": [
   "tamal-1062"
  ]
 },
 "פארק/גן ציבורי": {
  "color": "#bfff00",
  "verified": "mavat-single",
  "plans": [
   "tamal-1062"
  ]
 },
 "שביל": {
  "color": "#009972",
  "verified": "mavat-single",
  "plans": [
   "tamal-1062"
  ]
 },
 "שטח ציבורי פתוח": {
  "color": "#bfff00",
  "verified": "mavat-output",
  "plans": [
   "603-0477232",
   "603-0590729",
   "tamal-1062",
   "tamal-2023",
   "tamal-2047"
  ]
 },
 "תעסוקה": {
  "color": "#ff00c5",
  "verified": "mavat-single",
  "plans": [
   "603-0477232"
  ]
 }
};

/** מיפוי קטגוריה במודל (השדה cat ב-plan_models וב-city_twin) לשם הייעוד במבא"ת. */
export const CAT_TO_MAVAT = {"residential": "מגורים ד", "mixed": "מגורים מסחר ותעסוקה", "commerce": "מסחר ותעסוקה", "employment": "תעסוקה", "industry": null, "hotel": null, "public": "מבנים ומוסדות ציבור", "open": "שטח ציבורי פתוח", "road": "דרך מאושרת"};

/** צבע לקטגוריה. בלי צבע מאומת: ניטרלי. */
export function landUseColor(cat){ const u = LAND_USE[cat]; return u && u.color ? u.color : NEUTRAL; }
/** צבע לפי שם הייעוד המלא (למשל "מגורים ב"), כשהוא ידוע במגרש. אחרת לפי הקטגוריה. */
export function landUseColorByName(name, cat){ const n = String(name || '').replace(/['"׳]/g, '').replace(/\s+/g, ' ').trim(); const u = MAVAT_BY_NAME[n]; return u ? u.color : landUseColor(cat); }
export function landUseLabel(cat){ const u = LAND_USE[cat]; return u ? u.label : 'ייעוד לא ידוע (לבדיקה)'; }

/* ───────────── 2. ארבעה ממדי סטטוס, בלי הסקה ביניהם ───────────── */
export const STATUS = {
  /** הסטטוס הסטטוטורי של התב"ע. */
  statutory: { existing:'קיים', planning:'בתכנון', deposited:'בהפקדה', approved:'מאושרת', permit:'היתר', construction:'בביצוע', completed:'הושלם', unknown:'לא ידוע' },
  /** סטטוס הטיפול בתוכנית הבינוי (אפליקציית תוכניות בינוי). */
  buildingPlan: { none:'אין תוכנית בינוי', preparing:'בהכנה', in_review:'בטיפול', approved:'אושרה', unknown:'לא ידוע' },
  /** רמת הפירוט של הגאומטריה שמוצגת. */
  lod: { existing:'מבנה קיים (גובה סמלי)', massing:'נפח לפי התב"ע (הערכה)', concept:'תכנון רעיוני (מהמצגת)', detailed:'מודל אדריכלי מפורט' },
  /** סטטוס האישור של המודל עצמו. מודל מאושר אינו אישור תוכנית, ולהפך. */
  modelApproval: { working:'גרסת עבודה (לא מאושרת)', approved:'מודל מאושר', estimate:'הערכה', unknown:'לא ידוע' },
};

/** סטטוס התחדשות ("מה נבנה סביבי") לממד הסטטוטורי. */
export function statutoryOf(status){ return ({ planning:'planning', deposited:'deposited', approved:'approved', permit:'permit', construction:'construction', completed:'completed' })[status] || 'unknown'; }

/* ───────────── 3. מטריצת הייצוג ───────────── */
/**
 * ערוץ חזותי אחד לכל ממד:
 *   ייעוד/שימוש    -> צבע המילוי (רק מ-LAND_USE)
 *   סטטוס סטטוטורי -> אטימות וקו המתאר (מלא / מקווקו) + תווית במקרא ובכרטיס
 *   מיקוד          -> רוויה: הרקע אפור ניטרלי (NEUTRAL_BG), בלי לשנות את צבעי הייעוד שבמיקוד
 *   רמת פירוט      -> הגאומטריה עצמה (נפח / מודל מפורט), ותווית
 *   אישור מודל     -> תג טקסט "גרסת עבודה" + קו מתאר מקווקו עבה; לעולם לא בצבע הייעוד
 *   בחירה זמנית    -> הילה שחורה עבה וחץ אדום (SELECT), בלי לגעת במילוי
 * צבעים שמורים: כחול = גבול תוכנית ותאי שטח (כמו במבא"ת). אדום = בחירה. לא משתמשים בהם לסטטוס.
 */
export const BLUE_LINE = '#1D4ED8';
export const SELECT = { halo:'#111111', arrow:'#D32F2F' };
export const NEUTRAL_BG = { fill:'#cfcdc7', edge:'#a9a7a1', opacity:.55 };
export const LOOK = {
  existing:      { fill:'#c9c7c1', opacity:1,   line:'solid',  label:'קיים (גובה סמלי)' },
  approved:      { opacity:.95, line:'solid',  label:'מאושרת' },
  planning:      { opacity:.45, line:'dashed', label:'בתכנון או בהפקדה' },
  working:       { line:'dashed-bold', tag:'גרסת עבודה, לא מאושרת' },
  missing:       { fill:NEUTRAL, opacity:.6, line:'dotted', label:'מידע חסר (לבדיקה)' },
};
export function lookFor(statutory){
  if(statutory === 'existing') return LOOK.existing;
  if(['approved','permit','construction','completed'].includes(statutory)) return LOOK.approved;
  if(['planning','deposited'].includes(statutory)) return LOOK.planning;
  return LOOK.missing;
}

/* ───────────── 4. חוזה האינטראקציה ───────────── */
export const INTERACTION = {
  clickTolerancePx: 5,          // תזוזה קטנה מזו בין לחיצה לשחרור = בחירה. גדולה יותר = גרירה, בלי בחירה
  wheelLevelsPerNotch: .5,       // הזזת גלגלת אחת (100 פיקסלים) = חצי רמת זום, סביב הסמן
  keyZoomLevels: 1,              // + ו- = רמה שלמה, סביב מרכז המפה
  keyPanFraction: .15,           // חץ = 15% מרוחב המפה
  keyRotateDeg: 15,              // Shift+חץ ימינה/שמאלה
  keyTiltDeg: 10,                // Shift+חץ למעלה/למטה
  maxTiltDeg: 80,                // הטיה מרבית (0 = מבט מלמעלה)
  animMs: 450,
  controlsCorner: 'top-left',   // הכפתורים בפינה השמאלית העליונה (בממשק RTL המקרא מימין)
};

/** טבלת הפעולות: המקור לתיעוד, לחלונית העזרה ולבדיקה. */
export const ACTIONS = [
  { id:'zoom',    label:'הגדלה והקטנה',    mouse:'גלגלת (סביב הסמן), לחיצה כפולה מגדילה', touch:'צביטה, הקשה כפולה', keys:'+  -', button:'+  −' },
  { id:'pan',     label:'הזזה',            mouse:'גרירה בלחצן שמאלי', touch:'גרירה באצבע אחת', keys:'חיצים', button:'' },
  { id:'rotate',  label:'סיבוב',           mouse:'גרירה בלחצן ימני ימינה ושמאלה, או Ctrl + גרירה', touch:'סיבוב בשתי אצבעות', keys:'Shift + ← →', button:'מצפן' },
  { id:'tilt',    label:'הטיה',            mouse:'גרירה בלחצן ימני למעלה ולמטה, או Ctrl + גרירה', touch:'גרירה בשתי אצבעות למעלה ולמטה', keys:'Shift + ↑ ↓', button:'2D / 3D' },
  { id:'select',  label:'בחירה',           mouse:`לחיצה (תזוזה של עד 5 פיקסלים)`, touch:'הקשה', keys:'', button:'' },
  { id:'clear',   label:'ביטול בחירה',     mouse:'לחיצה על שטח ריק', touch:'הקשה על שטח ריק', keys:'Esc', button:'' },
  { id:'north',   label:'הצפנה',           mouse:'', touch:'', keys:'N', button:'מצפן' },
  { id:'reset',   label:'איפוס מבט',       mouse:'', touch:'', keys:'0 או Home', button:'איפוס' },
  { id:'dim',     label:'דו־ממד / תלת־ממד', mouse:'', touch:'', keys:'Shift + ↑ ↓', button:'2D / 3D' },
  { id:'full',    label:'מסך מלא',         mouse:'', touch:'', keys:'F', button:'מסך מלא' },
];
/** המקלדת פועלת רק כשהמפה בפוקוס (לחיצה עליה או Tab), כדי לא להתנגש בקיצורים של הדף. */
export const KEYS = { north:['n','N','מ'], reset:['0','Home'], full:['f','F','כ'], clear:['Escape'], zoomIn:['+','='], zoomOut:['-','_'] };

const has = (list, k) => list.includes(k);
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** מעקב לחיצה מול גרירה, משותף לכל המנועים: wasDrag() אמת אם בלחיצה האחרונה הייתה תזוזה מעל הסף. */
export function clickGuard(el){
  let p = null, dragged = false;
  el.addEventListener('pointerdown', e => { p = [e.clientX, e.clientY]; dragged = false; }, true);
  el.addEventListener('pointermove', e => { if(p && Math.hypot(e.clientX - p[0], e.clientY - p[1]) > INTERACTION.clickTolerancePx) dragged = true; }, true);
  return { wasDrag:() => dragged, isClick:e => !p || Math.hypot(e.clientX - p[0], e.clientY - p[1]) <= INTERACTION.clickTolerancePx };
}

function fullscreen(el){
  const d = el.ownerDocument;
  if(d.fullscreenElement) return d.exitFullscreen && d.exitFullscreen();
  return el.requestFullscreen && el.requestFullscreen();
}

/** מקלדת משותפת. h: { panBy(dxFrac, dyFrac), zoomBy(levels), rotateBy(deg), tiltBy(deg), north(), reset(), clear(), full(), enabled() } */
export function bindKeys(el, h){
  if(!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  if(!el.getAttribute('aria-label')) el.setAttribute('aria-label', 'מפה. חיצים להזזה, פלוס ומינוס לזום, Shift וחיצים לסיבוב ולהטיה, N לצפון, 0 לאיפוס, F למסך מלא, Esc לביטול בחירה');
  const I = INTERACTION;
  const on = e => {
    if(h.enabled && !h.enabled()) return;
    if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    const k = e.key; let done = true;
    if(e.shiftKey && k === 'ArrowLeft') h.rotateBy && h.rotateBy(-I.keyRotateDeg);
    else if(e.shiftKey && k === 'ArrowRight') h.rotateBy && h.rotateBy(I.keyRotateDeg);
    else if(e.shiftKey && k === 'ArrowUp') h.tiltBy && h.tiltBy(I.keyTiltDeg);
    else if(e.shiftKey && k === 'ArrowDown') h.tiltBy && h.tiltBy(-I.keyTiltDeg);
    else if(k === 'ArrowLeft') h.panBy && h.panBy(-I.keyPanFraction, 0);
    else if(k === 'ArrowRight') h.panBy && h.panBy(I.keyPanFraction, 0);
    else if(k === 'ArrowUp') h.panBy && h.panBy(0, -I.keyPanFraction);
    else if(k === 'ArrowDown') h.panBy && h.panBy(0, I.keyPanFraction);
    else if(has(KEYS.zoomIn, k)) h.zoomBy && h.zoomBy(I.keyZoomLevels);
    else if(has(KEYS.zoomOut, k)) h.zoomBy && h.zoomBy(-I.keyZoomLevels);
    else if(has(KEYS.north, k)) h.north && h.north();
    else if(has(KEYS.reset, k)) h.reset && h.reset();
    else if(has(KEYS.full, k)) (h.full || (() => fullscreen(el)))();
    else if(has(KEYS.clear, k)) h.clear && h.clear();
    else done = false;
    if(done){ e.preventDefault(); e.stopPropagation(); }
  };
  el.addEventListener('keydown', on, true);   // capture: המקש לא מגיע לקיצורים של הדף
  return () => el.removeEventListener('keydown', on, true);
}

/** גלגלת מנורמלת לפיקסלים (deltaMode שורה = 40, דף = 800). */
export function wheelPx(e){ return e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 800 : 1); }
export function wheelLevels(e){ return -wheelPx(e) / 100 * INTERACTION.wheelLevelsPerNotch; }

/* ── Leaflet (מפה דו־ממדית: אין סיבוב והטיה, והם מתועדים כלא רלוונטיים) ── */
export function applyLeaflet(map, L, h = {}){
  const I = INTERACTION, el = map.getContainer();
  // Leaflet ממיר גלגלת ברמת הפלטפורמה (getWheelPxFactor). מחשבים את wheelPxPerZoomLevel כך שהזזה אחת = I.wheelLevelsPerNotch.
  const B = L.Browser || {}, dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const factor = B.linux ? dpr : B.mac ? dpr * 3 : dpr > 0 ? 2 * dpr : 1;
  // 0.98: בלי זה עיגול נקודה צפה עובר את zoomSnap ומעגל ל-0.75 (נמצא בבדיקת הזהות)
  const want = I.wheelLevelsPerNotch * .98, d2 = -Math.log(2 / Math.pow(2, want / 4) - 1);
  map.options.wheelPxPerZoomLevel = (100 / factor) / (4 * d2);
  map.options.zoomSnap = .25; map.options.zoomDelta = I.keyZoomLevels; map.options.wheelDebounceTime = 20;
  if(map.scrollWheelZoom) map.scrollWheelZoom.enable();
  if(map.doubleClickZoom) map.doubleClickZoom.enable();
  if(map.keyboard) map.keyboard.disable();               // המקלדת עוברת לחוזה המשותף
  if(map.boxZoom) map.boxZoom.disable();                  // Shift+גרירה שמור לסיבוב במפות התלת־ממד
  if(L.Draggable) L.Draggable.prototype.options.clickTolerance = I.clickTolerancePx + 1;   // Leaflet: גרירה מ-tolerance ומעלה
  const home = { c:map.getCenter(), z:map.getZoom() };
  const unbind = bindKeys(el, {
    enabled:h.enabled,
    panBy:(fx, fy) => { const s = map.getSize(); map.panBy([fx * s.x, fy * s.y]); },
    zoomBy:l => map.setZoom(map.getZoom() + l),
    north:() => {}, rotateBy:() => {}, tiltBy:() => {},
    reset:h.reset || (() => map.setView(home.c, home.z)),
    clear:h.clear, full:h.full,
  });
  return { unbind, guard:clickGuard(el), setHome:(c, z) => { home.c = c; home.z = z; } };
}

/* ── MapLibre ── */
/** אפשרויות שנקבעות רק בבניית המפה. מוסיפים אותן ל-new maplibregl.Map({ ...MAPLIBRE_OPTIONS, ... }). */
export const MAPLIBRE_OPTIONS = { clickTolerance:INTERACTION.clickTolerancePx + 1, maxPitch:INTERACTION.maxTiltDeg, boxZoom:false, keyboard:false };
export function applyMapLibre(map, h = {}){
  const I = INTERACTION, el = map.getContainer();
  // MapLibre: שיעור הזום לגלגלת מחושב לפי הנוסחה שלו (2 / (1 + e^(-|d|·rate))), כך שהזזה אחת = I.wheelLevelsPerNotch
  const rate = -Math.log(2 / Math.pow(2, I.wheelLevelsPerNotch) - 1) / 100;
  if(map.scrollZoom){ map.scrollZoom.enable({ around:'pointer' }); map.scrollZoom.setWheelZoomRate(rate); map.scrollZoom.setZoomRate(rate); }
  map.dragPan.enable(); map.dragRotate.enable(); map.doubleClickZoom.enable();
  if(map.touchZoomRotate) map.touchZoomRotate.enable(); if(map.touchPitch) map.touchPitch.enable();
  if(map.keyboard) map.keyboard.disable();
  if(map.boxZoom) map.boxZoom.disable();
  map.setMaxPitch(I.maxTiltDeg);
  const home = { center:map.getCenter(), zoom:map.getZoom(), bearing:map.getBearing(), pitch:map.getPitch() };
  const d = I.animMs;
  const unbind = bindKeys(el, {
    enabled:h.enabled,
    panBy:(fx, fy) => { const c = map.getCanvas(); map.panBy([fx * c.clientWidth, fy * c.clientHeight], { duration:d }); },
    zoomBy:l => map.easeTo({ zoom:map.getZoom() + l, duration:d }),
    rotateBy:deg => map.easeTo({ bearing:map.getBearing() + deg, duration:d }),
    tiltBy:deg => map.easeTo({ pitch:Math.max(0, Math.min(I.maxTiltDeg, map.getPitch() + deg)), duration:d }),
    north:() => map.easeTo({ bearing:0, duration:d }),
    reset:h.reset || (() => map.easeTo(Object.assign({ duration:d }, home))),
    clear:h.clear, full:h.full,
  });
  return { unbind, guard:clickGuard(el), setHome:v => Object.assign(home, v) };
}

/* ── Three.js OrbitControls (r147) ── */
/**
 * מיפוי זהה למפות: לחצן שמאלי = הזזה על פני הקרקע, ימני (או Ctrl + שמאלי) = סיבוב והטיה,
 * גלגלת = זום סביב הסמן (מימוש כאן: ל-OrbitControls r147 אין zoomToCursor), לחיצה כפולה = הגדלה בנקודה.
 * מגע: אצבע אחת הזזה, שתיים צביטה וסיבוב.
 */
export function applyOrbit(ctl, cam, el, T, h = {}){
  const I = INTERACTION;
  ctl.mouseButtons = { LEFT:T.MOUSE.PAN, MIDDLE:T.MOUSE.DOLLY, RIGHT:T.MOUSE.ROTATE };
  ctl.touches = { ONE:T.TOUCH.PAN, TWO:T.TOUCH.DOLLY_ROTATE };
  ctl.screenSpacePanning = false;
  ctl.maxPolarAngle = Math.min(ctl.maxPolarAngle, I.maxTiltDeg * Math.PI / 180);
  const ground = h.groundY || (() => 0);
  const ray = new T.Raycaster(), plane = new T.Plane(new T.Vector3(0, 1, 0), 0), hit = new T.Vector3();
  const pointAt = (cx, cy) => {
    const r = el.getBoundingClientRect();
    ray.setFromCamera({ x:(cx - r.left) / r.width * 2 - 1, y:-(cy - r.top) / r.height * 2 + 1 }, cam);
    plane.constant = -ground();
    return ray.ray.intersectPlane(plane, hit) ? hit.clone() : null;
  };
  let anim = null;
  const zoomAt = (P, levels, ms) => {
    const f = Math.pow(2, -levels), dist = cam.position.distanceTo(ctl.target);
    const nd = Math.max(ctl.minDistance, Math.min(ctl.maxDistance, dist * f)), k = nd / dist;
    const p1 = P.clone().add(cam.position.clone().sub(P).multiplyScalar(k)), t1 = P.clone().add(ctl.target.clone().sub(P).multiplyScalar(k));
    if(!ms){ cam.position.copy(p1); ctl.target.copy(t1); ctl.update(); h.changed && h.changed(); return; }
    anim = { t:now(), ms, p0:cam.position.clone(), t0:ctl.target.clone(), p1, t1 };
    step();
  };
  const step = () => { if(!anim) return; const k = Math.min(1, (now() - anim.t) / anim.ms), e = 1 - Math.pow(1 - k, 3);
    cam.position.lerpVectors(anim.p0, anim.p1, e); ctl.target.lerpVectors(anim.t0, anim.t1, e); ctl.update(); h.changed && h.changed();
    if(k < 1) requestAnimationFrame(step); else anim = null; };
  const onWheel = e => {
    if(!ctl.enabled || (h.enabled && !h.enabled())) return;
    e.preventDefault(); e.stopImmediatePropagation();
    anim = null;
    const P = pointAt(e.clientX, e.clientY) || ctl.target.clone();
    zoomAt(P, wheelLevels(e), 0);
  };
  el.addEventListener('wheel', onWheel, { capture:true, passive:false });   // לפני ה-handler של OrbitControls
  const onDbl = e => { if(!ctl.enabled || (h.enabled && !h.enabled())) return; const P = pointAt(e.clientX, e.clientY); if(P) zoomAt(P, 1, I.animMs); };
  el.addEventListener('dblclick', onDbl);
  // סיבוב והטיה מהמקלדת: סביב המטרה, בכדור
  const sph = new T.Spherical(), off = new T.Vector3();
  const orbit = (dTheta, dPhi) => {
    off.copy(cam.position).sub(ctl.target); sph.setFromVector3(off);
    sph.theta += dTheta; sph.phi = Math.max(ctl.minPolarAngle + 1e-3, Math.min(ctl.maxPolarAngle, sph.phi + dPhi));
    off.setFromSpherical(sph); cam.position.copy(ctl.target).add(off); ctl.update(); h.changed && h.changed();
  };
  const home = { p:cam.position.clone(), t:ctl.target.clone() };
  const unbind = bindKeys(el, {
    enabled:() => ctl.enabled && (!h.enabled || h.enabled()),
    panBy:(fx, fy) => {
      const dist = cam.position.distanceTo(ctl.target), w = 2 * dist * Math.tan(cam.fov * Math.PI / 360) * cam.aspect;
      const fwd = ctl.target.clone().sub(cam.position).setY(0).normalize(), right = new T.Vector3().crossVectors(fwd, new T.Vector3(0, 1, 0)).normalize();
      const move = right.multiplyScalar(fx * w).add(fwd.multiplyScalar(-fy * w));
      cam.position.add(move); ctl.target.add(move); ctl.update(); h.changed && h.changed();
    },
    zoomBy:l => zoomAt(ctl.target.clone(), l, I.animMs),
    rotateBy:deg => orbit(-deg * Math.PI / 180, 0),
    tiltBy:deg => orbit(0, deg * Math.PI / 180),
    north:() => { off.copy(cam.position).sub(ctl.target); sph.setFromVector3(off); orbit(-sph.theta, 0); },
    reset:h.reset || (() => { cam.position.copy(home.p); ctl.target.copy(home.t); ctl.update(); h.changed && h.changed(); }),
    clear:h.clear, full:h.full,
  });
  return {
    unbind:() => { unbind(); el.removeEventListener('wheel', onWheel, { capture:true }); el.removeEventListener('dblclick', onDbl); },
    guard:clickGuard(el), zoomAt, setHome:() => { home.p.copy(cam.position); home.t.copy(ctl.target); },
  };
}
