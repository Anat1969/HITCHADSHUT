import { useEffect } from 'react'

interface Item {
  src: string
  caption?: string | null
}

export default function Lightbox({
  items,
  index,
  onIndex,
  onClose,
}: {
  items: Item[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const item = items[index]
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      // RTL: right arrow goes to the previous image
      if (e.key === 'ArrowLeft') onIndex((index + 1) % items.length)
      if (e.key === 'ArrowRight') onIndex((index - 1 + items.length) % items.length)
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [index, items.length, onClose, onIndex])

  if (!item) return null
  return (
    <div className="lightbox" role="dialog" aria-modal="true" aria-label="הדמיות">
      <div className="lightbox-bar">
        <span>
          {index + 1} מתוך {items.length}
          {item.caption ? ` · ${item.caption}` : ''}
        </span>
        <button className="btn btn-sm" onClick={onClose} autoFocus>
          סגירה
        </button>
      </div>
      <div className="lightbox-img" onClick={onClose}>
        <img src={item.src} alt={item.caption || 'הדמיה'} onClick={(e) => e.stopPropagation()} />
      </div>
      {items.length > 1 && (
        <div className="lightbox-nav">
          <button className="btn btn-sm" onClick={() => onIndex((index - 1 + items.length) % items.length)}>
            הקודמת
          </button>
          <button className="btn btn-sm" onClick={() => onIndex((index + 1) % items.length)}>
            הבאה
          </button>
        </div>
      )}
    </div>
  )
}
