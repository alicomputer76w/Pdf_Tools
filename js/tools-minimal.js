/**
 * Minimal PDF Tools Suite - For Testing
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
        return '<div>Base interface</div>';
    }

    validate(files, options = {}) {
        return { valid: true, errors: [] };
    }
}

class PDFMergerTool extends BaseTool {
    constructor() {
        super('PDF Merger', 'Merge multiple PDF files into one');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <h3>Merge PDF Files</h3>
                <p>Select multiple PDF files to merge into a single document.</p>
            </div>
        `;
    }

    async execute(files, options = {}) {
        // Minimal implementation
        console.log('Merging PDFs...');
        return { success: true };
    }
}

class ToolManager {
    constructor() {
        this.tools = new Map();
        this.initializeTools();
    }

    initializeTools() {
        // Register basic tools
        this.registerTool('pdf-merger', new PDFMergerTool());
    }

    registerTool(id, tool) {
        this.tools.set(id, tool);
    }

    getTool(id) {
        return this.tools.get(id);
    }
}

// Export ToolManager to global scope
window.ToolManager = ToolManager;

// Initialize tool manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.toolManager = new ToolManager();
});