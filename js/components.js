/**
 * PDF Tools Suite - UI Components
 * Handles UI components, modals, notifications, and user interactions
 */

/**
 * Enhanced Modal Manager with better progress tracking
 */
class ModalManager {
    constructor() {
        this.activeModal = null;
        this.currentProgress = 0;
        this.progressCallback = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Close modal on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModal) {
                this.closeModal();
            }
        });

        // Close modal on backdrop click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal') && this.activeModal) {
                this.closeModal();
            }
        });

        // Close modal on close button click
        document.addEventListener('click', (e) => {
            if (e.target.closest('.modal-close')) {
                this.closeModal();
            }
        });

        // Progress cancel button
        document.addEventListener('click', (e) => {
            if (e.target.closest('#progress-cancel')) {
                this.cancelProgress();
            }
        });
    }

    openModal(modalId, title = '', content = '') {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        // Set title if provided
        const titleElement = modal.querySelector('#modal-title, .modal-header h2');
        if (titleElement && title) {
            titleElement.textContent = title;
        }

        // Set content if provided
        const bodyElement = modal.querySelector('#modal-body, .modal-body');
        if (bodyElement && content) {
            if (typeof content === 'string') {
                bodyElement.innerHTML = content;
            } else {
                bodyElement.innerHTML = '';
                bodyElement.appendChild(content);
            }
        }

        modal.classList.add('active');
        this.activeModal = modal;
        document.body.style.overflow = 'hidden';

        // Focus management for accessibility
        const firstFocusable = modal.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
            firstFocusable.focus();
        }
    }

    closeModal() {
        // Prefer closing the tracked active modal
        if (this.activeModal) {
            this.activeModal.classList.remove('active');
            this.activeModal = null;
            document.body.style.overflow = '';
            return;
        }

        // Fallback: if no activeModal is tracked (e.g., after progress modal),
        // close any open modal element in the DOM
        const anyActiveModal = document.querySelector('.modal.active');
        if (anyActiveModal) {
            anyActiveModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }

    showProgress(title = 'Processing...', message = 'Please wait while we process your file.', cancellable = true) {
        const progressModal = document.getElementById('progress-modal');
        const titleElement = document.getElementById('progress-title');
        const messageElement = document.getElementById('progress-message');
        const cancelBtn = document.getElementById('progress-cancel');

        if (titleElement) titleElement.textContent = title;
        if (messageElement) messageElement.textContent = message;
        if (cancelBtn) cancelBtn.style.display = cancellable ? 'block' : 'none';

        this.currentProgress = 0;
        this.updateProgress(0);
        progressModal.classList.add('active');
        this.activeModal = progressModal;
        document.body.style.overflow = 'hidden';

        return new Promise((resolve, reject) => {
            this.progressCallback = { resolve, reject };
        });
    }

    updateProgress(percentage, status = '', details = '') {
        const progressFill = document.getElementById('progress-fill');
        const progressPercentage = document.getElementById('progress-percentage');
        const progressStatus = document.getElementById('progress-status');
        const progressDetails = document.getElementById('progress-details');

        this.currentProgress = Math.max(0, Math.min(100, percentage));

        if (progressFill) {
            progressFill.style.width = `${this.currentProgress}%`;
        }
        if (progressPercentage) {
            progressPercentage.textContent = `${Math.round(this.currentProgress)}%`;
        }
        if (progressStatus && status) {
            progressStatus.textContent = status;
        }
        if (progressDetails && details) {
            progressDetails.textContent = details;
        }

        // Auto-close when complete
        if (this.currentProgress >= 100) {
            setTimeout(() => {
                this.hideProgress();
                if (this.progressCallback) {
                    this.progressCallback.resolve();
                    this.progressCallback = null;
                }
            }, 1000);
        }
    }

    hideProgress() {
        const progressModal = document.getElementById('progress-modal');
        if (progressModal) {
            progressModal.classList.remove('active');
            if (this.activeModal === progressModal) {
                this.activeModal = null;
                document.body.style.overflow = '';
            }
        }
    }

    cancelProgress() {
        this.hideProgress();
        if (this.progressCallback) {
            this.progressCallback.reject(new Error('Operation cancelled by user'));
            this.progressCallback = null;
        }
    }
}

/**
 * Enhanced Notification Manager with better UX and accessibility
 */
class NotificationManager {
    constructor() {
        this.container = null;
        this.notifications = new Map();
        this.maxNotifications = 5;
        this.defaultDuration = 5000;
        this.init();
    }

    init() {
        this.createContainer();
        this.setupKeyboardHandlers();
    }

    createContainer() {
        this.container = document.getElementById('notification-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'notification-container';
            this.container.className = 'notification-container';
            this.container.setAttribute('aria-live', 'polite');
            this.container.setAttribute('aria-atomic', 'false');
            document.body.appendChild(this.container);
        }
    }

    setupKeyboardHandlers() {
        document.addEventListener('keydown', (e) => {
            // Dismiss notifications with Escape key
            if (e.key === 'Escape') {
                this.dismissAll();
            }
        });
    }

    show(message, type = 'info', options = {}) {
        const {
            duration = this.defaultDuration,
            persistent = false,
            actions = [],
            details = '',
            icon = null
        } = options;

        // Limit number of notifications
        if (this.notifications.size >= this.maxNotifications) {
            const oldestId = this.notifications.keys().next().value;
            this.dismiss(oldestId);
        }

        const id = this.generateId();
        const notification = this.createNotification(id, message, type, {
            duration,
            persistent,
            actions,
            details,
            icon
        });

        this.notifications.set(id, notification);
        this.container.appendChild(notification.element);

        // Animate in
        requestAnimationFrame(() => {
            notification.element.classList.add('show');
        });

        // Auto-dismiss if not persistent
        if (!persistent && duration > 0) {
            notification.timer = setTimeout(() => {
                this.dismiss(id);
            }, duration);
        }

        // Announce to screen readers
        this.announceToScreenReader(message, type);

        return id;
    }

    createNotification(id, message, type, options) {
        const element = document.createElement('div');
        element.className = `notification notification-${type}`;
        element.setAttribute('role', 'alert');
        element.setAttribute('aria-labelledby', `notification-${id}-message`);
        element.setAttribute('data-notification-id', id);

        const iconMap = {
            success: 'check_circle',
            error: 'error',
            warning: 'warning',
            info: 'info'
        };

        const icon = options.icon || iconMap[type] || 'info';

        element.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">
                    <i class="material-icons">${icon}</i>
                </div>
                <div class="notification-body">
                    <div class="notification-message" id="notification-${id}-message">
                        ${this.escapeHtml(message)}
                    </div>
                    ${options.details ? `<div class="notification-details">${this.escapeHtml(options.details)}</div>` : ''}
                    ${options.actions.length > 0 ? this.createActionButtons(options.actions) : ''}
                </div>
                <button class="notification-close" aria-label="Dismiss notification" tabindex="0">
                    <i class="material-icons">close</i>
                </button>
            </div>
            ${!options.persistent && options.duration > 0 ? `
                <div class="notification-progress">
                    <div class="notification-progress-bar" style="animation-duration: ${options.duration}ms;"></div>
                </div>
            ` : ''}
        `;

        // Setup event listeners
        const closeBtn = element.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => this.dismiss(id));

        // Keyboard navigation
        element.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.dismiss(id);
            }
        });

        return {
            element,
            timer: null,
            type,
            message,
            options
        };
    }

    createActionButtons(actions) {
        const actionsHtml = actions.map(action => `
            <button class="notification-action" data-action="${action.id}">
                ${this.escapeHtml(action.label)}
            </button>
        `).join('');

        return `<div class="notification-actions">${actionsHtml}</div>`;
    }

    dismiss(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;

        // Clear timer
        if (notification.timer) {
            clearTimeout(notification.timer);
        }

        // Animate out
        notification.element.classList.add('hide');
        
        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            this.notifications.delete(id);
        }, 300);
    }

    dismissAll() {
        const ids = Array.from(this.notifications.keys());
        ids.forEach(id => this.dismiss(id));
    }

    // Convenience methods
    success(message, options = {}) {
        return this.show(message, 'success', options);
    }

    error(message, options = {}) {
        return this.show(message, 'error', { ...options, persistent: true });
    }

    warning(message, options = {}) {
        return this.show(message, 'warning', options);
    }

    info(message, options = {}) {
        return this.show(message, 'info', options);
    }

    clear() {
        this.dismissAll();
    }

    // Utility methods
    generateId() {
        return `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    announceToScreenReader(message, type) {
        // Create a temporary element for screen reader announcement
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'assertive');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = `${type}: ${message}`;
        
        document.body.appendChild(announcement);
        
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }
}

/**
 * File Upload Component
 */
class FileUploadComponent {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            multiple: false,
            accept: '*/*',
            maxSize: FILE_SIZE_LIMITS.PDF,
            validator: null,
            onFilesSelected: null,
            onFileRemoved: null,
            dragText: 'Drag and drop files here',
            browseText: 'or click to browse',
            ...options
        };
        
        this.files = [];
        this.init();
    }

    init() {
        this.render();
        this.setupEventListeners();
    }

    render() {
        this.container.innerHTML = `
            <div class="file-upload-area" tabindex="0" role="button" aria-label="Upload files">
                <i class="material-icons upload-icon">cloud_upload</i>
                <div class="upload-text">${this.options.dragText}</div>
                <div class="upload-subtext">${this.options.browseText}</div>
                <input type="file" class="file-input" ${this.options.multiple ? 'multiple' : ''} accept="${this.options.accept}">
            </div>
            <div class="file-list"></div>
        `;

        this.uploadArea = this.container.querySelector('.file-upload-area');
        this.fileInput = this.container.querySelector('.file-input');
        this.fileList = this.container.querySelector('.file-list');
    }

    setupEventListeners() {
        // Click to browse
        this.uploadArea.addEventListener('click', () => {
            this.fileInput.click();
        });

        // Keyboard support: only trigger when the upload area itself has focus
        this.uploadArea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                // Avoid activating when typing inside any descendant input
                if (e.target !== e.currentTarget) return;
                e.preventDefault();
                this.fileInput.click();
            }
        });

        // File input change
        this.fileInput.addEventListener('change', (e) => {
            this.handleFiles(Array.from(e.target.files));
        });

        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.classList.add('dragover');
        });

        this.uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            if (!this.uploadArea.contains(e.relatedTarget)) {
                this.uploadArea.classList.remove('dragover');
            }
        });

        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.classList.remove('dragover');
            
            const files = Array.from(e.dataTransfer.files);
            this.handleFiles(files);
        });
    }

    handleFiles(newFiles) {
        const validFiles = [];
        const errors = [];

        newFiles.forEach(file => {
            // Validate file
            if (this.options.validator) {
                const validation = this.options.validator(file);
                if (validation.valid) {
                    validFiles.push(file);
                } else {
                    errors.push(`${file.name}: ${validation.errors.join(', ')}`);
                }
            } else {
                validFiles.push(file);
            }
        });

        // Show errors if any
        if (errors.length > 0) {
            window.notificationManager.error(errors.join('\n'), 'File Validation Error');
        }

        // Add valid files
        if (validFiles.length > 0) {
            if (!this.options.multiple) {
                this.files = [validFiles[0]];
            } else {
                this.files.push(...validFiles);
            }
            
            this.renderFileList();
            
            if (this.options.onFilesSelected) {
                this.options.onFilesSelected(this.files);
            }
        }
    }

    renderFileList() {
        this.fileList.innerHTML = '';
        
        this.files.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <i class="material-icons file-icon">picture_as_pdf</i>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${FileValidator.formatFileSize(file.size)}</div>
                </div>
                <div class="file-actions">
                    <button class="file-remove" data-index="${index}" aria-label="Remove file">
                        <i class="material-icons">close</i>
                    </button>
                </div>
            `;

            // Add remove event listener
            const removeBtn = fileItem.querySelector('.file-remove');
            removeBtn.addEventListener('click', () => {
                this.removeFile(index);
            });

            this.fileList.appendChild(fileItem);
        });
    }

    removeFile(index) {
        const removedFile = this.files.splice(index, 1)[0];
        this.renderFileList();
        
        if (this.options.onFileRemoved) {
            this.options.onFileRemoved(removedFile, index);
        }
    }

    getFiles() {
        return this.files;
    }

    clear() {
        this.files = [];
        this.renderFileList();
        this.fileInput.value = '';
    }

    setFiles(files) {
        this.files = files;
        this.renderFileList();
    }
}

/**
 * Preview Component
 */
class PreviewComponent {
    constructor(container) {
        this.container = container;
        this.currentFile = null;
        this.init();
    }

    init() {
        this.container.innerHTML = `
            <div class="preview-area">
                <div class="preview-placeholder">
                    <i class="material-icons">visibility</i>
                    <p>No preview available</p>
                </div>
            </div>
        `;
        this.previewArea = this.container.querySelector('.preview-area');
    }

    async showPDF(file) {
        try {
            this.currentFile = file;
            this.showLoading();

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            const page = await pdf.getPage(1);

            const scale = 1.5;
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            this.previewArea.innerHTML = '';
            this.previewArea.appendChild(canvas);
            canvas.className = 'preview-content';

        } catch (error) {
            this.showError('Failed to preview PDF');
            console.error('PDF preview error:', error);
        }
    }

    async showImage(file) {
        try {
            this.currentFile = file;
            this.showLoading();

            const img = await ImageUtils.loadImage(file);
            
            this.previewArea.innerHTML = '';
            this.previewArea.appendChild(img);
            img.className = 'preview-content';

        } catch (error) {
            this.showError('Failed to preview image');
            console.error('Image preview error:', error);
        }
    }

    showLoading() {
        this.previewArea.innerHTML = `
            <div class="preview-placeholder">
                <div class="loading-spinner"></div>
                <p>Loading preview...</p>
            </div>
        `;
    }

    showError(message) {
        this.previewArea.innerHTML = `
            <div class="preview-placeholder">
                <i class="material-icons">error</i>
                <p>${message}</p>
            </div>
        `;
    }

    clear() {
        this.currentFile = null;
        this.previewArea.innerHTML = `
            <div class="preview-placeholder">
                <i class="material-icons">visibility</i>
                <p>No preview available</p>
            </div>
        `;
    }
}

/**
 * Theme Manager
 */
class ThemeManager {
    constructor() {
        this.currentTheme = StorageUtils.load('theme', 'light');
        this.init();
    }

    init() {
        this.applyTheme(this.currentTheme);
        this.setupEventListeners();
    }

    setupEventListeners() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                this.toggleTheme();
            });
        }

        // Keyboard shortcut
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'd') {
                e.preventDefault();
                this.toggleTheme();
            }
        });
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    setTheme(theme) {
        this.currentTheme = theme;
        this.applyTheme(theme);
        StorageUtils.save('theme', theme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            const icon = themeToggle.querySelector('i');
            if (icon) {
                icon.textContent = theme === 'light' ? 'dark_mode' : 'light_mode';
            }
        }
    }

    getTheme() {
        return this.currentTheme;
    }
}

/**
 * Search and Filter Manager
 */
class SearchFilterManager {
    constructor() {
        this.searchInput = document.getElementById('tool-search');
        this.filterTabs = document.querySelectorAll('.filter-tab');
        this.toolCards = document.querySelectorAll('#tools-grid .tool-card');
        this.currentFilter = 'all';
        this.currentSearch = '';
        
        this.init();
    }

    init() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Search input
        if (this.searchInput) {
            const debouncedSearch = PerformanceUtils.debounce((value) => {
                this.currentSearch = value.toLowerCase();
                this.applyFilters();
            }, 300);

            this.searchInput.addEventListener('input', (e) => {
                debouncedSearch(e.target.value);
            });

            // Keyboard shortcut for search
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === '/') {
                    e.preventDefault();
                    this.searchInput.focus();
                }
            });
        }

        // Filter tabs
        this.filterTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                this.setFilter(tab.dataset.category);
            });
        });
    }

    setFilter(category) {
        this.currentFilter = category;
        
        // Update active tab
        this.filterTabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.category === category);
        });
        
        this.applyFilters();
    }

    applyFilters() {
        this.toolCards.forEach(card => {
            const matchesSearch = this.matchesSearch(card);
            const matchesFilter = this.matchesFilter(card);
            
            if (matchesSearch && matchesFilter) {
                card.classList.remove('hidden');
            } else {
                card.classList.add('hidden');
            }
        });
    }

    matchesSearch(card) {
        if (!this.currentSearch) return true;
        
        const titleEl = card.querySelector('h3');
        const descEl = card.querySelector('p');
        const title = (titleEl?.textContent || '').toLowerCase();
        const description = (descEl?.textContent || '').toLowerCase();
        
        return title.includes(this.currentSearch) || description.includes(this.currentSearch);
    }

    matchesFilter(card) {
        if (this.currentFilter === 'all') return true;
        
        return card.dataset.category === this.currentFilter;
    }
}

// Initialize global components
document.addEventListener('DOMContentLoaded', () => {
    window.modalManager = new ModalManager();
    window.notificationManager = new NotificationManager();
    window.themeManager = new ThemeManager();
    window.searchFilterManager = new SearchFilterManager();
    
    // Export classes for use in other modules
    window.FileUploadComponent = FileUploadComponent;
    window.PreviewComponent = PreviewComponent;
    window.ModalManager = ModalManager;
    window.NotificationManager = NotificationManager;
    window.ThemeManager = ThemeManager;
    window.SearchFilterManager = SearchFilterManager;
});
