/**
 * PDF to Word Tool - Generates a DOCX file from PDF text with basic RTL (Urdu) alignment support
 */
class PDFToWordTool extends BaseTool {
    constructor() {
        super('PDF to Word', 'Convert PDF text to an editable Word (.docx) file');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div class="upload-section">
                    <label class="option-label" for="pdf2word-file">Select a PDF file:</label>
                    <input type="file" id="pdf2word-file" accept="application/pdf" />
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Text Direction:</label>
                        <select class="option-input" id="pdf2word-detect">
                            <option value="auto" selected>Auto detect RTL (Urdu/Arabic)</option>
                            <option value="ltr">Force Left-to-Right</option>
                            <option value="rtl">Force Right-to-Left</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Output Mode:</label>
                        <select class="option-input" id="pdf2word-mode">
                            <option value="editable" selected>Editable text (improved layout)</option>
                            <option value="exact-editable">Exact editable (positioned text)</option>
                            <option value="exact">Exact layout (image-based)</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">RTL Font:</label>
                        <select class="option-input" id="pdf2word-font">
                            <option value="auto">Auto (system default)</option>
                            <option value="Calibri">Calibri</option>
                            <option value="Noto Naskh Arabic">Noto Naskh Arabic</option>
                            <option value="Jameel Noori Nastaleeq" selected>Jameel Noori Nastaleeq</option>
                            <option value="Arial Unicode MS">Arial Unicode MS</option>
                        </select>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="pdf2word-process">
                        <i class="material-icons">description</i>
                        <span>Export to Word</span>
                    </button>
                </div>
            </div>
        `;
    }

    async ensureDocxLoaded() {
        const isReady = () => {
            if (!window.docx) return false;
            // Some versions export directly, some under .default
            if (window.docx.Document) return true;
            if (window.docx.default && window.docx.default.Document) {
                // Merge default into parent to normalize
                Object.assign(window.docx, window.docx.default);
                return true;
            }
            return false;
        };
        
        if (isReady()) return true;

        const sources = [
            'https://unpkg.com/docx@8.5.0/build/index.js',
            'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.js',
            'https://cdnjs.cloudflare.com/ajax/libs/docx/8.5.0/docx.min.js',
            'js/vendor/docx.js'
        ];

        for (const src of sources) {
            try {
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = src;
                    script.async = true;
                    script.onload = () => resolve(true);
                    script.onerror = () => reject(new Error('Failed to load ' + src));
                    document.head.appendChild(script);
                });
                if (isReady()) return true;
            } catch (e) {
                console.warn('DOCX library load failed from:', src, e);
            }
        }

        return isReady();
    }

    async execute(files, options = {}) {
        if (!files || files.length !== 1) throw new Error('Select exactly one PDF file');
        
        // Ensure docx library is available
        const ok = await this.ensureDocxLoaded();
        if (!ok) {
            throw new Error('Word export library could not be loaded. Please check your internet connection.');
        }

        const detectMode = (options.detect || 'auto');
        const mode = (options.mode || 'editable');
        const userFont = (options.font || 'auto');
        const isUrdu = (str) => /[\u0600-\u06FF]/.test(str);

        const file = files[0];
        const data = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data }).promise;

        const { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun, Table, TableRow, TableCell, WidthType } = window.docx;

        const doc = new Document({
            sections: [{
                properties: {
                    page: {
                        margin: { top: 720, right: 720, bottom: 720, left: 720 },
                    },
                },
                children: []
            }]
        });
        const children = doc.sections[0].children;

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 1.0 });
            const pageTwipsW = 11900; 

            // Text extraction with position data
            const textContent = await page.getTextContent({ normalizeWhitespace: true });
            
            // Map items with normalized coordinates
            let items = textContent.items.map(item => {
                const tx = window.pdfjsLib.Util.transform(viewport.transform, item.transform);
                return {
                    str: item.str,
                    x: tx[4],
                    y: tx[5],
                    width: item.width,
                    height: item.height,
                    rtl: isUrdu(item.str)
                };
            });

            // Group items into lines based on Y coordinate with tolerance
            items.sort((a, b) => b.y - a.y); // Top to bottom
            let lines = [];
            if (items.length > 0) {
                let currentLine = [items[0]];
                for (let j = 1; j < items.length; j++) {
                    const prev = items[j - 1];
                    const curr = items[j];
                    if (Math.abs(curr.y - prev.y) < 5) {
                        currentLine.push(curr);
                    } else {
                        lines.push(currentLine);
                        currentLine = [curr];
                    }
                }
                lines.push(currentLine);
            }

            for (const line of lines) {
                // Detect line direction
                const lineText = line.map(item => item.str).join('');
                const isLineRtl = detectMode === 'rtl' ? true : (detectMode === 'ltr' ? false : isUrdu(lineText));
                
                // Sort line items: English (Left to Right), Urdu (Right to Left)
                line.sort((a, b) => isLineRtl ? b.x - a.x : a.x - b.x);

                const textRuns = line.map(item => {
                    const fontName = isLineRtl ? (userFont === 'auto' ? 'Jameel Noori Nastaleeq' : userFont) : 'Calibri';
                    return new TextRun({
                        text: item.str,
                        font: fontName,
                        rightToLeft: isLineRtl,
                        size: Math.round(item.height * 1.5) || 22,
                    });
                });

                const firstItem = isLineRtl ? line[0] : line[0];
                const indentTwips = Math.max(0, Math.round((line[0].x / viewport.width) * pageTwipsW));

                children.push(new Paragraph({
                    children: textRuns,
                    alignment: isLineRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
                    bidirectional: isLineRtl,
                    indent: isLineRtl ? { right: indentTwips } : { left: indentTwips },
                    spacing: { before: 120, after: 120, line: 240 }
                }));
            }

            if (i < pdf.numPages) {
                children.push(new Paragraph({ children: [new TextRun({ text: "", break: 1 })] }));
            }
        }

        const blob = await Packer.toBlob(doc);
        const filename = `${file.name.replace(/\.pdf$/i, '')}_word.docx`;
        DownloadUtils.downloadBlob(blob, filename);
        return { success: true, message: `Exported ${pdf.numPages} page(s) to Word` };
    }

    attachHandlers() {
        const input = document.getElementById('pdf2word-file');
        const detectSel = document.getElementById('pdf2word-detect');
        const modeSel = document.getElementById('pdf2word-mode');
        const fontSel = document.getElementById('pdf2word-font');
        const btn = document.getElementById('pdf2word-process');
        btn?.addEventListener('click', async () => {
            const files = Array.from(input?.files || []);
            try {
                modalManager.showProgress('Exporting to Word...', 'Converting PDF text...');
                await this.execute(files, { detect: detectSel?.value, mode: modeSel?.value, font: fontSel?.value });
                window.notificationManager?.show('Word file created successfully!', 'success');
            } catch (err) {
                console.error('PDF to Word failed:', err);
                window.notificationManager?.show(`PDF to Word failed: ${err.message}`, 'error', { persistent: true });
            } finally {
                modalManager.hideProgress();
            }
        });
    }
}
