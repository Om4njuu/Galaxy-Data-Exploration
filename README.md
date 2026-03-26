# Galaxy-Data-Exploration

This repository includes a simple web demo for "Galaxy Data Exploration": upload datasets (CSV or JSON) and visualize points as stars grouped into constellations.

Quick start:

1. Open [index.html](index.html) in your browser (a local static server is recommended).
2. Upload one or more files (CSV or JSON). The app groups records by filename by default; you can select an attribute to group by.

Files added:

- [index.html](index.html) — main page
- [src/styles.css](src/styles.css) — basic styling
- [src/app.js](src/app.js) — D3 visualization, upload, grouping, zoom, search, filters
- [data/sample.json](data/sample.json) — sample dataset

To run a local server (Python):

```powershell
python -m http.server 8000
# then open http://localhost:8000
```
