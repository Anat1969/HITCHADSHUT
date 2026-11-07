/* <app-creations>: דף הכתבות והיצירות המשותף לאפליקציות של ענת.
 * כתבה: כל נושא הוא גיליון A4 אחד, שמורכב אוטומטית מהיצירות שלו, בפורמט של האפליקציה (app.article.layout):
 * magazine, daf, herbarium, atlas, blueprint, archive, report. "יצירת כתבה" בונה כתבה מכל מקור במאגר (pool).
 * <app-article src topic|pool>: כתבה אחת לבדה, כך המוזיאון (TAARUCHA) תולה אותה בחדר של האפליקציה.
 * כל נושא שעולה מהידע, ההבנה והיישום של אפליקציה הופך ל"חדר" עם יצירות בתשעה עיצובים:
 * poster (טקסט על תמונה), gradient (שדה צבע), veil (שקיפות), insight (תובנה), quote (ציטוט),
 * haiku (הייקו), post (פוסט), fromto (פרשנות ממה למה), essay (מאמר).
 * כל יצירה בפרופורציה של A4 (1:1.414), נמדדת ביחידות cqw ולכן זהה במסך, בהדפסה ובקובץ PNG.
 * שימוש: <script src="https://anat1969.github.io/AppOfApp-GH/creations.js"></script>
 *        <app-creations src="./creations.json"></app-creations>
 * תקן ומבנה הנתונים: docs/creations-standard.md
 */
(() => {
  if (customElements.get('app-creations')) return;
  const TAARUCHA = 'https://taarucha.vercel.app';
  const STYLE_HE = { poster: 'טקסט על תמונה', gradient: 'שדה צבע', veil: 'שקיפות', insight: 'תובנה', quote: 'ציטוט', haiku: 'הייקו', post: 'פוסט', fromto: 'ממה למה', essay: 'מאמר' };
  const ZONES = ['ידע', 'הבנה', 'יישום'];
  // סמלי קו לשלבים: ידע ספר פתוח, הבנה שני מעגלים שנפגשים, יישום יד מצביעה למטרה (חץ אל מטרה)
  const ZONE_ICON = {
    'ידע': '<path d="M8 4.2C6.6 3.3 4.6 3 2.5 3.2v9c2.1-.2 4.1.1 5.5 1 1.4-.9 3.4-1.2 5.5-1v-9C11.4 3 9.4 3.3 8 4.2zM8 4.2v9"/>',
    'הבנה': '<circle cx="6" cy="8" r="3.8"/><circle cx="10" cy="8" r="3.8"/>',
    'יישום': '<circle cx="8.6" cy="7.4" r="4.6"/><circle cx="8.6" cy="7.4" r="1.6"/><path d="M2.2 13.8l5.2-5.2"/>',
  };
  const zoneIcon = (z) => `<svg viewBox="0 0 16 16" aria-hidden="true">${ZONE_ICON[z] || ''}</svg>`;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // טקסט עשיר מינימלי: **מודגש** ו-==מרקר==
  const rich = (s) => esc(s).replace(/==(.+?)==/g, '<mark>$1</mark>').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');

  const CSS = `
app-creations{display:block;direction:rtl;font-family:var(--cr-sans,"IBM Plex Sans Hebrew",system-ui,sans-serif);color:#1a1a18}
.cr-head{display:grid;gap:6px;margin:0 0 18px}
.cr-head h1{font-size:clamp(28px,3.4vw,46px);font-weight:700;line-height:1.05;margin:0;letter-spacing:-.01em}
.cr-why{margin:0;color:#55544f;font-size:15px;line-height:1.6}
.cr-why b{color:#1a1a18}
/* סינון לפי שלב: שלושה כפתורי שלב עם סמל קו, ו"הכול" כקישור שקט בסוף השורה (לא נראה כמו שלב) */
.cr-zones{display:flex;flex-wrap:wrap;align-items:center;gap:6px 6px;margin:6px 0 4px}
.cr-zones .cr-btn{min-width:104px;padding:8px 14px}
.cr-zones .cr-btn svg{width:15px;height:15px;flex:none;fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
.cr-zones .cr-btn .cr-n{font-family:var(--cr-mono,"IBM Plex Mono",monospace);font-size:11px;opacity:.6}
.cr-all{all:unset;box-sizing:border-box;font:inherit;font-size:13px;color:#55544f;cursor:pointer;padding:6px 4px;margin-inline-start:10px;text-decoration:underline;text-decoration-thickness:1px;text-underline-offset:4px;text-decoration-color:#b5b4ae;-webkit-tap-highlight-color:transparent}
.cr-all:hover{color:#1a1a18;text-decoration-color:currentColor}
.cr-all[aria-pressed="true"]{color:#1a1a18;font-weight:600;text-decoration:none;cursor:default}
.cr-all:focus-visible{outline:2px solid var(--cr-accent,#1f3a68);outline-offset:2px}
.cr-btn{font:inherit;font-size:13px;font-weight:500;padding:8px 12px;border:1px solid transparent;border-radius:0;background:#f0efeb;color:#1a1a18;cursor:pointer;text-align:center;text-decoration:none;box-shadow:0 1px 0 rgba(26,26,24,.06),0 2px 6px rgba(26,26,24,.08);transition:transform .15s,box-shadow .15s,background .15s;display:inline-flex;align-items:center;justify-content:center;gap:6px}
.cr-btn:hover{transform:translateY(-1px);box-shadow:0 2px 0 rgba(26,26,24,.08),0 8px 18px rgba(26,26,24,.12)}
.cr-btn:active{transform:translateY(1px);box-shadow:none}
app-creations button,.cr-lb button{-webkit-tap-highlight-color:transparent}
app-creations button:focus:not(:focus-visible),app-creations a:focus:not(:focus-visible),.cr-lb button:focus:not(:focus-visible){outline:none;box-shadow:none}
.cr-btn:focus-visible{outline:2px solid var(--cr-accent,#1f3a68);outline-offset:2px}
.cr-btn.on,.cr-btn.primary{background:#1a1a18;color:#fff}
.cr-room{margin:28px 0 8px;padding-top:16px;border-top:2px solid #1a1a18}
.cr-room-hd{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:end;margin-bottom:12px}
.cr-zone{font-family:var(--cr-mono,"IBM Plex Mono","IBM Plex Sans Hebrew",monospace);font-size:11px;letter-spacing:.06em;color:var(--cr-accent,#1f3a68);font-weight:600}
.cr-room h2{font-size:clamp(20px,2vw,28px);margin:2px 0 4px;line-height:1.15}
.cr-room p.cr-sub{margin:0;color:#55544f;font-size:14px;line-height:1.55;max-width:70ch}
.cr-acts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;min-width:min(480px,100%)}
.cr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:14px}
.cr-item{display:grid;gap:6px;min-width:0}
.cr-item-ft{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center}
.cr-item-ft .cr-lbl{font-family:var(--cr-mono,"IBM Plex Mono",monospace);font-size:10.5px;color:#85847e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cr-item-ft .cr-btn{padding:4px 10px;font-size:12px}
.cr-open{all:unset;cursor:zoom-in;display:block}
.cr-open:focus-visible{outline:2px solid var(--cr-accent,#1f3a68);outline-offset:3px}
.cr-empty{padding:24px;background:#f6f5f1;color:#55544f}
@media (max-width:760px){.cr-zones .cr-btn{min-width:0;padding:8px 10px}.cr-all{margin-inline-start:4px}.cr-room-hd{grid-template-columns:minmax(0,1fr)}.cr-acts{min-width:0}.cr-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}}
/* הגדלה בתוך הדף */
.cr-lb{position:fixed;inset:0;z-index:9000;background:rgba(18,18,16,.86);display:grid;place-items:center;padding:3vh 3vw;cursor:zoom-out}
.cr-lb .cr-card{height:min(92vh,calc(92vw*1.414));width:auto;box-shadow:0 30px 80px rgba(0,0,0,.5)}
.cr-lb-x{position:fixed;top:14px;left:14px;z-index:9001;background:#fff}

/* ───── היצירה: גיליון A4 שנמדד ביחידות של עצמו ───── */
.cr-card{--u:calc(var(--k,1)*1cqw);container-type:inline-size;aspect-ratio:1/1.4142;width:100%;position:relative;overflow:hidden;background:var(--cr-paper,#fff);color:var(--cr-ink,#1a1a18);box-shadow:0 2px 0 rgba(26,26,24,.08),0 12px 28px rgba(26,26,24,.14);direction:rtl;font-family:var(--cr-sans,"IBM Plex Sans Hebrew",system-ui,sans-serif)}
.cr-card *{box-sizing:border-box}
.cr-card mark{background:linear-gradient(transparent 52%,var(--cr-marker,#ffe45c) 52%);color:inherit;padding:0 .1em}
.cr-in{position:absolute;inset:0;padding:7cqw 7cqw 6cqw;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:3cqw}
.cr-top{display:flex;justify-content:space-between;align-items:baseline;font-family:var(--cr-mono,"IBM Plex Mono","IBM Plex Sans Hebrew",monospace);font-size:calc(2.1*var(--u));letter-spacing:.06em;opacity:.8;gap:3cqw}
.cr-foot{display:flex;justify-content:space-between;align-items:end;font-size:calc(1.9*var(--u));opacity:.75;gap:3cqw;line-height:1.4}
.cr-foot b{font-weight:600}
.cr-serif{font-family:var(--cr-serif,"Frank Ruhl Libre","IBM Plex Sans Hebrew",serif)}
.cr-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
/* 1 טקסט על תמונה */
.cr-poster{background:#121212;color:#fff}
.cr-poster::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.35) 0%,rgba(0,0,0,0) 28%,rgba(0,0,0,.15) 52%,rgba(0,0,0,.86) 100%)}
.cr-poster .cr-in{z-index:1}
.cr-poster .cr-body{align-self:end;display:grid;gap:2.4cqw}
.cr-poster h3{font-size:calc(11*var(--u));line-height:.98;margin:0;font-weight:700;letter-spacing:-.01em;text-wrap:balance}
.cr-poster p{font-size:calc(3.4*var(--u));line-height:1.45;margin:0;max-width:78cqw;opacity:.92}
/* 2 שדה צבע */
.cr-gradient{color:#fff;background:radial-gradient(120% 90% at 85% 10%,var(--cr-c,#b8700f) 0%,transparent 55%),radial-gradient(110% 80% at 10% 95%,var(--cr-b,#a3261e) 0%,transparent 60%),linear-gradient(160deg,var(--cr-a,#1f3a68),#121212)}
.cr-gradient .cr-body{align-self:center;display:grid;gap:4cqw}
.cr-gradient h3{font-size:calc(9.6*var(--u));line-height:1.04;margin:0;font-weight:700;text-wrap:balance}
.cr-gradient p{font-size:calc(3.6*var(--u));line-height:1.5;margin:0;max-width:70cqw;opacity:.9}
.cr-gradient .cr-rule{width:18cqw;height:.7cqw;background:#fff;opacity:.85}
/* 3 שקיפות */
.cr-veil{background:#222}
.cr-veil .cr-in{z-index:1}
.cr-veil .cr-glass{align-self:center;justify-self:stretch;padding:6cqw;background:rgba(255,255,255,.62);backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2);border-top:.8cqw solid var(--cr-a,#1f3a68);display:grid;gap:2.6cqw;box-shadow:0 2cqw 6cqw rgba(0,0,0,.25)}
.cr-veil h3{font-size:calc(7.4*var(--u));line-height:1.08;margin:0;font-weight:700}
.cr-veil p{font-size:calc(3.3*var(--u));line-height:1.55;margin:0}
.cr-veil .cr-top,.cr-veil .cr-foot{color:#fff;text-shadow:0 1px 6px rgba(0,0,0,.6)}
/* 4 תובנה */
.cr-insight .cr-body{align-self:center;display:grid;gap:4.5cqw}
.cr-insight .cr-k{font-family:var(--cr-mono,"IBM Plex Mono",monospace);font-size:calc(2.4*var(--u));letter-spacing:.08em;color:var(--cr-accent,#1d7a4f);font-weight:600}
.cr-insight h3{font-size:calc(10*var(--u));line-height:1.06;margin:0;font-weight:700;text-wrap:balance}
.cr-insight p{font-size:calc(3.6*var(--u));line-height:1.6;margin:0;color:#55544f;max-width:74cqw;border-inline-start:.7cqw solid var(--cr-marker,#ffe45c);padding-inline-start:3cqw}
/* 5 ציטוט */
.cr-quote .cr-body{align-self:center;display:grid;gap:4cqw;position:relative}
.cr-quote .cr-qm{font-size:calc(40*var(--u));line-height:.6;color:var(--cr-a,#1f3a68);opacity:.14;position:absolute;top:-6cqw;right:-3cqw;font-family:var(--cr-serif,"Frank Ruhl Libre",serif)}
.cr-quote blockquote{margin:0;font-size:calc(8.4*var(--u));line-height:1.22;font-weight:700;position:relative;text-wrap:balance}
.cr-quote cite{font-style:normal;font-size:calc(2.8*var(--u));color:#55544f;border-top:.35cqw solid currentColor;padding-top:2cqw;display:block;max-width:60cqw}
.cr-quote cite b{color:#1a1a18;font-size:calc(3.4*var(--u));display:block}
/* 6 הייקו */
.cr-haiku{background:var(--cr-paper2,#f6f4ee)}
.cr-haiku .cr-body{align-self:center;justify-self:center;text-align:center;display:grid;gap:6cqw}
.cr-haiku .cr-lines{display:grid;gap:3.4cqw}
.cr-haiku .cr-lines span{font-size:calc(7.2*var(--u));line-height:1.2}
.cr-haiku .cr-lines span:nth-child(2){padding-inline-start:10cqw}
.cr-haiku .cr-lines span:nth-child(3){padding-inline-start:20cqw}
.cr-haiku .cr-seal{width:7cqw;height:7cqw;background:var(--cr-b,#a3261e);justify-self:center;opacity:.9}
.cr-haiku p{font-size:calc(2.6*var(--u));color:#85847e;margin:0;max-width:60cqw;justify-self:center}
/* 7 פוסט */
.cr-post{background:var(--cr-paper2,#f6f4ee)}
.cr-post .cr-body{align-self:center;min-height:0;max-height:100%;background:#fff;box-shadow:0 1.5cqw 5cqw rgba(26,26,24,.14);display:grid;grid-template-rows:auto auto auto;overflow:hidden}
.cr-post .cr-ph{display:flex;align-items:center;gap:2.4cqw;padding:3.4cqw 4cqw}
.cr-post .cr-av{width:7cqw;height:7cqw;background:var(--cr-a,#1f3a68);color:#fff;display:grid;place-items:center;font-size:calc(2.6*var(--u));font-weight:700;flex:none}
.cr-post .cr-ph b{font-size:calc(3*var(--u));display:block}.cr-post .cr-ph span{font-size:calc(2.2*var(--u));color:#85847e}
.cr-post .cr-pimg{width:100%;aspect-ratio:16/9;object-fit:cover;display:block}
.cr-post .cr-ptxt{padding:3.6cqw 4cqw 4.4cqw;font-size:calc(3.1*var(--u));line-height:1.55;display:grid;gap:1.6cqw}
.cr-post .cr-ptxt h3{font-size:calc(4.6*var(--u));margin:0;line-height:1.2}
.cr-post .cr-tags{color:var(--cr-a,#1f3a68);font-size:calc(2.6*var(--u))}
/* 8 ממה למה */
.cr-fromto .cr-body{align-self:center;display:grid;gap:5cqw}
.cr-fromto h3{font-size:calc(6.4*var(--u));line-height:1.1;margin:0;font-weight:700}
.cr-fromto .cr-ft{display:grid;grid-template-columns:minmax(0,1fr) 8cqw minmax(0,1fr);align-items:stretch}
.cr-fromto .cr-side{padding:4cqw 3.6cqw;display:grid;gap:2cqw;align-content:start}
.cr-fromto .cr-side.f{background:var(--cr-b-wash,#fbeceb);border-top:.8cqw solid var(--cr-b,#a3261e)}
.cr-fromto .cr-side.t{background:var(--cr-s-wash,#e4f3eb);border-top:.8cqw solid var(--cr-s,#1d7a4f)}
.cr-fromto .cr-side span{font-family:var(--cr-mono,"IBM Plex Mono",monospace);font-size:calc(2.2*var(--u));letter-spacing:.08em;font-weight:600}
.cr-fromto .cr-side.f span{color:var(--cr-b,#a3261e)}.cr-fromto .cr-side.t span{color:var(--cr-s,#1d7a4f)}
.cr-fromto .cr-side p{font-size:calc(3.7*var(--u));line-height:1.4;margin:0;font-weight:600}
.cr-fromto .cr-axis{position:relative}
.cr-fromto .cr-axis::before{content:"";position:absolute;top:50%;right:1.2cqw;left:1.2cqw;height:.45cqw;background:#1a1a18}
.cr-fromto .cr-axis::after{content:"";position:absolute;top:calc(50% - 1.5cqw);left:.6cqw;border:1.7cqw solid transparent;border-right:2.4cqw solid #1a1a18;border-left:0}
.cr-fromto .cr-pivot{font-size:calc(3.6*var(--u));line-height:1.55;margin:0;color:#55544f}
/* 9 מאמר */
.cr-essay .cr-in{grid-template-rows:auto auto minmax(0,1fr) auto}
.cr-essay .cr-eh{display:grid;gap:1.6cqw;border-bottom:.5cqw solid #1a1a18;padding-bottom:3cqw}
.cr-essay h3{font-size:calc(7.4*var(--u));line-height:1.02;margin:0;font-weight:700}
.cr-essay .cr-lead{font-size:calc(3*var(--u));line-height:1.5;margin:0;color:#55544f}
.cr-essay .cr-eimg{height:30cqw;width:100%;object-fit:cover;display:block}
.cr-essay .cr-cols{column-count:2;column-gap:5cqw;column-rule:.15cqw solid #e5e4e0;font-size:calc(2.55*var(--u));line-height:1.62;overflow:hidden;text-align:justify}
.cr-essay .cr-cols p{margin:0 0 1.8cqw}
.cr-essay .cr-cols p:first-child::first-letter{font-family:var(--cr-serif,"Frank Ruhl Libre",serif);float:right;font-size:calc(8.6*var(--u));line-height:.8;padding-inline-end:1.4cqw;padding-top:.6cqw;font-weight:700}

/* הדפסה: רק היצירות שנבחרו, גיליון A4 לכל יצירה */
.cr-print{display:none}
@media print{
  html.cr-printing body>*:not(.cr-print){display:none!important}
  html.cr-printing .cr-print{display:block}
  html.cr-printing .cr-print .cr-card{width:210mm;height:297mm;aspect-ratio:auto;box-shadow:none;break-after:page;page-break-after:always}
  html.cr-printing body{margin:0;background:#fff}
  @page{size:A4;margin:0}
}
/* מצב צילום: יצירה אחת במסך, לייצוא PNG */
html.cr-shot body>*:not(.cr-shot-stage){display:none!important}
.cr-shot-stage{position:fixed;inset:0;background:#fff;display:grid;place-items:start;z-index:99999}
.cr-shot-stage .cr-card{width:1240px;box-shadow:none}

/* ───── הדף: כתבות ───── */
.ar-head{display:grid;gap:8px;margin:0 0 14px}
.ar-head h1{font-size:clamp(28px,3.4vw,46px);font-weight:700;line-height:1.05;margin:0;letter-spacing:-.01em}
.ar-lines{display:grid;gap:3px;margin:2px 0 0;padding:0;list-style:none;font-size:15px;line-height:1.5;color:#55544f}
.ar-lines strong{color:#1a1a18;font-weight:700}
.ar-lines .ar-lk{color:#1a1a18;font-family:var(--cr-mono,"IBM Plex Mono","IBM Plex Sans Hebrew",monospace);font-size:11.5px;letter-spacing:.06em;display:inline-block;min-width:66px}
.ar-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 18px;margin:8px 0 6px}
.ar-new{min-width:180px;padding:11px 22px;font-size:15px;font-weight:600}
.ar-zone{margin:30px 0 10px}
.ar-zh{display:flex;align-items:center;gap:10px;margin:0 0 16px;padding-top:12px;border-top:2px solid #1a1a18;font-size:clamp(19px,1.8vw,24px);line-height:1.2}
.ar-zh svg{width:20px;height:20px;fill:none;stroke:var(--cr-accent,#1f3a68);stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
.ar-zh span{font-family:var(--cr-mono,"IBM Plex Mono",monospace);font-size:12px;font-weight:500;color:#85847e}
.ar-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:40px 30px;align-items:start}
@media (max-width:1040px){.ar-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:640px){.ar-grid{grid-template-columns:minmax(0,1fr);gap:34px}}
.ar-item.cr-room{margin:0;padding:0;border:0;display:grid;gap:12px;min-width:0}
.ar-acts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.ar-acts .cr-btn{padding:9px 6px;font-size:13px;line-height:1.2;min-height:40px}
.ar-more>summary{cursor:pointer;font-size:13px;color:#55544f;list-style:none;padding:2px 0;text-decoration:underline;text-decoration-color:#b5b4ae;text-underline-offset:4px}
.ar-more>summary::-webkit-details-marker{display:none}
.ar-more>summary:hover{color:#1a1a18}
.ar-more[open]>summary{color:#1a1a18;font-weight:600;text-decoration:none}
.ar-more .cr-acts{margin:10px 0;min-width:0}
.ar-more .cr-grid{grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:10px}
.ar-more .cr-item-ft{grid-template-columns:minmax(0,1fr)}
.ar-more .cr-item-ft .cr-lbl{display:none}
/* היוצר: פאנל בתוך הדף, מתחת לכותרת */
.ar-comp{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(260px,.9fr);grid-template-areas:"art list";gap:26px;margin:14px 0 8px;padding:20px;background:#f6f5f1;box-shadow:inset 0 1px 0 rgba(26,26,24,.05)}
.ar-comp[hidden]{display:none}
.ar-comp-art{grid-area:art;display:grid;gap:12px;align-content:start;min-width:0}
.ar-comp-art .ar-sheet{max-width:620px}
.ar-comp-art .ar-acts{max-width:620px}
.ar-comp-ph{display:grid;place-items:center;aspect-ratio:1/1.4142;max-width:620px;background:#fff;color:#85847e;font-size:15px;text-align:center;padding:24px;box-shadow:0 2px 0 rgba(26,26,24,.06),0 12px 28px rgba(26,26,24,.10)}
.ar-comp-list{grid-area:list;display:grid;grid-template-rows:auto auto minmax(0,1fr);gap:10px;min-width:0;max-height:min(1000px,calc(100vh - 120px));position:sticky;top:12px}
.ar-comp-list h3{margin:0;font-size:17px}
.ar-comp-tools{display:grid;grid-template-columns:minmax(0,1fr) 104px;gap:6px}
.ar-search{position:relative;display:block}
.ar-search input{font:inherit;font-size:14px;width:100%;box-sizing:border-box;padding:9px 36px 9px 12px;border:1px solid #cfcdc6;border-radius:0;background:#fff;color:#1a1a18}
.ar-search input:focus{outline:2px solid var(--cr-accent,#1f3a68);outline-offset:0;border-color:transparent}
.ar-search input::-webkit-search-cancel-button{display:none}
.ar-x{all:unset;position:absolute;left:8px;top:50%;transform:translateY(-50%);width:22px;height:22px;display:grid;place-items:center;color:#a5a49e;font-size:18px;line-height:1;cursor:pointer}
.ar-x:hover{color:#55544f}
.ar-x[hidden]{display:none}
.ar-srcs{overflow:auto;min-height:0;display:grid;gap:4px;align-content:start;padding:2px 2px 6px}
.ar-srcs h4{margin:10px 0 2px;font-family:var(--cr-mono,"IBM Plex Mono","IBM Plex Sans Hebrew",monospace);font-size:11px;letter-spacing:.06em;color:var(--cr-accent,#1f3a68);display:flex;gap:6px;align-items:center}
.ar-srcs h4 svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.4}
.ar-src{all:unset;box-sizing:border-box;display:grid;gap:2px;padding:9px 12px;background:#fff;cursor:pointer;box-shadow:0 1px 0 rgba(26,26,24,.05),0 2px 6px rgba(26,26,24,.06);transition:transform .15s,box-shadow .15s}
.ar-src:hover{transform:translateY(-1px);box-shadow:0 2px 0 rgba(26,26,24,.06),0 8px 16px rgba(26,26,24,.10)}
.ar-src:active{transform:translateY(1px);box-shadow:none}
.ar-src:focus-visible{outline:2px solid var(--cr-accent,#1f3a68);outline-offset:2px}
.ar-src b{font-size:14px;font-weight:600;line-height:1.3}
.ar-src span{font-size:12px;color:#85847e;line-height:1.35}
.ar-src.on{background:#1a1a18;color:#fff}.ar-src.on span{color:#c9c8c2}
.ar-none{color:#85847e;font-size:13px;margin:6px 2px}
@media (max-width:860px){.ar-comp{grid-template-columns:minmax(0,1fr);grid-template-areas:"list" "art";padding:14px}.ar-comp-list{position:static;max-height:none}.ar-srcs{max-height:300px}}
@media (max-width:640px){.ar-new{width:100%}.ar-lines .ar-lk{min-width:0;display:block}}
.ar-lbw{width:min(92vw,calc(92vh/1.4142))}
.ar-lbw .ar-sheet{box-shadow:0 30px 80px rgba(0,0,0,.5)}
app-article{display:block;direction:rtl}
.ar-msg{padding:20px;background:#f6f5f1;color:#55544f;font-size:14px}

/* ───── הכתבה: גיליון A4 אחד, נמדד ביחידות של עצמו ───── */
.ar-sheet{--u:calc(var(--k,1)*1cqw);--ar-ink:var(--cr-ink,#1a1a18);--ar-mute:#5d5c56;--ar-rule:#d9d7cf;--ar-paper:var(--cr-paper,#fff);--ar-serif:var(--cr-serif,"Frank Ruhl Libre","IBM Plex Sans Hebrew",serif);--ar-sans:var(--cr-sans,"IBM Plex Sans Hebrew",system-ui,sans-serif);--ar-mono:var(--cr-mono,"IBM Plex Mono","IBM Plex Sans Hebrew",monospace);
  container-type:inline-size;aspect-ratio:1/1.4142;width:100%;position:relative;overflow:hidden;background:var(--ar-paper);color:var(--ar-ink);direction:rtl;font-family:var(--ar-sans);box-shadow:0 2px 0 rgba(26,26,24,.08),0 14px 34px rgba(26,26,24,.16);text-align:start}
.ar-sheet *{box-sizing:border-box}
.ar-sheet p,.ar-sheet h2,.ar-sheet h3,.ar-sheet blockquote,.ar-sheet figure,.ar-sheet ol,.ar-sheet ul{margin:0;padding:0}
.ar-sheet ol,.ar-sheet ul{list-style:none}
.ar-sheet [hidden]{display:none!important}
.ar-sheet b,.ar-sheet strong{font-weight:700}
.ar-sheet mark{background:linear-gradient(transparent 46%,var(--cr-marker,#ffe45c) 46%,var(--cr-marker,#ffe45c) 94%,transparent 94%);color:inherit;padding:0 .12em;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.ar-in{position:absolute;inset:0;display:grid;min-height:0;min-width:0}
.ar-fit{min-height:0;min-width:0;overflow:hidden}
.ar-img{display:block;width:100%;height:100%;object-fit:cover}
.ar-kicker{font-family:var(--ar-mono);font-size:calc(1.55*var(--u));letter-spacing:.08em;font-weight:600;display:block}
.ar-title{font-family:var(--ar-serif);font-weight:700;letter-spacing:-.01em;text-wrap:balance}
.ar-lead{text-wrap:pretty}
.ar-lbl{font-family:var(--ar-mono);font-size:calc(1.3*var(--u));letter-spacing:.1em;font-weight:600;display:block;color:var(--cr-accent,var(--cr-a,#1f3a68))}
.ar-credit{font-size:calc(1.15*var(--u));line-height:1.35;color:var(--ar-mute);display:block}
.ar-body p{text-wrap:pretty}
.ar-quote blockquote{font-family:var(--ar-serif);font-weight:500;text-wrap:balance}
.ar-quote figcaption{display:grid;gap:.3cqw;font-size:calc(1.35*var(--u));line-height:1.35;color:var(--ar-mute)}
.ar-quote figcaption b{color:var(--ar-ink);font-size:calc(1.6*var(--u))}
.ar-insight{display:grid;gap:1.1cqw}
.ar-ins-t{font-weight:700;line-height:1.25;text-wrap:balance}
.ar-ins-x{line-height:1.5}
.ar-ft{display:grid;gap:1.2cqw}
.ar-ft-h{font-weight:700;line-height:1.2}
.ar-ft-row{display:grid;grid-template-columns:minmax(0,1fr) 4.6cqw minmax(0,1fr);align-items:stretch}
.ar-ft-s{display:grid;gap:.6cqw;align-content:start;padding:1.6cqw 1.8cqw}
.ar-ft-s span{font-family:var(--ar-mono);font-size:calc(1.2*var(--u));letter-spacing:.06em;font-weight:600}
.ar-ft-s p{font-size:calc(1.65*var(--u));line-height:1.38;font-weight:500}
.ar-ft-s.f{background:var(--cr-b-wash,#fbeceb);border-top:.45cqw solid var(--cr-b,#a3261e)}.ar-ft-s.f span{color:var(--cr-b,#a3261e)}
.ar-ft-s.t{background:var(--cr-s-wash,#e4f3eb);border-top:.45cqw solid var(--cr-s,#1d7a4f)}.ar-ft-s.t span{color:var(--cr-s,#1d7a4f)}
.ar-ft-ar{display:grid;place-items:center}
.ar-ft-ar svg{width:3.4cqw;height:3.4cqw;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.ar-ft-x{font-size:calc(1.55*var(--u));line-height:1.5;color:var(--ar-mute)}
.ar-haiku{display:grid;gap:1.4cqw;align-content:center}
.ar-hk-l{display:grid;gap:.7cqw;font-family:var(--ar-serif)}
.ar-hk-l span{display:block;font-size:calc(2.3*var(--u));line-height:1.25}
.ar-hk-l span:nth-child(2){padding-inline-start:3cqw}.ar-hk-l span:nth-child(3){padding-inline-start:6cqw}
.ar-haiku p{font-size:calc(1.25*var(--u));line-height:1.45;color:var(--ar-mute)}
.ar-foot{display:flex;justify-content:space-between;align-items:baseline;gap:3cqw;font-family:var(--ar-mono);font-size:calc(1.25*var(--u));letter-spacing:.04em;line-height:1.3}
.ar-foot b{font-family:var(--ar-sans);font-weight:700;letter-spacing:0}
.ar-num{font-weight:700}

/* 1 magazine: תמונה מלאה בשליש העליון, כותרת על גרדיינט כהה, גוף בשתי עמודות */
.ar-L-magazine .ar-in{grid-template-rows:minmax(52cqw,1fr) auto auto}
.ar-mg-hero{position:relative;background:radial-gradient(120% 90% at 85% 0%,var(--cr-c,#b8700f) 0%,transparent 55%),radial-gradient(100% 90% at 0% 100%,var(--cr-b,#a3261e) 0%,transparent 60%),linear-gradient(160deg,var(--cr-a,#1f3a68),#101012)}
.ar-mg-hero .ar-img{position:absolute;inset:0}
.ar-mg-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.42) 0%,rgba(0,0,0,0) 22%,rgba(0,0,0,.08) 40%,rgba(0,0,0,.62) 66%,rgba(0,0,0,.92) 100%);pointer-events:none}
.ar-mg-cap{position:absolute;inset:auto 0 0 0;z-index:1;padding:0 7cqw 5cqw;color:#fff;display:grid;gap:1.8cqw}
.ar-mg-cap .ar-kicker{color:#fff;opacity:.88}
.ar-mg-cap .ar-kicker::before{content:"";display:inline-block;width:5cqw;height:.45cqw;background:var(--cr-marker,#ffe45c);vertical-align:middle;margin-inline-end:1.6cqw}
.ar-mg-cap .ar-title{font-size:calc(7.6*var(--u));line-height:1.02;text-shadow:0 .3cqw 2.4cqw rgba(0,0,0,.35)}
.ar-mg-cap .ar-lead{font-size:calc(2.3*var(--u));line-height:1.45;max-width:78cqw;opacity:.94}
.ar-mg-hero .ar-credit{position:absolute;top:3cqw;left:4cqw;z-index:1;color:#fff;opacity:.78;max-width:54cqw;text-align:left;font-size:calc(1.05*var(--u));text-shadow:0 1px 4px rgba(0,0,0,.6)}
.ar-mg-main{display:grid;grid-template-rows:auto auto auto auto;gap:2.6cqw;padding:4.2cqw 7cqw 2.6cqw}
.ar-L-magazine .ar-quote{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:1cqw 4cqw;align-items:end;border-top:.35cqw solid var(--ar-ink);border-bottom:.12cqw solid var(--ar-ink);padding:2.2cqw 0 2cqw}
.ar-L-magazine .ar-quote blockquote{font-size:calc(3.3*var(--u));line-height:1.28}
.ar-L-magazine .ar-quote figcaption{max-width:30cqw;text-align:end}
.ar-mg-body.ar-2c{column-count:2;column-gap:5cqw;column-rule:.12cqw solid var(--ar-rule)}
.ar-mg-body{font-size:calc(1.72*var(--u));line-height:1.62;text-align:justify}
.ar-mg-body p{margin-bottom:1.3cqw}
.ar-mg-body p.ar-dc::first-letter{font-family:var(--ar-serif);float:right;font-size:calc(5.4*var(--u));line-height:.82;padding-inline-end:1cqw;padding-top:.5cqw;font-weight:700;color:var(--cr-a,#1f3a68)}
.ar-L-magazine .ar-insight{background:color-mix(in srgb,var(--cr-marker,#ffe45c) 22%,#fff);padding:2.2cqw 2.8cqw;border-inline-start:1cqw solid var(--cr-marker,#ffe45c)}
.ar-L-magazine .ar-ins-t{font-size:calc(2.75*var(--u))}
.ar-L-magazine .ar-ins-x{font-size:calc(1.6*var(--u));color:var(--ar-mute)}
.ar-mg-row{display:flex;gap:3cqw;align-items:stretch}
.ar-mg-row>.ar-ft{flex:1.75 1 0;min-width:0}
.ar-mg-row>.ar-haiku:only-child{flex:0 1 46%;margin-inline-start:auto}
.ar-mg-row>.ar-haiku{flex:1 1 0;min-width:0;background:var(--cr-paper2,#f4f2ec);padding:2.2cqw 2.6cqw;position:relative}
.ar-mg-row>.ar-haiku::after{content:"";position:absolute;top:2.2cqw;left:2.4cqw;width:2.2cqw;height:2.2cqw;background:var(--cr-b,#a3261e);opacity:.85}
.ar-L-magazine .ar-ft-h{font-size:calc(2*var(--u))}
.ar-L-magazine .ar-foot{padding:2.2cqw 7cqw 3.6cqw;border-top:.12cqw solid var(--ar-rule);margin:0 7cqw;padding-inline:0;color:var(--ar-mute)}

/* 2 daf: צורת הדף. טקסט במרכז, פרשנות משני הצדדים, הכרעה למטה */
.ar-L-daf{--ar-paper:#fbf8f0;--ar-serif:"Frank Ruhl Libre","IBM Plex Sans Hebrew",serif;--ar-rule:#cbbfa6;font-family:var(--ar-serif)}
.ar-L-daf .ar-in{grid-template-rows:auto minmax(0,1fr) auto;padding:6.5cqw 6.5cqw 4cqw;gap:2.6cqw}
.ar-df-head{display:grid;gap:2.2cqw;text-align:center}
.ar-df-run{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);align-items:baseline;font-family:var(--ar-mono);font-size:calc(1.3*var(--u));letter-spacing:.08em;color:var(--ar-mute);border-bottom:.12cqw solid var(--ar-ink);padding-bottom:1.2cqw;box-shadow:0 .55cqw 0 -.4cqw var(--ar-ink)}
.ar-df-run span:first-child{text-align:start}.ar-df-run span:last-child{text-align:end}
.ar-df-run b{font-family:var(--ar-serif);font-size:calc(1.8*var(--u));letter-spacing:0;color:var(--ar-ink)}
.ar-L-daf .ar-title{font-size:calc(6.4*var(--u));line-height:1.05;font-weight:900}
.ar-L-daf .ar-lead{font-size:calc(2.05*var(--u));line-height:1.45;color:var(--ar-mute);max-width:72cqw;margin-inline:auto}
.ar-df-page{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr) auto;grid-template-areas:"r c l" "r d l";min-height:0;border-top:.12cqw solid var(--ar-ink);border-bottom:.12cqw solid var(--ar-ink);padding:2.4cqw 0}
.ar-df-r{grid-area:r;padding-inline-end:2.4cqw;border-inline-end:.12cqw solid var(--ar-rule);display:grid;align-content:start;gap:2.2cqw}
.ar-df-l{grid-area:l;padding-inline-start:2.4cqw;border-inline-start:.12cqw solid var(--ar-rule);display:grid;align-content:start;gap:2.2cqw}
.ar-df-c{grid-area:c;padding:0 2.6cqw;display:grid;grid-template-rows:minmax(22cqw,1fr) auto;gap:1.8cqw}
.ar-df-c:not(:has(.ar-df-vig)){grid-template-rows:auto}
.ar-df-d{grid-area:d;padding:2.2cqw 2.6cqw 0;margin-top:1cqw;border-top:.12cqw solid var(--ar-ink)}
.ar-df-lbl{font-family:var(--ar-serif);font-weight:900;font-size:calc(1.8*var(--u));display:block;text-align:center;border-bottom:.12cqw solid var(--ar-rule);padding-bottom:.8cqw;margin-bottom:.4cqw;letter-spacing:.02em}
.ar-df-vig{border:.14cqw solid var(--ar-ink);padding:.9cqw;background:#fff;box-shadow:0 0 0 .6cqw var(--ar-paper),0 0 0 .74cqw var(--ar-ink)}
.ar-df-vig{display:grid;grid-template-rows:minmax(0,1fr) auto;min-height:0}
.ar-df-vig .ar-img{height:100%;min-height:0}
.ar-df-vig .ar-credit{font-family:var(--ar-sans);padding-top:.8cqw;text-align:center}
.ar-df-c .ar-body{font-size:calc(1.95*var(--u));line-height:1.58;text-align:justify;display:grid;gap:1.1cqw}
.ar-df-open{float:right;font-weight:900;font-size:calc(3.1*var(--u));line-height:1;border:.18cqw solid var(--ar-ink);padding:.9cqw 1.2cqw .7cqw;margin:.4cqw 0 .4cqw 1.2cqw;background:#fff;box-shadow:.5cqw .5cqw 0 var(--cr-a,#1f3a68)}
.ar-L-daf .ar-quote{display:grid;gap:1cqw}
.ar-L-daf .ar-quote blockquote{font-size:calc(1.62*var(--u));line-height:1.5;font-weight:400;text-align:justify;text-wrap:pretty}
.ar-L-daf .ar-quote figcaption{font-family:var(--ar-sans);font-size:calc(1.12*var(--u))}
.ar-L-daf .ar-quote figcaption b{font-size:calc(1.35*var(--u))}
.ar-L-daf .ar-ft-h{font-size:calc(1.7*var(--u))}
.ar-L-daf .ar-ft-row{grid-template-columns:minmax(0,1fr);gap:0}
.ar-L-daf .ar-ft-ar{height:3.6cqw}.ar-L-daf .ar-ft-ar svg{transform:rotate(-90deg)}
.ar-L-daf .ar-ft-s p{font-size:calc(1.5*var(--u))}
.ar-L-daf .ar-ft-x{font-size:calc(1.4*var(--u));text-align:justify}
.ar-L-daf .ar-haiku{border-top:.12cqw solid var(--ar-rule);padding-top:1.6cqw;text-align:center}
.ar-L-daf .ar-hk-l span{font-size:calc(1.85*var(--u))}
.ar-L-daf .ar-hk-l span:nth-child(n){padding:0}
.ar-L-daf .ar-insight{text-align:center;gap:1cqw}
.ar-L-daf .ar-insight .ar-lbl{font-family:var(--ar-serif);font-size:calc(1.5*var(--u));letter-spacing:.04em;color:var(--cr-s,#1d7a4f);font-weight:900}
.ar-L-daf .ar-ins-t{font-size:calc(2.7*var(--u));color:var(--cr-s,#1d7a4f);font-weight:900}
.ar-L-daf .ar-ins-x{font-size:calc(1.6*var(--u));color:var(--ar-mute)}
.ar-L-daf .ar-foot{color:var(--ar-mute);padding-top:.6cqw}

/* 3 herbarium: גיליון הרבריום על נייר שמנת. דגימה מוצמדת, תווית הרכבה, כיתוב בוטני */
.ar-L-herbarium{--ar-paper:#f3eee1;--ar-ink:#2a2822;--ar-mute:#6b665a;--ar-rule:#c9bfa8;background-image:radial-gradient(130% 90% at 50% 40%,rgba(255,255,255,.55),rgba(255,255,255,0) 70%)}
.ar-L-herbarium .ar-in{grid-template-rows:auto minmax(50cqw,1fr) auto auto;padding:6cqw 7cqw 4cqw;gap:2.8cqw}
.ar-hb-head{display:grid;gap:1.6cqw}
.ar-hb-run{display:flex;justify-content:space-between;font-family:var(--ar-mono);font-size:calc(1.25*var(--u));letter-spacing:.1em;color:var(--ar-mute);border-bottom:.1cqw solid var(--ar-ink);padding-bottom:1cqw}
.ar-L-herbarium .ar-title{font-size:calc(5.6*var(--u));line-height:1.06;font-weight:500}
.ar-L-herbarium .ar-lead{font-family:var(--ar-serif);font-size:calc(2*var(--u));line-height:1.45;color:var(--ar-mute)}
.ar-hb-mount{position:relative;padding:1cqw 1cqw 0}
.ar-hb-mat{position:absolute;inset:1cqw 5cqw 2cqw;background:#fffdf7;padding:3cqw;box-shadow:0 .2cqw .4cqw rgba(60,50,30,.12),0 2cqw 4.5cqw rgba(60,50,30,.18)}
.ar-hb-mat .ar-img{filter:sepia(.12) saturate(.92) contrast(1.02)}
.ar-hb-mat i{position:absolute;width:9cqw;height:2.4cqw;background:rgba(236,228,206,.82);box-shadow:0 .1cqw .3cqw rgba(0,0,0,.08)}
.ar-hb-mat i:nth-of-type(1){top:-.8cqw;right:6cqw;transform:rotate(-4deg)}
.ar-hb-mat i:nth-of-type(2){top:-.8cqw;left:6cqw;transform:rotate(5deg)}
.ar-hb-mat i:nth-of-type(3){bottom:-.8cqw;left:40%;transform:rotate(-2deg)}
.ar-hb-mat.txt{display:grid;place-items:center;text-align:center}
.ar-hb-mat.txt .ar-hk-l span{font-size:calc(4.4*var(--u));padding:0!important}
.ar-hb-mat.txt .ar-quote{display:grid;gap:2cqw;max-width:70cqw}.ar-hb-mat.txt .ar-quote blockquote{font-size:calc(3.6*var(--u));line-height:1.35}
.ar-hb-label{position:absolute;bottom:0;left:2cqw;width:40cqw;background:#fffef9;border:.12cqw solid var(--ar-ink);padding:1.6cqw 2cqw;display:grid;gap:.6cqw;box-shadow:0 .8cqw 2cqw rgba(60,50,30,.16)}
.ar-hb-label .ar-lbl{color:var(--ar-ink);font-size:calc(1.2*var(--u))}
.ar-hb-label b{font-family:var(--ar-serif);font-size:calc(1.75*var(--u));line-height:1.25;font-weight:700}
.ar-hb-label .ar-credit{border-top:.1cqw solid var(--ar-rule);padding-top:.6cqw}
.ar-hb-notes{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:4.4cqw;min-height:0;border-top:.1cqw solid var(--ar-ink);padding-top:2.4cqw}
.ar-hb-c1 .ar-body{font-family:var(--ar-serif);font-size:calc(1.82*var(--u));line-height:1.6;display:grid;gap:1.2cqw;text-align:justify}
.ar-hb-c1 .ar-body p::before{content:"§ ";color:var(--cr-s,#5b7f3a);font-weight:700}
.ar-hb-c2{display:grid;align-content:start;gap:2.2cqw;border-inline-start:.1cqw solid var(--ar-rule);padding-inline-start:3.4cqw}
.ar-L-herbarium .ar-quote{display:grid;gap:.9cqw}
.ar-L-herbarium .ar-quote blockquote{font-size:calc(1.95*var(--u));line-height:1.45}
.ar-L-herbarium .ar-insight .ar-lbl,.ar-L-herbarium .ar-ft .ar-lbl{color:var(--cr-s,#5b7f3a)}
.ar-L-herbarium .ar-ins-t{font-size:calc(2.05*var(--u))}
.ar-L-herbarium .ar-ins-x{font-size:calc(1.5*var(--u));color:var(--ar-mute)}
.ar-L-herbarium .ar-ft-h{font-size:calc(1.7*var(--u))}
.ar-L-herbarium .ar-ft-s{padding:1.2cqw 1.3cqw}
.ar-L-herbarium .ar-ft-s p{font-size:calc(1.45*var(--u))}
.ar-L-herbarium .ar-ft-x{font-size:calc(1.35*var(--u))}
.ar-L-herbarium .ar-haiku{text-align:start}
.ar-L-herbarium .ar-hk-l span{font-size:calc(1.9*var(--u))}
.ar-L-herbarium .ar-foot{border-top:.1cqw solid var(--ar-ink);padding-top:1.4cqw;color:var(--ar-mute)}

/* 4 atlas: לוח מדעי. מסגרת קו כפולה, איור עם סרגלי מספור, טור הערות ממוספר */
.ar-L-atlas{--ar-paper:#fbfaf6;--ar-rule:#cfd2cc;--ar-mute:#575a57}
.ar-L-atlas::before{content:"";position:absolute;inset:3.6cqw;border:.32cqw solid var(--ar-ink);box-shadow:inset 0 0 0 .8cqw var(--ar-paper),inset 0 0 0 .92cqw var(--ar-ink);pointer-events:none}
.ar-L-atlas .ar-in{grid-template-rows:auto minmax(46cqw,1fr) auto auto;padding:8.2cqw 8.4cqw 6.6cqw;gap:2.8cqw}
.ar-at-head{display:grid;grid-template-columns:auto minmax(0,1fr);gap:3.4cqw;align-items:start}
.ar-at-no{display:grid;justify-items:center;border:.25cqw solid var(--ar-ink);padding:1cqw 1.8cqw 1.2cqw;min-width:12cqw}
.ar-at-no span{font-family:var(--ar-mono);font-size:calc(1.2*var(--u));letter-spacing:.14em}
.ar-at-no b{font-family:var(--ar-mono);font-size:calc(5*var(--u));line-height:1;font-weight:600;color:var(--cr-a,#1f3a68)}
.ar-at-tt{display:grid;gap:1.2cqw}
.ar-L-atlas .ar-kicker{color:var(--cr-s,#2f7a55)}
.ar-L-atlas .ar-title{font-size:calc(5.3*var(--u));line-height:1.05}
.ar-L-atlas .ar-lead{font-size:calc(1.9*var(--u));line-height:1.45;color:var(--ar-mute)}
.ar-at-fig{display:grid;grid-template-columns:3cqw minmax(0,1fr);grid-template-rows:3cqw minmax(0,1fr) auto;gap:0;min-height:0}
.ar-at-rt{grid-column:2;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:end;background:repeating-linear-gradient(to left,var(--ar-ink) 0 .12cqw,transparent .12cqw 2.12cqw) bottom/100% 1cqw no-repeat;border-bottom:.15cqw solid var(--ar-ink)}
.ar-at-rt span,.ar-at-rs span{font-family:var(--ar-mono);font-size:calc(1.15*var(--u));color:var(--ar-ink);font-weight:600}
.ar-at-rt span{padding:0 .5cqw 1.2cqw;border-inline-start:.15cqw solid var(--ar-ink)}
.ar-at-rs{grid-row:2;grid-column:1;display:grid;grid-template-rows:repeat(4,minmax(0,1fr));justify-items:center;background:repeating-linear-gradient(to bottom,var(--ar-ink) 0 .12cqw,transparent .12cqw 2.12cqw) left/1cqw 100% no-repeat;border-left:.15cqw solid var(--ar-ink)}
.ar-at-rs span{padding-top:.5cqw;border-top:.15cqw solid var(--ar-ink);width:100%;text-align:center}
.ar-at-img{grid-row:2;grid-column:2;min-height:0;position:relative;background:#e9ebe6;overflow:hidden}
.ar-at-img::after{content:"";position:absolute;inset:0;box-shadow:inset 0 0 0 .15cqw var(--ar-ink)}
.ar-at-img.txt{display:grid;place-items:center;padding:6cqw;background:linear-gradient(160deg,var(--cr-a,#1f3a68),#0f1a26);color:#fff;text-align:center}
.ar-at-img.txt .ar-ins-t{font-size:calc(4.4*var(--u));line-height:1.18}
.ar-at-img.txt mark{color:#17191c}
.ar-at-fig figcaption{grid-row:3;grid-column:2;padding-top:1.1cqw;font-size:calc(1.15*var(--u));color:var(--ar-mute);display:flex;gap:1.4cqw;align-items:baseline}
.ar-at-fig figcaption b{font-family:var(--ar-mono);color:var(--ar-ink);font-size:calc(1.2*var(--u));white-space:nowrap}
.ar-at-fig figcaption .ar-credit{display:inline}
.ar-at-notes{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1fr);gap:4cqw;min-height:0;border-top:.15cqw solid var(--ar-ink);padding-top:2.2cqw}
.ar-at-list{display:grid;gap:1.3cqw;align-content:start;counter-reset:n}
.ar-at-list .ar-lbl,.ar-at-side>.ar-lbl{color:var(--ar-ink);border-bottom:.12cqw solid var(--ar-rule);padding-bottom:.6cqw}
.ar-at-list li{counter-increment:n;display:grid;grid-template-columns:3.6cqw minmax(0,1fr);gap:1cqw;font-size:calc(1.68*var(--u));line-height:1.55}
.ar-at-list li::before{content:counter(n);font-family:var(--ar-mono);font-weight:600;color:var(--cr-a,#1f3a68);font-size:calc(1.4*var(--u));border:.14cqw solid currentColor;border-radius:50%;width:3cqw;height:3cqw;display:grid;place-items:center;margin-top:.2cqw}
.ar-at-side{display:grid;align-content:start;gap:2.1cqw;border-inline-start:.12cqw solid var(--ar-rule);padding-inline-start:3.4cqw}
.ar-L-atlas .ar-quote{display:grid;gap:.9cqw;border-inline-start:.5cqw solid var(--cr-s,#2f7a55);padding-inline-start:2cqw}
.ar-L-atlas .ar-quote blockquote{font-size:calc(1.95*var(--u));line-height:1.42}
.ar-L-atlas .ar-ins-t{font-size:calc(2.1*var(--u))}
.ar-L-atlas .ar-ins-x{font-size:calc(1.5*var(--u));color:var(--ar-mute)}
.ar-L-atlas .ar-ft-h{font-size:calc(1.65*var(--u))}
.ar-L-atlas .ar-ft-s{padding:1.2cqw 1.3cqw}
.ar-L-atlas .ar-ft-s p{font-size:calc(1.42*var(--u))}
.ar-L-atlas .ar-ft-x{font-size:calc(1.32*var(--u))}
.ar-L-atlas .ar-haiku{border:.12cqw solid var(--ar-rule);padding:1.4cqw 1.8cqw}
.ar-L-atlas .ar-hk-l span{font-size:calc(1.85*var(--u))}
.ar-L-atlas .ar-foot{color:var(--ar-mute);border-top:.12cqw solid var(--ar-ink);padding-top:1.3cqw}

/* 5 blueprint: גיליון שרטוט. רשת בהירה, קו כחול, פרט עם קנה מידה, טבלת כותרת בפינה */
.ar-L-blueprint{--bp:var(--cr-bp,#17375e);--ar-ink:var(--bp);--ar-mute:#4b6283;--ar-rule:#b7c6d9;--ar-paper:#f5f8fb;background-image:linear-gradient(rgba(23,55,94,.10) .1cqw,transparent .1cqw),linear-gradient(90deg,rgba(23,55,94,.10) .1cqw,transparent .1cqw),linear-gradient(rgba(23,55,94,.045) .08cqw,transparent .08cqw),linear-gradient(90deg,rgba(23,55,94,.045) .08cqw,transparent .08cqw);background-size:10cqw 10cqw,10cqw 10cqw,2cqw 2cqw,2cqw 2cqw;background-position:-.05cqw -.05cqw}
.ar-L-blueprint::before{content:"";position:absolute;inset:3.4cqw;border:.38cqw solid var(--bp);pointer-events:none}
.ar-L-blueprint .ar-in{grid-template-rows:auto minmax(40cqw,1fr) auto auto;padding:7.4cqw 7.4cqw 3.4cqw;gap:2.8cqw}
.ar-bp-head{display:grid;gap:1.2cqw;border-bottom:.38cqw solid var(--bp);padding-bottom:2cqw}
.ar-L-blueprint .ar-kicker{color:var(--bp)}
.ar-L-blueprint .ar-title{font-family:var(--ar-sans);font-size:calc(5.8*var(--u));line-height:1.02;font-weight:700;letter-spacing:-.02em}
.ar-L-blueprint .ar-lead{font-size:calc(1.9*var(--u));line-height:1.45;color:var(--ar-mute);max-width:80cqw}
.ar-bp-det{display:grid;grid-template-rows:minmax(0,1fr) auto;gap:1.2cqw;min-height:0;position:relative}
.ar-bp-img{position:relative;min-height:0;border:.25cqw solid var(--bp);background:#fff;overflow:hidden}
.ar-bp-img .ar-img{filter:grayscale(.15) contrast(1.04)}
.ar-bp-img::after{content:"";position:absolute;inset:0;background:linear-gradient(transparent 49.9%,rgba(23,55,94,.25) 50%,transparent 50.1%),linear-gradient(90deg,transparent 49.9%,rgba(23,55,94,.25) 50%,transparent 50.1%);pointer-events:none}
.ar-bp-img.txt{display:grid;place-items:center;padding:5cqw;text-align:center;background:#fff}
.ar-bp-img.txt .ar-ins-t{font-size:calc(4*var(--u))}
.ar-bp-tag{position:absolute;top:-2.4cqw;left:4cqw;width:6.6cqw;height:6.6cqw;border-radius:50%;background:var(--ar-paper);border:.3cqw solid var(--bp);display:grid;place-items:center;font-family:var(--ar-mono);font-weight:600;font-size:calc(2.4*var(--u));color:var(--bp);z-index:1}
.ar-bp-det figcaption{display:flex;align-items:center;gap:2cqw;font-size:calc(1.2*var(--u));color:var(--ar-mute)}
.ar-bp-det figcaption b{color:var(--bp);font-family:var(--ar-mono);white-space:nowrap}
.ar-bp-scale{display:inline-flex;flex:none;border:.15cqw solid var(--bp);height:1.4cqw}
.ar-bp-scale i{width:3.2cqw;height:100%}.ar-bp-scale i:nth-child(odd){background:var(--bp)}
.ar-bp-det .ar-credit{display:inline;color:var(--ar-mute)}
.ar-bp-notes{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:4cqw;min-height:0}
.ar-bp-notes .ar-lbl{color:var(--bp);border-bottom:.15cqw solid var(--bp);padding-bottom:.6cqw;margin-bottom:.4cqw}
.ar-bp-c1{display:grid;align-content:start;gap:1.2cqw}
.ar-bp-c1 .ar-body{font-size:calc(1.68*var(--u));line-height:1.58;display:grid;gap:1.1cqw;color:#1d2f47}
.ar-bp-c2{display:grid;align-content:start;gap:1.9cqw;counter-reset:bn}
.ar-bp-c2>:not(.ar-lbl){counter-increment:bn;position:relative;padding-inline-start:4cqw}
.ar-bp-c2>:not(.ar-lbl)::before{content:counter(bn) ".";position:absolute;right:0;top:0;font-family:var(--ar-mono);font-weight:600;color:var(--bp);font-size:calc(1.5*var(--u))}
.ar-L-blueprint .ar-quote{display:grid;gap:.8cqw}
.ar-L-blueprint .ar-quote blockquote{font-family:var(--ar-sans);font-weight:500;font-size:calc(1.85*var(--u));line-height:1.42;color:#1d2f47}
.ar-L-blueprint .ar-insight{border:.2cqw solid var(--bp);padding:1.4cqw 1.6cqw 1.4cqw 1.6cqw;padding-inline-start:4cqw;background:#fff}
.ar-L-blueprint .ar-ins-t{font-size:calc(2*var(--u))}
.ar-L-blueprint .ar-ins-x{font-size:calc(1.45*var(--u));color:var(--ar-mute)}
.ar-L-blueprint .ar-ft-h{font-size:calc(1.6*var(--u))}
.ar-L-blueprint .ar-ft-s{padding:1.2cqw 1.3cqw;background:#fff}
.ar-L-blueprint .ar-ft-s.f,.ar-L-blueprint .ar-ft-s.t{border-top-color:var(--bp)}
.ar-L-blueprint .ar-ft-s.f span,.ar-L-blueprint .ar-ft-s.t span{color:var(--bp)}
.ar-L-blueprint .ar-ft-s.t{background:#e6edf6}
.ar-L-blueprint .ar-ft-s p{font-size:calc(1.42*var(--u))}
.ar-L-blueprint .ar-ft-x{font-size:calc(1.32*var(--u))}
.ar-L-blueprint .ar-hk-l span{font-size:calc(1.8*var(--u));color:#1d2f47}
.ar-bp-tb{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border:.3cqw solid var(--bp);background:#fff;margin-bottom:.6cqw}
.ar-bp-tb>div{display:grid;gap:.3cqw;padding:.9cqw 1.2cqw;border-inline-start:.12cqw solid var(--bp);align-content:start;min-width:0}
.ar-bp-tb>div:first-child{border-inline-start:0}
.ar-bp-tb>div.w2{grid-column:span 2}
.ar-bp-tb span{font-family:var(--ar-mono);font-size:calc(.98*var(--u));letter-spacing:.08em;color:var(--ar-mute)}
.ar-bp-tb b{font-size:calc(1.32*var(--u));line-height:1.25;color:var(--bp);overflow-wrap:anywhere}

/* 6 archive: תיק ארכיון. נייר וזהב, מספר תיק, תצלום מוצמד, מראי מקום ממוספרים */
.ar-L-archive{--gold:var(--cr-gold,#b08a2e);--ar-paper:#f2ecdf;--ar-ink:#231f17;--ar-mute:#6a614f;--ar-rule:#d3c6a6;background-image:radial-gradient(140% 100% at 50% 30%,rgba(255,255,255,.5),rgba(0,0,0,0) 60%),radial-gradient(120% 80% at 50% 120%,rgba(120,90,30,.12),transparent 60%)}
.ar-L-archive::before{content:"";position:absolute;top:0;bottom:0;right:4.5cqw;width:.35cqw;background:var(--gold);opacity:.75}
.ar-L-archive .ar-in{grid-template-rows:auto minmax(0,1fr) auto auto;padding:6.5cqw 9cqw 4cqw 7cqw;gap:2.8cqw}
.ar-ac-head{display:grid;gap:1.6cqw}
.ar-ac-run{display:flex;justify-content:space-between;align-items:center;gap:3cqw;padding:1cqw 0 .6cqw 1.2cqw}
.ar-ac-no{font-family:var(--ar-mono);font-size:calc(1.35*var(--u));letter-spacing:.12em;border-bottom:.2cqw solid var(--gold);padding-bottom:.5cqw;font-weight:600}
.ar-ac-stamp{font-family:var(--ar-mono);font-size:calc(1.3*var(--u));letter-spacing:.2em;color:var(--gold);border:.3cqw double var(--gold);padding:.7cqw 2cqw;transform:rotate(-3deg);font-weight:600}
.ar-L-archive .ar-title{font-size:calc(6*var(--u));line-height:1.04;font-weight:700}
.ar-L-archive .ar-title::after{content:"";display:block;width:16cqw;height:.45cqw;background:var(--gold);margin-top:2cqw}
.ar-L-archive .ar-lead{font-family:var(--ar-serif);font-size:calc(2.05*var(--u));line-height:1.45;color:var(--ar-mute)}
.ar-ac-main{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:5cqw;min-height:0}
.ar-ac-c1{display:grid;align-content:start;gap:3.4cqw;padding:2cqw 2cqw 3cqw}
.ar-ac-photo{background:#fbf8f1;padding:1.8cqw 1.8cqw 1.4cqw;box-shadow:0 .3cqw .6cqw rgba(50,35,10,.14),0 2.4cqw 4cqw rgba(50,35,10,.2);transform:rotate(-1.4deg);position:relative;display:grid;gap:1cqw}
.ar-ac-photo .ar-img{height:40cqw;filter:sepia(.25) saturate(.85) contrast(1.03)}
.ar-ac-photo::before,.ar-ac-photo::after{content:"";position:absolute;width:5cqw;height:5cqw;border:solid var(--gold);opacity:.9}
.ar-ac-photo::before{top:.8cqw;right:.8cqw;border-width:.45cqw .45cqw 0 0}
.ar-ac-photo::after{bottom:.8cqw;left:.8cqw;border-width:0 0 .45cqw .45cqw}
.ar-ac-photo figcaption{font-family:var(--ar-mono);font-size:calc(1.15*var(--u));color:var(--ar-mute);letter-spacing:.04em}
.ar-L-archive .ar-quote{display:grid;gap:1cqw;background:#fbf7ee;padding:2.2cqw 2.4cqw;border-inline-start:.6cqw solid var(--gold);box-shadow:0 .8cqw 2cqw rgba(50,35,10,.08)}
.ar-L-archive .ar-quote blockquote{font-size:calc(2.15*var(--u));line-height:1.42}
.ar-ac-c2{display:grid;align-content:start;gap:2.2cqw}
.ar-ac-c2 .ar-body{font-family:var(--ar-serif);font-size:calc(1.85*var(--u));line-height:1.62;display:grid;gap:1.2cqw;text-align:justify}
.ar-L-archive .ar-ins-t{font-size:calc(2.25*var(--u))}
.ar-L-archive .ar-insight .ar-lbl,.ar-L-archive .ar-ft .ar-lbl{color:var(--gold)}
.ar-L-archive .ar-ins-x{font-size:calc(1.5*var(--u));color:var(--ar-mute)}
.ar-L-archive .ar-ft-h{font-size:calc(1.7*var(--u))}
.ar-L-archive .ar-ft-s{padding:1.2cqw 1.4cqw}
.ar-L-archive .ar-ft-s p{font-size:calc(1.45*var(--u))}
.ar-L-archive .ar-ft-x{font-size:calc(1.35*var(--u))}
.ar-L-archive .ar-haiku{border-top:.15cqw solid var(--gold);padding-top:1.6cqw}
.ar-L-archive .ar-hk-l span{font-size:calc(1.9*var(--u))}
.ar-ac-refs{display:grid;gap:.5cqw;border-top:.15cqw solid var(--ar-ink);padding-top:1.4cqw;counter-reset:r;font-size:calc(1.12*var(--u));line-height:1.4;color:var(--ar-mute)}
.ar-ac-refs .ar-lbl{color:var(--ar-ink)}
.ar-ac-refs li{counter-increment:r;display:grid;grid-template-columns:3cqw minmax(0,1fr)}
.ar-ac-refs li::before{content:"[" counter(r) "]";font-family:var(--ar-mono);color:var(--gold);font-weight:600}
.ar-L-archive sup{font-family:var(--ar-mono);color:var(--gold);font-size:.7em;font-weight:600}
.ar-L-archive .ar-foot{color:var(--ar-mute)}

/* 7 report: לוח מצב בנוסח מוקד 106. כחול כהה וזהב, משפט תובנה גדול, מספרים גדולים */
.ar-L-report{--nv:#1a3a6f;--gd:#d4af37;--ar-paper:#f8f6f1;--ar-ink:#14213a;--ar-mute:#56607a;--ar-rule:#ddd6c4}
.ar-L-report .ar-in{grid-template-rows:auto minmax(26cqw,1fr) auto auto}
.ar-L-report.noimg .ar-in{grid-template-rows:auto minmax(0,1fr) auto}
.ar-rp-band{background:var(--nv);color:#fff;padding:6cqw 7cqw 4.4cqw;display:grid;gap:1.8cqw;position:relative;border-bottom:1.1cqw solid var(--gd)}
.ar-rp-band .ar-kicker{color:var(--gd)}
.ar-L-report .ar-title{font-family:var(--ar-sans);font-size:calc(6.2*var(--u));line-height:1.02;font-weight:700;letter-spacing:-.02em}
.ar-rp-band .ar-lead{font-size:calc(2.05*var(--u));line-height:1.45;opacity:.88;max-width:80cqw}
.ar-rp-hero{position:relative}
.ar-rp-hero .ar-img{position:absolute;inset:0}
.ar-rp-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,22,45,.15),rgba(10,22,45,.78))}
.ar-rp-hero .ar-credit{position:absolute;bottom:1.8cqw;left:7cqw;right:7cqw;z-index:1;color:#fff;opacity:.85;text-align:left}
.ar-rp-main{display:grid;grid-template-rows:auto auto auto;gap:3cqw;padding:4.6cqw 7cqw 2.4cqw}
.ar-rp-stmt .ar-lbl{color:var(--nv)}
.ar-rp-stmt .ar-ins-t{font-size:calc(4.1*var(--u));line-height:1.14;color:var(--nv);font-weight:700}
.ar-rp-stmt .ar-ins-x{font-size:calc(1.85*var(--u));color:var(--ar-mute);margin-top:.6cqw}
.ar-rp-stmt .ar-insight{border-inline-start:1.1cqw solid var(--gd);padding-inline-start:3cqw}
.ar-rp-figs{display:grid;grid-template-columns:repeat(var(--n,3),minmax(0,1fr));gap:2.4cqw}
.ar-rp-fig{background:#fff;padding:2cqw 2.4cqw;box-shadow:0 .3cqw 0 var(--gd),0 1cqw 2.6cqw rgba(20,33,58,.10);display:grid;gap:.6cqw;align-content:start}
.ar-rp-fig b{font-size:calc(5.4*var(--u));line-height:1;color:var(--nv);font-weight:700;letter-spacing:-.02em}
.ar-rp-fig span{font-size:calc(1.42*var(--u));line-height:1.35;color:var(--ar-mute)}
.ar-rp-cols{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr);gap:4cqw;min-height:0}
.ar-rp-body{font-size:calc(1.72*var(--u));line-height:1.6;display:grid;gap:1.2cqw;align-content:start}
.ar-rp-body p:first-child{font-weight:600;color:var(--nv)}
.ar-rp-side{display:grid;align-content:start;gap:2.2cqw}
.ar-L-report .ar-quote{display:grid;gap:1cqw;background:#fff;padding:2.2cqw 2.4cqw;border-top:.6cqw solid var(--gd);box-shadow:0 1cqw 2.6cqw rgba(20,33,58,.08)}
.ar-L-report .ar-quote blockquote{font-family:var(--ar-sans);font-weight:600;font-size:calc(1.95*var(--u));line-height:1.4;color:var(--nv)}
.ar-L-report .ar-ft .ar-lbl{color:var(--nv)}
.ar-L-report .ar-ft-h{font-size:calc(1.7*var(--u));color:var(--nv)}
.ar-L-report .ar-ft-s{padding:1.3cqw 1.4cqw}
.ar-L-report .ar-ft-s.f{background:#fff;border-top-color:var(--nv)}.ar-L-report .ar-ft-s.f span{color:var(--nv)}
.ar-L-report .ar-ft-s.t{background:var(--nv);border-top-color:var(--gd);color:#fff}.ar-L-report .ar-ft-s.t span{color:var(--gd)}
.ar-L-report .ar-ft-s p{font-size:calc(1.45*var(--u))}
.ar-L-report .ar-ft-x{font-size:calc(1.35*var(--u))}
.ar-L-report .ar-haiku{border-top:.2cqw solid var(--gd);padding-top:1.4cqw}
.ar-L-report .ar-hk-l span{font-size:calc(1.85*var(--u));color:var(--nv)}
.ar-L-report .ar-foot{background:var(--nv);color:#fff;padding:2cqw 7cqw 2.4cqw;border-top:.5cqw solid var(--gd)}
.ar-L-report .ar-foot b{color:var(--gd)}

/* הדפסה ומצב צילום של כתבה */
@media print{html.cr-printing .cr-print .ar-sheet{width:210mm;height:297mm;aspect-ratio:auto;box-shadow:none;break-after:page;page-break-after:always;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
.cr-shot-stage .ar-sheet{width:1240px;box-shadow:none}
`;

  // התאמה לגיליון: אם טקסט גולש מהמסגרת, כל הטקסט ביצירה קטן יחד (עד 55%), כמו בעימוד מקצועי
  // גלישה = גוש הטקסט חוצה את שורת הכותרת או את התחתית, או שתוכן נחתך בתוך מסגרת סגורה (עמודות, פוסט)
  const clipped = (el) => getComputedStyle(el).overflow !== 'visible' && (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1);
  function fitCard(cardEl) {
    const inn = cardEl.querySelector('.cr-in'); if (!inn) return;
    const top = inn.querySelector(':scope>.cr-top'), foot = inn.querySelector(':scope>.cr-foot');
    const mids = [...inn.children].filter((e) => e !== top && e !== foot);
    const bad = () => {
      const tb = top ? top.getBoundingClientRect().bottom : -1e9, fb = foot ? foot.getBoundingClientRect().top : 1e9;
      return mids.some((m) => { const r = m.getBoundingClientRect(); return r.top < tb - 1 || r.bottom > fb + 1; })
        || [...inn.querySelectorAll('.cr-cols,.cr-ptxt,.cr-post .cr-body')].some(clipped);
    };
    let k = 1; cardEl.style.setProperty('--k', 1);
    while (k > 0.55 && bad()) { k = Math.round((k - 0.04) * 100) / 100; cardEl.style.setProperty('--k', k); }
    cardEl.dataset.fit = bad() ? 'over' : k;
  }
  async function fitAll(root) {
    const imgs = [...root.querySelectorAll('img')];
    await Promise.all(imgs.map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
    if (document.fonts) await document.fonts.ready;
    root.querySelectorAll('.cr-card').forEach(fitCard);
  }

  function card(c, t, app, base) {
    const img = (u) => (u ? new URL(u, base).href : '');
    const top = `<div class="cr-top"><span>${esc(app.name)}</span><span>${esc(t.zone || '')} · ${esc(STYLE_HE[c.style] || '')}</span></div>`;
    const foot = `<div class="cr-foot"><span><b>${esc(c.kicker || t.title)}</b>${c.credit ? `<br>${esc(c.credit)}` : ''}</span><span>אד' ענת שטיבלמן A&amp;I</span></div>`;
    const bg = c.image ? `<img class="cr-img" src="${esc(img(c.image))}" alt="" ${c.pos ? `style="object-position:${esc(c.pos)}"` : ''} crossorigin="anonymous">` : '';
    let body = '';
    switch (c.style) {
      case 'poster': body = `${bg}<div class="cr-in">${top}<div class="cr-body"><h3 class="cr-serif">${rich(c.title)}</h3>${c.text ? `<p>${rich(c.text)}</p>` : ''}</div>${foot}</div>`; break;
      case 'gradient': body = `<div class="cr-in">${top}<div class="cr-body"><span class="cr-rule"></span><h3>${rich(c.title)}</h3>${c.text ? `<p>${rich(c.text)}</p>` : ''}</div>${foot}</div>`; break;
      case 'veil': body = `${bg}<div class="cr-in">${top}<div class="cr-glass"><h3 class="cr-serif">${rich(c.title)}</h3>${c.text ? `<p>${rich(c.text)}</p>` : ''}</div>${foot}</div>`; break;
      case 'insight': body = `<div class="cr-in">${top}<div class="cr-body"><span class="cr-k">התובנה</span><h3>${rich(c.title)}</h3>${c.text ? `<p>${rich(c.text)}</p>` : ''}</div>${foot}</div>`; break;
      case 'quote': body = `<div class="cr-in">${top}<div class="cr-body"><span class="cr-qm" aria-hidden="true">"</span><blockquote class="cr-serif">${rich(c.quote || c.title)}</blockquote><cite>${c.who ? `<b>${esc(c.who)}</b>` : ''}${esc(c.cite || '')}</cite></div>${foot}</div>`; break;
      case 'haiku': body = `<div class="cr-in">${top}<div class="cr-body"><div class="cr-lines cr-serif">${(c.lines || []).map((l) => `<span>${esc(l)}</span>`).join('')}</div><span class="cr-seal" aria-hidden="true"></span>${c.text ? `<p>${rich(c.text)}</p>` : ''}</div>${foot}</div>`; break;
      case 'post': body = `<div class="cr-in">${top}<div class="cr-body"><div class="cr-ph"><span class="cr-av">A&amp;I</span><div><b>${esc(app.name)}</b><span>${esc(t.title)}</span></div></div>${c.image ? `<img class="cr-pimg" src="${esc(img(c.image))}" alt="" ${c.pos ? `style="object-position:${esc(c.pos)}"` : ''} crossorigin="anonymous">` : ''}<div class="cr-ptxt"><h3>${rich(c.title)}</h3>${(c.text || '').split('\n').map((l) => `<span>${rich(l)}</span>`).join('')}${c.tags ? `<span class="cr-tags">${c.tags.map((x) => '#' + esc(x)).join(' ')}</span>` : ''}</div></div>${foot}</div>`; break;
      case 'fromto': body = `<div class="cr-in">${top}<div class="cr-body"><h3>${rich(c.title)}</h3><div class="cr-ft"><div class="cr-side f"><span>${esc(c.fromLabel || 'ממה')}</span><p>${rich(c.from)}</p></div><div class="cr-axis" aria-hidden="true"></div><div class="cr-side t"><span>${esc(c.toLabel || 'למה')}</span><p>${rich(c.to)}</p></div></div>${c.text ? `<p class="cr-pivot">${rich(c.text)}</p>` : ''}</div>${foot}</div>`; break;
      case 'essay': body = `<div class="cr-in">${top}<div class="cr-eh"><h3 class="cr-serif">${rich(c.title)}</h3>${c.text ? `<p class="cr-lead">${rich(c.text)}</p>` : ''}</div><div style="display:grid;grid-template-rows:auto minmax(0,1fr);gap:3cqw;min-height:0">${c.image ? `<img class="cr-eimg" src="${esc(img(c.image))}" alt="" ${c.pos ? `style="object-position:${esc(c.pos)}"` : ''} crossorigin="anonymous">` : '<span></span>'}<div class="cr-cols">${(c.body || []).map((p) => `<p>${rich(p)}</p>`).join('')}</div></div>${foot}</div>`; break;
      default: body = `<div class="cr-in">${top}<div><h3>${rich(c.title)}</h3></div>${foot}</div>`;
    }
    return `<div class="cr-card cr-${esc(c.style)}" data-cr="${esc(t.id)}/${esc(c.id)}">${body}</div>`;
  }


  /* ───── כתבות: גיליון A4 אחד לכל נושא, מורכב אוטומטית מהיצירות של הנושא לפי תפקיד ───── */
  const LAYOUTS = ['magazine', 'daf', 'herbarium', 'atlas', 'blueprint', 'archive', 'report'];
  const FONTS_HREF = 'https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700;900&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans+Hebrew:wght@300;400;500;600;700&display=swap';
  const plain = (s) => String(s ?? '').replace(/==(.+?)==/g, '$1').replace(/\*\*(.+?)\*\*/g, '$1').trim();
  const norm = (s) => plain(s).replace(/[֑-ׇ]/g, '').replace(/[״׳"'.,:;!?\-–]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  // טקסט עשיר בכתבה: גם מספרים מודגשים אוטומטית (לא בתוך תג)
  const richA = (s) => rich(s).replace(/(^|[^\w&#;])(\d[\d,.–]*\d|\d)(?![^<]*>)/g, '$1<b class="ar-num" dir="ltr">$2</b>');
  const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return u || ''; } };
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12H4M10 5l-7 7 7 7"/></svg>';
  function injectCSS() {
    if (!document.getElementById('cr-css')) { const s = document.createElement('style'); s.id = 'cr-css'; s.textContent = CSS; document.head.appendChild(s); }
    if (!document.getElementById('ar-fonts')) { const l = document.createElement('link'); l.id = 'ar-fonts'; l.rel = 'stylesheet'; l.href = FONTS_HREF; document.head.appendChild(l); }
  }
  function appCSS(app) {
    const css = app?.article?.css; if (!css || !app.id) return;
    const id = 'ar-css-' + String(app.id).replace(/[^\w-]/g, '');
    if (document.getElementById(id)) return;
    const s = document.createElement('style'); s.id = id; s.textContent = `[data-ar-app="${String(app.id).replace(/"/g, '')}"]{${css}}`; document.head.appendChild(s);
  }
  const paletteStyle = (app) => Object.entries(app?.palette || {}).map(([k, v]) => `--cr-${k}:${String(v).replace(/[;"<>]/g, '')}`).join(';');

  // מהיצירות לתפקידים בכתבה. בלי טקסט חדש: כל מילה מגיעה מהיצירות של הנושא.
  function compose(t, app) {
    const cs = t.creations || [];
    const by = (st) => cs.find((c) => c.style === st);
    const heroC = cs.find((c) => c.image && ['poster', 'veil', 'post', 'essay'].includes(c.style)) || cs.find((c) => c.image);
    const essay = by('essay'), post = by('post');
    const ins = by('insight') || by('gradient');
    const q = by('quote');
    let lead = t.sub || essay?.text || '';
    let insight = ins ? { title: ins.title, text: ins.text } : null;
    if (insight && norm(insight.title) === norm(lead)) lead = (essay?.text && norm(essay.text) !== norm(lead)) ? essay.text : (insight.text || '');
    if (insight && norm(insight.text) === norm(lead)) insight = { title: insight.title, text: '' };
    let body = essay?.body?.length ? essay.body : post?.text ? post.text.split('\n').filter((x) => x.trim()) : [];
    if (!body.length) body = ['poster', 'veil', 'gradient'].map((s) => by(s)?.text).filter(Boolean);
    const seen = new Set([lead, insight?.title, insight?.text, q?.quote, by('fromto')?.from, by('fromto')?.to, by('fromto')?.text].filter(Boolean).map(norm));
    body = body.filter((p) => { const n = norm(p); if (!n || seen.has(n)) return false; seen.add(n); return true; });
    return {
      id: t.id, zone: t.zone || '', title: t.title || '', lead,
      hero: heroC ? { src: heroC.image, pos: heroC.pos || '', credit: heroC.credit || '' } : null,
      quote: q ? { quote: q.quote || q.title, who: q.who || '', cite: q.cite || '' } : null,
      insight, fromto: by('fromto') || null, body, haiku: by('haiku') || null,
    };
  }

  // מספרים גדולים (פריסת report): רק מספרים שכבר כתובים בכתבה, עם המילים שלידם
  function figures(a) {
    const out = [];
    for (const c of [a.fromto?.fromLabel, a.fromto?.toLabel, a.insight?.title, a.title, a.lead]) {
      if (!c) continue;
      const s = plain(c), m = s.match(/(\d[\d,.–]*\d|\d)(\s*לפנה״ס)?/);
      if (!m || out.some((o) => o.n === m[0].trim())) continue;
      const label = s.replace(m[0], ' ').replace(/^[\s,:·–-]+|[\s,:·–-]+$/g, '').replace(/\s+/g, ' ');
      if (!label || label.split(' ').length > 9) continue;
      out.push({ n: m[0].trim(), label });
      if (out.length === 3) break;
    }
    return out.length >= 2 ? out : [];
  }

  function parts(a, app, base, o) {
    const abs = (u) => (u ? new URL(u, base).href : '');
    const P = {};
    P.kicker = `<span class="ar-kicker">${esc(a.zone)}${a.zone ? ' · ' : ''}${esc(app.name || '')}</span>`;
    P.title = `<h2 class="ar-title">${rich(a.title)}</h2>`;
    P.lead = a.lead ? `<p class="ar-lead">${richA(a.lead)}</p>` : '';
    P.img = a.hero ? `<img class="ar-img" src="${esc(abs(a.hero.src))}" alt="" crossorigin="anonymous"${a.hero.pos ? ` style="object-position:${esc(a.hero.pos)}"` : ''}>` : '';
    P.credit = a.hero?.credit ? `<span class="ar-credit" dir="auto">${esc(a.hero.credit)}</span>` : '';
    const q = a.quote;
    P.quote = q ? `<figure class="ar-quote"><blockquote>"${richA(q.quote)}"${o.qref ? `<sup>[1]</sup>` : ''}</blockquote>${q.who || q.cite ? `<figcaption>${q.who ? `<b>${esc(q.who)}</b>` : ''}${q.cite ? `<span dir="auto">${esc(q.cite)}</span>` : ''}</figcaption>` : ''}</figure>` : '';
    const ins = a.insight;
    P.insight = ins ? `<div class="ar-insight">${o.insLabel === false ? '' : `<span class="ar-lbl">${esc(o.insLabel || 'התובנה')}</span>`}<p class="ar-ins-t"><mark>${rich(String(ins.title).replace(/==/g, ''))}</mark></p>${ins.text ? `<p class="ar-ins-x">${richA(ins.text)}</p>` : ''}</div>` : '';
    const f = a.fromto;
    P.fromto = f ? `<div class="ar-ft" data-drop="2"><span class="ar-lbl">ממה למה</span>${f.title ? `<p class="ar-ft-h">${rich(f.title)}</p>` : ''}<div class="ar-ft-row"><div class="ar-ft-s f"><span>${richA(f.fromLabel || 'ממה')}</span><p>${richA(f.from)}</p></div><div class="ar-ft-ar">${ARROW}</div><div class="ar-ft-s t"><span>${richA(f.toLabel || 'למה')}</span><p>${richA(f.to)}</p></div></div>${f.text ? `<p class="ar-ft-x">${richA(f.text)}</p>` : ''}</div>` : '';
    const h = a.haiku;
    P.haikuLines = h ? `<div class="ar-hk-l">${(h.lines || []).map((l) => `<span>${esc(l)}</span>`).join('')}</div>` : '';
    P.haiku = h ? `<div class="ar-haiku" data-drop="1">${P.haikuLines}${h.text ? `<p>${richA(h.text)}</p>` : ''}</div>` : '';
    const paras = (tag, open) => a.body.map((p, i) => {
      let html = richA(p);
      if (open && i === 0) {
        const m = String(p).match(/^(\*\*)?([^\s*]+)(\*\*)?\s*/);
        if (m) { let rest = String(p).slice(m[0].length); if (m[1] && !m[3]) rest = '**' + rest; html = `<span class="ar-df-open">${esc(m[2])}</span> ${richA(rest)}`; }
      }
      return `<${tag} data-drop="3" data-i="${i}"${i === 0 && /^[\u05d0-\u05ea]/.test(plain(p)) ? ' class="ar-dc"' : ''}>${tag === 'li' ? `<span>${html}</span>` : html}</${tag}>`;
    }).join('');
    P.body = a.body.length ? `<div class="ar-body">${paras('p', o.open)}</div>` : '';
    P.items = paras('li');
    P.foot = `<footer class="ar-foot"><span><b>${esc(app.name || '')}</b></span><span>אד' ענת שטיבלמן A&amp;I</span><span dir="ltr">${esc(hostOf(app.url))}</span></footer>`;
    return P;
  }

  const L = {
    magazine: (P, a) => `
      <div class="ar-mg-hero ar-fit">${P.img}<div class="ar-mg-cap">${P.kicker}${P.title}${P.lead}</div>${P.credit}</div>
      <div class="ar-mg-main ar-fit">${P.quote || '<span></span>'}<div class="ar-mg-body ar-body ar-fit${a.body.join(' ').length > 420 ? ' ar-2c' : ''}">${P.body.replace(/^<div class="ar-body">|<\/div>$/g, '')}</div>${P.insight}<div class="ar-mg-row">${P.fromto}${P.haiku}</div></div>
      ${P.foot}`,
    daf: (P, a, o, app) => `
      <header class="ar-df-head ar-fit"><div class="ar-df-run"><span>${esc(app.name || '')}</span><b>${esc(a.zone)}</b><span>דף ${o.no}</span></div>${P.title}${P.lead}</header>
      <div class="ar-df-page">
        <aside class="ar-df-r ar-fit"><span class="ar-df-lbl">פירוש</span>${P.quote}${P.haiku}</aside>
        <div class="ar-df-c ar-fit">${a.hero ? `<figure class="ar-df-vig">${P.img}${P.credit}</figure>` : ''}${P.body}</div>
        <aside class="ar-df-l ar-fit"><span class="ar-df-lbl">תוספת</span>${P.fromto || P.insight}</aside>
        ${P.fromto && P.insight ? `<div class="ar-df-d ar-fit">${P.insight}</div>` : ''}
      </div>
      ${P.foot}`,
    herbarium: (P, a, o) => {
      const spec = a.hero ? `<div class="ar-hb-mat">${P.img}<i></i><i></i><i></i></div>` : `<div class="ar-hb-mat txt">${P.haikuLines || P.quote}</div>`;
      const usedH = !a.hero && P.haikuLines, usedQ = !a.hero && !P.haikuLines;
      return `
      <header class="ar-hb-head ar-fit"><div class="ar-hb-run"><span>גיליון ${o.no}</span><span>${esc(a.zone)}</span></div>${P.title}${P.lead}</header>
      <div class="ar-hb-mount ar-fit">${spec}<div class="ar-hb-label"><span class="ar-lbl">${esc(o.cat)}</span><b>${esc(plain(a.title))}</b>${P.credit}</div></div>
      <div class="ar-hb-notes"><div class="ar-hb-c1 ar-fit">${P.body}</div><div class="ar-hb-c2 ar-fit">${usedQ ? '' : P.quote}${P.insight}${P.fromto}${usedH ? '' : P.haiku}</div></div>
      ${P.foot}`;
    },
    atlas: (P, a, o) => `
      <header class="ar-at-head ar-fit"><div class="ar-at-no"><span>לוח</span><b>${o.no}</b></div><div class="ar-at-tt">${P.kicker}${P.title}${P.lead}</div></header>
      <figure class="ar-at-fig ar-fit"><div class="ar-at-rt">${[1, 2, 3, 4, 5].map((n) => `<span>${n}</span>`).join('')}</div><div class="ar-at-rs">${['א', 'ב', 'ג', 'ד'].map((n) => `<span>${n}</span>`).join('')}</div>
        ${a.hero ? `<div class="ar-at-img">${P.img}</div>` : `<div class="ar-at-img txt">${a.insight ? `<p class="ar-ins-t"><mark>${rich(String(a.insight.title).replace(/==/g, ''))}</mark></p>` : P.haikuLines}</div>`}
        <figcaption><b>איור ${o.no}.</b>${a.hero ? P.credit : `<span class="ar-credit">${esc(plain(a.title))}</span>`}</figcaption></figure>
      <div class="ar-at-notes"><ol class="ar-at-list ar-fit"><span class="ar-lbl">הערות</span>${P.items}</ol><div class="ar-at-side ar-fit">${P.quote}${a.hero ? P.insight : (a.insight?.text ? `<div class="ar-insight"><span class="ar-lbl">התובנה</span><p class="ar-ins-x">${richA(a.insight.text)}</p></div>` : '')}${P.fromto}${P.haiku}</div></div>
      ${P.foot}`,
    blueprint: (P, a, o, app) => `
      <header class="ar-bp-head ar-fit">${P.kicker}${P.title}${P.lead}</header>
      <figure class="ar-bp-det ar-fit"><span class="ar-bp-tag">A</span>${a.hero ? `<div class="ar-bp-img">${P.img}</div>` : `<div class="ar-bp-img txt">${a.insight ? `<p class="ar-ins-t"><mark>${rich(String(a.insight.title).replace(/==/g, ''))}</mark></p>` : P.haikuLines}</div>`}
        <figcaption><span class="ar-bp-scale"><i></i><i></i><i></i><i></i></span><b>פרט A · ללא קנה מידה</b>${P.credit}</figcaption></figure>
      <div class="ar-bp-notes"><div class="ar-bp-c1 ar-fit"><span class="ar-lbl">תיאור</span>${P.body}</div><div class="ar-bp-c2 ar-fit"><span class="ar-lbl">הערות כלליות</span>${P.quote}${a.hero ? P.insight : ''}${P.fromto}${P.haiku}</div></div>
      <div class="ar-bp-tb ar-fit"><div class="w2"><span>אפליקציה</span><b>${esc(app.name || '')}</b></div><div class="w2"><span>נושא</span><b>${esc(plain(a.title))}</b></div><div><span>שלב</span><b>${esc(a.zone)}</b></div><div><span>גיליון</span><b>${o.no}</b></div><div class="w2"><span>עורכת</span><b>אד' ענת שטיבלמן A&amp;I</b></div><div class="w2"><span>כתובת</span><b dir="ltr">${esc(hostOf(app.url))}</b></div><div class="w2"><span>תאריך</span><b>${esc(o.date)}</b></div></div>`,
    archive: (P, a, o) => `
      <header class="ar-ac-head ar-fit"><div class="ar-ac-run"><span class="ar-ac-no">תיק ${esc(o.cat)}</span><span class="ar-ac-stamp">${esc(a.zone)}</span></div>${P.title}${P.lead}</header>
      <div class="ar-ac-main"><div class="ar-ac-c1 ar-fit">${a.hero ? `<figure class="ar-ac-photo">${P.img}<figcaption>תצלום ${o.no}${a.hero.credit ? ` <sup>[${a.quote?.cite ? 2 : 1}]</sup>` : ''}</figcaption></figure>` : ''}${P.quote}</div><div class="ar-ac-c2 ar-fit">${P.body}${P.insight}${P.fromto}${P.haiku}</div></div>
      ${a.quote?.cite || a.hero?.credit ? `<ol class="ar-ac-refs ar-fit"><span class="ar-lbl">מראי מקום</span>${a.quote?.cite ? `<li dir="auto">${esc(a.quote.cite)}</li>` : ''}${a.hero?.credit ? `<li dir="auto">${esc(a.hero.credit)}</li>` : ''}</ol>` : '<span></span>'}
      ${P.foot}`,
    report: (P, a) => {
      const figs = figures(a);
      return `
      <header class="ar-rp-band ar-fit">${P.kicker}${P.title}${P.lead}</header>
      ${a.hero ? `<div class="ar-rp-hero ar-fit">${P.img}${P.credit}</div>` : ''}
      <div class="ar-rp-main ar-fit"><div class="ar-rp-stmt">${P.insight}</div>
        ${figs.length ? `<div class="ar-rp-figs" style="--n:${figs.length}">${figs.map((x) => `<div class="ar-rp-fig"><b dir="ltr">${esc(x.n)}</b><span>${esc(x.label)}</span></div>`).join('')}</div>` : '<span></span>'}
        <div class="ar-rp-cols"><div class="ar-rp-body ar-fit">${P.body}</div><div class="ar-rp-side ar-fit">${P.quote}${P.fromto}${P.haiku}</div></div></div>
      ${P.foot}`;
    },
  };

  // o: { key, no, layout }
  function articleHTML(t, app, base, o = {}) {
    const layout = LAYOUTS.includes(o.layout) ? o.layout : LAYOUTS.includes(app?.article?.layout) ? app.article.layout : 'magazine';
    const a = compose(t, app);
    const no = String(o.no || 1).padStart(2, '0');
    const d = new Date();
    const opts = { no, cat: `${String(app.id || 'app').toUpperCase()}-${no}`, date: `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`, open: layout === 'daf', qref: layout === 'archive' && !!a.quote?.cite, insLabel: layout === 'daf' ? 'הכרעה' : layout === 'report' ? 'השורה התחתונה' : '' };
    const P = parts(a, app, base, opts);
    return `<article class="ar-sheet ar-L-${layout}${a.hero ? '' : ' noimg'}" data-ar="${esc(o.key || t.id)}" data-ar-app="${esc(app.id || '')}" data-layout="${layout}" data-k0="${layout === 'daf' || layout === 'archive' ? 1.4 : 1.15}" style="${paletteStyle(app)}" aria-label="${esc(plain(t.title))}"><div class="ar-in">${L[layout](P, a, opts, app)}</div></article>`;
  }

  // התאמה: כל הטקסט קטן יחד עד 0.7. אם עדיין גולש, יורדים גושים שלמים לפי הסדר: הייקו, ממה למה, הפסקאות האחרונות.
  // גלישה נמדדת גאומטרית: כל שורת טקסט חייבת להיות בתוך האזור (.ar-fit) שלה, וכל אזור בתוך הגיליון.
  const TXT = 'p,h2,blockquote,figcaption,li,.ar-hk-l span,.ar-kicker,.ar-credit,.ar-lbl,.ar-foot>span,.ar-bp-tb b,.ar-rp-fig b,.ar-rp-fig span,.ar-ft-s span,.ar-df-run>*,.ar-hb-run>*,.ar-ac-run>*,.ar-at-no b';
  function arBad(sheet) {
    const sr = sheet.getBoundingClientRect(); if (!sr.width) return false;
    const inside = (r, b) => r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && r.left >= b.left - 1 && r.right <= b.right + 1;
    for (const reg of sheet.querySelectorAll('.ar-fit')) { const r = reg.getBoundingClientRect(); if (r.width && !inside(r, sr)) return true; }
    for (const e of sheet.querySelectorAll(TXT)) {
      const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
      const reg = e.closest('.ar-fit'); const b = reg ? reg.getBoundingClientRect() : sr;
      if (!inside(r, b)) return true;
    }
    return false;
  }
  function fitArticle(sheet) {
    const all = (n) => [...sheet.querySelectorAll(`[data-drop="${n}"]`)];
    const drops = [...all(1), ...all(2), ...all(3).filter((p) => p.dataset.i !== '0').reverse()];
    drops.forEach((d) => { d.hidden = false; });
    if (!sheet.getBoundingClientRect().width) return;
    const set = (k) => sheet.style.setProperty('--k', k);
    const K0 = +(sheet.dataset.k0 || 1.15), KMIN = 0.7;
    const tryK = () => { let k = K0; set(k); while (k > KMIN + 1e-9 && arBad(sheet)) { k = Math.round((k - 0.03) * 100) / 100; set(k); } return arBad(sheet) ? null : k; };
    let k = tryK(); const dropped = [];
    while (k == null && drops.length) {
      const d = drops.shift(); d.hidden = true;
      dropped.push(d.dataset.drop === '1' ? 'haiku' : d.dataset.drop === '2' ? 'fromto' : 'p' + d.dataset.i);
      k = tryK();
    }
    sheet.dataset.fit = k == null ? 'over' : String(k);
    sheet.dataset.w = Math.round(sheet.getBoundingClientRect().width);
    if (dropped.length) sheet.dataset.dropped = dropped.join(' '); else delete sheet.dataset.dropped;
  }
  async function ready(root) {
    const imgs = [...root.querySelectorAll('img')];
    await Promise.all(imgs.map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
    if (document.fonts) { try { await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 4000))]); } catch {} }
  }
  async function fitArticles(root) { await ready(root); root.querySelectorAll('.ar-sheet').forEach(fitArticle); }
  const uploadUrl = (jsonAbs, key) => `${TAARUCHA}/studio/import?article=1&src=${encodeURIComponent(jsonAbs)}&${key.startsWith('pool:') ? 'pool=' + encodeURIComponent(key.slice(5)) : 'topic=' + encodeURIComponent(key)}`;
  const JSON_CACHE = new Map();
  const loadJSON = (url) => {
    if (!JSON_CACHE.has(url)) JSON_CACHE.set(url, fetch(url, { cache: 'no-cache' }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch((e) => { JSON_CACHE.delete(url); throw e; }));
    return JSON_CACHE.get(url);
  };
  // מקור לכתבה: נושא (id) או מקור מהמאגר (pool:<id>). בלי מאגר, הנושאים הם המאגר.
  function findSource(data, key) {
    if (String(key).startsWith('pool:')) {
      const id = key.slice(5), pool = data.pool || [];
      const i = pool.findIndex((x) => x.id === id);
      return i < 0 ? null : { t: pool[i], no: i + 1 };
    }
    const i = (data.topics || []).findIndex((x) => x.id === key);
    return i < 0 ? null : { t: data.topics[i], no: i + 1 };
  }

  class AppCreations extends HTMLElement {
    async connectedCallback() {
      injectCSS();
      const src = this.getAttribute('src') || './creations.json';
      this.base = new URL(src, location.href).href;
      this.innerHTML = '<p class="cr-empty">טוען כתבות…</p>';
      try {
        this.data = await loadJSON(this.base);
      } catch (e) {
        this.innerHTML = `<p class="cr-empty">קובץ היצירות לא נטען (${esc(src)}). בדקו שהקובץ קיים בתיקיית public של האפליקציה.</p>`;
        return;
      }
      appCSS(this.data.app);
      const p = this.data.app.palette || {};
      for (const [k, v] of Object.entries(p)) this.style.setProperty('--cr-' + k, v);
      this.zone = new URLSearchParams(location.hash.split('?')[1] || location.search).get('zone') || '';
      const qs = new URLSearchParams(location.search);
      if (qs.get('cr-article')) return this.shotArticle(qs.get('cr-article'));
      if (qs.get('cr')) return this.shot(qs.get('cr'));
      this.render();
    }
    get layout() { return this.getAttribute('layout') || new URLSearchParams(location.search).get('ar-layout') || ''; }
    get all() { return this.data.topics.flatMap((t) => t.creations.map((c) => ({ c, t }))); }
    get pool() { return this.data.pool?.length ? this.data.pool.map((t) => ({ t, key: 'pool:' + t.id })) : this.data.topics.map((t) => ({ t, key: t.id })); }
    article(key) { const s = findSource(this.data, key); return s ? articleHTML(s.t, this.data.app, this.base, { key, no: s.no, layout: this.layout }) : ''; }
    acts(key) {
      return `<div class="ar-acts" role="group" aria-label="פעולות לכתבה">
        <button class="cr-btn primary" data-ar-print="${esc(key)}" title="עמוד A4 אחד. בחלון ההדפסה: שמירה כ-PDF, או הדפסה">הורדה והדפסה</button>
        <a class="cr-btn" href="${esc(uploadUrl(this.base, key))}" target="_blank" rel="noopener" title="הכתבה נתלית בחדר של האפליקציה במוזיאון התערוכות">העלאה לחדר במוזיאון</a>
        <button class="cr-btn" data-ar-open="${esc(key)}" title="הכתבה בגודל מלא, בתוך הדף">הגדלה</button>
      </div>`;
    }
    render() {
      const { app, topics } = this.data;
      const shown = topics.filter((t) => !this.zone || t.zone === this.zone);
      const zones = [...ZONES, ...new Set(topics.map((t) => t.zone).filter((z) => !ZONES.includes(z)))];
      const groups = zones.map((z) => ({ z, list: shown.filter((t) => t.zone === z) })).filter((g) => g.list.length);
      const poolN = this.pool.length;
      this.innerHTML = `
        <header class="cr-head ar-head">
          <span class="cr-zone">כתבות</span>
          <h1>${esc(this.getAttribute('heading') || 'מה האפליקציה יוצרת')}</h1>
          <ul class="ar-lines">
            <li><span class="ar-lk">מה</span> כל נושא הוא <strong>כתבה</strong> של עמוד A4 אחד, שנבנית רק מהידע של ${esc(app.name)}: <strong>${topics.length}</strong> כתבות.</li>
            <li><span class="ar-lk">איך</span> בוחרים שלב, או לוחצים "יצירת כתבה" ובוחרים מקור מתוך <strong>${poolN}</strong>.</li>
            <li><span class="ar-lk">מה יוצא</span> קובץ A4 להדפסה, וכתבה שנתלית בחדר של האפליקציה במוזיאון התערוכות.</li>
          </ul>
          <div class="ar-bar">
            <div class="cr-zones" role="group" aria-label="סינון לפי שלב">
              ${ZONES.map((z) => `<button class="cr-btn${this.zone === z ? ' on' : ''}" data-zone="${z}" aria-pressed="${this.zone === z}">${zoneIcon(z)}<span>${z}</span><span class="cr-n">${topics.filter((t) => t.zone === z).length}</span></button>`).join('')}
              <button class="cr-all" data-zone="" aria-pressed="${!this.zone}" title="כל הכתבות, בלי סינון">הכול</button>
            </div>
            <button class="cr-btn primary ar-new" data-ar-new aria-expanded="${!!this.compOpen}" aria-controls="ar-comp">יצירת כתבה</button>
          </div>
        </header>
        <section class="ar-comp" id="ar-comp" aria-label="יצירת כתבה" ${this.compOpen ? '' : 'hidden'}>
          <div class="ar-comp-art" aria-live="polite">${this.pick ? this.article(this.pick) + this.acts(this.pick) : '<div class="ar-comp-ph">בוחרים מקור מהרשימה, והכתבה נבנית כאן, בפורמט של האפליקציה.</div>'}</div>
          <div class="ar-comp-list">
            <h3>מקורות לכתבה</h3>
            <div class="ar-comp-tools"><label class="ar-search"><input type="search" placeholder="חיפוש מקור" aria-label="חיפוש מקור" value="${esc(this.q || '')}" autocomplete="off"><button class="ar-x" type="button" aria-label="ניקוי החיפוש" ${this.q ? '' : 'hidden'}>×</button></label><button class="cr-btn" data-ar-rand title="מקור אקראי">הפתעה</button></div>
            <div class="ar-srcs">${this.srcList()}</div>
          </div>
        </section>
        ${groups.map((g) => `
          <section class="ar-zone" aria-label="${esc(g.z)}">
            <h2 class="ar-zh">${zoneIcon(g.z)}${esc(g.z)} <span>${g.list.length} כתבות</span></h2>
            <div class="ar-grid">${g.list.map((t) => this.item(t)).join('')}</div>
          </section>`).join('')}
        <p class="cr-why" style="margin-top:24px">הורדה: בחלון ההדפסה בוחרים "שמירה כ-PDF". הכתבה יוצאת בעמוד A4 אחד, בלי שוליים.</p>`;
      fitArticles(this);
      this.querySelectorAll('.ar-more').forEach((d) => d.addEventListener('toggle', () => { if (d.open) fitAll(d); }));
      const inp = this.querySelector('.ar-search input');
      inp.oninput = () => { this.q = inp.value; this.querySelector('.ar-x').hidden = !inp.value; this.querySelector('.ar-srcs').innerHTML = this.srcList(); };
      inp.onkeydown = (e) => { if (e.key === 'Escape') { inp.value = ''; inp.oninput(); } };
      this.onclick = (e) => {
        const z = e.target.closest('[data-zone]'); if (z) { this.zone = z.dataset.zone; this.render(); return; }
        if (e.target.closest('[data-ar-new]')) { this.compOpen = !this.compOpen; const c = this.querySelector('.ar-comp'); c.hidden = !this.compOpen; e.target.closest('[data-ar-new]').setAttribute('aria-expanded', this.compOpen); if (this.compOpen) { fitArticles(c); c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } return; }
        if (e.target.closest('.ar-x')) { inp.value = ''; inp.oninput(); inp.focus(); return; }
        if (e.target.closest('[data-ar-rand]')) { const list = this.pool.filter((x) => x.key !== this.pick); return this.choose(list[Math.floor(Math.random() * list.length)].key); }
        const s = e.target.closest('[data-ar-src]'); if (s) return this.choose(s.dataset.arSrc);
        const ap = e.target.closest('[data-ar-print]'); if (ap) return this.printArticle(ap.dataset.arPrint);
        const ao = e.target.closest('[data-ar-open]'); if (ao) return this.openArticle(ao.dataset.arOpen);
        const pr = e.target.closest('[data-print]'); if (pr) { this.print(pr.dataset.print); return; }
        const op = e.target.closest('[data-open]'); if (op) this.open(op.dataset.open);
      };
    }
    srcList() {
      const q = norm(this.q || '');
      const list = this.pool.filter(({ t }) => !q || q.split(' ').every((w) => norm(`${t.title} ${t.sub || ''} ${t.zone || ''}`).includes(w)));
      if (!list.length) return '<p class="ar-none">אין מקור שמתאים לחיפוש. נסו מילה אחרת, או לחצו על האיקס.</p>';
      const zones = [...ZONES, ...new Set(list.map((x) => x.t.zone).filter((z) => !ZONES.includes(z)))];
      return zones.map((z) => { const g = list.filter((x) => x.t.zone === z); return g.length ? `<h4>${zoneIcon(z)}${esc(z)} · ${g.length}</h4>${g.map(({ t, key }) => `<button class="ar-src${this.pick === key ? ' on' : ''}" data-ar-src="${esc(key)}" aria-pressed="${this.pick === key}"><b>${esc(plain(t.title))}</b>${t.sub ? `<span>${esc(plain(t.sub))}</span>` : ''}</button>`).join('')}` : ''; }).join('');
    }
    choose(key) {
      this.pick = key;
      const art = this.querySelector('.ar-comp-art');
      art.innerHTML = this.article(key) + this.acts(key);
      fitArticles(art);
      this.querySelectorAll('.ar-src').forEach((b) => { const on = b.dataset.arSrc === key; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
      if (matchMedia('(max-width:860px)').matches) art.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    item(t) {
      const { app, topics } = this.data;
      return `<section class="cr-room ar-item" id="cr-${esc(t.id)}">
        ${this.article(t.id)}
        ${this.acts(t.id)}
        <details class="ar-more"><summary>היצירות הבודדות (${t.creations.length})</summary>
          <div class="cr-acts">
            <button class="cr-btn" data-print="${esc(t.id)}" title="כל היצירות של הנושא, יצירה אחת בכל עמוד A4">הדפסת היצירות</button>
            <a class="cr-btn" href="${TAARUCHA}/studio/import?src=${encodeURIComponent(this.base)}&topic=${encodeURIComponent(t.id)}" target="_blank" rel="noopener" title="חדר לנושא, והיצירות נתלות על הקירות שלו">חדר לנושא</a>
            ${t.room ? `<a class="cr-btn" href="${TAARUCHA}/e/${esc(t.room)}" target="_blank" rel="noopener">כניסה לחדר</a>` : `<span class="cr-btn" aria-disabled="true" style="opacity:.45;cursor:default" title="החדר עוד לא הועלה">כניסה לחדר</span>`}
          </div>
          <div class="cr-grid">
            ${t.creations.map((c) => `<div class="cr-item"><button class="cr-open" data-open="${esc(t.id)}/${esc(c.id)}" aria-label="הגדלה: ${esc(plain(c.title || c.quote || STYLE_HE[c.style]))}">${card(c, t, app, this.base)}</button>
              <div class="cr-item-ft"><span class="cr-lbl">${esc(STYLE_HE[c.style] || c.style)}</span><button class="cr-btn" data-print="${esc(t.id)}/${esc(c.id)}">הדפסה A4</button></div></div>`).join('')}
          </div>
          <span hidden>${topics.indexOf(t) + 1}</span>
        </details>
      </section>`;
    }
    openArticle(key) {
      const lb = document.createElement('div');
      lb.className = 'cr-lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-label', 'כתבה מוגדלת');
      lb.innerHTML = `<div class="ar-lbw">${this.article(key)}</div><button class="cr-btn cr-lb-x" aria-label="סגירה">×</button>`;
      const close = () => { lb.remove(); document.removeEventListener('keydown', onKey); };
      const onKey = (e) => { if (e.key === 'Escape') close(); };
      lb.onclick = close; document.addEventListener('keydown', onKey);
      document.body.appendChild(lb); fitArticles(lb); lb.querySelector('.cr-lb-x').focus();
    }
    // הורדה והדפסה: רק הכתבה, בעמוד A4 אחד. שם הקובץ ב"שמירה כ-PDF" הוא כותרת הכתבה.
    printArticle(key) {
      const s = findSource(this.data, key); if (!s) return;
      const box = document.createElement('div');
      box.className = 'cr-print';
      box.innerHTML = this.article(key);
      box.style.cssText = 'display:block;position:absolute;left:-99999px;top:0;width:210mm';
      box.querySelector('.ar-sheet').style.width = '210mm';
      document.body.appendChild(box);
      const title = document.title;
      const done = () => { box.remove(); document.title = title; document.documentElement.classList.remove('cr-printing'); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      fitArticles(box).then(() => {
        box.style.cssText = '';
        document.title = `${plain(s.t.title)} · ${this.data.app.name}`;
        document.documentElement.classList.add('cr-printing');
        window.print();
      });
    }
    find(key) { const [tid, cid] = key.split('/'); const t = this.data.topics.find((x) => x.id === tid); return { t, list: cid ? t.creations.filter((c) => c.id === cid) : t.creations }; }
    open(key) {
      const { t, list } = this.find(key);
      const lb = document.createElement('div');
      lb.className = 'cr-lb'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-label', 'יצירה מוגדלת');
      for (const [k, v] of Object.entries(this.data.app.palette || {})) lb.style.setProperty('--cr-' + k, v);
      lb.innerHTML = card(list[0], t, this.data.app, this.base) + '<button class="cr-btn cr-lb-x" aria-label="סגירה">×</button>';
      const close = () => { lb.remove(); document.removeEventListener('keydown', onKey); };
      const onKey = (e) => { if (e.key === 'Escape') close(); };
      lb.onclick = close; document.addEventListener('keydown', onKey);
      document.body.appendChild(lb); fitAll(lb); lb.querySelector('.cr-lb-x').focus();
    }
    print(key) {
      const { t, list } = this.find(key);
      const box = document.createElement('div');
      box.className = 'cr-print';
      for (const [k, v] of Object.entries(this.data.app.palette || {})) box.style.setProperty('--cr-' + k, v);
      box.innerHTML = list.map((c) => card(c, t, this.data.app, this.base)).join('');
      document.body.appendChild(box);
      document.documentElement.classList.add('cr-printing');
      const done = () => { box.remove(); document.documentElement.classList.remove('cr-printing'); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      // הגיליון בהדפסה רחב יותר מבמסך: מודדים אחרי שמצב ההדפסה פעיל
      box.style.cssText += ';display:block;position:absolute;left:-99999px;top:0;width:210mm';
      box.querySelectorAll('.cr-card').forEach((c) => { c.style.width = '210mm'; });
      fitAll(box).then(() => { box.style.cssText = box.style.cssText.replace(/display:block;position:absolute;left:-99999px;top:0;width:210mm;?/, ''); window.print(); });
    }
    // ?cr=<topic>/<creation>: יצירה אחת ברוחב 1240 פיקסלים, לצילום (tools/creations-render.cjs)
    shot(key) {
      const { t, list } = this.find(key);
      const st = document.createElement('div');
      st.className = 'cr-shot-stage';
      for (const [k, v] of Object.entries(this.data.app.palette || {})) st.style.setProperty('--cr-' + k, v);
      st.innerHTML = card(list[0], t, this.data.app, this.base);
      document.body.appendChild(st);
      document.documentElement.classList.add('cr-shot');
      this.innerHTML = '';
      fitAll(st).then(() => st.setAttribute('data-ready', '1'));
    }
    // ?cr-article=<topic|pool:id>: כתבה אחת ברוחב 1240 פיקסלים, לצילום (creations-render.cjs --articles)
    shotArticle(key) {
      const st = document.createElement('div');
      st.className = 'cr-shot-stage';
      st.innerHTML = this.article(key) || '<p class="ar-msg">הכתבה לא נמצאה</p>';
      document.body.appendChild(st);
      document.documentElement.classList.add('cr-shot');
      this.innerHTML = '';
      fitArticles(st).then(() => st.setAttribute('data-ready', '1'));
    }
  }
  customElements.define('app-creations', AppCreations);

  // <app-article src="<creations.json>" topic="<id>"> או pool="<id>": כתבה אחת, ברוחב של עצמה. כך המוזיאון תולה כתבות.
  class AppArticle extends HTMLElement {
    static get observedAttributes() { return ['src', 'topic', 'pool', 'layout']; }
    connectedCallback() { this.load(); }
    disconnectedCallback() { this.ro?.disconnect(); }
    attributeChangedCallback() { if (this.isConnected && this.loaded) this.load(); }
    async load() {
      injectCSS();
      const src = this.getAttribute('src'); if (!src) return;
      const base = new URL(src, location.href).href;
      const key = this.getAttribute('pool') ? 'pool:' + this.getAttribute('pool') : this.getAttribute('topic') || '';
      let data;
      try { data = await loadJSON(base); } catch (e) { this.innerHTML = `<p class="ar-msg">הכתבה לא נטענה (${esc(e.message)}).</p>`; this.dispatchEvent(new CustomEvent('ar-error')); return; }
      const s = findSource(data, key);
      if (!s) { this.innerHTML = '<p class="ar-msg">הכתבה לא נמצאה בקובץ של האפליקציה.</p>'; this.dispatchEvent(new CustomEvent('ar-error')); return; }
      appCSS(data.app);
      this.loaded = true;
      this.innerHTML = articleHTML(s.t, data.app, base, { key, no: s.no, layout: this.getAttribute('layout') || '' });
      const sheet = this.querySelector('.ar-sheet');
      await ready(this);
      fitArticle(sheet);
      this.dataset.ready = '1';
      this.dispatchEvent(new CustomEvent('ar-ready', { detail: { title: plain(s.t.title), app: data.app } }));
      // מתאימים מחדש כשהרוחב משתנה הרבה (למשל כתבה שהייתה מוסתרת ונפתחה)
      this.ro?.disconnect();
      this.ro = new ResizeObserver(() => { const w = sheet.getBoundingClientRect().width; const was = +sheet.dataset.w || 0; if (w && (!was || Math.abs(w - was) / w > 0.25)) fitArticle(sheet); });
      this.ro.observe(this);
    }
  }
  if (!customElements.get('app-article')) customElements.define('app-article', AppArticle);
  window.AICreations = { compose, articleHTML, fitArticle, LAYOUTS };
})();
