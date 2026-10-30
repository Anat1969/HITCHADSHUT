// Runs the sun-hours study off the main thread: about a second per state and season.
import { makeRaster, heights, sunHours, mask, neighbourMask, receptorStats, type Season, type ShadeModel } from './shade'

export interface ShadeRequest { model: ShadeModel; season: Season }

self.onmessage = (e: MessageEvent<ShadeRequest>) => {
  const { model, season } = e.data
  const r = makeRaster(model)
  const H0 = heights(r, model, 'today'), H1 = heights(r, model, 'after')
  const h0 = sunHours(r, H0, season), h1 = sunHours(r, H1, season)
  const inside = mask(r, model.boundary)
  const open = mask(r, model.parcels, (p) => p.cat === 'open')
  const stats = [
    receptorStats(r, 'neighbours', 'השכנים: עד 100 מ\' מהתוכנית', neighbourMask(r, inside), H0, H1, h0, h1),
    receptorStats(r, 'open', 'השטחים הפתוחים בתוכנית', open, H0, H1, h0, h1),
  ]
  ;(self as unknown as Worker).postMessage({ r, H0, H1, h0, h1, inside, stats, season }, [H0.buffer, H1.buffer, h0.buffer, h1.buffer, inside.buffer])
}
