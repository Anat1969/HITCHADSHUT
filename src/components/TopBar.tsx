import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { CITY_URL, DEV_CHAT_URL, RESEARCH_URL, SHARE_IMAGE, SHARE_TEXT, SHARE_VERSION } from '../lib/links'
import '../styles/topbar.css'

interface MenuElement extends HTMLElement {
  items: { label: string; onSelect: () => unknown }[]
}

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'ai-menu': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { chat?: string; research?: string }
    }
  }
}

/** Fixed top bar on every page: icon and app name back to the home page, and the A&I logo button
 * (<ai-menu> from https://appofapp-gh.vercel.app/ai-menu.js): copy link, dev chat, research, install and admin. */
export default function TopBar({ context }: { context?: string }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [sent, setSent] = useState(false)
  const menuRef = useRef<MenuElement>(null)
  const isHome = pathname === '/'

  useEffect(() => {
    if (menuRef.current) menuRef.current.items = [{ label: 'ניהול', onSelect: () => navigate('/admin') }]
  }, [navigate])

  // One button sends the app in one go: picture of the home page, one sentence, and the link.
  // Phones: the system share sheet with the picture as a file and the sentence and link as its caption.
  // Computers: WhatsApp (web or app) opens with the message ready; the picture comes from the link preview.
  const shareFile = useRef<File | null>(null)
  useEffect(() => {
    fetch(SHARE_IMAGE)
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => (shareFile.current = new File([b], 'ma-nivne-svivi.png', { type: 'image/png' })))
      .catch(() => {})
  }, [])

  const share = async () => {
    const url = new URL(window.location.href)
    url.searchParams.set('s', SHARE_VERSION) // a new address, so WhatsApp builds a fresh preview
    const text = `${SHARE_TEXT}\n${url.toString()}`
    const file = shareFile.current
    const phone = window.matchMedia('(pointer: coarse)').matches
    if (phone && file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text })
      } catch {
        /* closed by the user */
      }
      return
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
    navigator.clipboard?.writeText(text).catch(() => {})
    setSent(true)
    setTimeout(() => setSent(false), 2400)
  }

  return (
    <header className="tb" dir="rtl">
      <div className="tb-in">
        <Link to="/" className="tb-brand" aria-label="מה נבנה סביבי, לדף הבית">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>מה נבנה סביבי</span>
          <small>אשדוד</small>
        </Link>
        {context && <span className="tb-context">{context}</span>}
        <nav className="tb-actions">
          {!isHome && (
            <Link to="/" className="tb-btn">
              דף הבית
            </Link>
          )}
          <button type="button" className="tb-btn tb-share" onClick={share} aria-label="שיתוף האפליקציה: תמונה, משפט וקישור">
            <img src={SHARE_IMAGE} alt="" width={56} height={29} />
            <span>{sent ? 'ההודעה מוכנה בוואטסאפ' : 'שיתוף'}</span>
          </button>
          <ai-menu ref={menuRef} chat={DEV_CHAT_URL} research={RESEARCH_URL || undefined} />
          <a href={CITY_URL} target="_blank" rel="noreferrer" className="tb-city" aria-label="אתר עיריית אשדוד">
            <img src="/ashdod-logo.png" alt="עיריית אשדוד" width={55} height={32} />
          </a>
        </nav>
      </div>
    </header>
  )
}
