import { supabase } from './supabase'
import type { Feedback, FeedbackKind, LonLat, ProjectWithMedia, Quarter } from './types'

const PROJECT_SELECT = '*, plan_media!plan_media_project_id_fkey(*)'

export async function fetchPublishedProjects(): Promise<ProjectWithMedia[]> {
  const { data, error } = await supabase
    .from('plan_projects')
    .select(PROJECT_SELECT)
    .eq('published', true)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ProjectWithMedia[]
}

export async function fetchAllProjects(): Promise<ProjectWithMedia[]> {
  const { data, error } = await supabase
    .from('plan_projects')
    .select(PROJECT_SELECT)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as ProjectWithMedia[]
}

export async function fetchProject(id: string): Promise<ProjectWithMedia | null> {
  const { data, error } = await supabase.from('plan_projects').select(PROJECT_SELECT).eq('id', id).maybeSingle()
  if (error) throw error
  return data as ProjectWithMedia | null
}

let quartersCache: Quarter[] | null = null
export async function fetchQuarters(): Promise<Quarter[]> {
  if (quartersCache) return quartersCache
  const { data, error } = await supabase.from('quarters').select('id, name')
  if (error) throw error
  const collator = new Intl.Collator('he', { numeric: true })
  quartersCache = ((data ?? []) as Quarter[]).sort((a, b) => {
    const ra = a.name.startsWith('רובע') ? 0 : 1
    const rb = b.name.startsWith('רובע') ? 0 : 1
    return ra - rb || collator.compare(a.name, b.name)
  })
  return quartersCache
}

export async function fetchApprovedFeedback(projectId: string): Promise<Feedback[]> {
  const { data, error } = await supabase
    .from('plan_feedback')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Feedback[]
}

/** Latest answered resident questions across all published projects, for the front page. */
export async function fetchLatestAnswered(limit = 3): Promise<Feedback[]> {
  const { data, error } = await supabase
    .from('plan_feedback')
    .select('*')
    .eq('status', 'approved')
    .not('reply', 'is', null)
    .order('replied_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as Feedback[]
}

export async function submitFeedback(input: {
  project_id: string
  kind: FeedbackKind
  body: string
  author_name: string | null
}): Promise<void> {
  // No .select() here: residents cannot read pending rows back (by design).
  const { error } = await supabase.from('plan_feedback').insert(input)
  if (error) throw error
}

export interface GeocodeResult {
  label: string
  point: LonLat
}

/** Address search limited to Ashdod (OpenStreetMap Nominatim). */
export async function geocodeAshdod(query: string): Promise<GeocodeResult[]> {
  const q = query.includes('אשדוד') ? query : `${query}, אשדוד`
  const params = new URLSearchParams({
    format: 'jsonv2',
    q,
    'accept-language': 'he',
    countrycodes: 'il',
    viewbox: '34.585,31.87,34.725,31.735',
    bounded: '1',
    limit: '5',
  })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`)
  if (!res.ok) throw new Error('החיפוש אינו זמין כרגע')
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string }[]
  return rows.map((r) => ({
    label: r.display_name
      .split(',')
      .map((s) => s.trim())
      .filter((s) => !/^(ישראל|מחוז|נפת|\d{5,7})/.test(s))
      .slice(0, 3)
      .join(', '),
    point: [Number(r.lon), Number(r.lat)],
  }))
}

/** URL of a plan story page. Plan numbers like "תמל/2022" carry a slash, so it becomes a dash. */
export function planPath(planNumber: string): string {
  return `/plan/${encodeURIComponent(planNumber.replace(/\s+/g, '').replace(/\//g, '-'))}`
}

/** Plan numbers a /plan/<slug> URL may stand for: as written, and with dashes read back as slashes. */
export function planNumberCandidates(slug: string): string[] {
  const s = slug.trim()
  return [...new Set([s, s.replace(/-/g, '/'), s.replace(/-/g, '/ ')])]
}
