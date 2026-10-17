import { MEDIA_BUCKET, supabase } from './supabase'
import { captionFromFileName, extOf, kindForFile, MAX_UPLOAD_BYTES } from './media'
import type { Media, MediaKind } from './types'

const CONTENT_TYPES: Record<string, string> = {
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  kml: 'application/vnd.google-earth.kml+xml',
  kmz: 'application/vnd.google-earth.kmz',
}

/** Shrink very large renders so they load fast on phones (max 2400px, JPEG). */
async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file
  if (file.size < 1.5 * 1024 * 1024) return file
  try {
    const bmp = await createImageBitmap(file)
    const max = 2400
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * scale)
    const h = Math.round(bmp.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bmp, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.86))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export class UploadError extends Error {}

export async function uploadMediaFile(
  projectId: string,
  original: File,
  opts: { kind?: MediaKind; caption?: string | null; sort: number },
): Promise<Media> {
  const kind = opts.kind ?? kindForFile(original)
  if (!kind) throw new UploadError(`סוג הקובץ "${original.name}" אינו נתמך`)
  const file = kind === 'render' ? await prepareImage(original) : original
  if (file.size > MAX_UPLOAD_BYTES)
    throw new UploadError(`"${original.name}" גדול מ-50MB. לסרטונים ארוכים העלו ליוטיוב או לוימאו והוסיפו קישור.`)

  const ext = extOf(file)
  const path = `${projectId}/${crypto.randomUUID()}.${ext}`
  const { error: upErr } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    contentType: CONTENT_TYPES[ext] ?? (file.type || 'application/octet-stream'),
    cacheControl: '31536000',
    upsert: false,
  })
  if (upErr) throw new UploadError(`ההעלאה של "${original.name}" נכשלה`)

  const caption = opts.caption ?? (kind === 'render' || kind === 'video' ? null : captionFromFileName(original.name))
  const { data, error } = await supabase
    .from('plan_media')
    .insert({ project_id: projectId, kind, storage_path: path, caption, sort: opts.sort })
    .select()
    .single()
  if (error) {
    await supabase.storage.from(MEDIA_BUCKET).remove([path])
    throw new UploadError('שמירת הקובץ נכשלה')
  }
  return data as Media
}

export async function deleteMedia(m: Media): Promise<void> {
  const { error } = await supabase.from('plan_media').delete().eq('id', m.id)
  if (error) throw error
  if (m.storage_path) await supabase.storage.from(MEDIA_BUCKET).remove([m.storage_path])
}
