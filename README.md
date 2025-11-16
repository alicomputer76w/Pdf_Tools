# PDF Tools Suite (Frontend‑Only)

Live site: https://pdfescape.online/

## About

PDF Tools Suite is a privacy‑friendly, client‑side toolkit for everyday PDF tasks. All processing happens locally in your browser — your files do not leave your device. The app is built with `pdf-lib`, `PDF.js`, and vanilla HTML/CSS/JS, and is deployed as a static site.

## Features Overview

- PDF Merger — combine multiple PDFs into one document
- PDF Splitter — extract specific pages or ranges into a new PDF
- PDF to Word — convert PDF text to editable DOCX (English & Urdu)
- PDF to Image — render pages to high‑quality images (PNG/JPG)
- Image to PDF — create PDFs from images with robust PNG embedding
- Watermark Adder — add text or image watermarks to pages
- Page Rotator — fix orientation by rotating selected pages
- Metadata Editor — view and edit title, author, and other properties
- Form Filler — fill and edit PDF form fields
- Digital Signature — add signature images to documents
- Text Extractor — extract text content from PDF pages
- Page Numbering — add customizable page numbers
- Bookmark Manager — add and manage document bookmarks
- Page Resizer — change page dimensions to common sizes
- OCR Tool — extract text from scanned documents (client‑side)
- Annotation Tool — add comments and notes to pages
- Quality Optimizer — balance size and quality for better performance
- Compressor — reduce file size while maintaining quality

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

- `sitemap.xml` lists the live pages (home, about, feedback, policy).
- `robots.txt` allows indexing and points search engines to the sitemap.

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