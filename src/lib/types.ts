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
