import { useRef, useState } from 'react'
import type { Media } from '../lib/types'
import { supabase } from '../lib/supabase'
import { embedUrl, kindForFile, mediaSrc, sortMedia } from '../lib/media'
import { deleteMedia, uploadMediaFile, UploadError } from '../lib/upload'
import { useToast } from './toast'

const KIND_NAME: Record<Media['kind'], string> = {
  render: 'הדמיה',
  video: 'סרטון',
  video_link: 'קישור לסרטון',
  kml: 'KML',
  document: 'מסמך',
}

interface Props {
  projectId: string
  media: Media[]
  coverId: string | null
  onChange: () => void
  onCover: (id: string | null) => void
}

export default function MediaManager({ projectId, media, coverId, onChange, onCover }: Props) {
  const toast = useToast()
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [link, setLink] = useState('')
  const [linkCaption, setLinkCaption] = useState('')

  const sorted = sortMedia(media.filter((m) => m.kind !== 'kml'))
  const maxSort = media.reduce((a, m) => Math.max(a, m.sort), 0)

  async function upload(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => {
      const k = kindForFile(f)
      return k && k !== 'kml'
    })
    const skipped = Array.from(files).length - list.length
    const errs: string[] = skipped ? [`${skipped} קבצים דולגו: נתמכים תמונות, סרטונים ו-PDF. קובץ KML מעלים באזור המיקום.`] : []
    let sort = maxSort
    let ok = 0
    let coverSet = !!coverId || sorted.some((x) => x.kind === 'render')
    for (let i = 0; i < list.length; i++) {
      setProgress({ done: i, total: list.length, name: list[i].name })
      try {
        const m = await uploadMediaFile(projectId, list[i], { sort: ++sort })
        ok++
        if (m.kind === 'render' && !coverSet) {
          coverSet = true
          onCover(m.id)
        }
      } catch (e) {
        errs.push(e instanceof UploadError ? e.message : `ההעלאה של "${list[i].name}" נכשלה`)
      }
    }
    setProgress(null)
    setErrors(errs)
    if (ok) toast(ok === 1 ? 'הקובץ הועלה' : `הועלו ${ok} קבצים`)
    onChange()
  }

  async function addLink() {
    const url = link.trim()
    if (!/^https?:\/\//.test(url)) {
      toast('הדביקו קישור מלא שמתחיל ב-https')
      return
    }
    const { error } = await supabase
      .from('plan_media')
      .insert({ project_id: projectId, kind: 'video_link', url, caption: linkCaption.trim() || null, sort: maxSort + 1 })
    if (error) toast('השמירה נכשלה')
    else {
      setLink('')
      setLinkCaption('')
      toast(embedUrl(url) ? 'הסרטון נוסף' : 'הקישור נוסף. הוא יוצג כקישור, לא כנגן.')
      onChange()
    }
  }

  async function saveCaption(m: Media, caption: string) {
    if ((m.caption ?? '') === caption) return
    const { error } = await supabase.from('plan_media').update({ caption: caption || null }).eq('id', m.id)
    if (error) toast('שמירת הכיתוב נכשלה')
    else onChange()
  }

  async function move(m: Media, dir: -1 | 1) {
    const i = sorted.findIndex((x) => x.id === m.id)
    const other = sorted[i + dir]
    if (!other) return
    // Normalise sort values so swapping always works.
    const order = sorted.map((x) => x.id)
    ;[order[i], order[i + dir]] = [order[i + dir], order[i]]
    await Promise.all(order.map((id, idx) => supabase.from('plan_media').update({ sort: idx + 1 }).eq('id', id)))
    onChange()
  }

  async function remove(m: Media) {
    if (!confirm(`למחוק את ה${KIND_NAME[m.kind]}?`)) return
    try {
      if (m.id === coverId) onCover(null)
      await deleteMedia(m)
      toast('נמחק')
      onChange()
    } catch {
      toast('המחיקה נכשלה')
    }
  }

  return (
    <div className="box">
      <div className="box-head">
        <h3>הדמיות, סרטונים ומסמכים</h3>
        <span className="muted" style={{ fontSize: 14 }}>
          עד 50MB לקובץ. תמונות גדולות מוקטנות אוטומטית.
        </span>
      </div>

      <div
        className={`dropzone${over ? ' over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setOver(false)
          if (e.dataTransfer.files.length) upload(e.dataTransfer.files)
        }}
      >
        <strong>גררו לכאן הדמיות, סרטונים או קובצי PDF</strong>
        <span className="muted">אפשר לבחור כמה קבצים יחד</span>
        <button type="button" className="btn btn-sm" onClick={() => input.current?.click()} disabled={!!progress}>
          בחירת קבצים
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept="image/*,video/*,.pdf,.mp4,.mov,.webm"
          onChange={(e) => {
            if (e.target.files?.length) upload(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {progress && (
        <div style={{ display: 'grid', gap: 6 }}>
          <span className="muted" style={{ fontSize: 14 }}>
            מעלה {progress.done + 1} מתוך {progress.total}: {progress.name}
          </span>
          <div className="progress">
            <div style={{ width: `${((progress.done + 0.5) / progress.total) * 100}%` }} />
          </div>
        </div>
      )}
      {errors.map((e, i) => (
        <div key={i} className="notice notice-warn">
          {e}
        </div>
      ))}

      <div className="grid-2" style={{ alignItems: 'end' }}>
        <label className="field">
          <span>קישור לסרטון ביוטיוב או בוימאו</span>
          <input className="input" dir="ltr" placeholder="https://youtu.be/..." value={link} onChange={(e) => setLink(e.target.value)} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" placeholder="כיתוב (לא חובה)" value={linkCaption} onChange={(e) => setLinkCaption(e.target.value)} />
          <button type="button" className="btn" onClick={addLink} disabled={!link.trim()}>
            הוספה
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="muted">עוד לא הועלו קבצים. הדמיה אחת לפחות הופכת את הפרויקט לברור הרבה יותר לתושבים.</p>
      ) : (
        <div className="media-grid">
          {sorted.map((m, i) => {
            const src = mediaSrc(m)
            const isCover = m.id === coverId
            return (
              <div key={m.id} className={`media-item${isCover ? ' is-cover' : ''}`}>
                <div className="preview">
                  {m.kind === 'render' && src ? (
                    <img src={src} alt="" loading="lazy" />
                  ) : m.kind === 'video' && src ? (
                    <video src={src} muted preload="metadata" />
                  ) : (
                    KIND_NAME[m.kind]
                  )}
                </div>
                <div className="body">
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                    <span className="muted">{KIND_NAME[m.kind]}</span>
                    {isCover && <span className="cover-tag">תמונה ראשית</span>}
                  </div>
                  <input
                    className="input"
                    placeholder="כיתוב"
                    defaultValue={m.caption ?? ''}
                    onBlur={(e) => saveCaption(m, e.target.value.trim())}
                  />
                  <div className="tools">
                    {m.kind === 'render' && !isCover && (
                      <button type="button" className="btn btn-sm" onClick={() => onCover(m.id)}>
                        לראשית
                      </button>
                    )}
                    <button type="button" className="btn btn-sm" onClick={() => move(m, -1)} disabled={i === 0} aria-label="הקדמה">
                      קודם
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => move(m, 1)} disabled={i === sorted.length - 1} aria-label="דחייה">
                      אחר כך
                    </button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => remove(m)}>
                      מחיקה
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
