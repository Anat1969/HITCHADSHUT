import type { LotData } from '../lib/types'

/** Spread `total` units over `floors` floors as evenly as possible. */
function perFloor(total: number, floors: number): number[] {
  const base = Math.floor(total / floors)
  const extra = total - base * floors
  return Array.from({ length: floors }, (_, i) => base + (i < extra ? 1 : 0))
}

function Facade({
  units,
  floors,
  small,
  micro,
  x,
  w,
  h,
  tone,
}: {
  units: number
  floors: number
  small: number
  micro: number
  x: number
  w: number
  h: number
  tone: 'before' | 'after'
}) {
  // Ground floor is a double-height lobby (plan section 4.1.2 א 2ב), so units start one level up.
  const rows = perFloor(units, floors - 1)
  const rowH = h / floors
  const cells: { x: number; y: number; w: number; fill: string }[] = []
  let n = 0
  rows.forEach((count, r) => {
    const y = h - rowH * (r + 2)
    const cw = w / count
    for (let c = 0; c < count; c++) {
      n++
      let fill = tone === 'before' ? '#D6D6D4' : '#B9B9B7'
      if (tone === 'after' && n <= micro) fill = '#141414'
      else if (tone === 'after' && n <= small) fill = '#6E6E6C'
      cells.push({ x: x + c * cw, y, w: cw, fill })
    }
  })
  return (
    <g>
      <rect x={x} y={0} width={w} height={h} fill="#F4F4F2" stroke="#111111" strokeWidth="1" />
      {cells.map((c, i) => (
        <rect key={i} x={c.x + 0.6} y={c.y + 0.6} width={Math.max(0.6, c.w - 1.2)} height={rowH - 1.2} fill={c.fill} />
      ))}
      <rect x={x} y={h - rowH} width={w} height={rowH} fill="#FFFFFF" stroke="#111111" strokeWidth="0.6" />
    </g>
  )
}

export default function UnitsCompare({ lot }: { lot: LotData }) {
  const H = 220
  const W = 92
  return (
    <figure className="units-compare">
      <svg viewBox={`0 0 ${W * 2 + 64} ${H + 4}`} role="img" aria-label={`מגרש ${lot.lot}: ${lot.units_before_est} דירות לפני, ${lot.units} אחרי, באותו בניין`}>
        <Facade units={lot.units_before_est} floors={lot.floors_above} small={0} micro={0} x={W + 40} w={W} h={H} tone="before" />
        <Facade units={lot.units} floors={lot.floors_above} small={lot.small_75_min} micro={lot.micro_55_min} x={16} w={W} h={H} tone="after" />
      </svg>
      <figcaption>
        <div>
          <b>{lot.units_before_est}</b>
          <span>דירות היום · כ-{lot.avg_unit_m2_before_est} מ"ר</span>
        </div>
        <div>
          <b>{lot.units}</b>
          <span>דירות אחרי · כ-{lot.avg_unit_m2_after} מ"ר</span>
        </div>
      </figcaption>
    </figure>
  )
}
