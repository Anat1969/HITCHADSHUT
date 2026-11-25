// Copies the shared urban-twin standard from PLANS-GH (the source) into this repo, byte for byte.
// Usage: node scripts/urban-standard/sync.mjs <path to PLANS-GH>      (copy)
//        node scripts/urban-standard/sync.mjs <path to PLANS-GH> --check   (exit 1 if the copy differs)
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const [src, flag] = process.argv.slice(2)
if (!src) { console.error('usage: sync.mjs <PLANS-GH> [--check]'); process.exit(2) }
const here = dirname(fileURLToPath(import.meta.url)), repo = join(here, '..', '..')
const pairs = [[join(src, 'standard/urban-standard.mjs'), join(repo, 'src/lib/urban-standard/urban-standard.js')],
  [join(src, 'data/urban-standard/legend-harvest.json'), join(repo, 'src/lib/urban-standard/legend-harvest.json')]]
let bad = 0
for (const [a, b] of pairs) {
  const A = readFileSync(a, 'utf8'), B = existsSync(b) ? readFileSync(b, 'utf8') : null
  if (flag === '--check') { if (A !== B) { console.error(`differs: ${b}`); bad++ } }
  else { writeFileSync(b, A); console.log(`copied ${a} -> ${b}`) }
}
process.exit(bad ? 1 : 0)
