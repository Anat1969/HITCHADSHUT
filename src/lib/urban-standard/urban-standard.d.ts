// Types for the shared urban-twin standard (urban-standard.js is copied from PLANS-GH, do not edit it here).
export const VERSION: string
export const NEUTRAL: string
export interface LandUse { label: string; mavat: string | null; color: string | null; verified: 'mavat-output' | 'mavat-single' | 'pending'; plans: string[]; note: string }
export const LAND_USE: Record<string, LandUse>
export const MAVAT_BY_NAME: Record<string, { color: string; verified: string; plans: string[] }>
export const CAT_TO_MAVAT: Record<string, string | null>
export function landUseColor(cat: string): string
export function landUseColorByName(name: string, cat: string): string
export function landUseLabel(cat: string): string
export const STATUS: Record<'statutory' | 'buildingPlan' | 'lod' | 'modelApproval', Record<string, string>>
export function statutoryOf(status: string): string
export const BLUE_LINE: string
export const SELECT: { halo: string; arrow: string }
export const NEUTRAL_BG: { fill: string; edge: string; opacity: number }
export interface Look { fill?: string; opacity?: number; line?: string; label?: string; tag?: string }
export const LOOK: Record<'existing' | 'approved' | 'planning' | 'working' | 'missing', Look>
export function lookFor(statutory: string): Look
export const INTERACTION: { clickTolerancePx: number; wheelLevelsPerNotch: number; keyZoomLevels: number; keyPanFraction: number; keyRotateDeg: number; keyTiltDeg: number; maxTiltDeg: number; animMs: number; controlsCorner: string }
export const ACTIONS: { id: string; label: string; mouse: string; touch: string; keys: string; button: string }[]
export const KEYS: Record<string, string[]>
export interface Guard { wasDrag(): boolean; isClick(e: { clientX: number; clientY: number }): boolean }
export interface Applied { unbind(): void; guard: Guard; setHome(...a: unknown[]): void }
export function clickGuard(el: HTMLElement): Guard
export function bindKeys(el: HTMLElement, h: Record<string, unknown>): () => void
export function wheelPx(e: WheelEvent): number
export function wheelLevels(e: WheelEvent): number
export interface Hooks { enabled?: () => boolean; reset?: () => void; clear?: () => void; full?: () => void }
export function applyLeaflet(map: unknown, L: unknown, h?: Hooks): Applied
export const MAPLIBRE_OPTIONS: { clickTolerance: number; maxPitch: number; boxZoom: boolean; keyboard: boolean }
export function applyMapLibre(map: unknown, h?: Hooks): Applied
export function applyOrbit(ctl: unknown, cam: unknown, el: HTMLElement, T: unknown, h?: Hooks & { groundY?: () => number; changed?: () => void }): Applied
export const REP_LEVELS: Record<1 | 2 | 3 | 4, { label: string; content: string; purpose: string }>
export const WORK_MODES: Record<'planning' | 'architectural' | 'experiential', { label: string; levels: number[]; show: string }>
export const PROVENANCE: Record<'verified' | 'plan' | 'computed' | 'illustration' | 'missing', { label: string; note: string }>
export const ENRICH_RULES: { id: string; when: string; add: string; level: number; prov: string }[]
