/**
 * PDF Tools Suite - Main Application
 * Initializes and manages the entire application
 */

class PDFToolsApp {
    constructor() {
        this.version = '1.0.0';
        this.initialized = false;
        this.components = {};
        this.settings = {};
        
        this.init();
    }

    async init() {
        try {
            // Show loading screen
            this.showLoadingScreen();
            
            // Load settings from localStorage
            this.loadSettings();
            
            // Initialize PDF.js
            await this.initializePDFJS();
            
            // Initialize components
            this.initializeComponents();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();
            
            // Initialize analytics (if enabled)
            this.initializeAnalytics();
            
            // Hide loading screen
            this.hideLoadingScreen();
            
            this.initialized = true;
            console.log('PDF Tools Suite initialized successfully');
            
        } catch (error) {
            this.handleInitializationError(error);
        }
    }

    showLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }

    loadSettings() {
        const defaultSettings = {
            theme: 'light',
            language: 'en',
            autoSave: true,
            maxFileSize: 50 * 1024 * 1024, // 50MB
            compressionLevel: 'medium',
            analytics: false,
            notifications: true,
            keyboardShortcuts: true
        };

        this.settings = { ...defaultSettings, ...LocalStorageManager.get('app-settings', {}) };
        
        // Apply theme
        if (this.settings.theme === 'dark') {
            document.body.classList.add('dark-theme');
        }
    }

    saveSettings() {
        LocalStorageManager.set('app-settings', this.settings);
    }

    async initializePDFJS() {
        // Set PDF.js worker
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }
    }

    initializeComponents() {
        // Initialize core components
        this.components.modal = new ModalManager();
        this.components.notification = new NotificationManager();
        this.components.theme = new ThemeManager();
        this.components.searchFilter = new SearchFilterManager();
        
        // Ensure ToolManager is available - create new instance if not already initialized
        if (typeof ToolManager === 'undefined') {
            throw new Error('ToolManager class is not defined. Make sure tools.js is loaded before app.js.');
        }
        
        this.components.tool = window.toolManager || new ToolManager();

        // Store global references
        window.modalManager = this.components.modal;
        window.notificationManager = this.components.notification;
        window.themeManager = this.components.theme;
        window.searchFilterManager = this.components.searchFilter;
        
        // Ensure toolManager is available globally
        if (!window.toolManager) {
            window.toolManager = this.components.tool;
        }

        // Initialize preview component for file previews
        const previewContainer = document.getElementById('preview-container');
        if (previewContainer) {
            this.components.preview = new PreviewComponent(previewContainer);
            window.previewComponent = this.components.preview;
        }
    }

    setupEventListeners() {
        // Handle window resize
        window.addEventListener('resize', PerformanceUtils.throttle(() => {
            this.handleResize();
        }, 250));

        // Handle online/offline status
        window.addEventListener('online', () => {
            this.components.notification.info('Connection restored');
        });

        window.addEventListener('offline', () => {
            this.components.notification.warning('Working offline');
        });

        // Handle beforeunload for unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges()) {
                e.preventDefault();
                e.returnValue = '';
            }
        });

        // Handle drag and drop on document
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            this.handleGlobalFileDrop(e);
        });

        // Handle settings button
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.openSettings();
            });
        }

        // Handle help button
        const helpBtn = document.getElementById('help-btn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                this.openHelp();
            });
        }

        // Handle feedback button
        const feedbackBtn = document.getElementById('feedback-btn');
        if (feedbackBtn) {
            feedbackBtn.addEventListener('click', () => {
                this.openFeedback();
            });
        }
    }

    setupKeyboardShortcuts() {
        if (!this.settings.keyboardShortcuts) return;

        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + shortcuts
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'o':
                        e.preventDefault();
                        this.openFileDialog();
                        break;
                    case 's':
                        e.preventDefault();
                        this.saveCurrentWork();
                        break;
                    case 'n':
                        e.preventDefault();
                        this.newDocument();
                        break;
                    case 'h':
                        e.preventDefault();
                        this.openHelp();
                        break;
                    case ',':
                        e.preventDefault();
                        this.openSettings();
                        break;
                    case 'f':
                        e.preventDefault();
                        this.focusSearch();
                        break;
                }
            }

            // Escape key
            if (e.key === 'Escape') {
                this.components.modal.closeModal();
            }

            // F1 for help
            if (e.key === 'F1') {
                e.preventDefault();
                this.openHelp();
            }
        });
    }

    initializeAnalytics() {
        if (!this.settings.analytics) return;

        // Basic analytics tracking
        this.trackEvent('app_initialized', {
            version: this.version,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent
        });
    }

    handleResize() {
        // Update components that need to respond to resize
        if (this.components.preview) {
            this.components.preview.handleResize();
        }
    }

    handleGlobalFileDrop(e) {
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        // Determine the best tool based on file types
        const pdfFiles = files.filter(f => f.type === 'application/pdf');
        const imageFiles = files.filter(f => f.type.startsWith('image/'));

        if (pdfFiles.length > 1) {
            // Multiple PDFs - suggest merger
            this.suggestTool('merger', files);
        } else if (pdfFiles.length === 1 && imageFiles.length === 0) {
            // Single PDF - show options
            this.showPDFOptions(pdfFiles[0]);
        } else if (imageFiles.length > 0 && pdfFiles.length === 0) {
            // Images only - suggest image to PDF
            this.suggestTool('image-to-pdf', files);
        } else {
            // Mixed files - show general options
            this.showMixedFileOptions(files);
        }
    }

    suggestTool(toolId, files) {
        const tool = this.components.tool.getTool(toolId);
        if (tool) {
            const message = `Detected ${files.length} files. Would you like to use ${tool.name}?`;
            this.components.notification.info(message, {
                actions: [
                    {
                        text: 'Yes',
                        action: () => this.components.tool.openTool(toolId)
                    },
                    {
                        text: 'Choose Tool',
                        action: () => this.showToolSelector()
                    }
                ]
            });
        }
    }

    showPDFOptions(file) {
        const options = [
            { id: 'splitter', name: 'Split PDF', icon: 'content_cut' },
            { id: 'compressor', name: 'Compress PDF', icon: 'compress' },
            { id: 'pdf-to-image', name: 'Convert to Images', icon: 'image' },
            { id: 'pdf-to-word', name: 'Convert to Word', icon: 'description' }
        ];

        this.showQuickActions('What would you like to do with this PDF?', options);
    }

    showMixedFileOptions(files) {
        this.components.notification.info(
            `Detected ${files.length} mixed files. Please select a tool from the main interface.`
        );
    }

    showQuickActions(title, options) {
        const actionsHtml = options.map(option => `
            <button class="quick-action-btn" data-tool="${option.id}">
                <i class="material-icons">${option.icon}</i>
                <span>${option.name}</span>
            </button>
        `).join('');

        const content = `
            <div class="quick-actions">
                <p class="quick-actions-title">${title}</p>
                <div class="quick-actions-grid">
                    ${actionsHtml}
                </div>
            </div>
        `;

        this.components.modal.openModal('quick-actions', 'Quick Actions', content);

        // Setup event listeners for quick actions
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const toolId = btn.dataset.tool;
                this.components.modal.closeModal();
                this.components.tool.openTool(toolId);
            });
        });
    }

    openFileDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = '.pdf,image/*';
        
        input.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            if (files.length > 0) {
                this.handleGlobalFileDrop({ dataTransfer: { files } });
            }
        });

        input.click();
    }

    saveCurrentWork() {
        // Save current state to localStorage
        const state = {
            timestamp: new Date().toISOString(),
            // Add current work state here
        };
        
        LocalStorageManager.set('current-work', state);
        this.components.notification.success('Work saved');
    }

    newDocument() {
        if (this.hasUnsavedChanges()) {
            this.components.notification.warning('You have unsaved changes');
            return;
        }

        // Clear current work
        this.clearCurrentWork();
        this.components.notification.info('Ready for new document');
    }

    focusSearch() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.focus();
        }
    }

    openSettings() {
        const settingsContent = `
            <div class="settings-panel">
                <div class="settings-section">
                    <h3>Appearance</h3>
                    <div class="setting-item">
                        <label class="setting-label">Theme:</label>
                        <select class="setting-input" id="theme-setting">
                            <option value="light" ${this.settings.theme === 'light' ? 'selected' : ''}>Light</option>
                            <option value="dark" ${this.settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                            <option value="auto" ${this.settings.theme === 'auto' ? 'selected' : ''}>Auto</option>
                        </select>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h3>Performance</h3>
                    <div class="setting-item">
                        <label class="setting-label">Max file size (MB):</label>
                        <input type="number" class="setting-input" id="max-file-size" 
                               value="${this.settings.maxFileSize / (1024 * 1024)}" min="1" max="100">
                    </div>
                    <div class="setting-item">
                        <label class="setting-checkbox">
                            <input type="checkbox" id="auto-save" ${this.settings.autoSave ? 'checked' : ''}>
                            <span>Auto-save work</span>
                        </label>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h3>Privacy</h3>
                    <div class="setting-item">
                        <label class="setting-checkbox">
                            <input type="checkbox" id="analytics" ${this.settings.analytics ? 'checked' : ''}>
                            <span>Enable analytics</span>
                        </label>
                    </div>
                </div>
                
                <div class="settings-section">
                    <h3>Accessibility</h3>
                    <div class="setting-item">
                        <label class="setting-checkbox">
                            <input type="checkbox" id="keyboard-shortcuts" ${this.settings.keyboardShortcuts ? 'checked' : ''}>
                            <span>Enable keyboard shortcuts</span>
                        </label>
                    </div>
                    <div class="setting-item">
                        <label class="setting-checkbox">
                            <input type="checkbox" id="notifications" ${this.settings.notifications ? 'checked' : ''}>
                            <span>Show notifications</span>
                        </label>
                    </div>
                </div>
            </div>
            
            <div class="settings-actions">
                <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                <button class="btn btn-primary" id="save-settings">Save Settings</button>
            </div>
        `;

        this.components.modal.openModal('settings-modal', 'Settings', settingsContent);

        // Setup settings event listeners
        document.getElementById('save-settings').addEventListener('click', () => {
            this.saveSettingsFromForm();
        });
    }

    saveSettingsFromForm() {
        // Update settings from form
        this.settings.theme = document.getElementById('theme-setting').value;
        this.settings.maxFileSize = parseInt(document.getElementById('max-file-size').value) * 1024 * 1024;
        this.settings.autoSave = document.getElementById('auto-save').checked;
        this.settings.analytics = document.getElementById('analytics').checked;
        this.settings.keyboardShortcuts = document.getElementById('keyboard-shortcuts').checked;
        this.settings.notifications = document.getElementById('notifications').checked;

        // Apply theme change
        if (this.settings.theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }

        // Save to localStorage
        this.saveSettings();

        this.components.modal.closeModal();
        this.components.notification.success('Settings saved successfully');
    }

    openHelp() {
        const helpContent = `
            <div class="help-content">
                <div class="help-section">
                    <h3>Getting Started</h3>
                    <p>Welcome to PDF Tools Suite! This application provides 20 essential PDF tools for all your document needs.</p>
                    <ul>
                        <li>Drag and drop files onto the page or click on any tool to get started</li>
                        <li>Use the search bar to quickly find specific tools</li>
                        <li>Filter tools by category using the tabs</li>
                    </ul>
                </div>
                
                <div class="help-section">
                    <h3>Keyboard Shortcuts</h3>
                    <div class="shortcuts-grid">
                        <div class="shortcut-item">
                            <kbd>Ctrl+O</kbd>
                            <span>Open files</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+S</kbd>
                            <span>Save work</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+N</kbd>
                            <span>New document</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+F</kbd>
                            <span>Focus search</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+H</kbd>
                            <span>Show help</span>
                        </div>
                        <div class="shortcut-item">
                            <kbd>Esc</kbd>
                            <span>Close modal</span>
                        </div>
                    </div>
                </div>
                
                <div class="help-section">
                    <h3>Supported Formats</h3>
                    <ul>
                        <li><strong>PDF:</strong> .pdf files up to ${this.settings.maxFileSize / (1024 * 1024)}MB</li>
                        <li><strong>Images:</strong> .jpg, .jpeg, .png, .gif, .bmp, .webp</li>
                        <li><strong>Documents:</strong> Limited support for text extraction</li>
                    </ul>
                </div>
                
                <div class="help-section">
                    <h3>Privacy & Security</h3>
                    <p>All processing is done locally in your browser. Your files are never uploaded to any server, ensuring complete privacy and security.</p>
                </div>
            </div>
        `;

        this.components.modal.openModal('help-modal', 'Help & Documentation', helpContent);
    }

    openFeedback() {
        const feedbackContent = `
            <div class="feedback-form">
                <div class="form-group">
                    <label for="feedback-type">Feedback Type:</label>
                    <select id="feedback-type" class="form-input">
                        <option value="bug">Bug Report</option>
                        <option value="feature">Feature Request</option>
                        <option value="improvement">Improvement Suggestion</option>
                        <option value="general">General Feedback</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="feedback-message">Message:</label>
                    <textarea id="feedback-message" class="form-input" rows="5" 
                              placeholder="Please describe your feedback in detail..."></textarea>
                </div>
                
                <div class="form-group">
                    <label class="form-checkbox">
                        <input type="checkbox" id="include-system-info">
                        <span>Include system information (helps with bug reports)</span>
                    </label>
                </div>
            </div>
            
            <div class="feedback-actions">
                <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                <button class="btn btn-primary" id="submit-feedback">Submit Feedback</button>
            </div>
        `;

        this.components.modal.openModal('feedback-modal', 'Send Feedback', feedbackContent);

        document.getElementById('submit-feedback').addEventListener('click', () => {
            this.submitFeedback();
        });
    }

    submitFeedback() {
        const type = document.getElementById('feedback-type').value;
        const message = document.getElementById('feedback-message').value;
        const includeSystemInfo = document.getElementById('include-system-info').checked;

        if (!message.trim()) {
            this.components.notification.error('Please enter a feedback message');
            return;
        }

        const feedback = {
            type,
            message,
            timestamp: new Date().toISOString(),
            version: this.version
        };

        if (includeSystemInfo) {
            feedback.systemInfo = {
                userAgent: navigator.userAgent,
                language: navigator.language,
                platform: navigator.platform,
                cookieEnabled: navigator.cookieEnabled,
                onLine: navigator.onLine
            };
        }

        // In a real application, you would send this to a server
        console.log('Feedback submitted:', feedback);
        
        this.components.modal.closeModal();
        this.components.notification.success('Thank you for your feedback!');
    }

    hasUnsavedChanges() {
        // Check if there are any unsaved changes
        return false; // Implement based on your needs
    }

    clearCurrentWork() {
        // Clear current work state
        LocalStorageManager.remove('current-work');
    }

    trackEvent(eventName, data = {}) {
        if (!this.settings.analytics) return;

        const event = {
            name: eventName,
            data,
            timestamp: new Date().toISOString(),
            sessionId: this.getSessionId()
        };

        // Store locally (in a real app, you might send to analytics service)
        const events = LocalStorageManager.get('analytics-events', []);
        events.push(event);
        
        // Keep only last 100 events
        if (events.length > 100) {
            events.splice(0, events.length - 100);
        }
        
        LocalStorageManager.set('analytics-events', events);
    }

    getSessionId() {
        let sessionId = LocalStorageManager.get('session-id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            LocalStorageManager.set('session-id', sessionId);
        }
        return sessionId;
    }

    handleInitializationError(error) {
        console.error('Failed to initialize PDF Tools Suite:', error);
        
        // Show error message to user
        const errorMessage = `
            <div class="error-message">
                <h3>Initialization Error</h3>
                <p>Failed to initialize the PDF Tools Suite. Please refresh the page and try again.</p>
                <p class="error-details">Error: ${error.message}</p>
                <button class="btn btn-primary" onclick="location.reload()">Refresh Page</button>
            </div>
        `;

        document.body.innerHTML = errorMessage;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add a small delay to ensure all scripts are fully loaded
    setTimeout(() => {
        try {
            window.pdfToolsApp = new PDFToolsApp();
        } catch (error) {
            console.error('Failed to initialize PDFToolsApp:', error);
            // Show error message to user
            const errorMessage = `
                <div class="error-message">
                    <h3>Initialization Error</h3>
                    <p>Failed to initialize the PDF Tools Suite. Please refresh the page and try again.</p>
                    <p class="error-details">Error: ${error.message}</p>
                    <button class="btn btn-primary" onclick="location.reload()">Refresh Page</button>
                </div>
            `;
            document.body.innerHTML = errorMessage;
        }
    }, 100); // 100ms delay
});

// Handle service worker registration for offline functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service Worker registered successfully');
            })
            .catch(error => {
                console.log('Service Worker registration failed');
            });
    });
}