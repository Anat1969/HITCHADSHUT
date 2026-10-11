import type { FeatureCollection } from 'geojson'

export type ProjectKind =
  | 'urban_renewal'
  | 'new_construction'
  | 'public_building'
  | 'public_space'
  | 'infrastructure'

export type RenewalTrack = 'pinui_binui' | 'tama38' | 'other'

export type ProjectStatus = 'planning' | 'approved' | 'permit' | 'construction' | 'completed'

export type LonLat = [number, number]

export interface Project {
  id: string
  title: string
  kind: ProjectKind
  renewal_track: RenewalTrack | null
  status: ProjectStatus
  plan_number: string | null
  quarter_id: string | null
  address: string | null
  summary: string | null
  description: string | null
  public_benefits: string | null
  units_existing: number | null
  units_planned: number | null
  floors: string | null
  expected_completion: string | null
  developer: string | null
  contact_info: string | null
  geojson: FeatureCollection | null
  center: LonLat | null
  cover_media_id: string | null
  story: PlanStory | null
  model_url: string | null
  published: boolean
  created_at: string
  updated_at: string
}

export type MediaKind = 'render' | 'video' | 'video_link' | 'kml' | 'document'

export interface Media {
  id: string
  project_id: string
  kind: MediaKind
  storage_path: string | null
  url: string | null
  caption: string | null
  sort: number
  created_at: string
}

export type FeedbackKind = 'question' | 'support' | 'concern' | 'idea'
export type FeedbackStatus = 'pending' | 'approved' | 'rejected'

export interface Feedback {
  id: string
  project_id: string
  kind: FeedbackKind
  body: string
  author_name: string | null
  status: FeedbackStatus
  reply: string | null
  replied_at: string | null
  created_at: string
}

export interface Quarter {
  id: string
  name: string
}

export type ProjectWithMedia = Project & { plan_media: Media[] }

export type Certainty = 'plan' | 'estimate'

export interface StoryFact {
  value: string
  unit?: string
  label: string
  certainty: Certainty
}

export interface StoryChapter {
  id: string
  title: string
  lead?: string
  paragraphs?: string[]
  bullets?: string[]
  facts?: StoryFact[]
  pros?: string[]
  questions?: string[]
  steps?: { title: string; text: string }[]
  terms?: { term: string; def: string }[]
  draft?: boolean
  sources?: string[]
}

export interface PlanStory {
  plan_number: string
  official_name: string
  mavat_url: string
  kicker: string
  headline: string
  headline_serif?: string
  deck: string
  status: { label: string; text: string; source: string }
  chapters: StoryChapter[]
  disclaimer: string
  reviewed: boolean
}

export interface LotData {
  lot: number
  mixed: boolean
  lot_size: number
  main_above: number
  service_above: number
  service_below: number
  coverage_pct: number
  units: number
  units_before_est: number
  avg_unit_m2_after: number
  avg_unit_m2_before_est: number
  small_75_min: number
  micro_55_min: number
  density: number
  height_m: number
  floors_above: number
  floors_below: number
  floor_plate_m2: number
  envelope_m2: number
  commercial_main?: number
  center: [number, number]
}

export interface PlanModel {
  plan_number: string
  sources: Record<string, string>
  summary: {
    lots: number
    units_after: number
    units_before_est: number
    units_added_est: number
    small_75_min: number
    micro_55_min: number
    floors_min: number
    floors_max: number
    height_max: number
    area_dunam: number
    service_below_m2: number
    commercial_lots: number[]
    avg_unit_before_est: number
    avg_unit_after: number
  }
  lots: LotData[]
  checks: { lot: number; level: 'error' | 'warn' | 'info'; text: string }[]
  massing: FeatureCollection
  boundary: FeatureCollection
  context: FeatureCollection
}
