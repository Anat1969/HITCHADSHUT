# Reference sun positions for scripts/shade-validate.ts, from NREL SPA as implemented in pvlib.
# python3 -I scripts/shade-spa-ref.py > spa-ref.json   (pip install pvlib)
import json, sys
import pandas as pd
import pvlib

lat, lon = 31.8045, 34.6545  # Ashdod, near תמל/2022
rows = []
for day, utc in [('2026-12-21', 2), ('2026-03-21', 2), ('2026-06-21', 3)]:
    for h in [x / 2 for x in range(10, 40)]:
        t = (pd.Timestamp(day) + pd.Timedelta(hours=h - utc)).tz_localize('UTC')
        sp = pvlib.solarposition.spa_python(pd.DatetimeIndex([t]), lat, lon, altitude=20, pressure=101325, temperature=20)
        el, az = float(sp['apparent_elevation'].iloc[0]), float(sp['azimuth'].iloc[0])
        if el > 0:
            rows.append(dict(ms=int(t.timestamp() * 1000), az=az, el=el))
json.dump(dict(lat=lat, lon=lon, rows=rows), sys.stdout)
