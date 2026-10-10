import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Feedback, FeedbackStatus } from '../lib/types'
import { FEEDBACK_LABEL } from '../lib/labels'
import { useToast } from './toast'

type Row = Feedback & { plan_projects: { title: string } | null }

const dateFmt = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const TABS: [FeedbackStatus, string][] = [
  ['pending', 'ממתינות לבדיקה'],
  ['approved', 'מפורסמות'],
  ['rejected', 'נדחו'],
]

export default function Moderation({ onChange }: { onChange: () => void }) {
  const [tab, setTab] = useState<FeedbackStatus>('pending')
  const [rows, setRows] = useState<Row[] | null>(null)
  const toast = useToast()

  const load = () => {
    setRows(null)
    supabase
      .from('plan_feedback')
      .select('*, plan_projects(title)')
      .eq('status', tab)
      .order('created_at', { ascending: tab === 'pending' })
      .then(({ data }) => setRows((data ?? []) as Row[]))
  }
  useEffect(load, [tab])

  async function setStatus(r: Row, status: FeedbackStatus) {
    const { error } = await supabase.from('plan_feedback').update({ status }).eq('id', r.id)
    if (error) return toast('העדכון נכשל')
    toast(status === 'approved' ? 'התגובה פורסמה' : status === 'rejected' ? 'התגובה נדחתה' : 'הוחזר לבדיקה')
    setRows((rs) => rs?.filter((x) => x.id !== r.id) ?? null)
    onChange()
  }

  async function saveReply(r: Row, reply: string) {
    const clean = reply.trim() || null
    const { error } = await supabase
      .from('plan_feedback')
      .update({ reply: clean, replied_at: clean ? new Date().toISOString() : null })
      .eq('id', r.id)
    if (error) return toast('שמירת התשובה נכשלה')
    toast('התשובה נשמרה')
    setRows((rs) => rs?.map((x) => (x.id === r.id ? { ...x, reply: clean } : x)) ?? null)
  }

  async function remove(r: Row) {
    if (!confirm('למחוק את התגובה לצמיתות?')) return
    const { error } = await supabase.from('plan_feedback').delete().eq('id', r.id)
    if (error) return toast('המחיקה נכשלה')
    setRows((rs) => rs?.filter((x) => x.id !== r.id) ?? null)
    onChange()
  }

  return (
    <>
      <div className="admin-head">
        <div>
          <h2>תגובות תושבים</h2>
          <p className="muted">תגובה מתפרסמת רק אחרי אישור. תשובה שתכתבו מופיעה מתחת לתגובה באתר.</p>
        </div>
        <div className="chips">
          {TABS.map(([k, l]) => (
            <button key={k} className="chip" aria-pressed={tab === k} onClick={() => setTab(k)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {rows === null ? (
        <div className="loading">טוען...</div>
      ) : rows.length === 0 ? (
        <div className="box empty">
          <h3>{tab === 'pending' ? 'אין תגובות שממתינות' : 'אין תגובות כאן'}</h3>
        </div>
      ) : (
        rows.map((r) => (
          <div className="box" key={r.id} style={{ gap: 12 }}>
            <div className="box-head">
              <div>
                <span className="badge">{FEEDBACK_LABEL[r.kind]}</span>{' '}
                <Link to={`/admin/p/${r.project_id}`} style={{ fontWeight: 700 }}>
                  {r.plan_projects?.title ?? 'פרויקט'}
                </Link>
              </div>
              <span className="muted" style={{ fontSize: 14 }}>
                {r.author_name || 'ללא שם'} · {dateFmt.format(new Date(r.created_at))}
              </span>
            </div>
            <p style={{ whiteSpace: 'pre-line', fontSize: 17 }}>{r.body}</p>
            <ReplyBox initial={r.reply ?? ''} onSave={(v) => saveReply(r, v)} />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {r.status !== 'approved' && (
                <button className="btn btn-primary btn-sm" onClick={() => setStatus(r, 'approved')}>
                  אישור ופרסום
                </button>
              )}
              {r.status !== 'rejected' && (
                <button className="btn btn-sm" onClick={() => setStatus(r, 'rejected')}>
                  דחייה
                </button>
              )}
              {r.status !== 'pending' && (
                <button className="btn btn-sm btn-ghost" onClick={() => setStatus(r, 'pending')}>
                  החזרה לבדיקה
                </button>
              )}
              <button className="btn btn-sm btn-danger" onClick={() => remove(r)} style={{ marginInlineStart: 'auto' }}>
                מחיקה
              </button>
            </div>
          </div>
        ))
      )}
    </>
  )
}

function ReplyBox({ initial, onSave }: { initial: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial)
  const changed = v.trim() !== initial.trim()
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label className="field">
        <span>תשובת העירייה (לא חובה)</span>
        <textarea className="textarea" style={{ minHeight: 70 }} value={v} onChange={(e) => setV(e.target.value)} />
      </label>
      {changed && (
        <button className="btn btn-sm" style={{ justifySelf: 'start' }} onClick={() => onSave(v)}>
          שמירת התשובה
        </button>
      )}
    </div>
  )
}
