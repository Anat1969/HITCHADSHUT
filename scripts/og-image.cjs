// Renders public/og.png, the link-preview image (1200x630) shown when the app link is shared.
// It screenshots the real home page with the current project list.
//
// 1. Export the projects (compact JSON) from the database:
//      select jsonb_agg(jsonb_build_object('t',title,'n',plan_number,'s',status,'k',kind,'u',units_planned,
//        'e',units_existing,'q',quarter_id,'c',center,'g',<polygon coordinates>)) from plan_projects where published;
// 2. npm run build && npx vite preview --port 4173 &
// 3. node scripts/og-image.cjs <projects.json> [public/og.png]
//
// Map tiles are replaced by a plain light tile, so the image does not depend on a tile server.
const fs = require('fs')
const path = require('path')
const { chromium } = require('playwright-core')

const [, , dataPath, outPath = 'public/og.png'] = process.argv
if (!dataPath) {
  console.error('usage: node scripts/og-image.cjs <projects.json> [out.png]')
  process.exit(1)
}

const QUARTERS = { a: "א'", b: "ב'", c: "ג'", d: "ד'", e: "ה'", f: "ו'", g: "ז'", h: "ח'", i: "ט'", j: "י'" }
const compact = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
const now = new Date().toISOString()
const projects = compact.map((p, i) => ({
  id: `og-${i}`, title: p.t, plan_number: p.n, status: p.s, kind: p.k, units_planned: p.u, units_existing: p.e,
  quarter_id: p.q, center: p.c, published: true, created_at: now, updated_at: now, plan_media: [],
  summary: null, description: null, address: null, developer: null, floors: null, story: null, model_url: null,
  cover_media_id: null, renewal_track: null, public_benefits: null, expected_completion: null, contact_info: null, source_id: null,
  geojson: { type: 'FeatureCollection', features: (p.g || []).map((coordinates) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates } })) },
}))
const quarters = Object.entries(QUARTERS).map(([k, v]) => ({ id: `q-${k}`, name: `רובע ${v}` }))

// A 1x1 light PNG, stretched over every map tile.
const TILE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP49PENAAWoAtD979jYAAAAAElFTkSuQmCC', 'base64')

;(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' })
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, locale: 'he-IL' })
  // The catch-all first: routes registered later take priority.
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1|fonts\.(googleapis|gstatic)\.com).*/, (r) => r.fulfill({ status: 204, body: '' }))
  await page.route(/tile|basemaps/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: TILE }))
  await page.route(/supabase\.co\/rest\/v1\/(\w+)/, (r) => {
    const table = r.request().url().match(/rest\/v1\/(\w+)/)[1]
    const body = table === 'plan_projects' ? projects : table === 'quarters' ? quarters : []
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  if (process.env.OG_DEBUG) page.on('request', (q) => console.log(q.url().slice(0, 100)))
  await page.goto(process.env.OG_URL || 'http://localhost:4173/', { waitUntil: 'networkidle' })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: outPath, type: 'png' })
  await browser.close()
  console.log(`wrote ${path.resolve(outPath)} (${fs.statSync(outPath).size} bytes)`)
})()
