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

                // Show progress modal
                await modalManager.showProgress('Merging PDFs...', 'Please wait while we merge your files.');
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
        this.registerTool('splitter', new PDFMergerTool()); // Using same class for now
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