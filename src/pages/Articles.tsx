import TopBar from '../components/TopBar'

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'app-creations': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { src?: string; heading?: string }
    }
  }
}

/** כתבות: כתבת A4 לכל נושא שעולה מהתוכניות ומכללי התכנון, יצירת כתבה מהמאגר, הורדה והדפסה, והעלאה לחדר במוזיאון.
 * הרכיב המשותף <app-creations> (AppOfApp-GH/public/creations.js) נטען ב-index.html.
 * הנתונים: public/creations.json, נגזר מ-supabase/seed/*.story.json ומ-docs/ ב-tools/creations.mjs. */
export default function Articles() {
  return (
    <div className="articles-page">
      <TopBar context="כתבות" />
      <main className="articles-main">
        <app-creations src="/creations.json" heading="מה ההתחדשות מלמדת" />
      </main>
    </div>
  )
}
