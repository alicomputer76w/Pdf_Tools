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
                <div id="merger-upload"></div>
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
            const mergedPdf = await mergePDFs(files);
            const filename = options.filename || 'merged-document.pdf';
            
            // Download the merged PDF
            downloadFile(mergedPdf, filename, 'application/pdf');
            
            return {
                success: true,
                message: `Successfully merged ${files.length} PDFs into ${filename}`
            };
        } catch (error) {
            throw new Error(`Failed to merge PDFs: ${error.message}`);
        }
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
        // Register available tools
        this.registerTool('pdf-merger', new PDFMergerTool());
        
        console.log('Tools initialized:', Array.from(this.tools.keys()));
    }

    registerTool(id, tool) {
        this.tools.set(id, tool);
    }

    getTool(id) {
        return this.tools.get(id);
    }

    setupEventListeners() {
        // Setup tool button listeners
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-tool]')) {
                const toolId = e.target.getAttribute('data-tool');
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
            const toolInterface = tool.createInterface();
            console.log(`Opening tool: ${tool.name}`);
            
            // In a real implementation, this would open a modal
            // For now, just log success
            console.log('Tool interface created successfully');
            
        } catch (error) {
            console.error(`Failed to open tool: ${error.message}`);
        }
    }
}

// Export ToolManager to global scope
window.ToolManager = ToolManager;

// Initialize tool manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.toolManager = new ToolManager();
    console.log('Clean ToolManager initialized successfully');
});