import { useEffect, useRef } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { CITY_URL, DEV_CHAT_URL, RESEARCH_URL } from '../lib/links'
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

/** One fixed top bar, the same on every page (ענת, 23.11.2026): nothing is added, removed or moved per page.
 *  - The app icon and name are the home button.
 *  - Navigation: מודל העיר, כתבות (the current page is marked, not hidden).
 *  - The A&I logo button (<ai-menu>): copy link, dev chat, research, install, the city film and admin.
 *  - The Ashdod municipality logo, to the city site. */
export default function TopBar(_props: { context?: string }) {
  const navigate = useNavigate()
  const menuRef = useRef<MenuElement>(null)

  useEffect(() => {
    if (menuRef.current)
      menuRef.current.items = [
        { label: 'סרטון מודל העיר', onSelect: () => navigate('/city?film=1') },
        { label: 'ניהול', onSelect: () => navigate('/admin') },
      ]
  }, [navigate])

  return (
    <header className="tb" dir="rtl">
      <div className="tb-in">
        <Link to="/" className="tb-brand" aria-label="מה נבנה סביבי, לדף הבית" title="דף הבית">
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>מה נבנה סביבי</span>
          <small>אשדוד</small>
        </Link>
        <nav className="tb-actions">
          <NavLink to="/city" className="tb-btn">
            מודל העיר
          </NavLink>
          <NavLink to="/articles" className="tb-btn">
            כתבות
          </NavLink>
          <ai-menu ref={menuRef} chat={DEV_CHAT_URL} research={RESEARCH_URL || undefined} />
          <a href={CITY_URL} target="_blank" rel="noreferrer" className="tb-city" aria-label="אתר עיריית אשדוד">
            <img src="/ashdod-logo.png" alt="עיריית אשדוד" width={55} height={32} />
          </a>
        </nav>
      </div>
    </header>
  )
}
