import { useEffect, useMemo } from 'react'
import { Circle, CircleMarker, GeoJSON, MapContainer, Marker, Pane, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { Feature, FeatureCollection } from 'geojson'
import 'leaflet/dist/leaflet.css'
import QuietBase from './QuietBase'
import { applyLeaflet } from '../lib/urban-standard/urban-standard.js'
import type { LonLat, Project } from '../lib/types'
import { BLUE_LINE } from '../lib/labels'
import { BUILDING_COLOR, PLANS_APP_URL, fmtDate, type BuildingPlan } from '../lib/buildingPlans'
import { ASHDOD_BOUNDS, ASHDOD_CENTER, bboxOf } from '../lib/geo'

// The red arrow that points at the plan in focus, and slides from plan to plan (css transition on .plan-arrow).
const arrowIcon = L.divIcon({
  className: 'plan-arrow',
  html: '<svg viewBox="0 0 24 36" width="24" height="36" aria-hidden="true"><path d="M12 35 L2 18 H8 V1 H16 V18 H22 Z" fill="#D0202A" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  iconSize: [24, 36],
  iconAnchor: [12, 36],
})

const meIcon = L.divIcon({ className: '', html: '<div class="me-pin"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })

// Plans larger than this (bbox, square degrees, about 2 x 2 km) are drawn in a pane behind the others:
// a city-wide plan (public plots) or the port plan would otherwise cover the blue lines of the plans inside them.
const BIG_PLAN = 4e-4
const bboxArea = (p: Pick<Project, 'geojson'>) => {
  const b = p.geojson ? bboxOf(p.geojson) : null
  return b ? (b[2] - b[0]) * (b[3] - b[1]) : 0
}

export type MapFocus =
  | { type: 'project'; project: Pick<Project, 'id' | 'geojson' | 'center'>; nonce: number }
  | { type: 'point'; point: LonLat; zoom?: number; nonce: number }
  | { type: 'all'; nonce: number }
  | null

interface Props {
  projects: Pick<Project, 'id' | 'title' | 'status' | 'geojson' | 'center'>[]
  selectedId?: string | null
  hoverId?: string | null
  onSelect?: (id: string) => void
  onHover?: (id: string | null) => void
  me?: LonLat | null
  meRadius?: number
  focus?: MapFocus
  onMapClick?: (p: LonLat) => void
  draftPin?: LonLat | null
  interactiveTooltips?: boolean
  /** Building plans from PLANS-GH, drawn in bronze; null hides them. */
  buildingPlans?: BuildingPlan[] | null
  /** Hide the urban renewal plans (the map shows building plans only). */
  hideProjects?: boolean
}

export default function MapView({
  projects,
  selectedId,
  hoverId,
  onSelect,
  onHover,
  me,
  meRadius = 500,
  focus,
  onMapClick,
  draftPin,
  interactiveTooltips = true,
  buildingPlans = null,
  hideProjects = false,
}: Props) {
  // Large plans behind, then the rest from large to small, so a small plan is never hidden under a bigger one.
  const shown = hideProjects ? [] : projects
  // The arrow: the plan under the pointer, else the one selected or flown to.
  const arrowAt = useMemo(() => {
    const id = hoverId ?? selectedId ?? (focus?.type === 'project' ? focus.project.id : null)
    const p = id ? projects.find((x) => x.id === id) : null
    if (!p) return null
    const b = p.geojson ? bboxOf(p.geojson) : null
    // the tip touches the top of the blue line, so the arrow never hides the plan
    return b ? ([b[3], (b[0] + b[2]) / 2] as [number, number]) : p.center ? ([p.center[1], p.center[0]] as [number, number]) : null
  }, [hoverId, selectedId, focus, projects])
  const [back, front] = useMemo(() => {
    const sorted = [...shown].sort((a, b) => bboxArea(b) - bboxArea(a))
    return [sorted.filter((p) => bboxArea(p) > BIG_PLAN), sorted.filter((p) => bboxArea(p) <= BIG_PLAN)]
  }, [shown])
  return (
    <MapContainer
      center={ASHDOD_CENTER}
      zoom={13}
      minZoom={11}
      maxBounds={[
        [ASHDOD_BOUNDS[0][0] - 0.12, ASHDOD_BOUNDS[0][1] - 0.15],
        [ASHDOD_BOUNDS[1][0] + 0.12, ASHDOD_BOUNDS[1][1] + 0.15],
      ]}
      zoomControl={false}
      attributionControl
      style={{ height: '100%', width: '100%' }}
    >
      <QuietBase />
      <ZoomControlLeft />
      <InteractionStandard />
      <ResizeWatcher />
      <FocusController focus={focus ?? null} />
      {onMapClick && <ClickCatcher onClick={onMapClick} />}

      <Pane name="plans-back" style={{ zIndex: 390 }}>
        {back.map((p) => (
          <ProjectLayer
            key={p.id}
            project={p}
            selected={p.id === selectedId}
            hovered={p.id === hoverId}
            dimmed={!!selectedId && p.id !== selectedId}
            onSelect={onSelect}
            onHover={onHover}
            tooltip={interactiveTooltips}
          />
        ))}
      </Pane>
      {front.map((p) => (
        <ProjectLayer
          key={p.id}
          project={p}
          selected={p.id === selectedId}
          hovered={p.id === hoverId}
          dimmed={!!selectedId && p.id !== selectedId}
          onSelect={onSelect}
          onHover={onHover}
          tooltip={interactiveTooltips}
        />
      ))}

      {buildingPlans?.map((bp) => (
        <BuildingLayer key={bp.plan_number} plan={bp} />
      ))}
      {arrowAt && <Marker position={arrowAt} icon={arrowIcon} interactive={false} zIndexOffset={1000} />}

      {me && (
        <>
          <Circle
            center={[me[1], me[0]]}
            radius={meRadius}
            pathOptions={{ color: '#111111', weight: 1.2, dashArray: '5 6', fillColor: '#111111', fillOpacity: 0.05 }}
            interactive={false}
          />
          <Marker position={[me[1], me[0]]} icon={meIcon} interactive={false} />
        </>
      )}
      {draftPin && <Marker position={[draftPin[1], draftPin[0]]} icon={meIcon} interactive={false} />}
    </MapContainer>
  )
}

// Map Interaction Standard (shared with PLANS-GH): same wheel, keys and click tolerance as every map.
function InteractionStandard() {
  const map = useMap()
  useEffect(() => applyLeaflet(map, L).unbind, [map])
  return null
}

function ZoomControlLeft() {
  const map = useMap()
  useEffect(() => {
    const zc = L.control.zoom({ position: 'topleft', zoomInTitle: 'הגדלה', zoomOutTitle: 'הקטנה' })
    zc.addTo(map)
    return () => {
      zc.remove()
    }
  }, [map])
  return null
}

function ClickCatcher({ onClick }: { onClick: (p: LonLat) => void }) {
  useMapEvents({
    click(e) {
      onClick([Math.round(e.latlng.lng * 1e6) / 1e6, Math.round(e.latlng.lat * 1e6) / 1e6])
    },
  })
  return null
}

function ResizeWatcher() {
  const map = useMap()
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer())
    return () => ro.disconnect()
  }, [map])
  return null
}

function FocusController({ focus }: { focus: MapFocus }) {
  const map = useMap()
  useEffect(() => {
    // Leaflet needs a size recalculation when the container changes (mobile layout switches).
    const t = setTimeout(() => map.invalidateSize(), 50)
    if (!focus) return () => clearTimeout(t)
    if (focus.type === 'point') {
      map.flyTo([focus.point[1], focus.point[0]], focus.zoom ?? 15, { duration: 0.8 })
    } else if (focus.type === 'all') {
      map.flyToBounds(ASHDOD_BOUNDS, { duration: 0.6 })
    } else {
      const fc = focus.project.geojson
      const b = fc ? bboxOf(fc) : null
      if (b && (b[2] - b[0] > 0.0004 || b[3] - b[1] > 0.0004)) {
        map.flyToBounds(
          [
            [b[1], b[0]],
            [b[3], b[2]],
          ],
          { padding: [40, 40], maxZoom: 17, duration: 0.8 },
        )
      } else if (focus.project.center) {
        map.flyTo([focus.project.center[1], focus.project.center[0]], 17, { duration: 0.8 })
      }
    }
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce])
  return null
}

function ProjectLayer({
  project,
  selected,
  hovered,
  dimmed,
  onSelect,
  onHover,
  tooltip,
}: {
  project: Pick<Project, 'id' | 'title' | 'status' | 'geojson' | 'center'>
  selected: boolean
  hovered: boolean
  dimmed: boolean
  onSelect?: (id: string) => void
  onHover?: (id: string | null) => void
  tooltip: boolean
}) {
  const color = BLUE_LINE
  const emphasis = selected || hovered
  const style = useMemo(
    () => ({
      color,
      weight: emphasis ? 3.5 : 2.2,
      opacity: dimmed ? 0.5 : 1,
      fillColor: color,
      fillOpacity: emphasis ? 0.24 : dimmed ? 0.04 : 0.1,
    }),
    [color, emphasis, dimmed],
  )
  const handlers = {
    click: () => onSelect?.(project.id),
    mouseover: () => onHover?.(project.id),
    mouseout: () => onHover?.(null),
  }
  const hasShapes = !!project.geojson?.features?.some((f) => f.geometry && f.geometry.type !== 'Point')

  return (
    <>
      {project.geojson && (
        <GeoJSON
          key={`${project.id}-${style.weight}-${style.opacity}-${color}`}
          data={project.geojson as FeatureCollection}
          style={() => style}
          pointToLayer={(_f, latlng) => L.circleMarker(latlng, { ...style, radius: emphasis ? 9 : 7, fillOpacity: 0.9 })}
          eventHandlers={handlers}
        >
          {tooltip && (
            <Tooltip className="proj-tip" direction="top" sticky>
              {project.title}
            </Tooltip>
          )}
        </GeoJSON>
      )}
      {project.center && !hasShapes && (
        <CircleMarker
          center={[project.center[1], project.center[0]]}
          radius={emphasis ? 9 : 7}
          pathOptions={{
            color: '#fff',
            weight: 2,
            fillColor: color,
            fillOpacity: dimmed ? 0.55 : 1,
          }}
          eventHandlers={handlers}
        >
          {tooltip && (
            <Tooltip className="proj-tip" direction="top" offset={[0, -6]}>
              {project.title}
            </Tooltip>
          )}
        </CircleMarker>
      )}
    </>
  )
}

/** A building plan (תב/) from PLANS-GH: its lots in bronze, a thin dashed line, and a card with the committee decision. */
function BuildingLayer({ plan }: { plan: BuildingPlan }) {
  const style = { color: BUILDING_COLOR, weight: 1.6, dashArray: '4 3', fillColor: BUILDING_COLOR, fillOpacity: 0.16 }
  const card = (
    <Popup className="bp-pop">
      <b>{plan.title}</b>
      <span>
        תוכנית בינוי {plan.plan_number.replace('תב/', '')}
        {plan.underlying_plan ? ` · לפי תוכנית ${plan.underlying_plan}` : ''}
      </span>
      <span>
        {plan.decision}
        {plan.committee_date ? ` (${fmtDate(plan.committee_date)})` : ''}
      </span>
      <a href={PLANS_APP_URL} target="_blank" rel="noreferrer">
        באפליקציית תוכניות הבינוי
      </a>
    </Popup>
  )
  if (plan.geometry)
    return (
      <GeoJSON data={{ type: 'Feature', properties: {}, geometry: plan.geometry } as Feature} style={() => style}>
        {card}
      </GeoJSON>
    )
  if (!plan.center) return null
  return (
    <CircleMarker center={[plan.center[1], plan.center[0]]} radius={6} pathOptions={{ ...style, fillOpacity: 0.5 }}>
      {card}
    </CircleMarker>
  )
}
