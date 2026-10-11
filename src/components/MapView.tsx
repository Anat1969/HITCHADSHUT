import { useEffect, useMemo } from 'react'
import { Circle, CircleMarker, GeoJSON, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import type { FeatureCollection } from 'geojson'
import 'leaflet/dist/leaflet.css'
import type { LonLat, Project } from '../lib/types'
import { STATUS_COLOR } from '../lib/labels'
import { ASHDOD_BOUNDS, ASHDOD_CENTER, bboxOf } from '../lib/geo'

const meIcon = L.divIcon({ className: '', html: '<div class="me-pin"></div>', iconSize: [18, 18], iconAnchor: [9, 9] })

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
}: Props) {
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
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        maxZoom={19}
      />
      <ZoomControlLeft />
      <ResizeWatcher />
      <FocusController focus={focus ?? null} />
      {onMapClick && <ClickCatcher onClick={onMapClick} />}

      {projects.map((p) => (
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
  const color = STATUS_COLOR[project.status]
  const emphasis = selected || hovered
  const style = useMemo(
    () => ({
      color,
      weight: emphasis ? 3.5 : 2,
      opacity: dimmed ? 0.5 : 1,
      fillColor: color,
      fillOpacity: emphasis ? 0.38 : dimmed ? 0.1 : 0.22,
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
      {project.center && (
        <CircleMarker
          center={[project.center[1], project.center[0]]}
          radius={emphasis ? 9 : hasShapes ? 5 : 8}
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
