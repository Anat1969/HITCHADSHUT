import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { DEV_CHAT_URL, RESEARCH_URL, SHARE_TEXT } from '../lib/links'
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
  const [copied, setCopied] = useState(false)
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
    } catch {
      window.prompt('העתקת קישור', window.location.href)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  // Phones: the system share sheet (WhatsApp and others). The preview image comes from the link itself.
  const canShare =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function' && window.matchMedia('(pointer: coarse)').matches
  const share = async () => {
    try {
      await navigator.share({ title: document.title, text: SHARE_TEXT, url: window.location.href })
    } catch {
      /* closed by the user */
    }
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
          <button type="button" className="tb-btn" onClick={copy}>
            {copied ? 'הקישור הועתק' : 'העתקת קישור'}
          </button>
          {canShare && (
            <button type="button" className="tb-btn" onClick={share}>
              שיתוף
            </button>
          )}
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
