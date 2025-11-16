# PDF Tools Suite (Frontend-Only)

Live site: https://pdfescape.online/

This is a pure client‑side PDF tools collection built for GitHub Pages. It requires no backend, no Node.js server, and no `node_modules`. All functionality runs in the browser using CDN libraries.

## What’s included

- Merge PDF
- Split PDF
- Rotate pages
- Watermark
- Text extractor
- PDF to Image
- Image to PDF (robust PNG embedding)
- Metadata viewer/editor
- Form filler
- Signature
- Page numbering
- Bookmark
- Resizer
- Annotation
- Optimizer
- OCR (optional – client‑side; may be disabled depending on build)

## Removed features (as requested)

- Password Protector (backend dependent)
- PDF to Excel (backend dependent)
- Color Converter (removed)
- Backup files and server code

## Tech stack

- pdf-lib (via CDN)
- PDF.js (via CDN)
- Vanilla JS/HTML/CSS, entirely static

## Usage

### GitHub Pages (recommended)
Just visit the live URL above. If you recently updated the repository and are still seeing old behavior:

1. Open DevTools → Application → Service Workers → Unregister (if any)
2. DevTools → Application → Storage → Clear site data
3. Hard reload (Ctrl+F5) or use an Incognito window

### Local use
Download or clone the repo and open `index.html` directly in your browser.
For more reliable local testing, you can serve the folder with any simple HTTP server (e.g., `python -m http.server`), then open `http://localhost:8000/`.

## Image to PDF notes

- Images are embedded as PNG to avoid JPEG SOI errors and maximize compatibility.
- EXIF orientation is respected when the browser supports it.
- Very large images are downscaled to a safe maximum dimension (default ~4000 px) to prevent memory issues.
- HEIC/HEIF images are not natively supported by most browsers; convert them to PNG/JPEG before use.

## Caching and Service Worker

- Service Worker registration is disabled by default to avoid stale assets on GitHub Pages.
- To re‑enable, open `js/app.js` and set `ENABLE_SW = true`, then deploy. If you enable SW, always bump script versions (e.g., `js/tools.js?v=15`) when you change files.

## Sitemap / SEO

- `sitemap.xml` lists only the existing homepage URL.
- `robots.txt` allows indexing of the project path and points to the sitemap.

## Project structure

```
Pdf_Projects/
├── index.html
├── robots.txt
├── sitemap.xml
├── js/
│   ├── app.js
│   ├── tools.js
│   ├── utils.js
│   ├── components.js
│   ├── performance.js
│   ├── drag-drop.js
│   ├── accessibility.js
│   └── pdf-to-word.js
├── css/ (if present)
└── assets/ (if present)
```

## Contributing

Pull requests are welcome. Please ensure any new features remain client‑side only and avoid introducing backend dependencies.

## License

This project is intended for educational and personal use. Add a license file (e.g., MIT) if you plan to distribute or accept external contributions.