import { useMemo, useState } from 'react'
import type { LonLat, Media, ProjectWithMedia, Quarter } from '../lib/types'
import { KIND_LABEL, STATUS_COLOR, STATUS_LABEL, TRACK_LABEL } from '../lib/labels'
import { distanceMeters, formatDistance, walkingMinutes } from '../lib/geo'
import { embedUrl, mediaSrc, sortMedia } from '../lib/media'
import StageTrack from './StageTrack'
import { planPath } from '../lib/data'
import Lightbox from './Lightbox'
import FeedbackSection from './FeedbackSection'

interface Props {
  project: ProjectWithMedia
  quarters: Quarter[]
  me: LonLat | null
  onBack: () => void
  preview?: boolean
}

export function coverOf(p: ProjectWithMedia): Media | undefined {
  const renders = sortMedia(p.plan_media.filter((m) => m.kind === 'render'))
  return renders.find((m) => m.id === p.cover_media_id) ?? renders[0]
}

export default function ProjectDetail({ project: p, quarters, me, onBack, preview }: Props) {
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const media = useMemo(() => sortMedia(p.plan_media), [p.plan_media])
  const cover = coverOf(p)
  const renders = media.filter((m) => m.kind === 'render')
  const ordered = cover ? [cover, ...renders.filter((m) => m.id !== cover.id)] : renders
  const videos = media.filter((m) => m.kind === 'video' || m.kind === 'video_link')
  const files = media.filter((m) => m.kind === 'document' || m.kind === 'kml')
  const quarter = quarters.find((q) => q.id === p.quarter_id)
  const dist = me && p.center ? distanceMeters(me, p.center) : null

  async function share() {
    const url = `${window.location.origin}/p/${p.id}`
    try {
      if (navigator.share) await navigator.share({ title: p.title, text: `${p.title} | מה נבנה סביבי באשדוד`, url })
      else {
        await navigator.clipboard.writeText(url)
        setCopied(true)
        setTimeout(() => setCopied(false), 2200)
      }
    } catch {
      /* user cancelled */
    }
  }

  const hasUnits = p.units_existing != null || p.units_planned != null

  return (
    <article className="detail">
      <div className="detail-bar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          חזרה לכל הפרויקטים
        </button>
        {!preview && (
          <button className="btn btn-sm" onClick={share}>
            {copied ? 'הקישור הועתק' : 'שיתוף'}
          </button>
        )}
      </div>

      <div className="hero">
        {cover ? (
          <img src={mediaSrc(cover) ?? ''} alt={cover.caption || `הדמיה של ${p.title}`} onClick={() => setLightbox(0)} />
        ) : (
          <div className="hero-empty">הדמיות יעלו בהמשך</div>
        )}
      </div>

      <div className="section">
        <span className="eyebrow">
          {KIND_LABEL[p.kind]}
          {p.renewal_track ? ` · ${TRACK_LABEL[p.renewal_track]}` : ''}
          {quarter ? ` · ${quarter.name}` : ''}
        </span>
        <h2>{p.title}</h2>
        {p.address && <p className="muted">{p.address}</p>}
        {dist != null && (
          <p style={{ color: 'var(--sea)', fontWeight: 600 }}>
            {formatDistance(dist)}
            {dist >= 150 && dist < 3000 ? ` · כ-${walkingMinutes(dist)} דקות הליכה` : ''}
          </p>
        )}
        {p.summary && <p className="lead">{p.summary}</p>}
        {p.story && p.plan_number && (
          <a className="btn btn-primary" style={{ justifySelf: 'start' }} href={planPath(p.plan_number)}>
            לסיפור המלא של התוכנית, עם מודל תלת-ממדי
          </a>
        )}
      </div>

      <div className="section">
        <h3>
          איפה זה עומד{' '}
          <span className="badge" style={{ marginInlineStart: 6 }}>
            <span className="dot" style={{ background: STATUS_COLOR[p.status] }} />
            {STATUS_LABEL[p.status]}
          </span>
        </h3>
        <StageTrack status={p.status} />
      </div>

      {(hasUnits || p.floors || p.expected_completion || p.plan_number || p.developer) && (
        <div className="section">
          <h3>במספרים</h3>
          <div className="facts">
            {hasUnits && (
              <div className="fact wide">
                <div className="units-change">
                  {p.units_existing != null && (
                    <div>
                      <b>{p.units_existing.toLocaleString('he-IL')}</b>
                      <span>דירות היום</span>
                    </div>
                  )}
                  {p.units_existing != null && p.units_planned != null && <span className="arrow">ובעתיד</span>}
                  {p.units_planned != null && (
                    <div>
                      <b>{p.units_planned.toLocaleString('he-IL')}</b>
                      <span>דירות בתוכנית</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            {p.floors && (
              <div className="fact">
                <b>{p.floors}</b>
                <span>קומות</span>
              </div>
            )}
            {p.expected_completion && (
              <div className="fact">
                <b>{p.expected_completion}</b>
                <span>מועד סיום משוער</span>
              </div>
            )}
            {p.plan_number && (
              <div className="fact">
                <b style={{ fontSize: 15 }}>{p.plan_number}</b>
                <span>מספר תוכנית</span>
              </div>
            )}
            {p.developer && (
              <div className="fact">
                <b style={{ fontSize: 15 }}>{p.developer}</b>
                <span>יזם</span>
              </div>
            )}
          </div>
        </div>
      )}

      {p.public_benefits && (
        <div className="section">
          <h3>מה השכונה מקבלת</h3>
          <p className="prose">{p.public_benefits}</p>
        </div>
      )}

      {p.description && (
        <div className="section">
          <h3>על הפרויקט</h3>
          <p className="prose">
            <Linkified text={p.description} />
          </p>
        </div>
      )}

      {ordered.length > 1 && (
        <div className="section">
          <h3>הדמיות</h3>
          <div className="gallery">
            {ordered.map((m, i) => (
              <button key={m.id} onClick={() => setLightbox(i)} aria-label={m.caption || `הדמיה ${i + 1}`}>
                <img src={mediaSrc(m) ?? ''} alt={m.caption || ''} loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <div className="section">
          <h3>{videos.length > 1 ? 'סרטונים' : 'סרטון'}</h3>
          {videos.map((m) => {
            const src = mediaSrc(m)
            const embed = m.kind === 'video_link' && src ? embedUrl(src) : null
            return (
              <figure key={m.id} style={{ margin: 0, display: 'grid', gap: 6 }}>
                <div className="video">
                  {m.kind === 'video' && src ? (
                    <video src={src} controls preload="metadata" playsInline />
                  ) : embed ? (
                    <iframe src={embed} title={m.caption || p.title} allow="encrypted-media; picture-in-picture; fullscreen" loading="lazy" />
                  ) : src ? (
                    <a href={src} target="_blank" rel="noreferrer" style={{ color: '#fff', display: 'block', padding: 20 }}>
                      לצפייה בסרטון
                    </a>
                  ) : null}
                </div>
                {m.caption && <figcaption className="caption">{m.caption}</figcaption>}
              </figure>
            )
          })}
        </div>
      )}

      {files.length > 0 && (
        <div className="section">
          <h3>מסמכים וקבצים</h3>
          <div className="files">
            {files.map((m) => (
              <a key={m.id} href={mediaSrc(m) ?? '#'} target="_blank" rel="noreferrer" download={m.kind === 'kml'}>
                {m.caption || (m.kind === 'kml' ? 'קובץ גבולות התוכנית' : 'מסמך')}
                <span>{m.kind === 'kml' ? 'KML · לפתיחה ב-Google Earth' : /\.pdf($|\?)/i.test(mediaSrc(m) ?? '') ? 'PDF' : 'קישור'}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {p.contact_info && (
        <div className="section">
          <h3>לפרטים נוספים</h3>
          <p className="prose">{p.contact_info}</p>
        </div>
      )}

      <FeedbackSection projectId={p.id} canPost={!preview} />

      {lightbox != null && (
        <Lightbox
          items={ordered.map((m) => ({ src: mediaSrc(m) ?? '', caption: m.caption }))}
          index={lightbox}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </article>
  )
}

/** Plain text with its http(s) links made clickable. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/\S+)/g)
  return (
    <>
      {parts.map((t, i) =>
        /^https?:\/\//.test(t) ? (
          <a key={i} href={t} target="_blank" rel="noreferrer">
            {t.includes('mavat') ? 'אתר תכנון זמין' : t}
          </a>
        ) : (
          t
        ),
      )}
    </>
  )
}
