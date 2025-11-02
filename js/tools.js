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
 * Tool Manager Class
 */
class ToolManager {
    constructor() {
        this.tools = new Map();
        this.initializeTools();
        this.setupEventListeners();
    }

    initializeTools() {
        // Register available tools with correct IDs matching HTML data-tool attributes
        this.registerTool('merger', new PDFMergerTool());
        this.registerTool('splitter', new PDFSplitterTool());
        this.registerTool('pdf-to-word', new PDFMergerTool());
        this.registerTool('pdf-to-image', new PDFMergerTool());
        this.registerTool('image-to-pdf', new PDFMergerTool());
        this.registerTool('compressor', new PDFMergerTool());
        this.registerTool('password-protector', new PDFMergerTool());
        this.registerTool('watermark', new PDFMergerTool());
        this.registerTool('rotator', new PDFMergerTool());
        this.registerTool('metadata', new PDFMergerTool());
        this.registerTool('form-filler', new PDFMergerTool());
        this.registerTool('signature', new PDFMergerTool());
        this.registerTool('text-extractor', new PDFMergerTool());
        this.registerTool('page-numbering', new PDFMergerTool());
        this.registerTool('bookmark', new PDFMergerTool());
        this.registerTool('resizer', new PDFMergerTool());
        this.registerTool('color-converter', new PDFMergerTool());
        this.registerTool('ocr', new PDFMergerTool());
        this.registerTool('annotation', new PDFMergerTool());
        this.registerTool('optimizer', new PDFMergerTool());
        
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
        const tool = this.getTool(toolId);
        if (!tool) {
            console.error(`Tool "${toolId}" not found`);
            return;
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