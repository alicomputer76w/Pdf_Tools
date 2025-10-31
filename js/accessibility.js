/**
 * Accessibility Module for PDF Tools Suite
 * Provides comprehensive accessibility features including keyboard navigation,
 * screen reader support, focus management, and ARIA enhancements
 */

class AccessibilityManager {
    constructor() {
        this.focusableElements = [
            'a[href]',
            'button:not([disabled])',
            'input:not([disabled])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
            '[contenteditable="true"]'
        ].join(', ');
        
        this.keyboardShortcuts = new Map();
        this.focusHistory = [];
        this.announcements = [];
        
        this.init();
    }

    init() {
        this.setupKeyboardNavigation();
        this.setupFocusManagement();
        this.setupARIAEnhancements();
        this.setupScreenReaderSupport();
        this.setupKeyboardShortcuts();
        this.setupHighContrastMode();
        this.setupReducedMotion();
    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            this.handleGlobalKeydown(e);
        });

        // Tab trap for modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                const modal = document.querySelector('.modal.active');
                if (modal) {
                    this.trapFocus(e, modal);
                }
            }
        });

        // Arrow key navigation for tool grid
        document.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                const toolGrid = document.querySelector('.tools-grid');
                if (toolGrid && toolGrid.contains(document.activeElement)) {
                    this.handleGridNavigation(e, toolGrid);
                }
            }
        });
    }

    setupFocusManagement() {
        // Track focus changes
        document.addEventListener('focusin', (e) => {
            this.focusHistory.push({
                element: e.target,
                timestamp: Date.now()
            });
            
            // Limit history size
            if (this.focusHistory.length > 10) {
                this.focusHistory.shift();
            }
        });

        // Ensure visible focus indicators
        document.addEventListener('mousedown', () => {
            document.body.classList.add('using-mouse');
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                document.body.classList.remove('using-mouse');
            }
        });
    }

    setupARIAEnhancements() {
        // Add ARIA labels to elements that need them
        this.enhanceToolCards();
        this.enhanceFormElements();
        this.enhanceProgressIndicators();
        this.enhanceNotifications();
    }

    enhanceToolCards() {
        const toolCards = document.querySelectorAll('.tool-card');
        toolCards.forEach((card, index) => {
            const title = card.querySelector('.tool-title')?.textContent || 'Tool';
            const description = card.querySelector('.tool-description')?.textContent || '';
            
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-label', `${title}. ${description}. Press Enter or Space to open.`);
            card.setAttribute('aria-describedby', `tool-${index}-description`);
            
            // Add keyboard activation
            card.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    card.click();
                }
            });
        });
    }

    enhanceFormElements() {
        // Add proper labels and descriptions
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (!input.getAttribute('aria-label') && !input.getAttribute('aria-labelledby')) {
                const label = input.closest('.form-group')?.querySelector('label');
                if (label) {
                    const labelId = `label-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    label.id = labelId;
                    input.setAttribute('aria-labelledby', labelId);
                }
            }

            // Add error announcements
            if (input.hasAttribute('aria-invalid')) {
                const errorId = `error-${input.id || Date.now()}`;
                input.setAttribute('aria-describedby', errorId);
            }
        });
    }

    enhanceProgressIndicators() {
        const progressBars = document.querySelectorAll('.progress-bar, [role="progressbar"]');
        progressBars.forEach(bar => {
            if (!bar.hasAttribute('role')) {
                bar.setAttribute('role', 'progressbar');
            }
            bar.setAttribute('aria-live', 'polite');
            bar.setAttribute('aria-atomic', 'true');
        });
    }

    enhanceNotifications() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE && 
                        node.classList?.contains('notification')) {
                        this.enhanceNotification(node);
                    }
                });
            });
        });

        const notificationContainer = document.getElementById('notification-container');
        if (notificationContainer) {
            observer.observe(notificationContainer, { childList: true });
        }
    }

    enhanceNotification(notification) {
        notification.setAttribute('role', 'alert');
        notification.setAttribute('aria-live', 'assertive');
        notification.setAttribute('tabindex', '-1');
        
        // Focus notification for screen readers
        setTimeout(() => {
            notification.focus();
        }, 100);
    }

    setupScreenReaderSupport() {
        // Create live region for announcements
        this.createLiveRegion();
        
        // Announce page changes
        this.announcePageChanges();
        
        // Announce dynamic content changes
        this.announceDynamicChanges();
    }

    createLiveRegion() {
        const liveRegion = document.createElement('div');
        liveRegion.id = 'live-region';
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        document.body.appendChild(liveRegion);
    }

    announce(message, priority = 'polite') {
        const liveRegion = document.getElementById('live-region');
        if (!liveRegion) return;

        // Clear previous announcement
        liveRegion.textContent = '';
        
        // Set priority
        liveRegion.setAttribute('aria-live', priority);
        
        // Announce after a brief delay to ensure screen readers pick it up
        setTimeout(() => {
            liveRegion.textContent = message;
        }, 100);

        // Clear after announcement
        setTimeout(() => {
            liveRegion.textContent = '';
        }, 3000);
    }

    announcePageChanges() {
        // Announce when tools are opened
        document.addEventListener('click', (e) => {
            const toolCard = e.target.closest('.tool-card');
            if (toolCard) {
                const toolName = toolCard.querySelector('.tool-title')?.textContent;
                if (toolName) {
                    this.announce(`Opening ${toolName} tool`);
                }
            }
        });

        // Announce modal openings
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const modal = mutation.target;
                    if (modal.classList.contains('modal') && modal.classList.contains('active')) {
                        const title = modal.querySelector('.modal-title, #modal-title')?.textContent;
                        if (title) {
                            this.announce(`${title} dialog opened`);
                        }
                    }
                }
            });
        });

        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            observer.observe(modal, { attributes: true });
        });
    }

    announceDynamicChanges() {
        // Announce file uploads
        document.addEventListener('change', (e) => {
            if (e.target.type === 'file') {
                const fileCount = e.target.files.length;
                if (fileCount > 0) {
                    this.announce(`${fileCount} file${fileCount > 1 ? 's' : ''} selected`);
                }
            }
        });

        // Announce progress updates
        document.addEventListener('progress-update', (e) => {
            const { percentage, status } = e.detail;
            this.announce(`Progress: ${percentage}%. ${status}`);
        });
    }

    setupKeyboardShortcuts() {
        // Register default shortcuts
        this.registerShortcut('Escape', () => {
            this.closeActiveModal();
        });

        this.registerShortcut('Alt+H', () => {
            this.showHelp();
        });

        this.registerShortcut('Alt+S', () => {
            this.focusSearch();
        });

        this.registerShortcut('Alt+T', () => {
            this.toggleTheme();
        });

        this.registerShortcut('Alt+1', () => {
            this.focusFirstTool();
        });

        // Show shortcuts help
        this.registerShortcut('Alt+?', () => {
            this.showKeyboardShortcuts();
        });
    }

    registerShortcut(combination, callback, description = '') {
        this.keyboardShortcuts.set(combination.toLowerCase(), {
            callback,
            description
        });
    }

    handleGlobalKeydown(e) {
        const combination = this.getKeyCombination(e);
        const shortcut = this.keyboardShortcuts.get(combination);
        
        if (shortcut) {
            e.preventDefault();
            shortcut.callback(e);
        }
    }

    getKeyCombination(e) {
        const parts = [];
        
        if (e.ctrlKey) parts.push('ctrl');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        if (e.metaKey) parts.push('meta');
        
        parts.push(e.key.toLowerCase());
        
        return parts.join('+');
    }

    trapFocus(e, container) {
        const focusableElements = container.querySelectorAll(this.focusableElements);
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            }
        } else {
            if (document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    }

    handleGridNavigation(e, grid) {
        e.preventDefault();
        
        const items = Array.from(grid.querySelectorAll('.tool-card'));
        const currentIndex = items.indexOf(document.activeElement);
        const columns = this.getGridColumns(grid);
        
        let newIndex = currentIndex;
        
        switch (e.key) {
            case 'ArrowRight':
                newIndex = Math.min(currentIndex + 1, items.length - 1);
                break;
            case 'ArrowLeft':
                newIndex = Math.max(currentIndex - 1, 0);
                break;
            case 'ArrowDown':
                newIndex = Math.min(currentIndex + columns, items.length - 1);
                break;
            case 'ArrowUp':
                newIndex = Math.max(currentIndex - columns, 0);
                break;
        }
        
        if (newIndex !== currentIndex && items[newIndex]) {
            items[newIndex].focus();
        }
    }

    getGridColumns(grid) {
        const style = window.getComputedStyle(grid);
        const columns = style.gridTemplateColumns;
        return columns ? columns.split(' ').length : 3; // Default to 3 columns
    }

    setupHighContrastMode() {
        // Detect high contrast mode
        const mediaQuery = window.matchMedia('(prefers-contrast: high)');
        
        const handleContrastChange = (e) => {
            document.body.classList.toggle('high-contrast', e.matches);
        };
        
        mediaQuery.addListener(handleContrastChange);
        handleContrastChange(mediaQuery);
    }

    setupReducedMotion() {
        // Respect reduced motion preference
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        
        const handleMotionChange = (e) => {
            document.body.classList.toggle('reduced-motion', e.matches);
        };
        
        mediaQuery.addListener(handleMotionChange);
        handleMotionChange(mediaQuery);
    }

    // Shortcut action methods
    closeActiveModal() {
        const activeModal = document.querySelector('.modal.active');
        if (activeModal) {
            const closeBtn = activeModal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.click();
            }
        }
    }

    showHelp() {
        // Trigger help modal
        const helpBtn = document.querySelector('[data-action="help"]');
        if (helpBtn) {
            helpBtn.click();
        }
    }

    focusSearch() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.focus();
        }
    }

    toggleTheme() {
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.click();
        }
    }

    focusFirstTool() {
        const firstTool = document.querySelector('.tool-card');
        if (firstTool) {
            firstTool.focus();
        }
    }

    showKeyboardShortcuts() {
        const shortcuts = Array.from(this.keyboardShortcuts.entries())
            .filter(([, shortcut]) => shortcut.description)
            .map(([combination, shortcut]) => 
                `${combination.toUpperCase()}: ${shortcut.description}`
            )
            .join('\n');

        if (window.modalManager) {
            modalManager.openModal('Keyboard Shortcuts', `
                <div class="shortcuts-list">
                    <h3>Available Keyboard Shortcuts</h3>
                    <ul>
                        <li><kbd>Escape</kbd> - Close active modal</li>
                        <li><kbd>Alt + H</kbd> - Show help</li>
                        <li><kbd>Alt + S</kbd> - Focus search</li>
                        <li><kbd>Alt + T</kbd> - Toggle theme</li>
                        <li><kbd>Alt + 1</kbd> - Focus first tool</li>
                        <li><kbd>Tab</kbd> - Navigate between elements</li>
                        <li><kbd>Arrow Keys</kbd> - Navigate tool grid</li>
                        <li><kbd>Enter/Space</kbd> - Activate buttons and tools</li>
                    </ul>
                </div>
            `);
        }
    }

    // Public API methods
    setFocus(element) {
        if (element && typeof element.focus === 'function') {
            element.focus();
        }
    }

    restoreFocus() {
        if (this.focusHistory.length > 1) {
            const previousFocus = this.focusHistory[this.focusHistory.length - 2];
            if (previousFocus && previousFocus.element) {
                this.setFocus(previousFocus.element);
            }
        }
    }

    addSkipLink(target, text = 'Skip to main content') {
        const skipLink = document.createElement('a');
        skipLink.href = `#${target}`;
        skipLink.textContent = text;
        skipLink.className = 'skip-link';
        skipLink.addEventListener('click', (e) => {
            e.preventDefault();
            const targetElement = document.getElementById(target);
            if (targetElement) {
                targetElement.focus();
                targetElement.scrollIntoView();
            }
        });
        
        document.body.insertBefore(skipLink, document.body.firstChild);
    }
}

// Initialize accessibility manager
document.addEventListener('DOMContentLoaded', () => {
    window.accessibilityManager = new AccessibilityManager();
    
    // Add skip links
    accessibilityManager.addSkipLink('main-content', 'Skip to main content');
    accessibilityManager.addSkipLink('tools-grid', 'Skip to tools');
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AccessibilityManager;
}