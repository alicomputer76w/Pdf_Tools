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
        const isReady = () => !!(window.docx && window.docx.Document && window.docx.Packer);
        if (isReady()) return true;

        const sources = [
            // On GitHub Pages, CDN is usually allowed; try CDN first, then local fallback
            'https://cdnjs.cloudflare.com/ajax/libs/docx/8.5.0/docx.min.js',
            'https://unpkg.com/docx@8.5.0/build/docx.js',
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
        // Ensure docx library is available; try to load if missing
        const ok = await this.ensureDocxLoaded();
        const detectMode = (options.detect || 'auto');
        const isUrdu = (str) => /[\u0600-\u06FF]/.test(str);

        const file = files[0];
        const data = await file.arrayBuffer();
        const pdf = await window.pdfjsLib.getDocument({ data }).promise;

        if (!ok || !window.docx) {
            // Fallback: generate RTF so Word can open it without DOCX library
            const toRTF = (str) => {
                let out = '';
                for (let i = 0; i < str.length; i++) {
                    const ch = str[i];
                    const code = str.charCodeAt(i);
                    if (ch === '\\' || ch === '{' || ch === '}') {
                        out += '\\' + ch; // escape special chars
                    } else if (code <= 127) {
                        out += ch;
                    } else {
                        // UTF-16 code unit to signed 16-bit for \uN?
                        const signed = code > 32767 ? code - 65536 : code;
                        out += `\\u${signed}?`;
                    }
                }
                return out;
            };

            let rtf = '{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Calibri;}}\\fs24 ';
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const strings = content.items.map(item => item.str);
                const text = strings.join(' ');
                const rtl = detectMode === 'rtl' ? true : (detectMode === 'ltr' ? false : isUrdu(text));

                rtf += `\\pard\\qc ${toRTF(`— Page ${i} —`)}\\par`;
                if (rtl) {
                    rtf += `\\pard\\rtlpar\\qr ${toRTF(text)}\\par`;
                } else {
                    rtf += `\\pard\\ltrpar\\ql ${toRTF(text)}\\par`;
                }
                rtf += `\\par`;
            }
            rtf += '}';

            const filenameRTF = `${file.name.replace(/\.pdf$/i, '')}_word.rtf`;
            DownloadUtils.downloadText(rtf, filenameRTF);
            return { success: true, message: `Exported ${pdf.numPages} page(s) to Word-compatible RTF (DOCX library unavailable)` };
        }
        const { Document, Packer, Paragraph, TextRun, AlignmentType } = window.docx;

        const doc = new Document({ sections: [{ properties: {}, children: [] }] });
        const children = doc.sections[0].children;

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const strings = content.items.map(item => item.str);
            const text = strings.join(' ');

            children.push(new Paragraph({
                children: [new TextRun({ text: `— Page ${i} —`, bold: true })],
                spacing: { after: 200 },
                alignment: AlignmentType.CENTER
            }));

            const rtl = detectMode === 'rtl' ? true : (detectMode === 'ltr' ? false : isUrdu(text));
            children.push(new Paragraph({
                children: [new TextRun({ text })],
                alignment: rtl ? AlignmentType.RIGHT : AlignmentType.LEFT
            }));

            children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
        }

        const blob = await Packer.toBlob(doc);
        const filename = `${file.name.replace(/\.pdf$/i, '')}_word.docx`;
        DownloadUtils.downloadBlob(blob, filename);
        return { success: true, message: `Exported ${pdf.numPages} page(s) to Word` };
    }

    attachHandlers() {
        const input = document.getElementById('pdf2word-file');
        const detectSel = document.getElementById('pdf2word-detect');
        const btn = document.getElementById('pdf2word-process');
        btn?.addEventListener('click', async () => {
            const files = Array.from(input?.files || []);
            try {
                modalManager.showProgress('Exporting to Word...', 'Converting PDF text...');
                await this.execute(files, { detect: detectSel?.value });
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