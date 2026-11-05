# Scanned drawing georeferenced by its grid ticks (3/03/101/71א, עורף נמל אשדוד)

Working scripts as used once, with the tick positions and thresholds of that drawing written in. Run from a scratch folder that holds the extracted image (`pdfimages -j tashrit.pdf img`).

1. `ticks2.py <img>`: finds the diagonal tick marks between the two frame lines (the frame-line equations are fitted first from row profiles).
2. `georef.py`: similarity transform from 25 ticks (old Israeli grid, EPSG:28193 with northing + 1,000,000), then to ITM. RMS 2.8 m. Checked against city GIS buildings.
3. Blue line: colour mask, close 45 px, flood fill, cut the dotted gas line by hand.
4. `zones_poly.py`: land use by k-means on the fill colour (18 clusters mapped by eye to the legend), small fragments absorbed.
5. `blocks.py`: blocks inside each buildable zone, split by the drawn lot lines and grown back to fill the zone.
