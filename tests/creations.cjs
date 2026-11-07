// בדיקת דף הכתבות (/articles) מול vite preview: npx vite preview --port 4194 & node tests/creations.cjs
// הרכיב המשותף <app-creations> מוגש מעותק מקומי (tests/fixtures/creations.js, או CREATIONS_JS), כי הסביבה לא מגיעה ל-github.io.
const fs = require('fs')
const path = require('path')
let chromium
try { ({ chromium } = require('playwright')) } catch { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))) }

const BASE = process.env.BASE || 'http://localhost:4194/'
const CREATIONS_JS = process.env.CREATIONS_JS || path.join(__dirname, 'fixtures/creations.js')
const CR = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'creations.json'), 'utf8'))
const LAYOUT = CR.app.article.layout
const fails = []
let passed = 0
const ok = (cond, msg) => { if (cond) passed++; else fails.push(msg); console.log((cond ? 'עבר  ' : 'נכשל ') + msg) }

;(async () => {
  ok(CR.topics.length >= 6 && new Set(CR.topics.map((t) => t.zone)).size === 3, `נתונים: ${CR.topics.length} נושאים בשלושת השלבים`)
  ok(CR.topics.every((t) => t.creations.length >= 4 && t.creations.length <= 6 && new Set(t.creations.map((c) => c.style)).size === t.creations.length), 'נתונים: 4 עד 6 יצירות לנושא, בלי עיצוב חוזר')
  ok(CR.pool.length >= 20, `נתונים: ${CR.pool.length} מקורות במאגר`)
  const imgs = [...CR.topics, ...CR.pool].flatMap((t) => t.creations.map((c) => c.image).filter(Boolean))
  ok(imgs.every((i) => fs.existsSync(path.join(__dirname, '..', 'public', i))), `נתונים: ${new Set(imgs).size} תמונות קיימות בריפו`)

  const b = await chromium.launch()
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const ctx = await b.newContext({ viewport: vp })
    const m = await ctx.newPage()
    const errs = []
    m.on('pageerror', (e) => errs.push(e.message))
    await m.route('**/creations.js', (r) => r.fulfill({ path: CREATIONS_JS, contentType: 'application/javascript' }))
    await m.route('**/ai-menu.js', (r) => r.fulfill({ body: "customElements.define('ai-menu',class extends HTMLElement{})", contentType: 'application/javascript' }))
    await m.route(/supabase\.co/, (r) => r.abort())
    await m.goto(BASE, { waitUntil: 'load' })
    await m.locator('.tb-actions a', { hasText: 'כתבות' }).click()
    await m.waitForURL(/\/articles$/)
    ok(true, `כתבות (${vp.width}): הכפתור בסרגל מוביל לדף`)
    await m.locator('app-creations .ar-sheet').first().waitFor({ timeout: 15000 })
    await m.waitForFunction(() => [...document.querySelectorAll('.ar-grid .ar-sheet')].every((s) => s.dataset.fit), null, { timeout: 30000 })
    const sheets = await m.evaluate(() => [...document.querySelectorAll('.ar-grid .ar-sheet')].map((s) => ({ fit: s.dataset.fit, layout: s.dataset.layout, dropped: s.dataset.dropped || '' })))
    ok(sheets.length === CR.topics.length, `כתבות (${vp.width}): ${sheets.length} גיליונות`)
    ok(sheets.every((x) => x.fit !== 'over' && x.layout === LAYOUT), `כתבות (${vp.width}): ${LAYOUT}, בלי גלישה (${sheets.map((x) => x.fit).join(' ')})`)
    ok(sheets.every((x) => !x.dropped), `כתבות (${vp.width}): שום גוש לא ירד`)
    const acts = await m.locator('.ar-item').first().locator('.ar-acts > *').allInnerTexts()
    ok(acts.join('|').includes('הורדה והדפסה') && acts.join('|').includes('העלאה לחדר במוזיאון'), `כתבות (${vp.width}): כפתורי הורדה והעלאה (${acts.join(', ')})`)
    const widths = await m.locator('.ar-item').first().locator('.ar-acts > *').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)))
    ok(new Set(widths).size === 1, `כתבות (${vp.width}): כפתורים באותו רוחב (${widths.join(', ')})`)
    const up = await m.locator('.ar-item').first().locator('.ar-acts a').getAttribute('href')
    ok(up.startsWith('https://taarucha.vercel.app/studio/import?article=1&src=') && up.includes(encodeURIComponent(new URL('creations.json', BASE).href)) && up.endsWith('&topic=' + CR.topics[0].id), `כתבות (${vp.width}): כתובת ההעלאה לחדר במוזיאון`)
    ok(!(await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)), `כתבות (${vp.width}): בלי גלילה אופקית`)
    ok(await m.evaluate(() => document.documentElement.scrollHeight > window.innerHeight * 2), `כתבות (${vp.width}): הדף נגלל רגיל`)
    // יצירת כתבה: כל מקור במאגר נבנה בלי גלישה
    await m.click('[data-ar-new]')
    ok(await m.locator('.ar-comp').isVisible(), `יצירת כתבה (${vp.width}): הפאנל נפתח בתוך הדף`)
    const n = await m.locator('.ar-src').count()
    ok(n >= CR.pool.length, `יצירת כתבה (${vp.width}): ${n} מקורות`)
    if (vp.width > 1000) {
      const over = []
      for (let i = 0; i < n; i++) {
        await m.locator('.ar-src').nth(i).click()
        await m.waitForFunction(() => document.querySelector('.ar-comp-art .ar-sheet')?.dataset.fit, null, { timeout: 15000 })
        const f = await m.locator('.ar-comp-art .ar-sheet').getAttribute('data-fit')
        const d = await m.locator('.ar-comp-art .ar-sheet').getAttribute('data-dropped')
        if (f === 'over' || d) over.push(`${i}:${f}${d ? ' -' + d : ''}`)
      }
      ok(!over.length, `יצירת כתבה: כל המקורות נבנים בלי גלישה ובלי ויתור ${over.join(' ')}`)
      const href = await m.locator('.ar-comp-art .ar-acts a').getAttribute('href')
      ok(/&pool=/.test(href), 'יצירת כתבה: העלאה למוזיאון עם pool')
    }
    ok(!errs.length, `כתבות (${vp.width}): בלי שגיאות בדף ${errs.join(' | ')}`)
    await ctx.close()
  }
  await b.close()
  console.log(`\n${passed} עברו, ${fails.length} נכשלו`)
  process.exit(fails.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(1) })
