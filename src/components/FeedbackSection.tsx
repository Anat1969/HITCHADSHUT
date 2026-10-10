import { useEffect, useState } from 'react'
import type { Feedback, FeedbackKind } from '../lib/types'
import { FEEDBACK_LABEL, FEEDBACK_PROMPT } from '../lib/labels'
import { fetchApprovedFeedback, submitFeedback } from '../lib/data'

const KINDS: FeedbackKind[] = ['question', 'support', 'concern', 'idea']
const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric' })

export default function FeedbackSection({ projectId, canPost = true }: { projectId: string; canPost?: boolean }) {
  const [items, setItems] = useState<Feedback[] | null>(null)
  const [kind, setKind] = useState<FeedbackKind>('question')
  const [body, setBody] = useState('')
  const [name, setName] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setItems(null)
    setState('idle')
    fetchApprovedFeedback(projectId)
      .then((d) => alive && setItems(d))
      .catch(() => alive && setItems([]))
    return () => {
      alive = false
    }
  }, [projectId])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (body.trim().length < 3) {
      setError('כתבו לפחות כמה מילים')
      setState('error')
      return
    }
    setState('sending')
    try {
      await submitFeedback({ project_id: projectId, kind, body: body.trim(), author_name: name.trim() || null })
      setBody('')
      setState('sent')
    } catch {
      setError('השליחה לא הצליחה. נסו שוב בעוד רגע.')
      setState('error')
    }
  }

  return (
    <section className="section" aria-labelledby={`fb-${projectId}`}>
      <h3 id={`fb-${projectId}`}>שאלות ותגובות של תושבים</h3>
      <p className="muted" style={{ fontSize: 15 }}>
        כל תגובה נקראת על ידי צוות העירייה. תגובות מתפרסמות כאן אחרי בדיקה, ולשאלות נוסיף תשובה.
      </p>

      {items === null ? (
        <p className="muted">טוען תגובות...</p>
      ) : items.length === 0 ? (
        <p className="muted">עדיין אין תגובות שפורסמו. אפשר להיות הראשונים.</p>
      ) : (
        <div className="fb-list">
          {items.map((f) => (
            <article className="fb" key={f.id}>
              <div className="fb-head">
                <span className="fb-kind">
                  {FEEDBACK_LABEL[f.kind]}
                  {f.author_name ? ` · ${f.author_name}` : ''}
                </span>
                <time dateTime={f.created_at}>{dateFmt.format(new Date(f.created_at))}</time>
              </div>
              <p style={{ whiteSpace: 'pre-line' }}>{f.body}</p>
              {f.reply && (
                <div className="fb-reply">
                  <b>תשובת העירייה</b>
                  <span style={{ whiteSpace: 'pre-line' }}>{f.reply}</span>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {canPost &&
        (state === 'sent' ? (
          <div className="notice notice-ok" role="status">
            תודה. התגובה התקבלה ותתפרסם אחרי בדיקה של צוות העירייה.{' '}
            <button className="btn btn-ghost btn-sm" onClick={() => setState('idle')}>
              כתיבת תגובה נוספת
            </button>
          </div>
        ) : (
          <form className="fb-form" onSubmit={send}>
            <div className="seg" role="group" aria-label="סוג התגובה">
              {KINDS.map((k) => (
                <button type="button" key={k} aria-pressed={kind === k} onClick={() => setKind(k)}>
                  {FEEDBACK_LABEL[k]}
                </button>
              ))}
            </div>
            <label className="field">
              <span className="visually-hidden">התגובה שלך</span>
              <textarea
                className="textarea"
                placeholder={FEEDBACK_PROMPT[kind]}
                value={body}
                maxLength={2000}
                onChange={(e) => setBody(e.target.value)}
              />
            </label>
            <label className="field">
              <span>שם (לא חובה)</span>
              <input className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="אפשר גם בלי שם" />
            </label>
            {state === 'error' && <div className="notice notice-error">{error}</div>}
            <button className="btn btn-primary" type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'שולח...' : 'שליחה לצוות העירייה'}
            </button>
            <small className="muted">אין צורך בהרשמה. לא נפרסם פרטים מזהים מעבר לשם שבחרתם לכתוב.</small>
          </form>
        ))}
    </section>
  )
}
