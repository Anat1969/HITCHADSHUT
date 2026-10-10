import type { Media, MediaKind } from './types'
import { publicMediaUrl } from './supabase'

export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024

export function mediaSrc(m: Media): string | null {
  if (m.storage_path) return publicMediaUrl(m.storage_path)
  return m.url
}

export function kindForFile(file: File): MediaKind | null {
  const n = file.name.toLowerCase()
  if (n.endsWith('.kml') || n.endsWith('.kmz')) return 'kml'
  if (file.type.startsWith('image/')) return 'render'
  if (file.type.startsWith('video/') || /\.(mp4|webm|mov|m4v)$/.test(n)) return 'video'
  if (file.type === 'application/pdf' || n.endsWith('.pdf')) return 'document'
  return null
}

export function extOf(file: File): string {
  const m = file.name.toLowerCase().match(/\.([a-z0-9]{1,6})$/)
  return m ? m[1] : 'bin'
}

/** YouTube / Vimeo link -> embeddable player URL, or null. */
export function embedUrl(link: string): string | null {
  try {
    const u = new URL(link)
    const host = u.hostname.replace(/^www\.|^m\./, '')
    if (host === 'youtu.be') return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`
    if (host === 'youtube.com') {
      const v = u.searchParams.get('v')
      if (v) return `https://www.youtube-nocookie.com/embed/${v}`
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([^/?]+)/)
      if (m) return `https://www.youtube-nocookie.com/embed/${m[2]}`
    }
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      if (/^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`
    }
    if (host === 'player.vimeo.com') return link
  } catch {
    /* not a URL */
  }
  return null
}

export function formatBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export function sortMedia(list: Media[]): Media[] {
  return [...list].sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at))
}
