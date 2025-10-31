// PDF Tools Suite - Rebuilt Version
// This file contains all the PDF tool classes

// Base Tool Class
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

class PDFMergerTool extends BaseTool {
    constructor() {
        super('PDF Merger', 'Combine multiple PDFs into one document');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div class="file-upload-area" data-tool-type="pdf-merger">
                    <i class="material-icons">cloud_upload</i>
                    <p>Drop PDF files here or click to browse</p>
                    <input type="file" accept=".pdf" multiple>
                </div>
                <button class="btn btn-primary process-btn">Merge PDFs</button>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length < 2) {
            throw new Error('Please select at least 2 PDF files to merge');
        }
        // Simplified implementation
        console.log('Merging PDFs...');
        return { success: true };
    }
}

class PDFSplitterTool extends BaseTool {
    constructor() {
        super('PDF Splitter', 'Extract specific pages from PDF documents');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div class="file-upload-area" data-tool-type="pdf-splitter">
                    <i class="material-icons">cloud_upload</i>
                    <p>Drop a PDF file here or click to browse</p>
                    <input type="file" accept=".pdf">
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Pages to extract:</label>
                        <input type="text" class="option-input" id="split-pages" placeholder="e.g., 1,3,5-10">
                    </div>
                </div>
                <button class="btn btn-primary process-btn">Split PDF</button>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file to split');
        }
        console.log('Splitting PDF...');
        return { success: true };
    }
}

class PDFQualityOptimizerTool extends BaseTool {
    constructor() {
        super('PDF Quality Optimizer', 'Optimize PDF quality and file size');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div class="file-upload-area" data-tool-type="quality-optimizer">
                    <i class="material-icons">cloud_upload</i>
                    <p>Drop a PDF file here or click to browse</p>
                    <input type="file" accept=".pdf">
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Optimization level:</label>
                        <select class="option-input option-select" id="optimization-level">
                            <option value="web" selected>Web (Balanced)</option>
                            <option value="print">Print (High Quality)</option>
                            <option value="mobile">Mobile (Small Size)</option>
                            <option value="archive">Archive (Maximum Quality)</option>
                        </select>
                    </div>
                </div>
                <button class="btn btn-primary process-btn">Optimize PDF</button>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file');
        }
        console.log('Optimizing PDF...');
        return { success: true };
    }
}

class PDFAnnotationTool extends BaseTool {
    constructor() {
        super('PDF Annotation Tool', 'Add annotations to PDF documents');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div class="file-upload-area" data-tool-type="annotation">
                    <i class="material-icons">cloud_upload</i>
                    <p>Drop a PDF file here or click to browse</p>
                    <input type="file" accept=".pdf">
                </div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Annotation type:</label>
                        <select class="option-input option-select" id="annotation-type">
                            <option value="highlight">Highlight</option>
                            <option value="note">Sticky Note</option>
                            <option value="text">Text Annotation</option>
                            <option value="rectangle">Rectangle</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Annotation text:</label>
                        <textarea class="option-input" id="annotation-text" placeholder="Enter annotation text" rows="3"></textarea>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Page number:</label>
                        <input type="number" class="option-input" id="annotation-page" min="1" value="1">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Color:</label>
                        <select class="option-input option-select" id="annotation-color">
                            <option value="yellow">Yellow</option>
                            <option value="red">Red</option>
                            <option value="blue">Blue</option>
                            <option value="green">Green</option>
                        </select>
                    </div>
                </div>
                <button class="btn btn-primary process-btn">Add Annotation</button>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file');
        }
        console.log('Adding annotation...');
        return { success: true };
    }
}

// Tool Manager Class
class ToolManager {
    constructor() {
        this.tools = new Map();
        this.initializeTools();
        this.setupEventListeners();
    }

    initializeTools() {
        // Register all tools
        this.registerTool('merger', new PDFMergerTool());
        this.registerTool('splitter', new PDFSplitterTool());
        this.registerTool('optimizer', new PDFQualityOptimizerTool());
        this.registerTool('annotation', new PDFAnnotationTool());
    }

    registerTool(id, tool) {
        this.tools.set(id, tool);
    }

    getTool(id) {
        return this.tools.get(id);
    }

    setupEventListeners() {
        // Setup global event listeners for tools
        console.log('Setting up tool event listeners');
    }

    async openTool(toolId) {
        const tool = this.getTool(toolId);
        if (!tool) {
            if (typeof notificationManager !== 'undefined') {
                notificationManager.error(`Tool "${toolId}" not found`);
            } else {
                console.error(`Tool "${toolId}" not found`);
            }
            return;
        }

        try {
            const toolInterface = tool.createInterface();
            if (typeof modalManager !== 'undefined') {
                modalManager.openModal('tool-modal', tool.name, toolInterface);
            } else {
                console.log(`Opening tool: ${tool.name}`);
                console.log(toolInterface);
            }
            
            // Setup tool-specific functionality
            this.setupToolInterface(toolId, tool);
            
        } catch (error) {
            if (typeof notificationManager !== 'undefined') {
                notificationManager.error(`Failed to open tool: ${error.message}`);
            } else {
                console.error(`Failed to open tool: ${error.message}`);
            }
        }
    }

    setupToolInterface(toolId, tool) {
        // Setup tool-specific interface functionality
        console.log(`Setting up interface for ${toolId}`);
    }
}

// Export to global scope
window.ToolManager = ToolManager;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.toolManager = new ToolManager();
    console.log('ToolManager initialized with tools:', Array.from(window.toolManager.tools.keys()));
});