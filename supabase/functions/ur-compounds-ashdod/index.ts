// Reads the government GIS layer of urban renewal compounds (data.gov.il, shapefile in a ZIP, ITM)
// and returns the compounds of one city as GeoJSON-like features, coordinates still in ITM (EPSG:2039).
// The database reprojects them (see supabase/seed/ur-compounds-ashdod.sql).
// GET ?layer=declared|masterplans  &q=<text to match in any attribute, default אשדוד>  &meta=1 for the file list only.
// Deployed with verify_jwt off: it only reads public open data.
import { unzipSync } from 'npm:fflate@0.8.2'

const PATHS: Record<string, string> = {
  declared: '/dataset/1de95a22-576e-4e9c-b7c4-59db01d85290/resource/ceb7bbb0-e2db-4e87-8a6c-0a250f5de001/download/officiallydeclaredprojects.zip',
  masterplans: '/dataset/1de95a22-576e-4e9c-b7c4-59db01d85290/resource/38555a84-8523-4ab1-9fe5-df6b523c15ea/download/masterplans.zip',
}
// data.gov.il answers 403 to requests without a browser user agent.
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', Accept: '*/*' }

function parseDbf(buf: Uint8Array, enc: string) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const n = dv.getUint32(4, true)
  const hlen = dv.getUint16(8, true)
  const rlen = dv.getUint16(10, true)
  const fields: { name: string; len: number }[] = []
  for (let o = 32; buf[o] !== 0x0d && o < hlen; o += 32) {
    const name = new TextDecoder('ascii').decode(buf.slice(o, o + 11)).replace(/\0.*$/, '')
    fields.push({ name, len: buf[o + 16] })
  }
  const td = new TextDecoder(enc)
  const rows: Record<string, string>[] = []
  for (let i = 0; i < n; i++) {
    let o = hlen + i * rlen + 1
    const r: Record<string, string> = {}
    for (const f of fields) {
      r[f.name] = td.decode(buf.slice(o, o + f.len)).trim()
      o += f.len
    }
    rows.push(r)
  }
  return rows
}

function parseShp(buf: Uint8Array) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const out: number[][][][] = []
  let o = 100
  while (o + 8 <= buf.byteLength) {
    const clen = dv.getInt32(o + 4, false) * 2
    const c = o + 8
    const type = dv.getInt32(c, true)
    const rings: number[][][] = []
    if (type === 5 || type === 15 || type === 25) {
      const np = dv.getInt32(c + 36, true)
      const npt = dv.getInt32(c + 40, true)
      const parts: number[] = []
      for (let k = 0; k < np; k++) parts.push(dv.getInt32(c + 44 + 4 * k, true))
      const p0 = c + 44 + 4 * np
      for (let k = 0; k < np; k++) {
        const end = k + 1 < np ? parts[k + 1] : npt
        const ring: number[][] = []
        for (let q = parts[k]; q < end; q++) ring.push([Math.round(dv.getFloat64(p0 + 16 * q, true) * 100) / 100, Math.round(dv.getFloat64(p0 + 16 * q + 8, true) * 100) / 100])
        rings.push(ring)
      }
    }
    out.push(rings)
    o = c + clen
  }
  return out
}

async function download(path: string) {
  const errs: string[] = []
  for (const host of ['https://data.gov.il', 'https://aws-e.data.gov.il']) {
    const res = await fetch(host + path, { headers: HEADERS, redirect: 'follow' })
    if (res.ok) return new Uint8Array(await res.arrayBuffer())
    errs.push(host + ' ' + res.status)
  }
  throw new Error(errs.join('; '))
}

Deno.serve(async (req) => {
  const u = new URL(req.url)
  const which = u.searchParams.get('layer') ?? 'declared'
  const q = u.searchParams.get('q') ?? 'אשדוד'
  let zip: Uint8Array
  try {
    zip = await download(PATHS[which])
  } catch (e) {
    return new Response('download failed ' + (e as Error).message, { status: 502 })
  }
  const files = unzipSync(zip)
  const names = Object.keys(files)
  const pick = (ext: string) => names.find((n) => n.toLowerCase().endsWith(ext))
  const cpg = pick('.cpg')
  const enc = (cpg ? new TextDecoder().decode(files[cpg]).trim() : '') || 'windows-1255'
  const rows = parseDbf(files[pick('.dbf')!], /utf/i.test(enc) ? 'utf-8' : 'windows-1255')
  const prj = pick('.prj') ? new TextDecoder().decode(files[pick('.prj')!]) : null
  if (u.searchParams.get('meta')) return Response.json({ names, enc, prj, count: rows.length, sample: rows.slice(0, 3) })
  const geoms = parseShp(files[pick('.shp')!])
  const feats: unknown[] = []
  rows.forEach((r, i) => {
    if (Object.values(r).some((v) => v.includes(q))) feats.push({ type: 'Feature', properties: r, geometry: { type: 'Polygon', coordinates: geoms[i] } })
  })
  return Response.json({ prj, enc, total: rows.length, features: feats })
})
