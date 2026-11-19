// Renders the city model film ("מודל העיר") frame by frame from the real model, then encodes it with ffmpeg.
//   node scripts/city-film/render.cjs <out.mp4> [--from=sec --to=sec --step=n]  (needs playwright-core, Chromium, ffmpeg)
// Data: city_twin from Supabase (rebuild it first: select plan_builders.build_city_twin();). Map: OpenFreeMap.
// Every frame waits until the map is idle, so the film is smooth even though software WebGL is slow.
const fs = require('fs')
const path = require('path')
const http = require('http')
const { execFileSync } = require('child_process')
const PW = process.env.PLAYWRIGHT_CORE || 'playwright-core'
const { chromium } = require(PW)

const ROOT = path.resolve(__dirname, '../..')
const OUT = path.resolve(process.argv[2] || 'city-film.mp4')
const arg = (k, d) => Number((process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d)
const FPS = 30
const EXAMPLE = 'תמל/2021'
const PUBLIC = '603-0828491' // the public plots plan, shown in its own segment

// --- static files for the page ------------------------------------------------------------------
const WORK = fs.mkdtempSync(path.join(require('os').tmpdir(), 'city-film-'))
const copy = (from, to) => fs.copyFileSync(path.join(ROOT, from), path.join(WORK, to || path.basename(from)))
copy('scripts/city-film/film.html')
for (const f of ['maplibre-gl.mjs', 'maplibre-gl-shared.mjs', 'maplibre-gl-worker.mjs', 'maplibre-gl.css']) copy(`node_modules/maplibre-gl/dist/${f}`)
copy('public/favicon.svg')
copy('public/ashdod-logo.png')
// Land-use palette straight from the app (src/lib/labels.ts), so the film matches the site.
const labels = fs.readFileSync(path.join(ROOT, 'src/lib/labels.ts'), 'utf8')
const block = labels.slice(labels.indexOf('export const LAND_USE'))
const LAND_USE = {}
for (const m of block.slice(0, block.indexOf('\n}')).matchAll(/(\w+):\s*\{\s*label:\s*'([^']+)',\s*color:\s*'([^']+)'/g)) LAND_USE[m[1]] = { label: m[2], color: m[3] }
fs.writeFileSync(path.join(WORK, 'land-use.json'), JSON.stringify(LAND_USE))
const sb = fs.readFileSync(path.join(ROOT, 'src/lib/supabase.ts'), 'utf8')
const URL_ = sb.match(/FALLBACK_URL = '([^']+)'/)[1]
const KEY = sb.match(/FALLBACK_KEY = '([^']+)'/)[1]
execFileSync('curl', ['-sf', '-H', `apikey: ${KEY}`, '-H', `Authorization: Bearer ${KEY}`, `${URL_}/rest/v1/city_twin?select=model&id=eq.1`, '-o', path.join(WORK, 'twin.json')])

const TYPES = { '.html': 'text/html', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }
const server = http.createServer((req, res) => {
  const f = path.join(WORK, decodeURIComponent(req.url.split('?')[0]))
  if (!f.startsWith(WORK) || !fs.existsSync(f)) return res.writeHead(404).end()
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }).end(fs.readFileSync(f))
})

// --- timeline ------------------------------------------------------------------------------------
const clamp = (x) => Math.max(0, Math.min(1, x))
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
const ramp = (t, a, b) => ease(clamp((t - a) / (b - a)))
const lerp = (a, b, k) => a + (b - a) * k
const fade = (t, a, b, f = 0.5) => Math.min(ramp(t, a, a + f), 1 - ramp(t, b - f, b))
const fmt = (n) => Math.round(n).toLocaleString('he-IL')

function timeline(plans, camAll, camEx) {
  const sum = (ps, k) => ps.filter((p) => p.units_planned != null && p.units_existing != null).reduce((s, p) => s + p[k], 0)
  const A = plans.filter((p) => p.stage === 'approved')
  const P = plans.filter((p) => p.stage === 'planning')
  const aE = sum(A, 'units_existing'), aP = sum(A, 'units_planned'), pE = sum(P, 'units_existing'), pP = sum(P, 'units_planned')
  const ex = plans.find((p) => p.plan_number === EXAMPLE)
  const lu = (k) => [LAND_USE[k].color, LAND_USE[k].label]
  const DUR = 76
  // Segments are timed to the narration (scripts/city-film/narration.json).
  const frame = (t) => {
    // Camera: overview orbit, fly to the example, orbit it, back out, slow orbit over the public buildings.
    const orbit = lerp(-34, 12, clamp(t / 31))
    let cam = { center: camAll.center, zoom: camAll.zoom - 0.35 * (1 - ramp(t, 0, 6)), pitch: 52, bearing: orbit }
    if (t > 31) {
      const k = ramp(t, 31, 35), back = ramp(t, 45.5, 49)
      const exBearing = lerp(-28, 6, clamp((t - 35) / 9))
      const fly = { center: [lerp(camAll.center[0], camEx.center[0], k), lerp(camAll.center[1], camEx.center[1], k)], zoom: lerp(camAll.zoom, camEx.zoom, k), pitch: lerp(52, 60, k), bearing: lerp(12, exBearing, k) }
      const outBearing = lerp(14, 34, clamp((t - 49) / 16))
      cam = back > 0 ? { center: [lerp(fly.center[0], camAll.center[0], back), lerp(fly.center[1], camAll.center[1], back)], zoom: lerp(fly.zoom, camAll.zoom - 0.2, back), pitch: lerp(60, 50, back), bearing: lerp(fly.bearing, outBearing, back) } : fly
    }
    const a = ramp(t, 11.5, 16.5)
    const p = ramp(t, 23.5, 28.5)
    // The example plan sinks back to today while the camera flies in, then rises again.
    const gf = t < 31 ? a : Math.max(1 - ramp(t, 31.5, 33.5), ramp(t, 36.5, 41.5))
    const st = { cam, a, p, focus: EXAMPLE, gf, useColors: t > 31 && t < 65, titleO: 1 - ramp(t, 3.2, 4.2), endO: ramp(t, 65.2, 66.4), legO: 0, capO: 0 }
    const uses = ['residential', 'commerce', 'public', 'open'].filter((k) => LAND_USE[k]).map(lu)
    if (t >= 4.2 && t < 11) Object.assign(st, { capO: fade(t, 4.4, 11), cap: { k: 'היום', h: 'כך נראית העיר היום', p: `${plans.length} תוכניות, כל אחת בקו הכחול שלה` } })
    if (t >= 11 && t < 23) Object.assign(st, { capO: fade(t, 11.1, 23), legO: fade(t, 11.1, 31), cap: { k: 'מאושר', h: `${A.length} תוכניות שכבר אושרו`, p: `<b>${fmt(aE)}</b> דירות היום ← <b>${fmt(aP)}</b> דירות לפי התוכניות` } })
    if (t >= 23 && t < 31) Object.assign(st, { capO: fade(t, 23.1, 31), legO: fade(t, 11.1, 31), cap: { k: 'בתכנון', h: `ועוד ${P.length} תוכניות בתכנון`, p: `<b>${fmt(pE)}</b> דירות היום ← <b>${fmt(pP)}</b> דירות, והן עוד יכולות להשתנות`, c: '#4A6FD8' } })
    if (t >= 11 && t < 31) st.legend = [['#D2D2D0', 'מבנים היום'], ['#3D3D3B', 'מאושר'], ['#4A6FD8', 'בתכנון']]
    if (t >= 33 && t < 46.5) {
      const rising = t > 36.5
      Object.assign(st, { capO: fade(t, 33.3, 46.5), legO: fade(t, 37, 46.5), legend: uses,
        cap: { k: `דוגמה · תוכנית ${EXAMPLE}`, h: ex.title, p: rising ? `<b>${fmt(ex.units_existing)}</b> דירות היום ← <b>${fmt(ex.units_planned)}</b> דירות, עם מבני ציבור, מסחר ושטח פתוח` : `היום: <b>${fmt(ex.units_existing)}</b> דירות בבנייני שיכון` } })
    }
    if (t >= 49.5 && t < 64.5)
      Object.assign(st, { capO: fade(t, 49.6, 64.5), legO: fade(t, 49.6, 64.5), legend: uses,
        cap: { k: `מבני ציבור · תוכנית ${PUBLIC}`, h: 'יותר מבני ציבור על אותה קרקע', p: `בכל מגרש ציבורי: עד <b>4</b> קומות, ותכסית שעולה מ-50% ל-<b>60%</b>. במודל: כ-<b>490</b> מגרשים (הערכה)` } })
    if (t >= 65) {
      const k = ramp(t, 65.5, 68.5)
      st.end = [aE + pE, lerp(aE + pE, aP + pE, k), lerp(aE + pE, aP + pP, k)]
    }
    return st
  }
  return { DUR, frame }
}

;(async () => {
  await new Promise((r) => server.listen(0, r))
  const port = server.address().port
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  page.on('pageerror', (e) => console.error('page:', e.message))
  page.on('console', (m) => process.env.FILM_DEBUG && console.error('console:', m.text().slice(0, 300)))
  page.on('requestfailed', (r) => process.env.FILM_DEBUG && console.error('failed:', r.url().slice(0, 120)))
  await page.goto(`http://localhost:${port}/film.html`)
  await page.waitForFunction(() => window.film?.ready, null, { timeout: Number(process.env.FILM_TIMEOUT || 120000) })
  await page.evaluate(() => document.fonts.ready)
  const { plans, camAll, camEx } = await page.evaluate((ex) => {
    const homes = window.film.plans.filter((p) => p.kind !== 'infrastructure' && p.units_planned).map((p) => window.film.bbox(p.plan_number))
    const b = homes.reduce((a, c) => [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[2]), Math.max(a[3], c[3])])
    return { plans: window.film.plans, camAll: window.film.camFor(b, 160, 52, 0), camEx: window.film.camFor(window.film.bbox(ex), 260, 60, -10) }
  }, EXAMPLE)
  const { DUR, frame } = timeline(plans, camAll, camEx)
  const from = arg('from', 0), to = arg('to', DUR), step = arg('step', 1)
  const frames = fs.mkdtempSync(path.join(require('os').tmpdir(), 'city-film-frames-'))
  let n = 0
  const t0 = Date.now()
  for (let i = Math.round(from * FPS); i < Math.round(to * FPS); i += step) {
    await page.evaluate((st) => window.film.set(st), frame(i / FPS))
    await page.evaluate(() => window.film.idle())
    await page.screenshot({ path: path.join(frames, `f${String(n++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
    if (n % 60 === 0) console.log(`frame ${n} (${(i / FPS).toFixed(1)}s) ${((Date.now() - t0) / n / 1000).toFixed(2)}s/frame`)
  }
  await browser.close()
  server.close()
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS / step), '-i', path.join(frames, 'f%05d.jpg'), '-c:v', 'libx264', '-preset', 'slow', '-crf', process.env.FILM_CRF || '31', '-tune', 'animation', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT])
  if (!process.env.NO_NARRATION) execFileSync('python3', ['-I', path.join(__dirname, 'narration.py'), OUT], { stdio: 'inherit' })
  console.log(`wrote ${OUT} (${n} frames, ${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB), frames in ${frames}`)
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
