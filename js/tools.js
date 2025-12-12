/**
 * PDF Tools Suite - Clean Tool Implementations
 * Minimal version to test syntax issues
 */

/**
 * Base Tool Class
 */
class BaseTool {
    constructor(name, description) {
        this.name = name;
        this.description = description;
    }

    async execute(files, options = {}) {
        throw new Error('Execute method must be implemented by subclass');
    }

    createInterface() {
        throw new Error('CreateInterface method must be implemented by subclass');
    }

    validate(files, options = {}) {
        return { valid: true, errors: [] };
    }
}

/**
 * PDF Merger Tool
 */
class PDFMergerTool extends BaseTool {
    constructor() {
        super('PDF Merger', 'Combine multiple PDFs into one document');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="merger-files">Select PDF files to merge:</label>
                    <input type="file" id="merger-files" accept="application/pdf" multiple />
                    <p class="hint">Tip: Select 2 or more PDF files. Order will follow selection order.</p>
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Output filename:</label>
                        <input type="text" class="option-input" id="merger-filename" value="merged-document.pdf">
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="merger-process">
                        <i class="material-icons">merge_type</i>
                        <span>Merge PDFs</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (!files || files.length < 2) {
            throw new Error('At least 2 PDF files are required for merging');
        }

        try {
            // Convert File objects into PDFLib documents
            const pdfDocs = [];
            for (const file of files) {
                const buffer = await file.arrayBuffer();
                const doc = await window.PDFLib.PDFDocument.load(buffer);
                pdfDocs.push(doc);
            }

            // Merge and save using PDFUtils
            const mergedDoc = await PDFUtils.mergePDFs(pdfDocs);
            const pdfBytes = await PDFUtils.savePDF(mergedDoc);
            const filename = options.filename || 'merged-document.pdf';

            // Download the merged PDF
            DownloadUtils.downloadPDF(pdfBytes, filename);

            return {
                success: true,
                message: `Successfully merged ${files.length} PDFs into ${filename}`
            };
        } catch (error) {
            throw new Error(`Failed to merge PDFs: ${error.message}`);
        }
    }

    attachHandlers() {
        const processBtn = document.getElementById('merger-process');
        const fileInput = document.getElementById('merger-files');
        const nameInput = document.getElementById('merger-filename');

        if (!processBtn) return;

        processBtn.addEventListener('click', async () => {
            try {
                const files = Array.from(fileInput?.files || []);
                if (!files || files.length < 2) {
                    window.notificationManager?.show('Please select at least 2 PDF files to merge.', 'warning');
                    return;
                }

                const filename = (nameInput?.value || 'merged-document.pdf').trim();

                // Show progress modal (do not await)
                modalManager.showProgress('Merging PDFs...', 'Please wait while we merge your files.');
                modalManager.updateProgress(5, 'Preparing files');

                // Execute merge
                await this.execute(files, { filename });

                // Mark complete
                modalManager.updateProgress(100, 'Completed');
                window.notificationManager?.show('PDFs merged successfully!', 'success');
            } catch (err) {
                console.error('Merge failed:', err);
                window.notificationManager?.show(`Merge failed: ${err.message}`, 'error', { persistent: true });
            } finally {
                modalManager.hideProgress();
            }
        });
    }
}

/**
 * PDF Splitter Tool
 */
class PDFSplitterTool extends BaseTool {
    constructor() {
        super('PDF Splitter', 'Extract specific pages from PDF documents');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="splitter-file">Select a PDF file to split:</label>
                    <input type="file" id="splitter-file" accept="application/pdf" />
                    <p class="hint">Tip: Enter pages like 1,3,5-7 to extract specific pages and ranges.</p>
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Pages to extract:</label>
                        <input type="text" class="option-input" id="splitter-pages" placeholder="e.g., 1,3,5-7">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Output filename:</label>
                        <input type="text" class="option-input" id="splitter-filename" value="extracted-pages.pdf">
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="splitter-process">
                        <i class="material-icons">content_cut</i>
                        <span>Split PDF</span>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Parse page expression like "1,3,5-7" into zero-based indices
     */
    parsePagesExpression(expr, maxPageCount) {
        const pages = new Set();
        const sanitized = (expr || '').trim();
        if (!sanitized) return [];

        const parts = sanitized.split(',').map(p => p.trim()).filter(Boolean);
        for (const part of parts) {
            if (part.includes('-')) {
                const [startStr, endStr] = part.split('-');
                let start = parseInt(startStr, 10);
                let end = parseInt(endStr, 10);
                if (Number.isNaN(start) || Number.isNaN(end)) continue;
                // Clamp and normalize
                start = Math.max(1, Math.min(start, maxPageCount));
                end = Math.max(1, Math.min(end, maxPageCount));
                if (start > end) [start, end] = [end, start];
                for (let n = start; n <= end; n++) pages.add(n - 1);
            } else {
                let n = parseInt(part, 10);
                if (Number.isNaN(n)) continue;
                n = Math.max(1, Math.min(n, maxPageCount));
                pages.add(n - 1);
            }
        }
        return Array.from(pages).sort((a, b) => a - b);
    }

    async execute(files, options = {}) {
        if (!files || files.length !== 1) {
            throw new Error('Select exactly one PDF file to split');
        }

        try {
            const file = files[0];
            const sourcePdf = await PDFUtils.loadPDF(file);
            const pageCount = PDFUtils.getPageCount(sourcePdf);
            const indices = this.parsePagesExpression(options.pages, pageCount);
            if (!indices.length) {
                throw new Error('Please provide valid pages to extract');
            }

            const newPdf = await PDFUtils.extractPages(sourcePdf, indices);
            const pdfBytes = await PDFUtils.savePDF(newPdf);
            const filename = (options.filename || 'extracted-pages.pdf').trim();
            DownloadUtils.downloadPDF(pdfBytes, filename);

            return {
                success: true,
                message: `Extracted ${indices.length} page(s) to ${filename}`
            };
        } catch (error) {
            throw new Error(`Failed to split PDF: ${error.message}`);
        }
    }

    attachHandlers() {
        const processBtn = document.getElementById('splitter-process');
        const fileInput = document.getElementById('splitter-file');
        const pagesInput = document.getElementById('splitter-pages');
        const nameInput = document.getElementById('splitter-filename');

        if (!processBtn) return;

        processBtn.addEventListener('click', async () => {
            try {
                const files = Array.from(fileInput?.files || []);
                if (!files || files.length !== 1) {
                    window.notificationManager?.show('Please select exactly one PDF file.', 'warning');
                    return;
                }

                const pagesExpr = (pagesInput?.value || '').trim();
                const filename = (nameInput?.value || 'extracted-pages.pdf').trim();

                // Show progress modal (do not await)
                modalManager.showProgress('Splitting PDF...', 'Preparing selection...');
                modalManager.updateProgress(5, 'Preparing selection');

                await this.execute(files, { pages: pagesExpr, filename });

                modalManager.updateProgress(100, 'Completed');
                window.notificationManager?.show('Pages extracted successfully!', 'success');
            } catch (err) {
                console.error('Split failed:', err);
                window.notificationManager?.show(`Split failed: ${err.message}`, 'error', { persistent: true });
            } finally {
                modalManager.hideProgress();
            }
        });
    }
}

/**
 * Helper: Parse page expression like "1,3,5-7" into zero-based indices
 */
function parsePagesExpression(expr, maxPageCount) {
    const pages = new Set();
    const sanitized = (expr || '').trim();
    if (!sanitized) return [];

    const parts = sanitized.split(',').map(p => p.trim()).filter(Boolean);
    for (const part of parts) {
        if (part.includes('-')) {
            const [startStr, endStr] = part.split('-');
            let start = parseInt(startStr, 10);
            let end = parseInt(endStr, 10);
            if (Number.isNaN(start) || Number.isNaN(end)) continue;
            // Clamp and normalize
            start = Math.max(1, Math.min(start, maxPageCount));
            end = Math.max(1, Math.min(end, maxPageCount));
            if (start > end) [start, end] = [end, start];
            for (let n = start; n <= end; n++) pages.add(n - 1);
        } else {
            let n = parseInt(part, 10);
            if (Number.isNaN(n)) continue;
            n = Math.max(1, Math.min(n, maxPageCount));
            pages.add(n - 1);
        }
    }
    return Array.from(pages).sort((a, b) => a - b);
}

/**
 * Image to PDF Tool
 */
class ImageToPDFTool extends BaseTool {
    constructor() {
        super('Image to PDF', 'Convert one or more images into a single PDF');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="img2pdf-files">Select image files:</label>
                    <input type="file" id="img2pdf-files" accept="image/*" multiple />
                    <p class="hint">Tip: Select multiple images to include all in one PDF.</p>
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Output filename:</label>
                        <input type="text" class="option-input" id="img2pdf-filename" value="images-to-pdf.pdf">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Preview & order:</label>
                        <style>
                            .img-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:10px; }
                            .img-tile { position:relative; border:1px solid var(--surface-3,#444); border-radius:10px; overflow:hidden; background:var(--surface-1,#111); box-shadow:0 2px 6px rgba(0,0,0,0.25); }
                            .img-tile img { width:100%; height:120px; object-fit:cover; display:block; }
                            .img-badge { position:absolute; top:6px; left:6px; background:rgba(0,0,0,0.65); color:#fff; font-size:12px; padding:2px 6px; border-radius:6px; }
                            .img-remove { position:absolute; top:6px; right:6px; background:rgba(0,0,0,0.65); color:#fff; border:none; border-radius:6px; padding:2px 6px; cursor:pointer; }
                            .img-footer { position:absolute; bottom:0; left:0; right:0; display:flex; align-items:center; gap:6px; background:rgba(0,0,0,0.55); color:#fff; padding:6px 8px; }
                            .img-name { flex:1; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                            .drag-handle { display:flex; align-items:center; justify-content:center; width:28px; height:24px; border-radius:6px; border:1px solid rgba(255,255,255,0.25); cursor:grab; }
                            .img-tile.drop-target { outline:2px dashed #4ea1ff; outline-offset:-2px; }
                            .img-toolbar { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
                        </style>
                        <div class="img-toolbar">
                            <button class="btn btn-secondary" id="img2pdf-add"><i class="material-icons">add_photo_alternate</i><span>Add more</span></button>
                            <button class="btn btn-secondary" id="img2pdf-sort-asc"><i class="material-icons">sort_by_alpha</i><span>A→Z</span></button>
                            <button class="btn btn-secondary" id="img2pdf-sort-desc"><i class="material-icons">sort</i><span>Z→A</span></button>
                            <button class="btn btn-secondary" id="img2pdf-reverse"><i class="material-icons">swap_vert</i><span>Reverse</span></button>
                            <button class="btn btn-secondary" id="img2pdf-clear"><i class="material-icons">delete</i><span>Clear</span></button>
                        </div>
                        <div id="img2pdf-grid" class="option-input img-grid"></div>
                        <p class="hint">Drag thumbnails or use toolbar to arrange. Remove unwanted images.</p>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="img2pdf-process">
                        <i class="material-icons">picture_as_pdf</i>
                        <span>Create PDF</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (!files || files.length < 1) {
            throw new Error('Select at least one image file');
        }
        const doc = await window.PDFLib.PDFDocument.create();
        const ua = (navigator.userAgent || '').toLowerCase();
        const isMobile = /android|iphone|ipad|ipod/.test(ua);
        const manyImages = files.length >= 6;
        function calcMobileDims(len) {
            if (len <= 8) return { dim: 2000, quality: 0.85 };
            if (len <= 15) return { dim: 1600, quality: 0.8 };
            return { dim: 1200, quality: 0.7 };
        }
        let MAX_DIM = isMobile ? calcMobileDims(files.length).dim : 4000;
        const JPEG_QUALITY = isMobile ? calcMobileDims(files.length).quality : 0.92;
        const LOW_MEM = isMobile && manyImages;

        async function loadBitmapWithOrientation(blob) {
            // Prefer createImageBitmap to respect EXIF orientation where supported
            if (window.createImageBitmap) {
                try {
                    return await createImageBitmap(blob, { imageOrientation: 'from-image' });
                } catch (e) {
                    // Fallback below
                }
            }
            return null;
        }

        async function drawToCanvas(file) {
            let bitmap = await loadBitmapWithOrientation(file);
            if (bitmap) {
                const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
                const cw = Math.max(1, Math.round(bitmap.width * scale));
                const ch = Math.max(1, Math.round(bitmap.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = cw; canvas.height = ch;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(bitmap, 0, 0, cw, ch);
                try { bitmap.close(); } catch {}
                return canvas;
            }
            // Fallback: HTMLImageElement
            const url = URL.createObjectURL(file);
            try {
                const img = await new Promise((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = (err) => reject(new Error('Unsupported image or failed to load'));
                    image.src = url;
                });
                const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
                const cw = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
                const ch = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
                const canvas = document.createElement('canvas');
                canvas.width = cw; canvas.height = ch;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, cw, ch);
                return canvas;
            } finally {
                URL.revokeObjectURL(url);
            }
        }

        async function canvasToJPEGBytes(canvas, quality = 0.92) {
            const blob = await ImageUtils.canvasToBlob(canvas, 'image/jpeg', quality);
            return new Uint8Array(await blob.arrayBuffer());
        }

        async function canvasToPNGBytes(canvas) {
            const blob = await ImageUtils.canvasToBlob(canvas, 'image/png');
            return new Uint8Array(await blob.arrayBuffer());
        }

        function isJPEG(bytes) {
            // JPEG starts with 0xFF 0xD8 (SOI)
            return bytes && bytes.length > 2 && bytes[0] === 0xFF && bytes[1] === 0xD8;
        }

        function isPNG(bytes) {
            // PNG signature: 89 50 4E 47 0D 0A 1A 0A
            const sig = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
            if (!bytes || bytes.length < sig.length) return false;
            for (let i = 0; i < sig.length; i++) {
                if (bytes[i] !== sig[i]) return false;
            }
            return true;
        }

        let index = 0;
        const skipped = [];
        for (const file of files) {
            index++;
            // Update progress for UX (non-blocking)
            try { modalManager.updateProgress(Math.round((index / files.length) * 100), `Processing image ${index}/${files.length}`); } catch {}

            // Draw to canvas (handles WebP, HEIC via browser support, and applies downscaling)
            let canvas;
            try {
                canvas = await drawToCanvas(file);
            } catch (e) {
                skipped.push(file.name);
                continue;
            }
            const cw = canvas.width, ch = canvas.height;

            let embedded = null;
            try {
                const mime = (file.type || '').toLowerCase();
                if (LOW_MEM) {
                    const jpegBytes = await canvasToJPEGBytes(canvas, JPEG_QUALITY);
                    embedded = await doc.embedJpg(jpegBytes);
                } else if (mime.includes('jpeg') || mime.includes('jpg')) {
                    const jpegBytes = await canvasToJPEGBytes(canvas, JPEG_QUALITY);
                    embedded = await doc.embedJpg(jpegBytes);
                } else {
                    const pngBytes = await canvasToPNGBytes(canvas);
                    if (!isPNG(pngBytes)) throw new Error('Invalid PNG');
                    embedded = await doc.embedPng(pngBytes);
                }
            } catch (e2) {
                skipped.push(file.name);
                try { canvas.width = 0; canvas.height = 0; } catch {}
                await new Promise(r => setTimeout(r, 30));
                continue;
            }

            const page = doc.addPage([cw, ch]);
            page.drawImage(embedded, { x: 0, y: 0, width: cw, height: ch });
            try { canvas.width = 0; canvas.height = 0; } catch {}
            await new Promise(r => setTimeout(r, 30));
        }

        const pdfBytes = await doc.save();
        const filename = (options.filename || 'images-to-pdf.pdf').trim();
        DownloadUtils.downloadPDF(pdfBytes, filename);
        const msg = skipped.length ? `Created ${filename} (skipped ${skipped.length} image(s): ${skipped.join(', ')})` : `Created ${filename}`;
        return { success: true, message: msg };
    }

    attachHandlers() {
        const input = document.getElementById('img2pdf-files');
        const nameInput = document.getElementById('img2pdf-filename');
        const btn = document.getElementById('img2pdf-process');
        const gridEl = document.getElementById('img2pdf-grid');
        let orderedFiles = [];

        function renderGrid() {
            if (!gridEl) return;
            gridEl.innerHTML = '';
            orderedFiles.forEach((f, i) => {
                const tile = document.createElement('div');
                tile.className = 'img-tile';
                tile.draggable = true;
                tile.dataset.index = String(i);

                const img = document.createElement('img');
                img.alt = f.name;
                const url = URL.createObjectURL(f);
                img.src = url;
                img.onload = () => URL.revokeObjectURL(url);

                const badge = document.createElement('div');
                badge.className = 'img-badge';
                badge.textContent = String(i + 1);

                const removeBtn = document.createElement('button');
                removeBtn.className = 'img-remove';
                removeBtn.textContent = '✖';
                removeBtn.addEventListener('click', () => {
                    orderedFiles = orderedFiles.filter((_, idx) => idx !== i);
                    renderGrid();
                });

                const footer = document.createElement('div');
                footer.className = 'img-footer';
                const nameEl = document.createElement('span');
                nameEl.className = 'img-name';
                nameEl.textContent = f.name;
                const handle = document.createElement('div');
                handle.className = 'drag-handle';
                const icon = document.createElement('i');
                icon.className = 'material-icons';
                icon.textContent = 'drag_indicator';
                handle.appendChild(icon);

                function swap(a, b) {
                    const t = orderedFiles[a];
                    orderedFiles[a] = orderedFiles[b];
                    orderedFiles[b] = t;
                    renderGrid();
                }
                handle.addEventListener('click', () => { if (i < orderedFiles.length - 1) swap(i, i + 1); });

                tile.addEventListener('dragstart', e => {
                    e.dataTransfer.setData('text/plain', String(i));
                });
                tile.addEventListener('dragover', e => { e.preventDefault(); tile.classList.add('drop-target'); });
                tile.addEventListener('drop', e => {
                    e.preventDefault();
                    const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                    const to = i;
                    if (!Number.isNaN(from) && from !== to) swap(from, to);
                    tile.classList.remove('drop-target');
                });
                tile.addEventListener('dragleave', () => tile.classList.remove('drop-target'));

                tile.appendChild(img);
                tile.appendChild(badge);
                tile.appendChild(removeBtn);
                footer.appendChild(nameEl);
                footer.appendChild(handle);
                tile.appendChild(footer);
                gridEl.appendChild(tile);
            });
        }

        gridEl?.addEventListener('dragover', e => e.preventDefault());
        gridEl?.addEventListener('drop', e => e.preventDefault());

        input?.addEventListener('change', () => {
            const fresh = Array.from(input.files || []);
            orderedFiles = orderedFiles.length ? orderedFiles.concat(fresh) : fresh;
            renderGrid();
        });

        const addBtn = document.getElementById('img2pdf-add');
        const sortAscBtn = document.getElementById('img2pdf-sort-asc');
        const sortDescBtn = document.getElementById('img2pdf-sort-desc');
        const reverseBtn = document.getElementById('img2pdf-reverse');
        const clearBtn = document.getElementById('img2pdf-clear');
        addBtn?.addEventListener('click', () => input?.click());
        sortAscBtn?.addEventListener('click', () => { orderedFiles.sort((a,b)=>a.name.localeCompare(b.name)); renderGrid(); });
        sortDescBtn?.addEventListener('click', () => { orderedFiles.sort((a,b)=>b.name.localeCompare(a.name)); renderGrid(); });
        reverseBtn?.addEventListener('click', () => { orderedFiles.reverse(); renderGrid(); });
        clearBtn?.addEventListener('click', () => { orderedFiles = []; renderGrid(); });
        btn?.addEventListener('click', async () => {
            const files = orderedFiles.length ? orderedFiles : Array.from(input?.files || []);
            try {
                modalManager.showProgress('Converting Images...', 'Creating PDF...');
                await this.execute(files, { filename: nameInput?.value });
                window.notificationManager?.show('Images converted to PDF successfully!', 'success');
            } catch (err) {
                console.error('Image to PDF failed:', err);
                window.notificationManager?.show(`Image to PDF failed: ${err.message}`, 'error');
            } finally {
                modalManager.hideProgress();
            }
        });
    }
}

/**
 * PDF to Image Tool
 */
class PDFToImageTool extends BaseTool {
    constructor() {
        super('PDF to Image', 'Convert PDF pages to images');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="pdf2img-file">Select a PDF file:</label>
                    <input type="file" id="pdf2img-file" accept="application/pdf" />
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Image format:</label>
                        <select class="option-input" id="pdf2img-format">
                            <option value="image/png">PNG</option>
                            <option value="image/jpeg">JPEG</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Scale:</label>
                        <input type="number" class="option-input" id="pdf2img-scale" value="1" min="0.5" max="3" step="0.1">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Page range:</label>
                        <div style="display:flex; gap:8px; align-items:center;">
                            <input type="number" class="option-input" id="pdf2img-start" value="1" min="1" step="1" style="width:100px" placeholder="Start">
                            <span>to</span>
                            <input type="number" class="option-input" id="pdf2img-end" value="" min="1" step="1" style="width:120px" placeholder="End (blank = last)">
                        </div>
                        <p class="hint">Example: convert only pages 20 to 45, enter 20 and 45. Leave End blank to convert till the last page.</p>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Save destination:</label>
                        <div class="option-input" style="display:flex; flex-direction:column; gap:6px;">
                            <label style="display:flex; align-items:center; gap:6px;">
                                <input type="checkbox" id="pdf2img-folder" checked />
                                <span>Choose a folder once (Chrome/Edge on desktop)</span>
                            </label>
                            <small id="pdf2img-folder-hint" class="hint">If your browser does not support folder saving, we will download a single ZIP file with all images.</small>
                        </div>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="pdf2img-process">
                        <i class="material-icons">image</i>
                        <span>Convert</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (!files || files.length !== 1) {
            throw new Error('Select exactly one PDF file');
        }
        const file = files[0];
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const pageCount = pdf.numPages;
        const format = options.format || 'image/png';
        const scale = parseFloat(options.scale) || 1;
        const start = Math.max(1, parseInt(options.startPage || '1', 10));
        const endRaw = options.endPage ? parseInt(options.endPage, 10) : pageCount;
        const end = Math.min(pageCount, Math.max(start, endRaw));
        const useFolder = !!options.useFolder;

        const canPickDirectory = typeof window.showDirectoryPicker === 'function';
        let dirHandle = null;
        let zip = null;

        if (useFolder && canPickDirectory) {
            dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' }).catch(() => null);
        }

        if (!dirHandle && useFolder) {
            if (typeof window.JSZip === 'undefined') {
                await new Promise((resolve, reject) => {
                    const s = document.createElement('script');
                    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                    s.onload = resolve;
                    s.onerror = () => reject(new Error('Failed to load JSZip'));
                    document.head.appendChild(s);
                });
            }
            if (typeof window.JSZip === 'function') {
                zip = new window.JSZip();
            }
        }

        const baseName = file.name.replace(/\.pdf$/i, '');
        let convertedCount = 0;

        for (let i = start; i <= end; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: ctx, viewport }).promise;

            const blob = await ImageUtils.canvasToBlob(canvas, format, format === 'image/jpeg' ? 0.92 : 1);
            const filename = `${baseName}_page_${i}.${format === 'image/png' ? 'png' : 'jpg'}`;

            if (dirHandle) {
                try {
                    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
                    const writable = await fileHandle.createWritable();
                    await writable.write(blob);
                    await writable.close();
                } catch (e) {
                    console.warn('Folder save failed, falling back to download:', e);
                    DownloadUtils.downloadImage(blob, filename);
                }
            } else if (zip) {
                const arrayBuf = await blob.arrayBuffer();
                zip.file(filename, arrayBuf);
            } else {
                DownloadUtils.downloadImage(blob, filename);
            }

            convertedCount++;
        }

        if (zip) {
            const zipBlob = await zip.generateAsync({ type: 'blob' });
            const zipName = `${baseName}_${start}-${end}_images.zip`;
            DownloadUtils.downloadBlob(zipBlob, zipName);
        }

        return { success: true, message: `Converted ${convertedCount} page(s) to images` };
    }

    attachHandlers() {
        const input = document.getElementById('pdf2img-file');
        const fmt = document.getElementById('pdf2img-format');
        const scaleInput = document.getElementById('pdf2img-scale');
        const btn = document.getElementById('pdf2img-process');
        const startInput = document.getElementById('pdf2img-start');
        const endInput = document.getElementById('pdf2img-end');
        const folderCheckbox = document.getElementById('pdf2img-folder');
        const folderHint = document.getElementById('pdf2img-folder-hint');

        if (typeof window.showDirectoryPicker !== 'function') {
            folderHint.textContent = 'Folder saving is not supported in this browser. We will download a single ZIP with all images.';
        }

        btn?.addEventListener('click', async () => {
            const files = Array.from(input?.files || []);
            try {
                modalManager.showProgress('Converting to Images...', 'Rendering pages...');
                await this.execute(files, {
                    format: fmt?.value,
                    scale: scaleInput?.value,
                    startPage: startInput?.value,
                    endPage: endInput?.value,
                    useFolder: folderCheckbox?.checked
                });
                window.notificationManager?.show('Converted to images successfully!', 'success');
            } catch (err) {
                console.error('PDF to Image failed:', err);
                window.notificationManager?.show(`PDF to Image failed: ${err.message}`, 'error');
            } finally {
                modalManager.hideProgress();
            }
        });
    }
}

/**
 * Rotate PDF Tool
 */
class RotatorTool extends BaseTool {
    constructor() {
        super('Rotate PDF', 'Rotate pages in a PDF');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="rotator-file">Select a PDF file:</label>
                    <input type="file" id="rotator-file" accept="application/pdf" />
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Rotation:</label>
                        <select class="option-input" id="rotator-angle">
                            <option value="90">90°</option>
                            <option value="180">180°</option>
                            <option value="270">270°</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Pages (optional):</label>
                        <input type="text" class="option-input" id="rotator-pages" placeholder="e.g., 1,3,5-7 or leave blank for all">
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="rotator-process">
                        <i class="material-icons">rotate_90_degrees_ccw</i>
                        <span>Rotate</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (!files || files.length !== 1) throw new Error('Select exactly one PDF file');
        const file = files[0];
        const sourcePdf = await PDFUtils.loadPDF(file);
        const angle = parseInt(options.angle, 10) || 90;
        const pageCount = PDFUtils.getPageCount(sourcePdf);
        const indices = options.pages ? parsePagesExpression(options.pages, pageCount) : null;
        const rotated = PDFUtils.rotatePDF(sourcePdf, angle, indices);
        const pdfBytes = await PDFUtils.savePDF(rotated);
        const filename = `${file.name.replace(/\.pdf$/i, '')}_rotated.pdf`;
        DownloadUtils.downloadPDF(pdfBytes, filename);
        return { success: true, message: `Rotated ${indices ? indices.length : pageCount} page(s)` };
    }

    attachHandlers() {
        const input = document.getElementById('rotator-file');
        const angleInput = document.getElementById('rotator-angle');
        const pagesInput = document.getElementById('rotator-pages');
        const btn = document.getElementById('rotator-process');
        btn?.addEventListener('click', async () => {
            const files = Array.from(input?.files || []);
            try {
                modalManager.showProgress('Rotating Pages...', 'Applying rotation...');
                await this.execute(files, { angle: angleInput?.value, pages: pagesInput?.value });
                window.notificationManager?.show('Rotation completed!', 'success');
            } catch (err) {
                console.error('Rotate failed:', err);
                window.notificationManager?.show(`Rotate failed: ${err.message}`, 'error');
            } finally {
                modalManager.hideProgress();
            }
        });
    }
}

/**
 * Text Extractor Tool
 */
class TextExtractorTool extends BaseTool {
    constructor() {
        super('Text Extractor', 'Extract text from PDF using PDF.js');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="textex-file">Select a PDF file:</label>
                    <input type="file" id="textex-file" accept="application/pdf" />
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="textex-process">
                        <i class="material-icons">description</i>
                        <span>Extract Text</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files) {
        if (!files || files.length !== 1) throw new Error('Select exactly one PDF file');
        const file = files[0];
        const data = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const strings = content.items.map(item => item.str);
            fullText += `\n\n--- Page ${i} ---\n` + strings.join(' ');
        }
        const filename = `${file.name.replace(/\.pdf$/i, '')}_text.txt`;
        DownloadUtils.downloadText(fullText, filename);
        return { success: true, message: `Extracted text from ${pdf.numPages} page(s)` };
    }

    attachHandlers() {
        const input = document.getElementById('textex-file');
        const btn = document.getElementById('textex-process');
        btn?.addEventListener('click', async () => {
            const files = Array.from(input?.files || []);
            try {
                modalManager.showProgress('Extracting Text...', 'Reading PDF...');
                await this.execute(files);
                window.notificationManager?.show('Text extracted successfully!', 'success');
            } catch (err) {
                console.error('Text extract failed:', err);
                window.notificationManager?.show(`Text extract failed: ${err.message}`, 'error');
            } finally {
                modalManager.hideProgress();
            }
        });
    }
}

/**
 * Page Numbering Tool
 */
class PageNumberingTool extends BaseTool {
    constructor() {
        super('Page Numbering', 'Add page numbers to PDF');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="pagenum-file">Select a PDF file:</label>
                    <input type="file" id="pagenum-file" accept="application/pdf" />
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Font size:</label>
                        <input type="number" class="option-input" id="pagenum-size" value="12" min="8" max="36">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Numbering format:</label>
                        <select class="option-input" id="pagenum-format">
                            <option value="arabic" selected>Arabic (1, 2, 3)</option>
                            <option value="roman">Roman (I, II, III)</option>
                            <option value="words">Words (one, two, three)</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Color:</label>
                        <input type="color" class="option-input" id="pagenum-color" value="#000000">
                    </div>
                    <div class="option-group" style="display:flex;align-items:center;gap:8px;">
                        <input type="checkbox" id="pagenum-underline">
                        <label class="option-label" for="pagenum-underline">Underline</label>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="pagenum-process">
                        <i class="material-icons">format_list_numbered</i>
                        <span>Add Numbers</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (!files || files.length !== 1) throw new Error('Select exactly one PDF file');
        const file = files[0];
        const doc = await PDFUtils.loadPDF(file);
        const fontSize = parseInt(options.fontSize, 10) || 12;
        const format = options.format || 'arabic';
        const colorHex = options.color || '#000000';
        const underline = !!options.underline;
        const hexToRgb = (hex) => {
            const h = hex.replace('#', '');
            const int = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
            const r = (int >> 16) & 255;
            const g = (int >> 8) & 255;
            const b = int & 255;
            return window.PDFLib.rgb(r/255, g/255, b/255);
        };
        const toRoman = (num) => {
            const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1];
            const syms = ['M','CM','D','CD','C','XC','L','XL','X','IX','V','IV','I'];
            let n = num; let out = '';
            for (let i=0;i<vals.length;i++){ while(n>=vals[i]){ out += syms[i]; n -= vals[i]; } }
            return out;
        };
        const toWords = (num) => {
            const ones = ['zero','one','two','three','four','five','six','seven','eight','nine'];
            const teens = ['ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
            const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
            const chunk = (n) => {
                let s = '';
                const h = Math.floor(n/100); const t = n%100; const o = n%10;
                if (h) s += ones[h] + ' hundred';
                if (t){ if (h) s += ' ';
                    if (t<10) s += ones[t]; else if (t<20) s += teens[t-10]; else { s += tens[Math.floor(t/10)]; if (o) s += '-' + ones[o]; }
                }
                return s || 'zero';
            };
            if (num===0) return 'zero';
            const thousands = Math.floor(num/1000); const rest = num%1000;
            let out = '';
            if (thousands) out += chunk(thousands) + ' thousand';
            if (rest){ if (thousands) out += ' '; out += chunk(rest); }
            return out;
        };
        const helv = await doc.embedFont(window.PDFLib.StandardFonts.Helvetica);
        const pages = doc.getPages();
        pages.forEach((page, idx) => {
            const { width } = page.getSize();
            const n = idx + 1;
            let text = '';
            if (format === 'roman') text = toRoman(n);
            else if (format === 'words') text = toWords(n);
            else text = String(n);
            const textWidth = helv.widthOfTextAtSize(text, fontSize);
            const x = (width - textWidth) / 2;
            const y = 24;
            page.drawText(text, {
                x,
                y,
                size: fontSize,
                font: helv,
                color: hexToRgb(colorHex)
            });
            if (underline) {
                const thickness = Math.max(0.75, fontSize * 0.05);
                page.drawRectangle({ x, y: y - thickness - 2, width: textWidth, height: thickness, color: hexToRgb(colorHex) });
            }
        });
        const pdfBytes = await doc.save();
        const filename = `${file.name.replace(/\.pdf$/i, '')}_numbered.pdf`;
        DownloadUtils.downloadPDF(pdfBytes, filename);
        return { success: true, message: `Added page numbers to ${pages.length} page(s)` };
    }

    attachHandlers() {
        const input = document.getElementById('pagenum-file');
        const sizeInput = document.getElementById('pagenum-size');
        const formatSel = document.getElementById('pagenum-format');
        const colorInput = document.getElementById('pagenum-color');
        const underlineInput = document.getElementById('pagenum-underline');
        const btn = document.getElementById('pagenum-process');
        btn?.addEventListener('click', async () => {
            const files = Array.from(input?.files || []);
            try {
                modalManager.showProgress('Adding Page Numbers...', 'Processing PDF pages...');
                await this.execute(files, {
                    fontSize: sizeInput?.value,
                    format: formatSel?.value,
                    color: colorInput?.value,
                    underline: underlineInput?.checked
                });
                window.notificationManager?.show('Page numbers added successfully!', 'success');
            } catch (err) {
                console.error('Page numbering failed:', err);
                window.notificationManager?.show(`Page numbering failed: ${err.message}`, 'error');
            } finally {
                modalManager.hideProgress();
            }
        });
    }
}

/**
 * Metadata Tool
 */
class MetadataTool extends BaseTool {
    constructor() {
        super('Metadata', 'Update PDF metadata such as title and author');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="metadata-file">Select a PDF file:</label>
                    <input type="file" id="metadata-file" accept="application/pdf" />
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Title:</label>
                        <input type="text" class="option-input" id="metadata-title" placeholder="Document Title">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Author:</label>
                        <input type="text" class="option-input" id="metadata-author" placeholder="Author Name">
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="metadata-process">
                        <i class="material-icons">info</i>
                        <span>Update</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (!files || files.length !== 1) throw new Error('Select exactly one PDF file');
        const file = files[0];
        const doc = await PDFUtils.loadPDF(file);
        if (options.title) doc.setTitle(options.title);
        if (options.author) doc.setAuthor(options.author);
        const pdfBytes = await doc.save();
        const filename = `${file.name.replace(/\.pdf$/i, '')}_metadata.pdf`;
        DownloadUtils.downloadPDF(pdfBytes, filename);
        return { success: true, message: 'Metadata updated' };
    }

    attachHandlers() {
        const input = document.getElementById('metadata-file');
        const titleInput = document.getElementById('metadata-title');
        const authorInput = document.getElementById('metadata-author');
        const btn = document.getElementById('metadata-process');
        btn?.addEventListener('click', async () => {
            const files = Array.from(input?.files || []);
            try {
                modalManager.showProgress('Updating Metadata...', 'Processing PDF...');
                await this.execute(files, { title: titleInput?.value, author: authorInput?.value });
                window.notificationManager?.show('Metadata updated successfully!', 'success');
            } catch (err) {
                console.error('Metadata update failed:', err);
                window.notificationManager?.show(`Metadata update failed: ${err.message}`, 'error');
            } finally {
                modalManager.hideProgress();
            }
        });
    }
}

/**
 * Watermark Tool
 */
class WatermarkTool extends BaseTool {
    constructor() {
        super('Watermark', 'Add a text watermark to PDF pages');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="watermark-file">Select a PDF file:</label>
                    <input type="file" id="watermark-file" accept="application/pdf" />
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Watermark type:</label>
                        <select class="option-input" id="watermark-type">
                            <option value="text" selected>Text</option>
                            <option value="image">Image</option>
                        </select>
                    </div>
                    <div class="upload-section">
                        <label class="option-label" for="watermark-image">Upload watermark image (PNG/JPG):</label>
                        <input type="file" id="watermark-image" accept="image/*" />
                    </div>
                    <div class="option-group">
                        <label class="option-label">Watermark Text:</label>
                        <input type="text" class="option-input" id="watermark-text" placeholder="CONFIDENTIAL">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Opacity (0.1 - 1):</label>
                        <input type="number" class="option-input" id="watermark-opacity" value="0.2" min="0.1" max="1" step="0.1">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Angle (degrees):</label>
                        <input type="number" class="option-input" id="watermark-angle" value="45" min="0" max="90" step="1">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Font size (when auto‑fit is off):</label>
                        <input type="number" class="option-input" id="watermark-size" value="72" min="12" max="400">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Color:</label>
                        <input type="color" class="option-input" id="watermark-color" value="#FF0000">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Font:</label>
                        <select class="option-input" id="watermark-font">
                            <option value="Helvetica" selected>Helvetica</option>
                            <option value="TimesRoman">Times</option>
                            <option value="Courier">Courier</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Image scale (fraction of page width):</label>
                        <input type="number" class="option-input" id="watermark-scale" value="0.6" min="0.1" max="1" step="0.05">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Pages (e.g., 1-3,5):</label>
                        <input type="text" class="option-input" id="watermark-pages" placeholder="all">
                    </div>
                    <div class="option-group" style="display:flex; align-items:center; gap:8px;">
                        <input type="checkbox" id="watermark-tile">
                        <label class="option-label" for="watermark-tile">Tile across page</label>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="watermark-process">
                        <i class="material-icons">water_drop</i>
                        <span>Add Watermark</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (!files || files.length !== 1) throw new Error('Select exactly one PDF file');
        const file = files[0];
        const doc = await PDFUtils.loadPDF(file);
        const type = options.type || 'text';
        const text = (options.text || 'CONFIDENTIAL').trim();
        const opacity = Math.min(1, Math.max(0.1, parseFloat(options.opacity) || 0.2));
        const angle = Math.min(90, Math.max(0, parseFloat(options.angle) || 45));
        const manualSize = Math.min(400, Math.max(12, parseInt(options.size, 10) || 72));
        const colorHex = options.color || '#FF0000';
        const fontName = options.font || 'Helvetica';
        const tile = !!options.tile;
        const pageExpr = options.pages || '';
        const hexToRgb = (hex) => {
            const h = hex.replace('#', '');
            const v = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
            const i = parseInt(v, 16);
            const r = (i >> 16) & 255, g = (i >> 8) & 255, b = i & 255;
            return window.PDFLib.rgb(r/255, g/255, b/255);
        };
        const fontRef = await doc.embedFont(window.PDFLib.StandardFonts[fontName] || window.PDFLib.StandardFonts.Helvetica);
        let imageRef = null;
        let imageScale = Math.min(1, Math.max(0.1, parseFloat(options.scale) || 0.6));
        if (type === 'image') {
            const imgFile = options.imageFile;
            if (!imgFile) throw new Error('Upload a watermark image');
            const imgBytes = await imgFile.arrayBuffer();
            const isPng = /png$/i.test(imgFile.type) || imgFile.name.toLowerCase().endsWith('.png');
            imageRef = isPng ? await doc.embedPng(imgBytes) : await doc.embedJpg(imgBytes);
        }
        const pages = doc.getPages();
        const selected = pageExpr ? parsePagesExpression(pageExpr, pages.length) : pages.map((_, i) => i);
        pages.forEach((page, pageIndex) => {
            if (!selected.includes(pageIndex)) return;
            const { width, height } = page.getSize();
            const rad = (angle * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            if (type === 'image') {
                let wDraw = width * imageScale;
                const aspect = imageRef.height / imageRef.width;
                let hDraw = wDraw * aspect;
                let bw = Math.abs(wDraw * cos) + Math.abs(hDraw * sin);
                let bh = Math.abs(wDraw * sin) + Math.abs(hDraw * cos);
                const fitScale = Math.min(1, Math.min((width * 0.95) / bw, (height * 0.95) / bh));
                wDraw *= fitScale;
                hDraw *= fitScale;
                bw = Math.abs(wDraw * cos) + Math.abs(hDraw * sin);
                bh = Math.abs(wDraw * sin) + Math.abs(hDraw * cos);
                const centerX = width / 2;
                const centerY = height / 2;
                const anchorForCenter = (cx, cy) => {
                    const dx = (wDraw / 2) * cos - (hDraw / 2) * sin;
                    const dy = (wDraw / 2) * sin + (hDraw / 2) * cos;
                    return { x: cx - dx, y: cy - dy };
                };
                const drawAtCenter = (cx, cy) => {
                    const a = anchorForCenter(cx, cy);
                    page.drawImage(imageRef, {
                        x: a.x,
                        y: a.y,
                        width: wDraw,
                        height: hDraw,
                        rotate: window.PDFLib.degrees(angle),
                        opacity
                    });
                };
                if (!tile) {
                    drawAtCenter(centerX, centerY);
                } else {
                    const stepX = width / 2;
                    const stepY = height / 2;
                    for (let ix = -1; ix <= 1; ix++) {
                        for (let iy = -1; iy <= 1; iy++) {
                            drawAtCenter(centerX + ix * stepX, centerY + iy * stepY);
                        }
                    }
                }
            } else {
                let size = manualSize;
                let wText = fontRef.widthOfTextAtSize(text, size);
                let hText = fontRef.heightAtSize(size);
                let bw = Math.abs(wText * cos) + Math.abs(hText * sin);
                let bh = Math.abs(wText * sin) + Math.abs(hText * cos);
                const fitScale = Math.min(1, Math.min(width * 0.95 / bw, height * 0.95 / bh));
                if (fitScale < 1) {
                    size = size * fitScale;
                    wText = fontRef.widthOfTextAtSize(text, size);
                    hText = fontRef.heightAtSize(size);
                    bw = Math.abs(wText * cos) + Math.abs(hText * sin);
                    bh = Math.abs(wText * sin) + Math.abs(hText * cos);
                }
                const cx = (width - bw) / 2;
                const cy = (height - bh) / 2 + (fontRef.heightAtSize(size) * 0.5);
                const drawTextOnce = (dx, dy) => {
                    page.drawText(text, {
                        x: dx,
                        y: dy,
                        size,
                        font: fontRef,
                        rotate: window.PDFLib.degrees(angle),
                        color: hexToRgb(colorHex),
                        opacity
                    });
                };
                if (!tile) {
                    drawTextOnce(cx, cy);
                } else {
                    const stepX = width / 2;
                    const stepY = height / 2;
                    for (let ix = -1; ix <= 1; ix++) {
                        for (let iy = -1; iy <= 1; iy++) {
                            drawTextOnce(cx + ix * stepX, cy + iy * stepY);
                        }
                    }
                }
            }
        });
        const pdfBytes = await doc.save();
        const filename = `${file.name.replace(/\.pdf$/i, '')}_watermarked.pdf`;
        DownloadUtils.downloadPDF(pdfBytes, filename);
        return { success: true, message: 'Watermark added' };
    }

    attachHandlers() {
        const input = document.getElementById('watermark-file');
        const typeSel = document.getElementById('watermark-type');
        const imageInput = document.getElementById('watermark-image');
        const textInput = document.getElementById('watermark-text');
        const opacityInput = document.getElementById('watermark-opacity');
        const angleInput = document.getElementById('watermark-angle');
        const sizeInput = document.getElementById('watermark-size');
        const colorInput = document.getElementById('watermark-color');
        const fontSel = document.getElementById('watermark-font');
        const pagesInput = document.getElementById('watermark-pages');
        const tileInput = document.getElementById('watermark-tile');
        const scaleInput = document.getElementById('watermark-scale');
        const btn = document.getElementById('watermark-process');
        btn?.addEventListener('click', async () => {
            const files = Array.from(input?.files || []);
            const imgFiles = Array.from(imageInput?.files || []);
            try {
                modalManager.showProgress('Adding Watermark...', 'Processing PDF...');
                await this.execute(files, {
                    type: typeSel?.value,
                    text: textInput?.value,
                    opacity: opacityInput?.value,
                    angle: angleInput?.value,
                    size: sizeInput?.value,
                    color: colorInput?.value,
                    font: fontSel?.value,
                    pages: pagesInput?.value,
                    tile: tileInput?.checked,
                    imageFile: imgFiles[0],
                    scale: scaleInput?.value
                });
                window.notificationManager?.show('Watermark added successfully!', 'success');
            } catch (err) {
                console.error('Watermark failed:', err);
                window.notificationManager?.show(`Watermark failed: ${err.message}`, 'error');
            } finally {
                modalManager.hideProgress();
            }
        });
    }
}
/**
 * Tool Manager Class
 */
class ToolManager {
    constructor() {
        this.tools = new Map();
        // Expected class names per tool ID for runtime self-heal
        this.expectedToolClasses = {
            'merger': 'PDFMergerTool',
            'splitter': 'PDFSplitterTool',
            'pdf-to-word': 'PDFToWordTool',
            'pdf-to-image': 'PDFToImageTool',
            'image-to-pdf': 'ImageToPDFTool',
            'compressor': 'CompressorTool',
            
            'watermark': 'WatermarkTool',
            'rotator': 'RotatorTool',
            'metadata': 'MetadataTool',
            'form-filler': 'FormFillerTool',
            'signature': 'SignatureTool',
            'text-extractor': 'TextExtractorTool',
            'page-numbering': 'PageNumberingTool',
            'bookmark': 'BookmarkTool',
            'resizer': 'ResizerTool',
            
            'ocr': 'OCRTool',
            'annotation': 'AnnotationTool',
            'optimizer': 'OptimizerTool'
        };
        this.initializeTools();
        this.setupEventListeners();
    }

    initializeTools() {
        // Register available tools with correct IDs matching HTML data-tool attributes
        this.registerTool('merger', new PDFMergerTool());
        this.registerTool('splitter', new PDFSplitterTool());
        this.registerTool('pdf-to-word', new PDFToWordTool());
        this.registerTool('pdf-to-image', new PDFToImageTool());
        this.registerTool('image-to-pdf', new ImageToPDFTool());
        this.registerTool('compressor', new CompressorTool());
        
        this.registerTool('watermark', new WatermarkTool());
        this.registerTool('rotator', new RotatorTool());
        this.registerTool('metadata', new MetadataTool());
        this.registerTool('form-filler', new FormFillerTool());
        this.registerTool('signature', new SignatureTool());
        this.registerTool('text-extractor', new TextExtractorTool());
        this.registerTool('page-numbering', new PageNumberingTool());
        this.registerTool('bookmark', new BookmarkTool());
        this.registerTool('resizer', new ResizerTool());
        
        this.registerTool('ocr', new OCRTool());
        this.registerTool('annotation', new AnnotationTool());
        this.registerTool('optimizer', new OptimizerTool());

        console.log('Tools initialized:', Array.from(this.tools.keys()));
    }

    registerTool(id, tool) {
        this.tools.set(id, tool);
    }

    getTool(id) {
        return this.tools.get(id);
    }

    setupEventListeners() {
        // Setup tool button listeners (use closest to capture clicks on inner elements)
        document.addEventListener('click', (e) => {
            const toolBtn = e.target.closest('[data-tool]');
            if (toolBtn) {
                const toolId = toolBtn.getAttribute('data-tool');
                this.openTool(toolId);
            }
        });
    }

    async openTool(toolId) {
        let tool = this.getTool(toolId);
        if (!tool) {
            console.error(`Tool "${toolId}" not found`);
            return;
        }
        // Runtime guard: self-heal incorrect tool mapping from stale caches or old builds
        const expected = this.expectedToolClasses[toolId];
        if (expected && tool?.constructor?.name !== expected) {
            console.warn(`Tool mapping mismatch for "${toolId}". Expected ${expected}, but found ${tool?.constructor?.name}. Re-registering correct tool.`);
            // Instantiate the correct class
            switch (toolId) {
                case 'merger': tool = new PDFMergerTool(); break;
                case 'splitter': tool = new PDFSplitterTool(); break;
                case 'pdf-to-word': tool = new PDFToWordTool(); break;
                case 'pdf-to-image': tool = new PDFToImageTool(); break;
                case 'image-to-pdf': tool = new ImageToPDFTool(); break;
                case 'compressor': tool = new CompressorTool(); break;
                case 'password-protector': tool = new PasswordProtectorTool(); break;
                case 'watermark': tool = new WatermarkTool(); break;
                case 'rotator': tool = new RotatorTool(); break;
                case 'metadata': tool = new MetadataTool(); break;
                case 'form-filler': tool = new FormFillerTool(); break;
                case 'signature': tool = new SignatureTool(); break;
                case 'text-extractor': tool = new TextExtractorTool(); break;
                case 'page-numbering': tool = new PageNumberingTool(); break;
                case 'bookmark': tool = new BookmarkTool(); break;
                case 'resizer': tool = new ResizerTool(); break;
                case 'color-converter': tool = new ColorConverterTool(); break;
                case 'ocr': tool = new OCRTool(); break;
                case 'annotation': tool = new AnnotationTool(); break;
                case 'optimizer': tool = new OptimizerTool(); break;
            }
            this.registerTool(toolId, tool);
        }

        try {
            const content = tool.createInterface();
            console.log(`Opening tool: ${tool.name}`);
            // Open modal with tool UI
            modalManager.openModal('tool-modal', tool.name, content);
            // Attach tool-specific handlers
            if (typeof tool.attachHandlers === 'function') {
                tool.attachHandlers();
            }
        } catch (error) {
            console.error(`Failed to open tool: ${error.message}`);
            window.notificationManager?.show(`Failed to open ${tool.name}: ${error.message}`, 'error');
        }
    }
}

// Export ToolManager to global scope
window.ToolManager = ToolManager;

// Initialize tool manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.toolManager = new ToolManager();
    window.toolManager.setupEventListeners();
    console.log('Clean ToolManager initialized successfully');
    console.log('Event listeners set up for tool buttons');
});
/**
 * Compressor Tool - re-renders pages with lower scale/quality to reduce size
 */
class CompressorTool extends BaseTool {
    constructor() { super('Compressor', 'Reduce PDF size by re-rendering pages at lower quality'); }
    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="compressor-file">Select a PDF file:</label>
                    <input type="file" id="compressor-file" accept="application/pdf" />
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Scale (0.5 - 1.0):</label>
                        <input type="number" class="option-input" id="compressor-scale" value="0.8" step="0.1" min="0.5" max="1">
                    </div>
                    <div class="option-group">
                        <label class="option-label">JPEG Quality (0.5 - 0.95):</label>
                        <input type="number" class="option-input" id="compressor-quality" value="0.85" step="0.05" min="0.5" max="0.95">
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="compressor-process">
                        <i class="material-icons">tune</i>
                        <span>Compress</span>
                    </button>
                </div>
            </div>`;
    }
    async execute(files, options = {}) {
        if (!files || files.length !== 1) throw new Error('Select exactly one PDF file');
        const file = files[0];
        const data = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data }).promise;
        const doc = await window.PDFLib.PDFDocument.create();
        const scale = Math.max(0.5, Math.min(1, parseFloat(options.scale) || 0.8));
        const quality = Math.max(0.5, Math.min(0.95, parseFloat(options.quality) || 0.85));

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: ctx, viewport }).promise;
            const blob = await ImageUtils.canvasToBlob(canvas, 'image/jpeg', quality);
            const imgBytes = new Uint8Array(await blob.arrayBuffer());
            const embedded = await doc.embedJpg(imgBytes);
            const { width, height } = embedded.scale(1);
            const newPage = doc.addPage([width, height]);
            newPage.drawImage(embedded, { x: 0, y: 0, width, height });
        }
        const pdfBytes = await doc.save();
        const filename = `${file.name.replace(/\.pdf$/i, '')}_compressed.pdf`;
        DownloadUtils.downloadPDF(pdfBytes, filename);
        return { success: true, message: 'PDF compressed' };
    }
    attachHandlers() {
        const input = document.getElementById('compressor-file');
        const s = document.getElementById('compressor-scale');
        const q = document.getElementById('compressor-quality');
        const btn = document.getElementById('compressor-process');
        btn?.addEventListener('click', async () => {
            const files = Array.from(input?.files || []);
            try {
                modalManager.showProgress('Compressing...', 'Rendering pages...');
                await this.execute(files, { scale: s?.value, quality: q?.value });
                window.notificationManager?.show('Compressed successfully!', 'success');
            } catch (err) {
                window.notificationManager?.show(`Compression failed: ${err.message}`, 'error');
            } finally { modalManager.hideProgress(); }
        });
    }
}

/** Resizer Tool - change page size by re-rendering to target dimensions */
class ResizerTool extends BaseTool {
    constructor() { super('Page Resizer', 'Resize pages to a target size'); }
    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="resizer-file">Select a PDF file:</label>
                    <input type="file" id="resizer-file" accept="application/pdf" />
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Preset:</label>
                        <select class="option-input" id="resizer-preset">
                            <option value="A4">A4 (595x842)</option>
                            <option value="Letter">Letter (612x792)</option>
                            <option value="Custom">Custom</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Width (pt):</label>
                        <input type="number" class="option-input" id="resizer-width" value="595">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Height (pt):</label>
                        <input type="number" class="option-input" id="resizer-height" value="842">
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="resizer-process">
                        <i class="material-icons">aspect_ratio</i>
                        <span>Resize</span>
                    </button>
                </div>
            </div>`;
    }
    async execute(files, options = {}) {
        if (!files || files.length !== 1) throw new Error('Select exactly one PDF file');
        const file = files[0];
        const data = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data }).promise;
        const doc = await window.PDFLib.PDFDocument.create();
        let width = parseFloat(options.width) || 595;
        let height = parseFloat(options.height) || 842;
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = width; canvas.height = height;
            const scaleX = width / viewport.width;
            const scaleY = height / viewport.height;
            const viewportScaled = page.getViewport({ scale: Math.min(scaleX, scaleY) });
            await page.render({ canvasContext: ctx, viewport: viewportScaled }).promise;
            const blob = await ImageUtils.canvasToBlob(canvas, 'image/jpeg', 0.9);
            const bytes = new Uint8Array(await blob.arrayBuffer());
            const img = await doc.embedJpg(bytes);
            const newPage = doc.addPage([width, height]);
            newPage.drawImage(img, { x: 0, y: 0, width, height });
        }
        const pdfBytes = await doc.save();
        const filename = `${file.name.replace(/\.pdf$/i, '')}_resized.pdf`;
        DownloadUtils.downloadPDF(pdfBytes, filename);
        return { success: true, message: 'Resized PDF' };
    }
    attachHandlers() {
        const input = document.getElementById('resizer-file');
        const preset = document.getElementById('resizer-preset');
        const w = document.getElementById('resizer-width');
        const h = document.getElementById('resizer-height');
        preset?.addEventListener('change', () => {
            if (preset.value === 'A4') { w.value = '595'; h.value = '842'; }
            else if (preset.value === 'Letter') { w.value = '612'; h.value = '792'; }
        });
        const btn = document.getElementById('resizer-process');
        btn?.addEventListener('click', async () => {
            const files = Array.from(input?.files || []);
            try {
                modalManager.showProgress('Resizing Pages...', 'Rendering PDF...');
                await this.execute(files, { width: w?.value, height: h?.value });
                window.notificationManager?.show('Resizing complete!', 'success');
            } catch (err) { window.notificationManager?.show(`Resize failed: ${err.message}`, 'error'); }
            finally { modalManager.hideProgress(); }
        });
    }
}

/* ColorConverterTool removed as per user request */

/** Signature Tool - draw signature image onto pages */
class SignatureTool extends BaseTool {
    constructor() { super('Signature', 'Add a signature image to PDF pages'); }
    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="sig-file">Select a PDF file:</label>
                    <input type="file" id="sig-file" accept="application/pdf" />
                </div>
                <div class="upload-section">
                    <label class="option-label" for="sig-image">Upload signature image (PNG/JPG):</label>
                    <input type="file" id="sig-image" accept="image/*" />
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Scale (0.2 - 1.0):</label>
                        <input type="number" class="option-input" id="sig-scale" value="0.4" step="0.1" min="0.2" max="1">
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="sig-process">
                        <i class="material-icons">edit</i>
                        <span>Add Signature</span>
                    </button>
                </div>
            </div>`;
    }
    async execute(files, options = {}) {
        if (!files || files.length !== 1) throw new Error('Select exactly one PDF file');
        if (!options.imageFile) throw new Error('Please upload a signature image');
        const file = files[0];
        const doc = await PDFUtils.loadPDF(file);
        const imgArrayBuffer = await options.imageFile.arrayBuffer();
        let embedded;
        const type = (options.imageFile.type || '').toLowerCase();
        if (type.includes('png')) embedded = await doc.embedPng(imgArrayBuffer); else embedded = await doc.embedJpg(imgArrayBuffer);
        const scale = Math.max(0.2, Math.min(1.0, parseFloat(options.scale) || 0.4));
        const pages = doc.getPages();
        for (const page of pages) {
            const { width } = page.getSize();
            const dims = embedded.scale(scale);
            page.drawImage(embedded, { x: width - dims.width - 32, y: 32, width: dims.width, height: dims.height });
        }
        const pdfBytes = await doc.save();
        const filename = `${file.name.replace(/\.pdf$/i, '')}_signed.pdf`;
        DownloadUtils.downloadPDF(pdfBytes, filename);
        return { success: true, message: 'Signature added' };
    }
    attachHandlers() {
        const input = document.getElementById('sig-file');
        const imgInput = document.getElementById('sig-image');
        const scaleInput = document.getElementById('sig-scale');
        const btn = document.getElementById('sig-process');
        btn?.addEventListener('click', async () => {
            const files = Array.from(input?.files || []);
            const imgs = Array.from(imgInput?.files || []);
            try { modalManager.showProgress('Adding Signature...', 'Processing PDF...'); await this.execute(files, { imageFile: imgs[0], scale: scaleInput?.value }); window.notificationManager?.show('Signature added successfully!', 'success'); }
            catch (err) { window.notificationManager?.show(`Signature failed: ${err.message}`, 'error'); }
            finally { modalManager.hideProgress(); }
        });
    }
}

/** Form Filler Tool - overlay text at given position */
class FormFillerTool extends BaseTool {
    constructor() { super('Form Filler', 'Overlay text on PDF pages'); }
    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="form-file">Select a PDF file:</label>
                    <input type="file" id="form-file" accept="application/pdf" />
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Text:</label>
                        <input type="text" class="option-input" id="form-text" placeholder="Enter text to place">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Page (1-based):</label>
                        <input type="number" class="option-input" id="form-page" value="1" min="1">
                    </div>
                    <div class="option-group">
                        <label class="option-label">X (pt):</label>
                        <input type="number" class="option-input" id="form-x" value="50">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Y (pt):</label>
                        <input type="number" class="option-input" id="form-y" value="700">
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="form-process">
                        <i class="material-icons">assignment</i>
                        <span>Fill</span>
                    </button>
                </div>
            </div>`;
    }
    async execute(files, options = {}) {
        if (!files || files.length !== 1) throw new Error('Select exactly one PDF file');
        const text = (options.text || '').trim(); if (!text) throw new Error('Please enter text');
        const pageNum = Math.max(1, parseInt(options.page, 10) || 1);
        const x = parseFloat(options.x) || 50; const y = parseFloat(options.y) || 700;
        const doc = await PDFUtils.loadPDF(files[0]);
        const font = await doc.embedFont(window.PDFLib.StandardFonts.Helvetica);
        const pages = doc.getPages();
        const idx = Math.min(pageNum - 1, pages.length - 1);
        pages[idx].drawText(text, { x, y, size: 12, font, color: window.PDFLib.rgb(0, 0, 0) });
        const pdfBytes = await doc.save();
        const filename = `${files[0].name.replace(/\.pdf$/i, '')}_filled.pdf`;
        DownloadUtils.downloadPDF(pdfBytes, filename);
        return { success: true, message: 'Text placed on PDF' };
    }
    attachHandlers() {
        const input = document.getElementById('form-file');
        const textInput = document.getElementById('form-text');
        const pageInput = document.getElementById('form-page');
        const xInput = document.getElementById('form-x');
        const yInput = document.getElementById('form-y');
        const btn = document.getElementById('form-process');
        btn?.addEventListener('click', async () => {
            const files = Array.from(input?.files || []);
            try { modalManager.showProgress('Filling Form...', 'Processing PDF form...'); await this.execute(files, { text: textInput?.value, page: pageInput?.value, x: xInput?.value, y: yInput?.value }); window.notificationManager?.show('Form filled successfully!', 'success'); }
            catch (err) { window.notificationManager?.show(`Form fill failed: ${err.message}`, 'error'); }
            finally { modalManager.hideProgress(); }
        });
    }
}

/** Annotation Tool - highlight area or add note */
class AnnotationTool extends BaseTool {
    constructor() { super('Annotation', 'Add a highlight or note to PDF'); }
    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="anno-file">Select a PDF file:</label>
                    <input type="file" id="anno-file" accept="application/pdf" />
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Note text:</label>
                        <input type="text" class="option-input" id="anno-text" placeholder="Optional note">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Page:</label>
                        <input type="number" class="option-input" id="anno-page" value="1" min="1">
                    </div>
                    <div class="option-group">
                        <label class="option-label">X:</label>
                        <input type="number" class="option-input" id="anno-x" value="50">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Y:</label>
                        <input type="number" class="option-input" id="anno-y" value="700">
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="anno-process">
                        <i class="material-icons">note_add</i>
                        <span>Add Annotation</span>
                    </button>
                </div>
            </div>`;
    }
    async execute(files, options = {}) {
        if (!files || files.length !== 1) throw new Error('Select exactly one PDF file');
        const doc = await PDFUtils.loadPDF(files[0]);
        const font = await doc.embedFont(window.PDFLib.StandardFonts.Helvetica);
        const idx = Math.max(1, parseInt(options.page, 10) || 1) - 1;
        const pages = doc.getPages();
        const page = pages[Math.min(idx, pages.length - 1)];
        const x = parseFloat(options.x) || 50; const y = parseFloat(options.y) || 700;
        // Draw a translucent yellow rectangle as highlight
        page.drawRectangle({ x, y: y - 20, width: 200, height: 24, color: window.PDFLib.rgb(1, 1, 0), opacity: 0.3 });
        const note = (options.text || '').trim();
        if (note) page.drawText(note, { x: x + 6, y: y - 18, size: 12, font, color: window.PDFLib.rgb(0, 0, 0) });
        const pdfBytes = await doc.save();
        const filename = `${files[0].name.replace(/\.pdf$/i, '')}_annotated.pdf`;
        DownloadUtils.downloadPDF(pdfBytes, filename);
        return { success: true, message: 'Annotation added' };
    }
    attachHandlers() {
        const input = document.getElementById('anno-file');
        const textInput = document.getElementById('anno-text');
        const pageInput = document.getElementById('anno-page');
        const xInput = document.getElementById('anno-x');
        const yInput = document.getElementById('anno-y');
        const btn = document.getElementById('anno-process');
        btn?.addEventListener('click', async () => {
            const files = Array.from(input?.files || []);
            try { modalManager.showProgress('Adding Annotation...', 'Processing PDF...'); await this.execute(files, { text: textInput?.value, page: pageInput?.value, x: xInput?.value, y: yInput?.value }); window.notificationManager?.show('Annotation added successfully!', 'success'); }
            catch (err) { window.notificationManager?.show(`Annotation failed: ${err.message}`, 'error'); }
            finally { modalManager.hideProgress(); }
        });
    }
}

/** Bookmark Tool - add a TOC page listing selected bookmarks */
/** Bookmark Tool - add a TOC page listing selected bookmarks */
class BookmarkTool extends BaseTool {
    constructor() { super('Bookmark Manager', 'Add a TOC page listing bookmarks'); }
    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="bm-file">Select a PDF file:</label>
                    <input type="file" id="bm-file" accept="application/pdf" />
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Bookmarks (format: page:title, e.g., 1:Intro,3:Chapter 1):</label>
                        <input type="text" class="option-input" id="bm-list" placeholder="1:Intro,3:Chapter 1">
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="bm-process">
                        <i class="material-icons">bookmark</i>
                        <span>Add TOC</span>
                    </button>
                </div>
            </div>`;
    }
    async execute(files, options = {}) {
        if (!files || files.length !== 1) throw new Error('Select exactly one PDF file');
        const src = await PDFUtils.loadPDF(files[0]);
        const newDoc = await window.PDFLib.PDFDocument.create();
        const helv = await newDoc.embedFont(window.PDFLib.StandardFonts.Helvetica);
        const toc = newDoc.addPage([595, 842]);
        toc.drawText('Table of Contents', { x: 50, y: 800, size: 20, font: helv });
        let y = 770;
        const listStr = (options.list || '').trim();
        if (listStr) {
            const items = listStr.split(',').map(s => s.trim()).filter(Boolean);
            for (const item of items) {
                const [pgStr, title] = item.split(':');
                const pg = Math.max(1, parseInt(pgStr, 10) || 1);
                toc.drawText(`${pg}. ${title || 'Untitled'}`, { x: 50, y, size: 12, font: helv });
                y -= 20;
            }
        } else {
            toc.drawText('No bookmarks provided.', { x: 50, y, size: 12, font: helv });
        }
        const pageCount = src.getPageCount();
        const indices = Array.from({ length: pageCount }, (_, i) => i);
        const pages = await newDoc.copyPages(src, indices);
        pages.forEach(p => newDoc.addPage(p));
        const pdfBytes = await newDoc.save();
        const filename = `${files[0].name.replace(/\.pdf$/i, '')}_toc.pdf`;
        DownloadUtils.downloadPDF(pdfBytes, filename);
        return { success: true, message: 'TOC page added' };
    }
    attachHandlers() {
        const input = document.getElementById('bm-file');
        const list = document.getElementById('bm-list');
        const btn = document.getElementById('bm-process');
        btn?.addEventListener('click', async () => {
            const files = Array.from(input?.files || []);
            try { modalManager.showProgress('Processing Bookmarks...', 'Loading PDF...'); await this.execute(files, { list: list?.value }); window.notificationManager?.show('TOC added successfully!', 'success'); }
            catch (err) { window.notificationManager?.show(`Bookmark processing failed: ${err.message}`, 'error'); }
            finally { modalManager.hideProgress(); }
        });
    }
}

/** Optimizer Tool - similar to compressor with adjustable quality */
class OptimizerTool extends BaseTool {
    constructor() { super('Optimizer', 'Optimize PDF by re-rendering pages'); }
    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="opt-file">Select a PDF file:</label>
                    <input type="file" id="opt-file" accept="application/pdf" />
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Quality (0.5 - 0.95):</label>
                        <input type="number" class="option-input" id="opt-quality" value="0.8" step="0.05" min="0.5" max="0.95">
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="opt-process">
                        <i class="material-icons">tune</i>
                        <span>Optimize</span>
                    </button>
                </div>
            </div>`;
    }
    async execute(files, options = {}) {
        // Reuse compressor pipeline but expose only quality
        return new CompressorTool().execute(files, { scale: 0.9, quality: options.quality });
    }
    attachHandlers() {
        const input = document.getElementById('opt-file');
        const q = document.getElementById('opt-quality');
        const btn = document.getElementById('opt-process');
        btn?.addEventListener('click', async () => {
            const files = Array.from(input?.files || []);
            try { modalManager.showProgress('Optimizing PDF...', 'Analyzing document structure...'); await this.execute(files, { quality: q?.value }); window.notificationManager?.show('Optimized successfully!', 'success'); }
            catch (err) { window.notificationManager?.show(`Optimize failed: ${err.message}`, 'error'); }
            finally { modalManager.hideProgress(); }
        });
    }
}

/* PasswordProtectorTool removed as per user request */

/** OCR Tool - basic OCR using Tesseract.js loaded dynamically */
class OCRTool extends BaseTool {
    constructor() { super('OCR', 'Extract text from scanned PDFs using Tesseract.js'); }
    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="ocr-file">Select a PDF file:</label>
                    <input type="file" id="ocr-file" accept="application/pdf" />
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Language (e.g., eng):</label>
                        <input type="text" class="option-input" id="ocr-lang" value="eng">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Pages to OCR (e.g., 1-3 or blank for all):</label>
                        <input type="text" class="option-input" id="ocr-pages" placeholder="e.g., 1-3">
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="ocr-process">
                        <i class="material-icons">scanner</i>
                        <span>Run OCR</span>
                    </button>
                </div>
            </div>`;
    }
    async loadTesseract() {
        if (window.Tesseract) return;
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@v5/dist/tesseract.min.js';
            s.onload = resolve; s.onerror = () => reject(new Error('Failed to load Tesseract.js'));
            document.head.appendChild(s);
        });
    }
    async execute(files, options = {}) {
        if (!files || files.length !== 1) throw new Error('Select exactly one PDF file');
        await this.loadTesseract();
        const file = files[0];
        const data = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data }).promise;
        const lang = (options.lang || 'eng').trim();
        let indices = [];
        if (options.pages) {
            const pages = new Set();
            const parts = options.pages.split(',').map(p => p.trim()).filter(Boolean);
            for (const part of parts) {
                if (part.includes('-')) {
                    const [s, e] = part.split('-');
                    let a = parseInt(s, 10), b = parseInt(e, 10);
                    if (!Number.isNaN(a) && !Number.isNaN(b)) {
                        if (a > b) [a, b] = [b, a];
                        for (let n = Math.max(1, a); n <= Math.min(pdf.numPages, b); n++) pages.add(n);
                    }
                } else {
                    let n = parseInt(part, 10);
                    if (!Number.isNaN(n)) pages.add(Math.max(1, Math.min(n, pdf.numPages)));
                }
            }
            indices = Array.from(pages).sort((a, b) => a - b);
        } else {
            indices = Array.from({ length: pdf.numPages }, (_, i) => i + 1);
        }
        let fullText = '';
        for (const i of indices) {
            modalManager.updateProgress(Math.round(((indices.indexOf(i) + 1) / indices.length) * 90), `OCR page ${i}`);
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width; canvas.height = viewport.height;
            await page.render({ canvasContext: ctx, viewport }).promise;
            const dataUrl = canvas.toDataURL('image/png');
            const result = await window.Tesseract.recognize(dataUrl, lang);
            fullText += `\n\n--- Page ${i} ---\n` + (result.data?.text || '');
        }
        const filename = `${file.name.replace(/\.pdf$/i, '')}_ocr.txt`;
        DownloadUtils.downloadText(fullText, filename);
        return { success: true, message: `OCR complete for ${indices.length} page(s)` };
    }
    attachHandlers() {
        const input = document.getElementById('ocr-file');
        const langInput = document.getElementById('ocr-lang');
        const pagesInput = document.getElementById('ocr-pages');
        const btn = document.getElementById('ocr-process');
        btn?.addEventListener('click', async () => {
            const files = Array.from(input?.files || []);
            try { modalManager.showProgress('Processing OCR...', 'This may take a while...'); await this.execute(files, { lang: langInput?.value, pages: pagesInput?.value }); window.notificationManager?.show('OCR completed successfully!', 'success'); }
            catch (err) { window.notificationManager?.show(`OCR failed: ${err.message}`, 'error'); }
            finally { modalManager.hideProgress(); }
        });
    }
}

/* PDFToExcelTool removed as per user request */
