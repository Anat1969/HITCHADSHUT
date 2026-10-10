import type { CSSProperties } from 'react'
import type { ProjectStatus } from '../lib/types'
import { STATUS_COLOR, STATUS_LABEL, STATUS_MEANING, STATUS_ORDER } from '../lib/labels'

export default function StageTrack({ status }: { status: ProjectStatus }) {
  const idx = STATUS_ORDER.indexOf(status)
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <ol className="stages" aria-label="שלבי הפרויקט" style={{ '--stage-color': STATUS_COLOR[status] } as CSSProperties}>
        {STATUS_ORDER.map((s, i) => (
          <li key={s} className={i < idx ? 'done' : i === idx ? 'current' : ''} aria-current={i === idx ? 'step' : undefined}>
            <div className="bar" />
            {STATUS_LABEL[s]}
          </li>
        ))}
      </ol>
      <p className="stage-meaning">
        <strong>מה זה אומר עכשיו: </strong>
        {STATUS_MEANING[status]}
      </p>
    </div>
  )
}
