import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// "שער היעדים" (Anat1969/pro-metrics-vue-GH): האם התוכנית עומדת ביעד של שלב האישור שלה.
// קורא רק את המדידה של שכונה 360 (shchuna_plan_scores) ומחשב כמו שתי האפליקציות האחרות,
// כדי שאותה תוכנית תקבל אותו מספר בכל מקום. ההחלטה המלאה, הבדיקות והמכתב ליזם: בדוח של שער היעדים.
const GATE_APP = 'https://shchuna-360.vercel.app'
const MEASURE_APP = 'https://shchuna360.vercel.app'
const TARGET = 55 // ברירת מחדל: דרגת ארד, 55 מתוך 120. העירייה קובעת את היעד בפועל.
// ניקוד מרבי לכל מדד לפי סדר החוברת (שכונה 360°, גרסה 2.0). מדד 41 = 3, וכך הסך 120.
const MAX = [2, 2, 4, 2, 2, 3, 2, 3, 3, 5, 2, 4, 4, 3, 4, 3, 1, 7, 2, 1, 3, 4, 4, 2, 5, 1, 2, 2, 6, 3, 1, 2, 1, 1, 1, 3, 5, 2, 2, 2, 3, 1, 2, 3]
// מדדים שאפשר לדרוש במלואם רק בתוכנית הבינוי. כל השאר: כבר בתב"ע (עד 94 נקודות).
const BINUI = new Set([11, 16, 17, 19, 20, 24, 27, 28, 30, 34, 39, 43, 44])

type Evidence = { score: number | null; note?: string | null }
type Gate = 'taba' | 'binui' | 'after'
const GATE_HE: Record<Gate, string> = { taba: 'אישור התב"ע', binui: 'אישור תוכנית הבינוי', after: 'ההיתר והביצוע' }
const VERDICT: Record<'pass' | 'evidence' | 'fail', { label: string; line: string }> = {
  pass: { label: 'עומדת ביעד', line: 'מה שהוכח במסמכים כבר מגיע ליעד.' },
  evidence: { label: 'תלויה בראיות', line: 'היעד אפשרי, אם היזם יציג מסמכים לנושאים שעוד לא נבדקו.' },
  fail: { label: 'לא עומדת ביעד', line: 'גם עם כל המסמכים החסרים היעד לא מושג בשלב הזה. נדרש שינוי בתוכנית.' },
}

export default function GateCard({ projectId, status }: { projectId: string; status: string | null }) {
  const [row, setRow] = useState<{ metrics: Record<string, Evidence>; measured_at: string } | null | undefined>(undefined)

  useEffect(() => {
    supabase
      .from('shchuna_plan_scores')
      .select('metrics, measured_at')
      .eq('plan_project_id', projectId)
      .maybeSingle()
      .then(({ data, error }) => setRow(error ? null : ((data as typeof row) ?? null)))
  }, [projectId])

  if (!row) return null // אין מדידה: הכרטיס לא מוצג, והעמוד נשאר כמו שהיה

  const gate: Gate = status === 'planning' ? 'taba' : status === 'approved' ? 'binui' : 'after'
  let got = 0, nowMax = 0, open = 0, missingDocs = 0
  MAX.forEach((max, i) => {
    const n = i + 1
    const e = row.metrics[String(n)]
    if (e && e.score == null && /לא רלוונטי/.test(e.note ?? '')) return
    const here = gate !== 'taba' || !BINUI.has(n)
    if (here) nowMax += max
    if (e && e.score != null) {
      const s = Math.max(0, Math.min(e.score, max))
      got += s
      if (here) open += max - s
    } else if (here) {
      open += max
      missingDocs++
    }
  })
  const points = Math.round((Math.round((got / 120) * 100) / 100) * 120)
  const verdict = points >= TARGET ? 'pass' : points + open >= TARGET ? 'evidence' : 'fail'
  const date = new Date(row.measured_at).toLocaleDateString('he-IL')

  return (
    <section className="mag-chapter gate-card" id="gate" aria-labelledby="h-gate">
      <div>
        <span className="mag-label">שכונה 360°</span>
        <h2 id="h-gate">שער היעדים</h2>
      </div>
      <div>
        <p className="lead">
          {VERDICT[verdict].label} לקראת {GATE_HE[gate]}.
        </p>
        <p>{VERDICT[verdict].line}</p>
        <ul className="gate-facts">
          <li>
            <b>{points}</b> נקודות הוכחו במסמכים, מתוך 120. <em className="chip">מדידה</em>
          </li>
          <li>
            בשלב הזה אפשר לדרוש עד <b>{nowMax}</b> נקודות, והיעד הוא <b>{TARGET}</b>. <em className="chip">הערכה</em>
          </li>
          <li>
            עוד <b>{open}</b> נקודות פתוחות בשלב, ו-<b>{missingDocs}</b> נושאים שהמסמכים לא מתייחסים אליהם עדיין.
          </li>
        </ul>
        <p className="gate-links">
          <a className="mag-pill" href={`${GATE_APP}/#/report/${projectId}`} target="_blank" rel="noreferrer">
            הדוח המלא: מה לדרוש מהיזם
          </a>
          <a className="mag-pill light" href={`${MEASURE_APP}/plans/${projectId}`} target="_blank" rel="noreferrer">
            הניקוד, נושא אחר נושא
          </a>
        </p>
        <p className="mag-src">
          המדידה: שכונה 360°, גרסה 2.0 (המועצה הישראלית לבנייה ירוקה ומשרד הבינוי), {date}. היעד הוא ברירת מחדל, דרגת ארד.
        </p>
      </div>
    </section>
  )
}
