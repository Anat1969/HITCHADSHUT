import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DEV_CHAT_URL, RESEARCH_URL, SHARE_IMAGE, SHARE_TEXT, SHARE_VERSION } from '../lib/links'
import '../styles/topbar.css'

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

// Chrome fires beforeinstallprompt once, possibly before the bar mounts: keep it at module level.
let deferredInstall: InstallPrompt | null = null
const installListeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredInstall = e as InstallPrompt
    installListeners.forEach((f) => f())
  })
  window.addEventListener('appinstalled', () => {
    deferredInstall = null
    installListeners.forEach((f) => f())
  })
}

/** Fixed top bar on every page: icon and app name back to the home page, and the system menu. */
export default function TopBar({ context }: { context?: string }) {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [sent, setSent] = useState(false)
  const [canInstall, setCanInstall] = useState(!!deferredInstall)
  const menuRef = useRef<HTMLDivElement>(null)
  const isHome = pathname === '/'

  useEffect(() => {
    const f = () => setCanInstall(!!deferredInstall)
    installListeners.add(f)
    return () => {
      installListeners.delete(f)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

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

  const install = async () => {
    if (!deferredInstall) return
    await deferredInstall.prompt()
    await deferredInstall.userChoice
    deferredInstall = null
    setCanInstall(false)
    setOpen(false)
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
          <div className="tb-menu" ref={menuRef}>
            <button type="button" className="tb-btn" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
              מערכת
            </button>
            {open && (
              <div className="tb-pop" role="menu">
                <a role="menuitem" href={DEV_CHAT_URL} target="_blank" rel="noreferrer">
                  שיחת הפיתוח
                </a>
                {RESEARCH_URL && (
                  <a role="menuitem" href={RESEARCH_URL} target="_blank" rel="noreferrer">
                    פרויקט המחקר
                  </a>
                )}
                {canInstall && (
                  <button type="button" role="menuitem" onClick={install}>
                    התקנת האפליקציה
                  </button>
                )}
                <Link role="menuitem" to="/admin" onClick={() => setOpen(false)}>
                  ניהול
                </Link>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  )
}
