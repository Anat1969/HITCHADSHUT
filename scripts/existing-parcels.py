"""Registered parcels (גושים וחלקות) inside a plan, from the Ashdod GIS, for plans without an approved-state drawing.

Usage:
  python3 -I scripts/existing-parcels.py <model.json> <out.geojson>

This is the existing cadastre, not the approved land use: the GIS has no zoning layer. The evolution
map shows it as "המצב הקיים" beside the approved quantities from table 3.2, and labels it as such.
Parcels are clipped to model.boundary; slivers under 20 m2 are dropped.
"""
import json, sys, urllib.parse, urllib.request

from shapely.geometry import shape, mapping
from shapely.ops import unary_union

URL = ('https://gis.ashdod.muni.il/arcgis/rest/services/' + urllib.parse.quote('גושים_וחלקות') +
       '/MapServer/1/query')
model_path, out_path = sys.argv[1:]
model = json.load(open(model_path))
bnd = unary_union([shape(f['geometry']) for f in model['boundary']['features']]).buffer(0)
x0, y0, x1, y1 = bnd.bounds
q = urllib.parse.urlencode({
    'geometry': f'{x0},{y0},{x1},{y1}', 'geometryType': 'esriGeometryEnvelope', 'inSR': 4326,
    'spatialRel': 'esriSpatialRelIntersects', 'outFields': 'Gush,Helka,Helka_Area', 'returnGeometry': 'true',
    'outSR': 4326, 'f': 'geojson'})
data = json.load(urllib.request.urlopen(f'{URL}?{q}', timeout=60))
feats = []
for f in data.get('features', []):
    g = shape(f['geometry']).buffer(0).intersection(bnd)
    # area in m2 by a local equirectangular projection (good to a fraction of a percent at this size)
    import math
    k = 111320 * math.cos(math.radians(bnd.centroid.y)) * 110574
    if g.is_empty or g.area * k < 20:
        continue
    p = f['properties']
    feats.append({'type': 'Feature', 'geometry': mapping(g),
                  'properties': {'gush': p.get('Gush'), 'helka': p.get('Helka'), 'reg_area': p.get('Helka_Area'),
                                 'area_in_plan_m2': round(g.area * k)}})
json.dump({'type': 'FeatureCollection', 'features': feats,
           'properties': {'source': 'gis.ashdod.muni.il, שכבת גושים וחלקות', 'clipped_to': 'model.boundary'}},
          open(out_path, 'w'), ensure_ascii=False)
print(f'{len(feats)} parcels, {sum(f["properties"]["area_in_plan_m2"] for f in feats)} m2 inside the boundary', file=sys.stderr)
