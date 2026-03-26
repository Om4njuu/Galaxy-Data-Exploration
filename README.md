# Galaxy Data Exploration

Lightweight static prototype demonstrating a galaxy-like data visualization using D3.

Quick start

1. Serve the folder with a local HTTP server (browsers block fetch on file://):

```bash
python -m http.server 8000
# or using Node.js
npx http-server . -p 8000
```

2. Open http://localhost:8000 in your browser.

Features included

- D3 force simulation to arrange points as a galaxy
- Pan & zoom
- Search by name or id
- Spectral-type filter and brightness slider
- Hover tooltip and click details sidebar

Files

- `index.html` — main page
- `src/main.js` — D3 logic and interactions
- `src/styles.css` — styling
- `data/sample-astronomical.json` — sample dataset

Next steps

- Add clustering labels, improved legends, and timeline animation
- Support CSV & larger datasets via streaming or server API
# Galaxy-Data-Exploration