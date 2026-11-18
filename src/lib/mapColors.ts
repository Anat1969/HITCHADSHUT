import type { ExpressionSpecification } from 'maplibre-gl'
import { LAND_USE } from './labels'

/** MapLibre colour expression by land use (`cat` on massing and lot features). */
export function landUseColor(fallback: string | ExpressionSpecification): ExpressionSpecification {
  return ['match', ['get', 'cat'], ...Object.entries(LAND_USE).flatMap(([k, v]) => [k, v.color]), fallback] as unknown as ExpressionSpecification
}
