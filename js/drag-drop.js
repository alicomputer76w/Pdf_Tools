/**
 * Drag and Drop Module for PDF Tools Suite
 * Provides comprehensive drag-and-drop functionality with visual feedback,
 * batch processing, file validation, and accessibility support
 */

class DragDropManager {
    constructor() {
        this.dropZones = new Map();
        this.activeDropZone = null;
        this.dragCounter = 0;
        this.supportedTypes = {
            pdf: ['application/pdf'],
            image: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'],
            document: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
        };
        
        this.init();
    }

    init() {
        this.setupGlobalDragHandlers();
        this.createDropOverlay();
        this.setupDefaultDropZones();
        this.setupAccessibility();
    }

    setupGlobalDragHandlers() {
        // Prevent default drag behaviors on the entire document
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });

        // Global drag enter/leave tracking
        document.addEventListener('dragenter', (e) => {
            this.handleGlobalDragEnter(e);
        });

        document.addEventListener('dragleave', (e) => {
            this.handleGlobalDragLeave(e);
        });

        document.addEventListener('dragover', (e) => {
            this.handleGlobalDragOver(e);
        });

        document.addEventListener('drop', (e) => {
            this.handleGlobalDrop(e);
        });
    }

    createDropOverlay() {
        const overlay = document.createElement('div');
        overlay.id = 'drag-drop-overlay';
        overlay.className = 'drag-drop-overlay';
        overlay.innerHTML = `
            <div class="drop-content">
                <div class="drop-icon">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7,10 12,15 17,10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                </div>
                <h3>Drop files here</h3>
                <p>Drop your PDF files or images to get started</p>
                <div class="supported-formats">
                    <span class="format-badge">PDF</span>
                    <span class="format-badge">JPG</span>
                    <span class="format-badge">PNG</span>
                    <span class="format-badge">GIF</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }

    setupDefaultDropZones() {
        // Main application drop zone
        this.registerDropZone(document.body, {
            accept: ['pdf', 'image'],
            multiple: true,
            onDrop: (files) => this.handleMainDrop(files),
            className: 'main-drop-zone'
        });

        // Tool-specific drop zones will be registered when tools are opened
        this.setupToolDropZones();
    }

    setupToolDropZones() {
        // Observer for dynamically created tool interfaces
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const uploadAreas = node.querySelectorAll('.file-upload-area');
                        uploadAreas.forEach(area => {
                            this.enhanceUploadArea(area);
                        });
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    enhanceUploadArea(uploadArea) {
        const toolType = uploadArea.dataset.toolType || 'general';
        const accept = this.getAcceptedTypesForTool(toolType);
        
        this.registerDropZone(uploadArea, {
            accept: accept,
            multiple: uploadArea.hasAttribute('multiple'),
            onDrop: (files) => this.handleToolDrop(files, uploadArea),
            onDragEnter: () => uploadArea.classList.add('drag-over'),
            onDragLeave: () => uploadArea.classList.remove('drag-over'),
            className: 'tool-drop-zone'
        });
    }

    registerDropZone(element, options = {}) {
        const config = {
            accept: options.accept || ['pdf'],
            multiple: options.multiple || false,
            onDrop: options.onDrop || (() => {}),
            onDragEnter: options.onDragEnter || (() => {}),
            onDragLeave: options.onDragLeave || (() => {}),
            onDragOver: options.onDragOver || (() => {}),
            className: options.className || '',
            maxSize: options.maxSize || 50 * 1024 * 1024, // 50MB default
            ...options
        };

        this.dropZones.set(element, config);

        // Add visual indicators
        element.classList.add('drop-zone');
        if (config.className) {
            element.classList.add(config.className);
        }

        // Add accessibility attributes
        element.setAttribute('role', 'button');
        element.setAttribute('aria-label', 'Drop files here or click to select');
        element.setAttribute('tabindex', '0');
    }

    unregisterDropZone(element) {
        this.dropZones.delete(element);
        element.classList.remove('drop-zone');
    }

    handleGlobalDragEnter(e) {
        this.dragCounter++;
        
        if (this.dragCounter === 1) {
            this.showDropOverlay();
        }

        // Find the most specific drop zone
        const dropZone = this.findDropZone(e.target);
        if (dropZone) {
            this.setActiveDropZone(dropZone, e);
        }
    }

    handleGlobalDragLeave(e) {
        this.dragCounter--;
        
        if (this.dragCounter === 0) {
            this.hideDropOverlay();
            this.clearActiveDropZone();
        }
    }

    handleGlobalDragOver(e) {
        const dropZone = this.findDropZone(e.target);
        if (dropZone) {
            const config = this.dropZones.get(dropZone);
            if (this.canAcceptFiles(e.dataTransfer, config)) {
                e.dataTransfer.dropEffect = 'copy';
                config.onDragOver(e);
            } else {
                e.dataTransfer.dropEffect = 'none';
            }
        }
    }

    handleGlobalDrop(e) {
        this.dragCounter = 0;
        this.hideDropOverlay();
        
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        const dropZone = this.findDropZone(e.target);
        if (dropZone) {
            const config = this.dropZones.get(dropZone);
            this.processFileDrop(files, config, dropZone);
        }

        this.clearActiveDropZone();
    }

    findDropZone(element) {
        let current = element;
        while (current && current !== document.body) {
            if (this.dropZones.has(current)) {
                return current;
            }
            current = current.parentElement;
        }
        return this.dropZones.has(document.body) ? document.body : null;
    }

    setActiveDropZone(dropZone, e) {
        if (this.activeDropZone !== dropZone) {
            this.clearActiveDropZone();
            this.activeDropZone = dropZone;
            
            const config = this.dropZones.get(dropZone);
            dropZone.classList.add('drag-over');
            config.onDragEnter(e);
        }
    }

    clearActiveDropZone() {
        if (this.activeDropZone) {
            const config = this.dropZones.get(this.activeDropZone);
            this.activeDropZone.classList.remove('drag-over');
            config.onDragLeave();
            this.activeDropZone = null;
        }
    }

    canAcceptFiles(dataTransfer, config) {
        const files = Array.from(dataTransfer.files);
        
        // Check file count
        if (!config.multiple && files.length > 1) {
            return false;
        }

        // Check file types
        return files.every(file => this.isFileTypeAccepted(file, config.accept));
    }

    isFileTypeAccepted(file, acceptedTypes) {
        return acceptedTypes.some(type => {
            const mimeTypes = this.supportedTypes[type] || [type];
            return mimeTypes.some(mimeType => {
                if (mimeType.endsWith('/*')) {
                    return file.type.startsWith(mimeType.slice(0, -1));
                }
                return file.type === mimeType;
            });
        });
    }

    processFileDrop(files, config, dropZone) {
        // Validate files
        const validationResults = this.validateFiles(files, config);
        
        if (validationResults.invalid.length > 0) {
            this.showValidationErrors(validationResults.invalid);
        }

        if (validationResults.valid.length > 0) {
            // Show processing indicator
            this.showProcessingIndicator(validationResults.valid.length);
            
            // Process files
            config.onDrop(validationResults.valid, dropZone);
            
            // Announce to screen readers
            if (window.accessibilityManager) {
                const count = validationResults.valid.length;
                accessibilityManager.announce(
                    `${count} file${count > 1 ? 's' : ''} dropped successfully`
                );
            }
        }
    }

    validateFiles(files, config) {
        const valid = [];
        const invalid = [];

        files.forEach(file => {
            const errors = [];

            // Check file type
            if (!this.isFileTypeAccepted(file, config.accept)) {
                errors.push(`File type not supported: ${file.type}`);
            }

            // Check file size
            if (file.size > config.maxSize) {
                errors.push(`File too large: ${this.formatFileSize(file.size)} (max: ${this.formatFileSize(config.maxSize)})`);
            }

            // Check if file is empty
            if (file.size === 0) {
                errors.push('File is empty');
            }

            if (errors.length === 0) {
                valid.push(file);
            } else {
                invalid.push({ file, errors });
            }
        });

        return { valid, invalid };
    }

    showValidationErrors(invalidFiles) {
        const errors = invalidFiles.map(({ file, errors }) => 
            `${file.name}: ${errors.join(', ')}`
        ).join('\n');

        if (window.notificationManager) {
            notificationManager.show(
                'File Validation Errors',
                `Some files could not be processed:\n${errors}`,
                'error',
                { persistent: true }
            );
        }
    }

    showProcessingIndicator(fileCount) {
        if (window.modalManager) {
            modalManager.showProgress(
                'Processing Files',
                `Processing ${fileCount} file${fileCount > 1 ? 's' : ''}...`,
                0
            );
        }
    }

    handleMainDrop(files) {
        // Intelligent tool suggestion based on file types
        const suggestions = this.suggestTools(files);
        this.showToolSuggestions(files, suggestions);
    }

    handleToolDrop(files, uploadArea) {
        // Trigger the file input change event
        const fileInput = uploadArea.querySelector('input[type="file"]');
        if (fileInput) {
            // Create a new FileList-like object
            const dt = new DataTransfer();
            files.forEach(file => dt.items.add(file));
            fileInput.files = dt.files;
            
            // Trigger change event
            const event = new Event('change', { bubbles: true });
            fileInput.dispatchEvent(event);
        }
    }

    suggestTools(files) {
        const suggestions = [];
        const fileTypes = this.analyzeFileTypes(files);

        if (fileTypes.pdf > 0) {
            if (fileTypes.pdf > 1) {
                suggestions.push({
                    tool: 'pdf-merger',
                    reason: `Merge ${fileTypes.pdf} PDF files`,
                    priority: 'high'
                });
            }
            
            suggestions.push({
                tool: 'pdf-splitter',
                reason: 'Split PDF pages',
                priority: 'medium'
            });

            suggestions.push({
                tool: 'pdf-to-image',
                reason: 'Convert PDF to images',
                priority: 'medium'
            });
        }

        if (fileTypes.image > 0) {
            suggestions.push({
                tool: 'image-to-pdf',
                reason: `Convert ${fileTypes.image} image${fileTypes.image > 1 ? 's' : ''} to PDF`,
                priority: 'high'
            });
        }

        if (fileTypes.pdf > 0 && fileTypes.image > 0) {
            suggestions.push({
                tool: 'pdf-watermark',
                reason: 'Add image watermarks to PDFs',
                priority: 'medium'
            });
        }

        return suggestions.sort((a, b) => {
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
    }

    analyzeFileTypes(files) {
        const types = { pdf: 0, image: 0, document: 0, other: 0 };
        
        files.forEach(file => {
            if (this.supportedTypes.pdf.includes(file.type)) {
                types.pdf++;
            } else if (this.supportedTypes.image.includes(file.type)) {
                types.image++;
            } else if (this.supportedTypes.document.includes(file.type)) {
                types.document++;
            } else {
                types.other++;
            }
        });

        return types;
    }

    showToolSuggestions(files, suggestions) {
        if (suggestions.length === 0) {
            if (window.notificationManager) {
                notificationManager.show(
                    'Files Received',
                    `${files.length} file${files.length > 1 ? 's' : ''} ready for processing`,
                    'info'
                );
            }
            return;
        }

        const suggestionHTML = suggestions.map(suggestion => `
            <div class="tool-suggestion" data-tool="${suggestion.tool}">
                <div class="suggestion-content">
                    <h4>${this.getToolDisplayName(suggestion.tool)}</h4>
                    <p>${suggestion.reason}</p>
                </div>
                <button class="btn btn-primary" onclick="this.closest('.tool-suggestion').click()">
                    Open Tool
                </button>
            </div>
        `).join('');

        if (window.modalManager) {
            modalManager.openModal('Suggested Tools', `
                <div class="tool-suggestions">
                    <p>Based on your files, here are some suggested tools:</p>
                    <div class="suggestions-list">
                        ${suggestionHTML}
                    </div>
                    <div class="file-summary">
                        <h4>Files to process:</h4>
                        <ul>
                            ${files.map(file => `<li>${file.name} (${this.formatFileSize(file.size)})</li>`).join('')}
                        </ul>
                    </div>
                </div>
            `);

            // Add click handlers for suggestions
            document.querySelectorAll('.tool-suggestion').forEach(suggestion => {
                suggestion.addEventListener('click', () => {
                    const toolId = suggestion.dataset.tool;
                    this.openToolWithFiles(toolId, files);
                    modalManager.closeModal();
                });
            });
        }
    }

    openToolWithFiles(toolId, files) {
        // Find and click the tool card
        const toolCard = document.querySelector(`[data-tool="${toolId}"]`);
        if (toolCard) {
            toolCard.click();
            
            // Wait for tool to open, then populate files
            setTimeout(() => {
                const fileInput = document.querySelector('.modal.active input[type="file"]');
                if (fileInput) {
                    const dt = new DataTransfer();
                    files.forEach(file => dt.items.add(file));
                    fileInput.files = dt.files;
                    
                    const event = new Event('change', { bubbles: true });
                    fileInput.dispatchEvent(event);
                }
            }, 500);
        }
    }

    getToolDisplayName(toolId) {
        const names = {
            'pdf-merger': 'PDF Merger',
            'pdf-splitter': 'PDF Splitter',
            'pdf-to-image': 'PDF to Image',
            'image-to-pdf': 'Image to PDF',
            'pdf-watermark': 'PDF Watermark',
            'pdf-compressor': 'PDF Compressor'
        };
        return names[toolId] || toolId.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    getAcceptedTypesForTool(toolType) {
        const toolAcceptance = {
            'pdf-merger': ['pdf'],
            'pdf-splitter': ['pdf'],
            'pdf-to-word': ['pdf'],
            'pdf-to-image': ['pdf'],
            'image-to-pdf': ['image'],
            'pdf-compressor': ['pdf'],
            'pdf-password': ['pdf'],
            'pdf-watermark': ['pdf', 'image'],
            'pdf-rotator': ['pdf'],
            'pdf-metadata': ['pdf'],
            'pdf-form-filler': ['pdf'],
            'pdf-signature': ['pdf'],
            'pdf-text-extractor': ['pdf'],
            'pdf-page-numbering': ['pdf'],
            'pdf-bookmark': ['pdf'],
            'pdf-page-resizer': ['pdf'],
            'pdf-color-converter': ['pdf'],
            'pdf-ocr': ['pdf', 'image'],
            'pdf-annotation': ['pdf'],
            'pdf-quality-optimizer': ['pdf']
        };

        return toolAcceptance[toolType] || ['pdf'];
    }

    showDropOverlay() {
        const overlay = document.getElementById('drag-drop-overlay');
        if (overlay) {
            overlay.classList.add('active');
            document.body.classList.add('drag-active');
        }
    }

    hideDropOverlay() {
        const overlay = document.getElementById('drag-drop-overlay');
        if (overlay) {
            overlay.classList.remove('active');
            document.body.classList.remove('drag-active');
        }
    }

    setupAccessibility() {
        // Add keyboard support for drop zones
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                const dropZone = e.target.closest('.drop-zone');
                if (dropZone) {
                    e.preventDefault();
                    this.triggerFileSelection(dropZone);
                }
            }
        });
    }

    triggerFileSelection(dropZone) {
        const fileInput = dropZone.querySelector('input[type="file"]');
        if (fileInput) {
            fileInput.click();
        } else {
            // Create a temporary file input
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = '.pdf,.jpg,.jpeg,.png,.gif';
            
            input.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                if (files.length > 0) {
                    const config = this.dropZones.get(dropZone);
                    if (config) {
                        this.processFileDrop(files, config, dropZone);
                    }
                }
            });
            
            input.click();
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Public API methods
    enableBatchMode() {
        document.body.classList.add('batch-mode');
    }

    disableBatchMode() {
        document.body.classList.remove('batch-mode');
    }

    setMaxFileSize(size) {
        this.dropZones.forEach(config => {
            config.maxSize = size;
        });
    }

    addSupportedType(name, mimeTypes) {
        this.supportedTypes[name] = mimeTypes;
    }
}

// Initialize drag and drop manager
document.addEventListener('DOMContentLoaded', () => {
    window.dragDropManager = new DragDropManager();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DragDropManager;
}