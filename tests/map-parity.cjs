// Map Interaction Standard: the same mouse and keyboard action gives the same result in every map engine
// (Leaflet = home map, MapLibre = city model and plan 3D, Three.js OrbitControls = PLANS-GH model and entry page).
// Usage: node tests/map-parity.cjs [path to PLANS-GH, default ../PLANS-GH]
const http = require('http'), fs = require('fs'), path = require('path')
const { chromium } = require('playwright')
const HS = path.resolve(__dirname, '..'), PG = path.resolve(process.argv[2] || path.join(HS, '..', 'PLANS-GH'))
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json' }
const srv = http.createServer((q, s) => {
  const u = decodeURIComponent(q.url.split('?')[0]), root = u.startsWith('/pg/') ? PG : HS, rel = u.replace(/^\/(pg|hs)\//, '/')
  const f = u === '/' ? path.join(HS, 'tests/fixtures/map-parity.html') : path.join(root, rel)
  fs.readFile(f, (e, b) => { if (e) { s.writeHead(404); return s.end() } s.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); s.end(b) })
})
const results = []
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'עובר ' : 'נכשל '} ${name}${detail ? `  (${detail})` : ''}`) }
const near = (a, b, t) => Math.abs(a - b) <= t
;(async () => {
  await new Promise((r) => srv.listen(0, r))
  const port = srv.address().port
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const page = await browser.newPage({ viewport: { width: 1300, height: 400 } })
  page.on('pageerror', (e) => console.error('pageerror', e.message))
  await page.goto(`http://localhost:${port}/`)
  await page.waitForFunction(() => window.READY)
  await page.evaluate(() => P.ready())
  const box = {}
  for (const id of ['lf', 'ml', 'th']) box[id] = await page.locator('#' + id).boundingBox()
  const wait = (ms) => page.waitForTimeout(ms)
  const st = () => page.evaluate(() => P.state())
  // screen position (in the map) of a ground point, per engine
  const toScreen = (id, c) => page.evaluate(([id, c]) => {
    if (id === 'lf') { const p = window.__lf.latLngToContainerPoint([c[1], c[0]]); return [p.x, p.y] }
    if (id === 'ml') { const p = window.__ml.project(c); return [p.x, p.y] }
    return P.screenOf([c[0], 0, c[1]])
  }, [id, c])
  const engines = ['lf', 'ml', 'th']

  // 1. wheel: one notch = +0.5 zoom, around the cursor
  for (const id of engines) {
    await page.evaluate(() => P.reset()); await wait(150)
    const b = box[id], px = 300, py = 90
    await page.mouse.move(b.x + px, b.y + py)
    const s0 = await st(), u0 = (await page.evaluate(([x, y]) => P.under(x, y), [px, py]))[id]
    await page.mouse.wheel(0, -100); await wait(900)
    const s1 = await st()
    const dz = id === 'th' ? Math.log2(s0.th.dist / s1.th.dist) : s1[id].zoom - s0[id].zoom
    ok(`גלגלת, ${id}: הזזה אחת = חצי רמה`, near(dz, 0.5, 0.15), `Δ${dz.toFixed(2)}`)
    if (id !== 'lf') { // Leaflet without tiles: anchor checked by Leaflet's own around-cursor zoom
      const u1 = (await page.evaluate(([x, y]) => P.under(x, y), [px, py]))[id]
      const drift = id === 'th' ? Math.hypot(u1[0] - u0[0], u1[1] - u0[1]) / s1.th.dist * 400 : Math.hypot(u1[0] - u0[0], u1[1] - u0[1]) * 111000 / (156543 * Math.cos(0.555) / 2 ** s1.ml.zoom)
      ok(`גלגלת, ${id}: הנקודה שמתחת לסמן נשארת במקומה`, drift < 8, `${drift.toFixed(1)}px`)
    }
  }
  // 2. keys + and -, arrows, shift+arrows, N, 0
  for (const id of engines) {
    await page.evaluate(() => P.reset()); await wait(150)
    const sel = id === 'th' ? '#th canvas' : '#' + id
    await page.focus(sel)
    let s0 = await st()
    await page.keyboard.press('+'); await wait(900)
    let s1 = await st()
    const dz = id === 'th' ? Math.log2(s0.th.dist / s1.th.dist) : s1[id].zoom - s0[id].zoom
    ok(`מקש +, ${id}: רמה אחת`, near(dz, 1, 0.1), `Δ${dz.toFixed(2)}`)
    await page.keyboard.press('-'); await wait(900)
    s0 = await st()
    await page.keyboard.press('ArrowRight'); await wait(900)
    s1 = await st()
    let moved
    if (id === 'lf') moved = (s1.lf.center.lng - s0.lf.center.lng) > 0
    else if (id === 'ml') moved = (s1.ml.center.lng - s0.ml.center.lng) > 0
    else moved = s1.th.target[0] - s0.th.target[0] > 0
    ok(`חץ ימינה, ${id}: המבט זז מזרחה`, moved)
    if (id === 'lf') continue
    s0 = await st(); await page.keyboard.press('Shift+ArrowRight'); await wait(900); s1 = await st()
    const db = ((s1[id].bearing - s0[id].bearing + 540) % 360) - 180
    ok(`Shift+חץ ימינה, ${id}: סיבוב של 15°`, near(db, 15, 1.5), `Δ${db.toFixed(1)}°`)
    s0 = await st(); await page.keyboard.press('Shift+ArrowUp'); await wait(900); s1 = await st()
    const dp = s1[id].pitch - s0[id].pitch
    ok(`Shift+חץ למעלה, ${id}: הטיה של 10°`, near(dp, 10, 1.5), `Δ${dp.toFixed(1)}°`)
    await page.keyboard.press('n'); await wait(900); s1 = await st()
    const b0 = ((s1[id].bearing + 540) % 360) - 180
    ok(`N, ${id}: הצפנה`, near(b0, 0, 1), `${b0.toFixed(1)}°`)
  }
  // 3. left drag = pan, right drag = rotate
  for (const id of engines) {
    await page.evaluate(() => P.reset()); await wait(150)
    const b = box[id], x0 = b.x + 200, y0 = b.y + 150
    let s0 = await st()
    await page.mouse.move(x0, y0); await page.mouse.down(); for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + i * 10, y0)
    await page.mouse.up(); await wait(700)
    let s1 = await st()
    const panned = id === 'lf' ? s1.lf.center.lng < s0.lf.center.lng : id === 'ml' ? s1.ml.center.lng < s0.ml.center.lng : s1.th.target[0] < s0.th.target[0]
    ok(`גרירה שמאלית ימינה, ${id}: הזזה (המפה נגררת עם הסמן)`, panned)
    if (id !== 'lf') ok(`גרירה שמאלית, ${id}: בלי סיבוב`, Math.abs(((s1[id].bearing - s0[id].bearing + 540) % 360) - 180) < 1)
    await page.evaluate(() => P.reset()); await wait(150)
    s0 = await st()
    await page.mouse.move(x0, y0); await page.mouse.down({ button: 'right' }); for (let i = 1; i <= 8; i++) await page.mouse.move(x0 + i * 10, y0)
    await page.mouse.up({ button: 'right' }); await wait(700)
    s1 = await st()
    if (id === 'lf') ok(`גרירה ימנית, lf: אין סיבוב בדו־ממד, המפה לא זזה`, Math.abs(s1.lf.center.lng - s0.lf.center.lng) < 1e-9)
    else { const db = ((s1[id].bearing - s0[id].bearing + 540) % 360) - 180; ok(`גרירה ימנית ימינה, ${id}: סיבוב`, Math.abs(db) > 3, `Δ${db.toFixed(1)}°`); results.push({ rot: id, db }) }
  }
  const rots = results.filter((r) => r.rot)
  if (rots.length === 2) ok('גרירה ימנית: אותו כיוון סיבוב ב-MapLibre וב-Three', Math.sign(rots[0].db) === Math.sign(rots[1].db), rots.map((r) => `${r.rot} ${r.db.toFixed(1)}`).join(', '))
  // 4. click vs drag: 3 px = click, 9 px = drag
  for (const id of engines) {
    await page.evaluate(() => P.reset()); await wait(150)
    const b = box[id], x0 = b.x + 120, y0 = b.y + 200
    for (const [d, want] of [[3, 1], [5, 1], [6, 0], [9, 0]]) {
      const c0 = (await st())[id].clicks
      await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x0 + d, y0); await page.mouse.up(); await wait(400)
      const c1 = (await st())[id].clicks
      ok(`לחיצה עם תזוזה של ${d} פיקסלים, ${id}: ${want ? 'בחירה' : 'גרירה, בלי בחירה'}`, c1 - c0 === want, `${c1 - c0}`)
    }
  }
  await browser.close(); srv.close()
  const fail = results.filter((r) => r.name && !r.pass)
  console.log(`\n${results.filter((r) => r.name).length - fail.length} עוברות, ${fail.length} נכשלות`)
  process.exit(fail.length ? 1 : 0)
})().catch((e) => { console.error(e); process.exit(2) })
