/**
 * PDF Tools Suite - Utility Functions
 * Provides common utility functions for file handling, validation, and processing
 */

// File size limits (in bytes)
const FILE_SIZE_LIMITS = {
    PDF: 50 * 1024 * 1024, // 50MB
    IMAGE: 10 * 1024 * 1024, // 10MB
    TOTAL: 100 * 1024 * 1024 // 100MB total
};

// Supported file types
const SUPPORTED_TYPES = {
    PDF: ['application/pdf', '.pdf'],
    IMAGE: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff'],
    DOCUMENT: ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.doc', '.docx']
};

/**
 * History Management Utilities
 */
class HistoryManager {
    static add(action, filename) {
        try {
            const history = JSON.parse(localStorage.getItem('pdf_tools_history') || '[]');
            const newItem = {
                action,
                filename,
                date: new Date().toISOString(),
                id: Date.now().toString()
            };
            // Add to beginning
            history.unshift(newItem);
            // Keep last 5
            if (history.length > 5) history.pop();
            localStorage.setItem('pdf_tools_history', JSON.stringify(history));
            
            // Dispatch event for UI updates
            window.dispatchEvent(new CustomEvent('historyUpdated'));
        } catch (e) {
            console.error('Failed to save history', e);
        }
    }

    static get() {
        try {
            return JSON.parse(localStorage.getItem('pdf_tools_history') || '[]');
        } catch (e) {
            return [];
        }
    }
}

/**
 * File Validation Utilities
 */
class FileValidator {
    /**
     * Validate file type
     * @param {File} file - File to validate
     * @param {Array} allowedTypes - Array of allowed MIME types or extensions
     * @returns {boolean} - True if valid
     */
    static validateFileType(file, allowedTypes) {
        const fileName = file.name.toLowerCase();
        const fileType = file.type.toLowerCase();
        
        return allowedTypes.some(type => {
            if (type.startsWith('.')) {
                return fileName.endsWith(type);
            }
            return fileType === type;
        });
    }

    /**
     * Validate file size
     * @param {File} file - File to validate
     * @param {number} maxSize - Maximum size in bytes
     * @returns {boolean} - True if valid
     */
    static validateFileSize(file, maxSize) {
        return file.size <= maxSize;
    }

    /**
     * Validate PDF file
     * @param {File} file - File to validate
     * @returns {Object} - Validation result
     */
    static validatePDF(file) {
        const result = {
            valid: true,
            errors: []
        };

        if (!this.validateFileType(file, SUPPORTED_TYPES.PDF)) {
            result.valid = false;
            result.errors.push('Invalid file type. Please select a PDF file.');
        }

        if (!this.validateFileSize(file, FILE_SIZE_LIMITS.PDF)) {
            result.valid = false;
            result.errors.push(`File size exceeds ${this.formatFileSize(FILE_SIZE_LIMITS.PDF)} limit.`);
        }

        return result;
    }

    /**
     * Validate image file
     * @param {File} file - File to validate
     * @returns {Object} - Validation result
     */
    static validateImage(file) {
        const result = {
            valid: true,
            errors: []
        };

        if (!this.validateFileType(file, SUPPORTED_TYPES.IMAGE)) {
            result.valid = false;
            result.errors.push('Invalid file type. Please select an image file.');
        }

        if (!this.validateFileSize(file, FILE_SIZE_LIMITS.IMAGE)) {
            result.valid = false;
            result.errors.push(`File size exceeds ${this.formatFileSize(FILE_SIZE_LIMITS.IMAGE)} limit.`);
        }

        return result;
    }

    /**
     * Format file size for display
     * @param {number} bytes - Size in bytes
     * @returns {string} - Formatted size
     */
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

/**
 * PDF Processing Utilities
 */
class PDFUtils {
    /**
     * Load PDF document
     * @param {File|ArrayBuffer} source - PDF source
     * @returns {Promise<PDFLib.PDFDocument>} - PDF document
     */
    static async loadPDF(source) {
        try {
            let arrayBuffer;
            
            if (source instanceof File) {
                arrayBuffer = await source.arrayBuffer();
            } else if (source instanceof ArrayBuffer) {
                arrayBuffer = source;
            } else {
                throw new Error('Invalid PDF source');
            }

            return await window.PDFLib.PDFDocument.load(arrayBuffer);
        } catch (error) {
            throw new Error(`Failed to load PDF: ${error.message}`);
        }
    }

    /**
     * Create new PDF document
     * @returns {PDFLib.PDFDocument} - New PDF document
     */
    static createPDF() {
        return window.PDFLib.PDFDocument.create();
    }

    /**
     * Get PDF page count
     * @param {PDFLib.PDFDocument} pdfDoc - PDF document
     * @returns {number} - Number of pages
     */
    static getPageCount(pdfDoc) {
        return pdfDoc.getPageCount();
    }

    /**
     * Extract pages from PDF
     * @param {PDFLib.PDFDocument} sourcePdf - Source PDF
     * @param {Array<number>} pageNumbers - Page numbers to extract (0-based)
     * @returns {Promise<PDFLib.PDFDocument>} - New PDF with extracted pages
     */
    static async extractPages(sourcePdf, pageNumbers) {
        // PDFLib.PDFDocument.create() returns a Promise, so we must await it
        const newPdf = await window.PDFLib.PDFDocument.create();
        const pages = await newPdf.copyPages(sourcePdf, pageNumbers);
        
        pages.forEach(page => newPdf.addPage(page));
        
        return newPdf;
    }

    /**
     * Merge multiple PDFs
     * @param {Array<PDFLib.PDFDocument>} pdfDocs - Array of PDF documents
     * @returns {Promise<PDFLib.PDFDocument>} - Merged PDF
     */
    static async mergePDFs(pdfDocs) {
        // PDFLib.PDFDocument.create() returns a Promise, so we must await it
        const mergedPdf = await window.PDFLib.PDFDocument.create();
        
        for (const pdfDoc of pdfDocs) {
            const pageCount = pdfDoc.getPageCount();
            const pageIndices = Array.from({length: pageCount}, (_, i) => i);
            const pages = await mergedPdf.copyPages(pdfDoc, pageIndices);
            
            pages.forEach(page => mergedPdf.addPage(page));
        }
        
        return mergedPdf;
    }

    /**
     * Rotate PDF pages
     * @param {PDFLib.PDFDocument} pdfDoc - PDF document
     * @param {number} rotation - Rotation angle (90, 180, 270)
     * @param {Array<number>} pageIndices - Page indices to rotate (optional, all if not provided)
     * @returns {PDFLib.PDFDocument} - PDF with rotated pages
     */
    static rotatePDF(pdfDoc, rotation, pageIndices = null) {
        const pages = pdfDoc.getPages();
        const indicesToRotate = pageIndices || Array.from({length: pages.length}, (_, i) => i);
        
        indicesToRotate.forEach(index => {
            if (index >= 0 && index < pages.length) {
                pages[index].setRotation(window.PDFLib.degrees(rotation));
            }
        });
        
        return pdfDoc;
    }

    /**
     * Save PDF to bytes
     * @param {PDFLib.PDFDocument} pdfDoc - PDF document
     * @returns {Promise<Uint8Array>} - PDF bytes
     */
    static async savePDF(pdfDoc) {
        return await pdfDoc.save();
    }
}

/**
 * Image Processing Utilities
 */
class ImageUtils {
    /**
     * Load image from file
     * @param {File} file - Image file
     * @returns {Promise<HTMLImageElement>} - Image element
     */
    static loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Failed to load image'));
            };
            
            img.src = url;
        });
    }

    /**
     * Convert image to canvas
     * @param {HTMLImageElement} img - Image element
     * @param {number} maxWidth - Maximum width
     * @param {number} maxHeight - Maximum height
     * @returns {HTMLCanvasElement} - Canvas element
     */
    static imageToCanvas(img, maxWidth = null, maxHeight = null) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let { width, height } = img;
        
        // Resize if needed
        if (maxWidth && width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }
        
        if (maxHeight && height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx.drawImage(img, 0, 0, width, height);
        
        return canvas;
    }

    /**
     * Convert canvas to blob
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {string} type - MIME type
     * @param {number} quality - Quality (0-1)
     * @returns {Promise<Blob>} - Image blob
     */
    static canvasToBlob(canvas, type = 'image/jpeg', quality = 0.9) {
        return new Promise(resolve => {
            canvas.toBlob(resolve, type, quality);
        });
    }

    /**
     * Resize image
     * @param {File} file - Image file
     * @param {number} maxWidth - Maximum width
     * @param {number} maxHeight - Maximum height
     * @param {number} quality - Quality (0-1)
     * @returns {Promise<Blob>} - Resized image blob
     */
    static async resizeImage(file, maxWidth, maxHeight, quality = 0.9) {
        const img = await this.loadImage(file);
        const canvas = this.imageToCanvas(img, maxWidth, maxHeight);
        return await this.canvasToBlob(canvas, file.type, quality);
    }
}

/**
 * Download Utilities
 */
class DownloadUtils {
    /**
     * Download file from blob
     * @param {Blob} blob - File blob
     * @param {string} filename - File name
     */
    static downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Download PDF
     * @param {Uint8Array} pdfBytes - PDF bytes
     * @param {string} filename - File name
     */
    static downloadPDF(pdfBytes, filename) {
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        this.downloadBlob(blob, filename);
    }

    /**
     * Download image
     * @param {Blob} imageBlob - Image blob
     * @param {string} filename - File name
     */
    static downloadImage(imageBlob, filename) {
        this.downloadBlob(imageBlob, filename);
    }

    /**
     * Download text file
     * @param {string} text - Text content
     * @param {string} filename - File name
     */
    static downloadText(text, filename) {
        const blob = new Blob([text], { type: 'text/plain' });
        this.downloadBlob(blob, filename);
    }
}

/**
 * Storage Utilities
 */
class StorageUtils {
    /**
     * Save to localStorage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     */
    static save(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
        }
    }

    /**
     * Load from localStorage
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if not found
     * @returns {*} - Stored value or default
     */
    static load(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            // Gracefully handle legacy non-JSON values (e.g., 'light', 'dark')
            try {
                return JSON.parse(item);
            } catch (parseError) {
                // If parsing fails, return the raw string value
                return item;
            }
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
            return defaultValue;
        }
    }

    /**
     * Remove from localStorage
     * @param {string} key - Storage key
     */
    static remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn('Failed to remove from localStorage:', error);
        }
    }

    /**
     * Clear all localStorage
     */
    static clear() {
        try {
            localStorage.clear();
        } catch (error) {
            console.warn('Failed to clear localStorage:', error);
        }
    }
}

/**
 * LocalStorage Management Utilities
 */
class LocalStorageManager {
    /**
     * Get item from localStorage with fallback
     * @param {string} key - Storage key
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} - Stored value or default
     */
    static get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            try {
                return JSON.parse(item);
            } catch (parseError) {
                // Fallback to raw string when legacy non-JSON values are stored
                return item;
            }
        } catch (error) {
            console.warn(`Failed to get localStorage item "${key}":`, error);
            return defaultValue;
        }
    }

    /**
     * Set item in localStorage
     * @param {string} key - Storage key
     * @param {*} value - Value to store
     * @returns {boolean} - Success status
     */
    static set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn(`Failed to set localStorage item "${key}":`, error);
            return false;
        }
    }

    /**
     * Remove item from localStorage
     * @param {string} key - Storage key
     * @returns {boolean} - Success status
     */
    static remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn(`Failed to remove localStorage item "${key}":`, error);
            return false;
        }
    }

    /**
     * Clear all localStorage items
     * @returns {boolean} - Success status
     */
    static clear() {
        try {
            localStorage.clear();
            return true;
        } catch (error) {
            console.warn('Failed to clear localStorage:', error);
            return false;
        }
    }
}

/**
 * Performance Utilities
 */
class PerformanceUtils {
    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} - Debounced function
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} - Throttled function
     */
    static throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Measure execution time
     * @param {Function} func - Function to measure
     * @param {string} label - Label for measurement
     * @returns {*} - Function result
     */
    static async measureTime(func, label = 'Operation') {
        const start = performance.now();
        const result = await func();
        const end = performance.now();
        console.log(`${label} took ${(end - start).toFixed(2)} milliseconds`);
        return result;
    }
}

// Export utilities to global scope
window.FileValidator = FileValidator;
window.PDFUtils = PDFUtils;
window.ImageUtils = ImageUtils;
window.DownloadUtils = DownloadUtils;
window.StorageUtils = StorageUtils;
window.LocalStorageManager = LocalStorageManager;
window.PerformanceUtils = PerformanceUtils;
window.FILE_SIZE_LIMITS = FILE_SIZE_LIMITS;
window.SUPPORTED_TYPES = SUPPORTED_TYPES;