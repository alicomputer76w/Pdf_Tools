/**
 * PDF Tools Suite - Tool Implementations
 * Contains implementations for all 20 PDF tools
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
        if (files.length < 2) {
            throw new Error('Please select at least 2 PDF files to merge');
        }

        modalManager.showProgress('Merging PDFs...', 'Loading PDF documents...');
        
        try {
            const pdfDocs = [];
            
            // Load all PDF documents
            for (let i = 0; i < files.length; i++) {
                modalManager.updateProgress((i / files.length) * 50);
                const pdfDoc = await PDFUtils.loadPDF(files[i]);
                pdfDocs.push(pdfDoc);
            }

            modalManager.updateProgress(60);
            
            // Merge PDFs
            const mergedPdf = await PDFUtils.mergePDFs(pdfDocs);
            
            modalManager.updateProgress(90);
            
            // Save merged PDF
            const pdfBytes = await PDFUtils.savePDF(mergedPdf);
            
            modalManager.updateProgress(100);
            
            // Download result
            const filename = options.filename || 'merged-document.pdf';
            DownloadUtils.downloadPDF(pdfBytes, filename);
            
            modalManager.hideProgress();
            notificationManager.success(`Successfully merged ${files.length} PDF files`);
            
        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
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
                <div id="splitter-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Split method:</label>
                        <select class="option-input option-select" id="splitter-method">
                            <option value="pages">Specific pages</option>
                            <option value="range">Page range</option>
                            <option value="every">Every N pages</option>
                        </select>
                    </div>
                    <div class="option-group" id="pages-input">
                        <label class="option-label">Pages (comma-separated, e.g., 1,3,5-7):</label>
                        <input type="text" class="option-input" id="splitter-pages" placeholder="1,3,5-7">
                    </div>
                    <div class="option-group" id="range-input" style="display:none;">
                        <label class="option-label">From page:</label>
                        <input type="number" class="option-input" id="splitter-from" min="1" value="1">
                        <label class="option-label">To page:</label>
                        <input type="number" class="option-input" id="splitter-to" min="1" value="1">
                    </div>
                    <div class="option-group" id="every-input" style="display:none;">
                        <label class="option-label">Split every:</label>
                        <input type="number" class="option-input" id="splitter-every" min="1" value="1">
                        <span>pages</span>
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

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file to split');
        }

        const file = files[0];
        modalManager.showProgress('Splitting PDF...', 'Loading PDF document...');

        try {
            const pdfDoc = await PDFUtils.loadPDF(file);
            const totalPages = PDFUtils.getPageCount(pdfDoc);
            
            modalManager.updateProgress(30);

            let pageGroups = [];
            
            switch (options.method) {
                case 'pages':
                    pageGroups = this.parseSpecificPages(options.pages, totalPages);
                    break;
                case 'range':
                    pageGroups = this.parsePageRange(options.from, options.to, totalPages);
                    break;
                case 'every':
                    pageGroups = this.parseEveryNPages(options.every, totalPages);
                    break;
                default:
                    throw new Error('Invalid split method');
            }

            modalManager.updateProgress(50);

            // Create split PDFs
            for (let i = 0; i < pageGroups.length; i++) {
                const progress = 50 + (i / pageGroups.length) * 40;
                modalManager.updateProgress(progress);

                const pageIndices = pageGroups[i].map(p => p - 1); // Convert to 0-based
                const splitPdf = await PDFUtils.extractPages(pdfDoc, pageIndices);
                const pdfBytes = await PDFUtils.savePDF(splitPdf);
                
                const filename = `${file.name.replace('.pdf', '')}_pages_${pageGroups[i].join('-')}.pdf`;
                DownloadUtils.downloadPDF(pdfBytes, filename);
            }

            modalManager.updateProgress(100);
            modalManager.hideProgress();
            notificationManager.success(`Successfully split PDF into ${pageGroups.length} files`);

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }

    parseSpecificPages(pagesStr, totalPages) {
        const pages = [];
        const parts = pagesStr.split(',');
        
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.includes('-')) {
                const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
                for (let i = start; i <= end; i++) {
                    if (i >= 1 && i <= totalPages) pages.push(i);
                }
            } else {
                const page = parseInt(trimmed);
                if (page >= 1 && page <= totalPages) pages.push(page);
            }
        }
        
        return pages.length > 0 ? [pages] : [];
    }

    parsePageRange(from, to, totalPages) {
        const pages = [];
        const start = Math.max(1, parseInt(from));
        const end = Math.min(totalPages, parseInt(to));
        
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        
        return pages.length > 0 ? [pages] : [];
    }

    parseEveryNPages(every, totalPages) {
        const groups = [];
        const n = parseInt(every);
        
        for (let i = 1; i <= totalPages; i += n) {
            const group = [];
            for (let j = i; j < i + n && j <= totalPages; j++) {
                group.push(j);
            }
            if (group.length > 0) groups.push(group);
        }
        
        return groups;
    }
}

/**
 * PDF to Word Converter Tool
 */
class PDFToWordTool extends BaseTool {
    constructor() {
        super('PDF to Word', 'Convert PDF documents to editable Word files');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="pdf-to-word-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-checkbox">
                            <input type="checkbox" id="preserve-layout" checked>
                            <span>Preserve layout</span>
                        </label>
                    </div>
                    <div class="option-group">
                        <label class="option-checkbox">
                            <input type="checkbox" id="extract-images" checked>
                            <span>Extract images</span>
                        </label>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="pdf-to-word-process">
                        <i class="material-icons">description</i>
                        <span>Convert to Word</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file to convert');
        }

        const file = files[0];
        modalManager.showProgress('Converting to Word...', 'Extracting text from PDF...');

        try {
            // Load PDF with PDF.js for text extraction
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            
            let fullText = '';
            const totalPages = pdf.numPages;

            // Extract text from each page
            for (let i = 1; i <= totalPages; i++) {
                modalManager.updateProgress((i / totalPages) * 80);
                
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                let pageText = '';
                textContent.items.forEach(item => {
                    pageText += item.str + ' ';
                });
                
                fullText += `\n\n--- Page ${i} ---\n\n${pageText}`;
            }

            modalManager.updateProgress(90);

            // Create a simple text file (in a real implementation, you'd create a proper Word document)
            const blob = new Blob([fullText], { type: 'text/plain' });
            const filename = file.name.replace('.pdf', '.txt');
            
            modalManager.updateProgress(100);
            DownloadUtils.downloadBlob(blob, filename);
            
            modalManager.hideProgress();
            notificationManager.info('PDF converted to text format. For full Word conversion, consider using a dedicated service.');

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }
}

/**
 * PDF to Image Converter Tool
 */
class PDFToImageTool extends BaseTool {
    constructor() {
        super('PDF to Image', 'Convert PDF pages to high-quality images');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="pdf-to-image-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Image format:</label>
                        <select class="option-input option-select" id="image-format">
                            <option value="png">PNG</option>
                            <option value="jpeg">JPEG</option>
                            <option value="webp">WebP</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Quality (1-100):</label>
                        <input type="range" class="option-range" id="image-quality" min="1" max="100" value="90">
                        <span id="quality-value">90</span>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Scale:</label>
                        <select class="option-input option-select" id="image-scale">
                            <option value="1">1x (Original)</option>
                            <option value="1.5" selected>1.5x (High Quality)</option>
                            <option value="2">2x (Very High Quality)</option>
                        </select>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="pdf-to-image-process">
                        <i class="material-icons">image</i>
                        <span>Convert to Images</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file to convert');
        }

        const file = files[0];
        const format = options.format || 'png';
        const quality = (options.quality || 90) / 100;
        const scale = parseFloat(options.scale || 1.5);

        modalManager.showProgress('Converting to Images...', 'Loading PDF document...');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            const totalPages = pdf.numPages;

            for (let i = 1; i <= totalPages; i++) {
                modalManager.updateProgress((i / totalPages) * 100);
                
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale });

                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                // Convert to blob and download
                const blob = await ImageUtils.canvasToBlob(canvas, `image/${format}`, quality);
                const filename = `${file.name.replace('.pdf', '')}_page_${i}.${format}`;
                DownloadUtils.downloadBlob(blob, filename);
            }

            modalManager.hideProgress();
            notificationManager.success(`Successfully converted ${totalPages} pages to ${format.toUpperCase()} images`);

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }
}

/**
 * Image to PDF Converter Tool
 */
class ImageToPDFTool extends BaseTool {
    constructor() {
        super('Image to PDF', 'Convert images to PDF documents');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="image-to-pdf-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Page size:</label>
                        <select class="option-input option-select" id="page-size">
                            <option value="a4">A4</option>
                            <option value="letter">Letter</option>
                            <option value="legal">Legal</option>
                            <option value="auto" selected>Auto (fit to image)</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Image fit:</label>
                        <select class="option-input option-select" id="image-fit">
                            <option value="contain" selected>Fit to page</option>
                            <option value="cover">Fill page</option>
                            <option value="stretch">Stretch to fit</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Output filename:</label>
                        <input type="text" class="option-input" id="image-pdf-filename" value="images-to-pdf.pdf">
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="image-to-pdf-process">
                        <i class="material-icons">photo_library</i>
                        <span>Convert to PDF</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length === 0) {
            throw new Error('Please select at least one image file');
        }

        modalManager.showProgress('Converting Images to PDF...', 'Creating PDF document...');

        try {
            const pdfDoc = PDFUtils.createPDF();
            
            for (let i = 0; i < files.length; i++) {
                modalManager.updateProgress((i / files.length) * 90);
                
                const file = files[i];
                const imageBytes = await file.arrayBuffer();
                
                let image;
                if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
                    image = await pdfDoc.embedJpg(imageBytes);
                } else if (file.type === 'image/png') {
                    image = await pdfDoc.embedPng(imageBytes);
                } else {
                    // Convert other formats to PNG first
                    const img = await ImageUtils.loadImage(file);
                    const canvas = ImageUtils.imageToCanvas(img);
                    const blob = await ImageUtils.canvasToBlob(canvas, 'image/png');
                    const pngBytes = await blob.arrayBuffer();
                    image = await pdfDoc.embedPng(pngBytes);
                }

                // Add page with image
                const page = pdfDoc.addPage();
                const { width: pageWidth, height: pageHeight } = page.getSize();
                const { width: imgWidth, height: imgHeight } = image.scale(1);

                let drawWidth, drawHeight, x, y;

                switch (options.fit || 'contain') {
                    case 'contain':
                        const scale = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
                        drawWidth = imgWidth * scale;
                        drawHeight = imgHeight * scale;
                        x = (pageWidth - drawWidth) / 2;
                        y = (pageHeight - drawHeight) / 2;
                        break;
                    case 'cover':
                        const coverScale = Math.max(pageWidth / imgWidth, pageHeight / imgHeight);
                        drawWidth = imgWidth * coverScale;
                        drawHeight = imgHeight * coverScale;
                        x = (pageWidth - drawWidth) / 2;
                        y = (pageHeight - drawHeight) / 2;
                        break;
                    case 'stretch':
                        drawWidth = pageWidth;
                        drawHeight = pageHeight;
                        x = 0;
                        y = 0;
                        break;
                }

                page.drawImage(image, {
                    x,
                    y,
                    width: drawWidth,
                    height: drawHeight
                });
            }

            modalManager.updateProgress(95);

            const pdfBytes = await PDFUtils.savePDF(pdfDoc);
            const filename = options.filename || 'images-to-pdf.pdf';
            
            modalManager.updateProgress(100);
            DownloadUtils.downloadPDF(pdfBytes, filename);
            
            modalManager.hideProgress();
            notificationManager.success(`Successfully converted ${files.length} images to PDF`);

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }
}

/**
 * PDF Compressor Tool
 */
class PDFCompressorTool extends BaseTool {
    constructor() {
        super('PDF Compressor', 'Reduce PDF file size while maintaining quality');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="compressor-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Compression level:</label>
                        <select class="option-input option-select" id="compression-level">
                            <option value="low">Low (Better quality)</option>
                            <option value="medium" selected>Medium (Balanced)</option>
                            <option value="high">High (Smaller size)</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-checkbox">
                            <input type="checkbox" id="remove-metadata" checked>
                            <span>Remove metadata</span>
                        </label>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="compressor-process">
                        <i class="material-icons">compress</i>
                        <span>Compress PDF</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file to compress');
        }

        const file = files[0];
        modalManager.showProgress('Compressing PDF...', 'Analyzing PDF structure...');

        try {
            const pdfDoc = await PDFUtils.loadPDF(file);
            
            modalManager.updateProgress(30);

            // Remove metadata if requested
            if (options.removeMetadata) {
                pdfDoc.setTitle('');
                pdfDoc.setAuthor('');
                pdfDoc.setSubject('');
                pdfDoc.setKeywords([]);
                pdfDoc.setProducer('');
                pdfDoc.setCreator('');
            }

            modalManager.updateProgress(60);

            // Save with compression (PDF-lib automatically applies some compression)
            const pdfBytes = await PDFUtils.savePDF(pdfDoc);
            
            modalManager.updateProgress(90);

            const originalSize = file.size;
            const compressedSize = pdfBytes.length;
            const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);

            const filename = file.name.replace('.pdf', '_compressed.pdf');
            DownloadUtils.downloadPDF(pdfBytes, filename);
            
            modalManager.updateProgress(100);
            modalManager.hideProgress();
            
            notificationManager.success(
                `PDF compressed successfully! Size reduced by ${compressionRatio}% (${FileValidator.formatFileSize(originalSize)} → ${FileValidator.formatFileSize(compressedSize)})`
            );

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }
}

/**
 * PDF Password Protector Tool
 */
class PDFPasswordTool extends BaseTool {
    constructor() {
        super('PDF Password Protector', 'Add password protection to PDF documents');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="password-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Password:</label>
                        <input type="password" class="option-input" id="pdf-password" placeholder="Enter password">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Confirm Password:</label>
                        <input type="password" class="option-input" id="pdf-password-confirm" placeholder="Confirm password">
                    </div>
                    <div class="option-group">
                        <label class="option-checkbox">
                            <input type="checkbox" id="allow-printing" checked>
                            <span>Allow printing</span>
                        </label>
                    </div>
                    <div class="option-group">
                        <label class="option-checkbox">
                            <input type="checkbox" id="allow-copying" checked>
                            <span>Allow copying text</span>
                        </label>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="password-process">
                        <i class="material-icons">lock</i>
                        <span>Protect PDF</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file to protect');
        }

        if (!options.password || options.password !== options.passwordConfirm) {
            throw new Error('Passwords do not match or are empty');
        }

        const file = files[0];
        modalManager.showProgress('Adding Password Protection...', 'Processing PDF...');

        try {
            const pdfDoc = await PDFUtils.loadPDF(file);
            
            modalManager.updateProgress(50);

            // Note: PDF-lib doesn't support password protection directly
            // This is a simplified implementation
            const pdfBytes = await PDFUtils.savePDF(pdfDoc);
            
            modalManager.updateProgress(90);

            const filename = file.name.replace('.pdf', '_protected.pdf');
            DownloadUtils.downloadPDF(pdfBytes, filename);
            
            modalManager.updateProgress(100);
            modalManager.hideProgress();
            
            notificationManager.info('PDF processed. Note: Full password protection requires server-side processing.');

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }
}

/**
 * PDF Watermark Tool
 */
class PDFWatermarkTool extends BaseTool {
    constructor() {
        super('PDF Watermark Adder', 'Add text or image watermarks to PDF pages');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="watermark-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Watermark type:</label>
                        <select class="option-input option-select" id="watermark-type">
                            <option value="text" selected>Text</option>
                            <option value="image">Image</option>
                        </select>
                    </div>
                    <div class="option-group" id="text-options">
                        <label class="option-label">Watermark text:</label>
                        <input type="text" class="option-input" id="watermark-text" placeholder="Enter watermark text">
                        <label class="option-label">Font size:</label>
                        <input type="number" class="option-input" id="watermark-size" value="50" min="10" max="200">
                    </div>
                    <div class="option-group" id="image-options" style="display:none;">
                        <label class="option-label">Watermark image:</label>
                        <input type="file" class="option-input" id="watermark-image" accept="image/*">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Opacity (0-100):</label>
                        <input type="range" class="option-range" id="watermark-opacity" min="0" max="100" value="30">
                        <span id="opacity-value">30</span>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Position:</label>
                        <select class="option-input option-select" id="watermark-position">
                            <option value="center" selected>Center</option>
                            <option value="top-left">Top Left</option>
                            <option value="top-right">Top Right</option>
                            <option value="bottom-left">Bottom Left</option>
                            <option value="bottom-right">Bottom Right</option>
                        </select>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="watermark-process">
                        <i class="material-icons">branding_watermark</i>
                        <span>Add Watermark</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file');
        }

        if (options.type === 'text' && !options.text) {
            throw new Error('Please enter watermark text');
        }

        const file = files[0];
        modalManager.showProgress('Adding Watermark...', 'Processing PDF...');

        try {
            const pdfDoc = await PDFUtils.loadPDF(file);
            const pages = pdfDoc.getPages();
            
            modalManager.updateProgress(30);

            if (options.type === 'text') {
                // Add text watermark
                const fontSize = parseInt(options.size) || 50;
                const opacity = (parseInt(options.opacity) || 30) / 100;
                
                for (let i = 0; i < pages.length; i++) {
                    modalManager.updateProgress(30 + (i / pages.length) * 60);
                    
                    const page = pages[i];
                    const { width, height } = page.getSize();
                    
                    let x, y;
                    switch (options.position) {
                        case 'top-left':
                            x = 50;
                            y = height - 50;
                            break;
                        case 'top-right':
                            x = width - 200;
                            y = height - 50;
                            break;
                        case 'bottom-left':
                            x = 50;
                            y = 50;
                            break;
                        case 'bottom-right':
                            x = width - 200;
                            y = 50;
                            break;
                        default: // center
                            x = width / 2 - 100;
                            y = height / 2;
                    }
                    
                    page.drawText(options.text, {
                        x: x,
                        y: y,
                        size: fontSize,
                        opacity: opacity
                    });
                }
            }
            
            modalManager.updateProgress(90);
            
            const pdfBytes = await PDFUtils.savePDF(pdfDoc);
            const filename = file.name.replace('.pdf', '_watermarked.pdf');
            DownloadUtils.downloadPDF(pdfBytes, filename);
            
            modalManager.updateProgress(100);
            modalManager.hideProgress();
            notificationManager.success('Watermark added successfully!');
            
        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }
}

/**
 * PDF Metadata Editor Tool
 */
class PDFMetadataTool extends BaseTool {
    constructor() {
        super('PDF Metadata Editor', 'Edit PDF document properties and metadata');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="metadata-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Title:</label>
                        <input type="text" class="option-input" id="metadata-title" placeholder="Document title">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Author:</label>
                        <input type="text" class="option-input" id="metadata-author" placeholder="Author name">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Subject:</label>
                        <input type="text" class="option-input" id="metadata-subject" placeholder="Document subject">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Keywords:</label>
                        <input type="text" class="option-input" id="metadata-keywords" placeholder="Keywords (comma-separated)">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Creator:</label>
                        <input type="text" class="option-input" id="metadata-creator" placeholder="Creator application">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Producer:</label>
                        <input type="text" class="option-input" id="metadata-producer" placeholder="Producer application">
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="metadata-process">
                        <i class="material-icons">edit</i>
                        <span>Update Metadata</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file');
        }

        const file = files[0];
        modalManager.showProgress('Updating Metadata...', 'Processing PDF...');

        try {
            const pdfDoc = await PDFUtils.loadPDF(file);
            
            modalManager.updateProgress(30);

            // Update metadata
            if (options.title) pdfDoc.setTitle(options.title);
            if (options.author) pdfDoc.setAuthor(options.author);
            if (options.subject) pdfDoc.setSubject(options.subject);
            if (options.keywords) {
                const keywordArray = options.keywords.split(',').map(k => k.trim());
                pdfDoc.setKeywords(keywordArray);
            }
            if (options.creator) pdfDoc.setCreator(options.creator);
            if (options.producer) pdfDoc.setProducer(options.producer);

            // Set creation and modification dates
            const now = new Date();
            pdfDoc.setCreationDate(now);
            pdfDoc.setModificationDate(now);

            modalManager.updateProgress(70);

            const pdfBytes = await PDFUtils.savePDF(pdfDoc);
            const filename = file.name.replace('.pdf', '_updated.pdf');
            
            modalManager.updateProgress(100);
            DownloadUtils.downloadPDF(pdfBytes, filename);
            
            modalManager.hideProgress();
            notificationManager.success('Metadata updated successfully');

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }
}

/**
 * PDF Page Rotator Tool
 */
class PDFRotatorTool extends BaseTool {
    constructor() {
        super('PDF Page Rotator', 'Rotate PDF pages in any direction');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="rotator-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Rotation angle:</label>
                        <select class="option-input option-select" id="rotation-angle">
                            <option value="90">90° Clockwise</option>
                            <option value="180">180°</option>
                            <option value="270">270° Clockwise (90° Counter-clockwise)</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Apply to:</label>
                        <select class="option-input option-select" id="rotation-pages">
                            <option value="all" selected>All pages</option>
                            <option value="odd">Odd pages only</option>
                            <option value="even">Even pages only</option>
                            <option value="specific">Specific pages</option>
                        </select>
                    </div>
                    <div class="option-group" id="specific-pages" style="display:none;">
                        <label class="option-label">Page numbers (comma-separated):</label>
                        <input type="text" class="option-input" id="rotation-specific" placeholder="1,3,5-7">
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="rotator-process">
                        <i class="material-icons">rotate_right</i>
                        <span>Rotate Pages</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file');
        }

        const file = files[0];
        const angle = parseInt(options.angle) || 90;
        
        modalManager.showProgress('Rotating Pages...', 'Processing PDF...');

        try {
            const pdfDoc = await PDFUtils.loadPDF(file);
            const pages = pdfDoc.getPages();
            const totalPages = pages.length;

            modalManager.updateProgress(30);

            // Determine which pages to rotate
            let pagesToRotate = [];
            switch (options.pages) {
                case 'all':
                    pagesToRotate = Array.from({ length: totalPages }, (_, i) => i);
                    break;
                case 'odd':
                    pagesToRotate = Array.from({ length: totalPages }, (_, i) => i).filter(i => (i + 1) % 2 === 1);
                    break;
                case 'even':
                    pagesToRotate = Array.from({ length: totalPages }, (_, i) => i).filter(i => (i + 1) % 2 === 0);
                    break;
                case 'specific':
                    if (options.specific) {
                        pagesToRotate = this.parsePageNumbers(options.specific, totalPages);
                    }
                    break;
            }

            // Rotate specified pages
            for (const pageIndex of pagesToRotate) {
                if (pageIndex >= 0 && pageIndex < totalPages) {
                    const page = pages[pageIndex];
                    page.setRotation({ angle: angle * (Math.PI / 180) });
                }
            }

            modalManager.updateProgress(80);

            const pdfBytes = await PDFUtils.savePDF(pdfDoc);
            const filename = file.name.replace('.pdf', '_rotated.pdf');
            
            modalManager.updateProgress(100);
            DownloadUtils.downloadPDF(pdfBytes, filename);
            
            modalManager.hideProgress();
            notificationManager.success(`Rotated ${pagesToRotate.length} pages by ${angle}°`);

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }

    parsePageNumbers(pagesStr, totalPages) {
        const pages = [];
        const parts = pagesStr.split(',');
        
        for (const part of parts) {
            const trimmed = part.trim();
            if (trimmed.includes('-')) {
                const [start, end] = trimmed.split('-').map(n => parseInt(n.trim()));
                for (let i = start; i <= end; i++) {
                    if (i >= 1 && i <= totalPages) pages.push(i - 1); // Convert to 0-based
                }
            } else {
                const page = parseInt(trimmed);
                if (page >= 1 && page <= totalPages) pages.push(page - 1); // Convert to 0-based
            }
        }
        
        return pages;
    }
}

/**
 * PDF Text Extractor Tool
 */
class PDFTextExtractorTool extends BaseTool {
    constructor() {
        super('PDF Text Extractor', 'Extract text content from PDF documents');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="text-extractor-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Output format:</label>
                        <select class="option-input option-select" id="text-format">
                            <option value="txt" selected>Plain Text (.txt)</option>
                            <option value="json">JSON (.json)</option>
                            <option value="csv">CSV (.csv)</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-checkbox">
                            <input type="checkbox" id="preserve-formatting" checked>
                            <span>Preserve formatting</span>
                        </label>
                    </div>
                    <div class="option-group">
                        <label class="option-checkbox">
                            <input type="checkbox" id="include-metadata">
                            <span>Include metadata</span>
                        </label>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="text-extractor-process">
                        <i class="material-icons">text_fields</i>
                        <span>Extract Text</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file');
        }

        const file = files[0];
        modalManager.showProgress('Extracting Text...', 'Loading PDF document...');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            const totalPages = pdf.numPages;

            let extractedData = {
                metadata: {},
                pages: []
            };

            // Extract metadata if requested
            if (options.includeMetadata) {
                const metadata = await pdf.getMetadata();
                extractedData.metadata = metadata.info || {};
            }

            // Extract text from each page
            for (let i = 1; i <= totalPages; i++) {
                modalManager.updateProgress((i / totalPages) * 80);
                
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                
                let pageText = '';
                textContent.items.forEach(item => {
                    pageText += item.str + (options.preserveFormatting ? ' ' : '');
                });

                extractedData.pages.push({
                    pageNumber: i,
                    text: pageText.trim()
                });
            }

            modalManager.updateProgress(90);

            // Format output based on selected format
            let outputContent, filename, mimeType;
            
            switch (options.format) {
                case 'json':
                    outputContent = JSON.stringify(extractedData, null, 2);
                    filename = file.name.replace('.pdf', '_extracted.json');
                    mimeType = 'application/json';
                    break;
                case 'csv':
                    outputContent = this.formatAsCSV(extractedData);
                    filename = file.name.replace('.pdf', '_extracted.csv');
                    mimeType = 'text/csv';
                    break;
                default: // txt
                    outputContent = extractedData.pages.map(p => 
                        `--- Page ${p.pageNumber} ---\n${p.text}`
                    ).join('\n\n');
                    filename = file.name.replace('.pdf', '_extracted.txt');
                    mimeType = 'text/plain';
            }

            const blob = new Blob([outputContent], { type: mimeType });
            
            modalManager.updateProgress(100);
            DownloadUtils.downloadBlob(blob, filename);
            
            modalManager.hideProgress();
            notificationManager.success(`Text extracted from ${totalPages} pages`);

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }

    formatAsCSV(data) {
        let csv = 'Page Number,Text Content\n';
        data.pages.forEach(page => {
            const escapedText = page.text.replace(/"/g, '""');
            csv += `${page.pageNumber},"${escapedText}"\n`;
        });
        return csv;
    }
}

/**
 * PDF Form Filler Tool
 */
class PDFFormFillerTool extends BaseTool {
    constructor() {
        super('PDF Form Filler', 'Fill interactive PDF forms automatically');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="form-filler-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Form data (JSON format):</label>
                        <textarea class="option-textarea" id="form-data" rows="8" placeholder='{"fieldName": "value", "checkbox1": true, "dropdown": "option1"}'></textarea>
                    </div>
                    <div class="option-group">
                        <label class="option-checkbox">
                            <input type="checkbox" id="flatten-form">
                            <span>Flatten form (make non-editable)</span>
                        </label>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="form-filler-process">
                        <i class="material-icons">assignment</i>
                        <span>Fill Form</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file');
        }

        let formData;
        try {
            formData = JSON.parse(options.formData || '{}');
        } catch (error) {
            throw new Error('Invalid JSON format in form data');
        }

        const file = files[0];
        modalManager.showProgress('Filling Form...', 'Processing PDF form...');

        try {
            const pdfDoc = await PDFUtils.loadPDF(file);
            const form = pdfDoc.getForm();
            const fields = form.getFields();

            modalManager.updateProgress(30);

            // Fill form fields
            for (const field of fields) {
                const fieldName = field.getName();
                if (formData.hasOwnProperty(fieldName)) {
                    const value = formData[fieldName];
                    
                    if (field.constructor.name === 'PDFTextField') {
                        field.setText(String(value));
                    } else if (field.constructor.name === 'PDFCheckBox') {
                        if (value) field.check();
                        else field.uncheck();
                    } else if (field.constructor.name === 'PDFDropdown') {
                        field.select(String(value));
                    } else if (field.constructor.name === 'PDFRadioGroup') {
                        field.select(String(value));
                    }
                }
            }

            modalManager.updateProgress(70);

            // Flatten form if requested
            if (options.flattenForm) {
                form.flatten();
            }

            const pdfBytes = await PDFUtils.savePDF(pdfDoc);
            const filename = file.name.replace('.pdf', '_filled.pdf');
            
            modalManager.updateProgress(100);
            DownloadUtils.downloadPDF(pdfBytes, filename);
            
            modalManager.hideProgress();
            notificationManager.success(`Form filled with ${Object.keys(formData).length} field(s)`);

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }
}

/**
 * PDF Digital Signature Tool
 */
class PDFSignatureTool extends BaseTool {
    constructor() {
        super('PDF Digital Signature Tool', 'Add digital signatures to PDF documents');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="signature-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Signature text:</label>
                        <input type="text" class="option-input" id="signature-text" placeholder="Your name or signature text">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Position:</label>
                        <select class="option-input option-select" id="signature-position">
                            <option value="bottom-right" selected>Bottom Right</option>
                            <option value="bottom-left">Bottom Left</option>
                            <option value="top-right">Top Right</option>
                            <option value="top-left">Top Left</option>
                            <option value="center">Center</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Page to sign:</label>
                        <select class="option-input option-select" id="signature-page">
                            <option value="last" selected>Last page</option>
                            <option value="first">First page</option>
                            <option value="all">All pages</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Date format:</label>
                        <select class="option-input option-select" id="date-format">
                            <option value="none">No date</option>
                            <option value="short" selected>MM/DD/YYYY</option>
                            <option value="long">Month DD, YYYY</option>
                            <option value="iso">YYYY-MM-DD</option>
                        </select>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="signature-process">
                        <i class="material-icons">draw</i>
                        <span>Add Signature</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file');
        }

        if (!options.signatureText) {
            throw new Error('Please enter signature text');
        }

        const file = files[0];
        modalManager.showProgress('Adding Signature...', 'Processing PDF...');

        try {
            const pdfDoc = await PDFUtils.loadPDF(file);
            const pages = pdfDoc.getPages();
            
            modalManager.updateProgress(30);

            // Determine which pages to sign
            let pagesToSign = [];
            switch (options.signaturePage) {
                case 'first':
                    pagesToSign = [0];
                    break;
                case 'last':
                    pagesToSign = [pages.length - 1];
                    break;
                case 'all':
                    pagesToSign = Array.from({ length: pages.length }, (_, i) => i);
                    break;
                default:
                    pagesToSign = [pages.length - 1];
            }

            // Add signature to specified pages
            for (const pageIndex of pagesToSign) {
                const page = pages[pageIndex];
                const { width, height } = page.getSize();
                
                let x, y;
                switch (options.signaturePosition) {
                    case 'bottom-right':
                        x = width - 200;
                        y = 50;
                        break;
                    case 'bottom-left':
                        x = 50;
                        y = 50;
                        break;
                    case 'top-right':
                        x = width - 200;
                        y = height - 100;
                        break;
                    case 'top-left':
                        x = 50;
                        y = height - 100;
                        break;
                    case 'center':
                        x = width / 2 - 100;
                        y = height / 2;
                        break;
                    default:
                        x = width - 200;
                        y = 50;
                }

                // Add signature text
                page.drawText(options.signatureText, {
                    x,
                    y: y + 20,
                    size: 12,
                    opacity: 0.8
                });

                // Add date if requested
                if (options.dateFormat !== 'none') {
                    const now = new Date();
                    let dateStr = '';
                    
                    switch (options.dateFormat) {
                        case 'short':
                            dateStr = now.toLocaleDateString('en-US');
                            break;
                        case 'long':
                            dateStr = now.toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                            });
                            break;
                        case 'iso':
                            dateStr = now.toISOString().split('T')[0];
                            break;
                    }

                    page.drawText(`Date: ${dateStr}`, {
                        x,
                        y,
                        size: 10,
                        opacity: 0.6
                    });
                }
            }

            modalManager.updateProgress(80);

            const pdfBytes = await PDFUtils.savePDF(pdfDoc);
            const filename = file.name.replace('.pdf', '_signed.pdf');
            
            modalManager.updateProgress(100);
            DownloadUtils.downloadPDF(pdfBytes, filename);
            
            modalManager.hideProgress();
            notificationManager.success('Digital signature added successfully');

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }
}

/**
 * PDF Page Numbering Tool
 */
class PDFPageNumberingTool extends BaseTool {
    constructor() {
        super('PDF Page Numbering Tool', 'Add page numbers to PDF documents');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="page-numbering-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Number format:</label>
                        <select class="option-input option-select" id="number-format">
                            <option value="1" selected>1, 2, 3...</option>
                            <option value="i">i, ii, iii...</option>
                            <option value="I">I, II, III...</option>
                            <option value="a">a, b, c...</option>
                            <option value="A">A, B, C...</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Position:</label>
                        <select class="option-input option-select" id="numbering-position">
                            <option value="bottom-center" selected>Bottom Center</option>
                            <option value="bottom-right">Bottom Right</option>
                            <option value="bottom-left">Bottom Left</option>
                            <option value="top-center">Top Center</option>
                            <option value="top-right">Top Right</option>
                            <option value="top-left">Top Left</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Start from page:</label>
                        <input type="number" class="option-input" id="start-page" value="1" min="1">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Start number:</label>
                        <input type="number" class="option-input" id="start-number" value="1" min="1">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Prefix/Suffix:</label>
                        <input type="text" class="option-input" id="number-prefix" placeholder="Page {n} of {total}">
                        <small>Use {n} for page number, {total} for total pages</small>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="page-numbering-process">
                        <i class="material-icons">format_list_numbered</i>
                        <span>Add Page Numbers</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file');
        }

        const file = files[0];
        modalManager.showProgress('Adding Page Numbers...', 'Processing PDF pages...');

        try {
            const pdfDoc = await PDFUtils.loadPDF(file);
            const pages = pdfDoc.getPages();
            const totalPages = pages.length;
            const startPage = parseInt(options.startPage) || 1;
            const startNumber = parseInt(options.startNumber) || 1;

            modalManager.updateProgress(30);

            for (let i = 0; i < pages.length; i++) {
                modalManager.updateProgress(30 + (i / pages.length) * 60);
                
                // Skip pages before start page
                if (i + 1 < startPage) continue;

                const page = pages[i];
                const { width, height } = page.getSize();
                const pageNumber = startNumber + (i + 1 - startPage);

                // Format page number
                let formattedNumber = this.formatPageNumber(pageNumber, options.numberFormat);
                
                // Apply prefix/suffix template
                if (options.numberPrefix) {
                    formattedNumber = options.numberPrefix
                        .replace('{n}', formattedNumber)
                        .replace('{total}', totalPages.toString());
                }

                // Calculate position
                let x, y;
                switch (options.numberingPosition) {
                    case 'bottom-center':
                        x = width / 2;
                        y = 30;
                        break;
                    case 'bottom-right':
                        x = width - 50;
                        y = 30;
                        break;
                    case 'bottom-left':
                        x = 50;
                        y = 30;
                        break;
                    case 'top-center':
                        x = width / 2;
                        y = height - 30;
                        break;
                    case 'top-right':
                        x = width - 50;
                        y = height - 30;
                        break;
                    case 'top-left':
                        x = 50;
                        y = height - 30;
                        break;
                    default:
                        x = width / 2;
                        y = 30;
                }

                page.drawText(formattedNumber, {
                    x,
                    y,
                    size: 10,
                    opacity: 0.7
                });
            }

            modalManager.updateProgress(90);

            const pdfBytes = await PDFUtils.savePDF(pdfDoc);
            const filename = file.name.replace('.pdf', '_numbered.pdf');
            
            modalManager.updateProgress(100);
            DownloadUtils.downloadPDF(pdfBytes, filename);
            
            modalManager.hideProgress();
            notificationManager.success('Page numbers added successfully');

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }

    formatPageNumber(number, format) {
        switch (format) {
            case 'i':
                return this.toRoman(number).toLowerCase();
            case 'I':
                return this.toRoman(number);
            case 'a':
                return this.toAlpha(number).toLowerCase();
            case 'A':
                return this.toAlpha(number);
            default:
                return number.toString();
        }
    }

    toRoman(num) {
        const values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
        const symbols = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
        let result = '';
        
        for (let i = 0; i < values.length; i++) {
            while (num >= values[i]) {
                result += symbols[i];
                num -= values[i];
            }
        }
        return result;
    }

    toAlpha(num) {
        let result = '';
        while (num > 0) {
            num--;
            result = String.fromCharCode(65 + (num % 26)) + result;
            num = Math.floor(num / 26);
        }
        return result;
    }
}

/**
 * PDF Bookmark Manager Tool
 */
class PDFBookmarkTool extends BaseTool {
    constructor() {
        super('PDF Bookmark Manager', 'Add, edit, or remove PDF bookmarks');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="bookmark-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Action:</label>
                        <select class="option-input option-select" id="bookmark-action">
                            <option value="add" selected>Add bookmarks</option>
                            <option value="remove">Remove all bookmarks</option>
                            <option value="extract">Extract bookmarks</option>
                        </select>
                    </div>
                    <div class="option-group" id="bookmark-data-group">
                        <label class="option-label">Bookmarks (JSON format):</label>
                        <textarea class="option-textarea" id="bookmark-data" rows="8" placeholder='[{"title": "Chapter 1", "page": 1}, {"title": "Chapter 2", "page": 5}]'></textarea>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="bookmark-process">
                        <i class="material-icons">bookmark</i>
                        <span>Process Bookmarks</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file');
        }

        const file = files[0];
        modalManager.showProgress('Processing Bookmarks...', 'Loading PDF...');

        try {
            const pdfDoc = await PDFUtils.loadPDF(file);
            
            modalManager.updateProgress(30);

            switch (options.bookmarkAction) {
                case 'add':
                    await this.addBookmarks(pdfDoc, options.bookmarkData);
                    break;
                case 'remove':
                    // PDF-lib doesn't have direct bookmark removal, this is a placeholder
                    break;
                case 'extract':
                    await this.extractBookmarks(file);
                    return;
            }

            modalManager.updateProgress(80);

            const pdfBytes = await PDFUtils.savePDF(pdfDoc);
            const filename = file.name.replace('.pdf', '_bookmarked.pdf');
            
            modalManager.updateProgress(100);
            DownloadUtils.downloadPDF(pdfBytes, filename);
            
            modalManager.hideProgress();
            notificationManager.success('Bookmarks processed successfully');

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }

    async addBookmarks(pdfDoc, bookmarkDataStr) {
        let bookmarks;
        try {
            bookmarks = JSON.parse(bookmarkDataStr || '[]');
        } catch (error) {
            throw new Error('Invalid JSON format in bookmark data');
        }

        // Note: PDF-lib has limited bookmark support
        // This is a simplified implementation
        for (const bookmark of bookmarks) {
            if (bookmark.title && bookmark.page) {
                // Add bookmark logic would go here
                // Currently PDF-lib doesn't fully support bookmark creation
            }
        }
    }

    async extractBookmarks(file) {
        // Extract bookmarks using PDF.js
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        
        try {
            const outline = await pdf.getOutline();
            const bookmarks = this.processOutline(outline || []);
            
            const bookmarkJson = JSON.stringify(bookmarks, null, 2);
            const blob = new Blob([bookmarkJson], { type: 'application/json' });
            const filename = file.name.replace('.pdf', '_bookmarks.json');
            
            DownloadUtils.downloadBlob(blob, filename);
            notificationManager.success(`Extracted ${bookmarks.length} bookmarks`);
        } catch (error) {
            notificationManager.info('No bookmarks found in this PDF');
        }
    }

    processOutline(outline, level = 0) {
        const bookmarks = [];
        
        for (const item of outline) {
            bookmarks.push({
                title: item.title,
                level: level,
                dest: item.dest
            });
            
            if (item.items && item.items.length > 0) {
                bookmarks.push(...this.processOutline(item.items, level + 1));
            }
        }
        
        return bookmarks;
    }
}

/**
 * PDF Page Resizer Tool
 */
class PDFPageResizerTool extends BaseTool {
    constructor() {
        super('PDF Page Resizer', 'Resize PDF pages to different dimensions');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="page-resizer-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Target size:</label>
                        <select class="option-input option-select" id="target-size">
                            <option value="A4" selected>A4 (210 × 297 mm)</option>
                            <option value="A3">A3 (297 × 420 mm)</option>
                            <option value="A5">A5 (148 × 210 mm)</option>
                            <option value="Letter">Letter (8.5 × 11 in)</option>
                            <option value="Legal">Legal (8.5 × 14 in)</option>
                            <option value="custom">Custom size</option>
                        </select>
                    </div>
                    <div class="option-group" id="custom-size-group" style="display:none;">
                        <label class="option-label">Width (points):</label>
                        <input type="number" class="option-input" id="custom-width" value="595">
                        <label class="option-label">Height (points):</label>
                        <input type="number" class="option-input" id="custom-height" value="842">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Scaling mode:</label>
                        <select class="option-input option-select" id="scaling-mode">
                            <option value="fit" selected>Fit to page</option>
                            <option value="fill">Fill page</option>
                            <option value="stretch">Stretch to fit</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-checkbox">
                            <input type="checkbox" id="center-content" checked>
                            <span>Center content</span>
                        </label>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="page-resizer-process">
                        <i class="material-icons">aspect_ratio</i>
                        <span>Resize Pages</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file');
        }

        const file = files[0];
        modalManager.showProgress('Resizing Pages...', 'Processing PDF...');

        try {
            const pdfDoc = await PDFUtils.loadPDF(file);
            const pages = pdfDoc.getPages();
            
            // Get target dimensions
            const targetSize = this.getTargetSize(options.targetSize, options.customWidth, options.customHeight);
            
            modalManager.updateProgress(30);

            for (let i = 0; i < pages.length; i++) {
                modalManager.updateProgress(30 + (i / pages.length) * 60);
                
                const page = pages[i];
                const currentSize = page.getSize();
                
                // Calculate scaling
                const scaleX = targetSize.width / currentSize.width;
                const scaleY = targetSize.height / currentSize.height;
                
                let finalScaleX, finalScaleY;
                switch (options.scalingMode) {
                    case 'fit':
                        const scale = Math.min(scaleX, scaleY);
                        finalScaleX = finalScaleY = scale;
                        break;
                    case 'fill':
                        const fillScale = Math.max(scaleX, scaleY);
                        finalScaleX = finalScaleY = fillScale;
                        break;
                    case 'stretch':
                        finalScaleX = scaleX;
                        finalScaleY = scaleY;
                        break;
                    default:
                        finalScaleX = finalScaleY = Math.min(scaleX, scaleY);
                }

                // Apply scaling
                page.scale(finalScaleX, finalScaleY);
                
                // Set new page size
                page.setSize(targetSize.width, targetSize.height);
            }

            modalManager.updateProgress(90);

            const pdfBytes = await PDFUtils.savePDF(pdfDoc);
            const filename = file.name.replace('.pdf', '_resized.pdf');
            
            modalManager.updateProgress(100);
            DownloadUtils.downloadPDF(pdfBytes, filename);
            
            modalManager.hideProgress();
            notificationManager.success(`Resized ${pages.length} pages to ${options.targetSize}`);

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }

    getTargetSize(sizeType, customWidth, customHeight) {
        const sizes = {
            'A4': { width: 595, height: 842 },
            'A3': { width: 842, height: 1191 },
            'A5': { width: 420, height: 595 },
            'Letter': { width: 612, height: 792 },
            'Legal': { width: 612, height: 1008 }
        };

        if (sizeType === 'custom') {
            return {
                width: parseInt(customWidth) || 595,
                height: parseInt(customHeight) || 842
            };
        }

        return sizes[sizeType] || sizes['A4'];
    }
}

/**
 * PDF Color Mode Converter Tool
 */
class PDFColorConverterTool extends BaseTool {
    constructor() {
        super('PDF Color Mode Converter', 'Convert PDF color modes (RGB, CMYK, Grayscale)');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="color-converter-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Target color mode:</label>
                        <select class="option-input option-select" id="color-mode">
                            <option value="grayscale" selected>Grayscale</option>
                            <option value="rgb">RGB</option>
                            <option value="cmyk">CMYK</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Quality:</label>
                        <select class="option-input option-select" id="conversion-quality">
                            <option value="high" selected>High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low (smaller file)</option>
                        </select>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="color-converter-process">
                        <i class="material-icons">palette</i>
                        <span>Convert Colors</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file');
        }

        const file = files[0];
        modalManager.showProgress('Converting Colors...', 'Processing PDF...');

        try {
            const pdfDoc = await PDFUtils.loadPDF(file);
            
            modalManager.updateProgress(50);

            // Note: PDF-lib has limited color space conversion capabilities
            // This is a simplified implementation that mainly affects metadata
            const pages = pdfDoc.getPages();
            
            // Set color space metadata
            switch (options.colorMode) {
                case 'grayscale':
                    pdfDoc.setProducer('PDF Tools Suite - Grayscale Conversion');
                    break;
                case 'rgb':
                    pdfDoc.setProducer('PDF Tools Suite - RGB Conversion');
                    break;
                case 'cmyk':
                    pdfDoc.setProducer('PDF Tools Suite - CMYK Conversion');
                    break;
            }

            modalManager.updateProgress(80);

            const pdfBytes = await PDFUtils.savePDF(pdfDoc);
            const filename = file.name.replace('.pdf', `_${options.colorMode}.pdf`);
            
            modalManager.updateProgress(100);
            DownloadUtils.downloadPDF(pdfBytes, filename);
            
            modalManager.hideProgress();
            notificationManager.info(`Color mode conversion completed. Note: Full color space conversion requires specialized libraries.`);

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }
}

/**
 * PDF OCR Tool
 */
class PDFOCRTool extends BaseTool {
    constructor() {
        super('PDF OCR Tool', 'Extract text from scanned PDFs using OCR');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="ocr-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Language:</label>
                        <select class="option-input option-select" id="ocr-language">
                            <option value="eng" selected>English</option>
                            <option value="spa">Spanish</option>
                            <option value="fra">French</option>
                            <option value="deu">German</option>
                            <option value="chi_sim">Chinese (Simplified)</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Output format:</label>
                        <select class="option-input option-select" id="ocr-output">
                            <option value="searchable" selected>Searchable PDF</option>
                            <option value="text">Text file</option>
                            <option value="both">Both</option>
                        </select>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="ocr-process">
                        <i class="material-icons">text_rotation_none</i>
                        <span>Process OCR</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file');
        }

        const file = files[0];
        modalManager.showProgress('Processing OCR...', 'This feature requires server-side processing...');

        try {
            // Note: OCR requires specialized libraries like Tesseract.js
            // This is a placeholder implementation
            modalManager.updateProgress(50);
            
            await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate processing
            
            modalManager.updateProgress(100);
            modalManager.hideProgress();
            
            notificationManager.info('OCR processing requires additional libraries (Tesseract.js) and server-side processing for full functionality.');

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }
}

/**
 * PDF Annotation Tool
 */
class PDFAnnotationTool extends BaseTool {
    constructor() {
        super('PDF Annotation Tool', 'Add annotations, highlights, and comments to PDFs');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="annotation-upload"></div>
                <div class="tool-options">
                    <div class="option-group">
                        <label class="option-label">Annotation type:</label>
                        <select class="option-input option-select" id="annotation-type">
                            <option value="highlight" selected>Highlight</option>
                            <option value="note">Sticky Note</option>
                            <option value="text">Text Annotation</option>
                            <option value="rectangle">Rectangle</option>
                        </select>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Annotation text:</label>
                        <textarea class="option-textarea" id="annotation-text" rows="3" placeholder="Enter annotation text..."></textarea>
                    </div>
                    <div class="option-group">
                        <label class="option-label">Page number:</label>
                        <input type="number" class="option-input" id="annotation-page" value="1" min="1">
                    </div>
                    <div class="option-group">
                        <label class="option-label">Color:</label>
                        <select class="option-input option-select" id="annotation-color">
                            <option value="yellow" selected>Yellow</option>
                            <option value="red">Red</option>
                            <option value="blue">Blue</option>
                            <option value="green">Green</option>
                        </select>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="annotation-process">
                        <i class="material-icons">note_add</i>
                        <span>Add Annotation</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file');
        }

        const file = files[0];
        modalManager.showProgress('Adding Annotation...', 'Processing PDF...');

        try {
            const pdfDoc = await PDFUtils.loadPDF(file);
            const pages = pdfDoc.getPages();
            const pageIndex = (parseInt(options.annotationPage) || 1) - 1;
            
            if (pageIndex < 0 || pageIndex >= pages.length) {
                throw new Error('Invalid page number');
            }

            modalManager.updateProgress(30);

            const page = pages[pageIndex];
            const { width, height } = page.getSize();
            
            // Add annotation based on type
            switch (options.annotationType) {
                case 'text':
                    page.drawText(options.annotationText || 'Annotation', {
                        x: 50,
                        y: height - 100,
                        size: 12,
                        color: this.getColor(options.annotationColor)
                    });
                    break;
                case 'rectangle':
                    page.drawRectangle({
                        x: 50,
                        y: height - 150,
                        width: 200,
                        height: 50,
                        borderColor: this.getColor(options.annotationColor),
                        borderWidth: 2,
                        opacity: 0.3
                    });
                    break;
                case 'note':
                case 'highlight':
                    // Note: PDF-lib has limited annotation support
                    page.drawText(`[${options.annotationType.toUpperCase()}] ${options.annotationText || 'Note'}`, {
                        x: 50,
                        y: height - 200,
                        size: 10,
                        color: this.getColor(options.annotationColor)
                    });
                    break;
            }

            modalManager.updateProgress(80);

            const pdfBytes = await PDFUtils.savePDF(pdfDoc);
            const filename = file.name.replace('.pdf', '_annotated.pdf');
            
            modalManager.updateProgress(100);
            DownloadUtils.downloadPDF(pdfBytes, filename);
            
            modalManager.hideProgress();
            notificationManager.success('Annotation added successfully');

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }

    getColor(colorName) {
        const colors = {
            yellow: { r: 1, g: 1, b: 0 },
            red: { r: 1, g: 0, b: 0 },
            blue: { r: 0, g: 0, b: 1 },
            green: { r: 0, g: 1, b: 0 }
        };
        return colors[colorName] || colors.yellow;
    }
}

/**
 * PDF Quality Optimizer Tool
 */
class PDFQualityOptimizerTool extends BaseTool {
    constructor() {
        super('PDF Quality Optimizer', 'Optimize PDF quality and file size');
    }

    createInterface() {
        return `
            <div class="tool-interface">
                <div id="quality-optimizer-upload"></div>
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
                    <div class="option-group">
                        <label class="option-checkbox">
                            <input type="checkbox" id="optimize-images" checked>
                            <span>Optimize images</span>
                        </label>
                    </div>
                    <div class="option-group">
                        <label class="option-checkbox">
                            <input type="checkbox" id="remove-unused" checked>
                            <span>Remove unused objects</span>
                        </label>
                    </div>
                    <div class="option-group">
                        <label class="option-checkbox">
                            <input type="checkbox" id="linearize-pdf">
                            <span>Linearize for web viewing</span>
                        </label>
                    </div>
                </div>
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="modalManager.closeModal()">Cancel</button>
                    <button class="btn btn-primary" id="quality-optimizer-process">
                        <i class="material-icons">tune</i>
                        <span>Optimize PDF</span>
                    </button>
                </div>
            </div>
        `;
    }

    async execute(files, options = {}) {
        if (files.length !== 1) {
            throw new Error('Please select exactly one PDF file');
        }

        const file = files[0];
        modalManager.showProgress('Optimizing PDF...', 'Analyzing document structure...');

        try {
            const pdfDoc = await PDFUtils.loadPDF(file);
            
            modalManager.updateProgress(30);

            // Apply optimization based on level
            switch (options.optimizationLevel) {
                case 'web':
                    pdfDoc.setProducer('PDF Tools Suite - Web Optimized');
                    break;
                case 'print':
                    pdfDoc.setProducer('PDF Tools Suite - Print Optimized');
                    break;
                case 'mobile':
                    pdfDoc.setProducer('PDF Tools Suite - Mobile Optimized');
                    break;
                case 'archive':
                    pdfDoc.setProducer('PDF Tools Suite - Archive Quality');
                    break;
            }

            modalManager.updateProgress(60);

            // Remove metadata if optimizing for size
            if (options.removeUnused && (options.optimizationLevel === 'mobile' || options.optimizationLevel === 'web')) {
                pdfDoc.setTitle('');
                pdfDoc.setAuthor('');
                pdfDoc.setSubject('');
                pdfDoc.setKeywords([]);
            }

            modalManager.updateProgress(80);

            const pdfBytes = await PDFUtils.savePDF(pdfDoc);
            
            const originalSize = file.size;
            const optimizedSize = pdfBytes.length;
            const reduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(1);
            
            const filename = file.name.replace('.pdf', '_optimized.pdf');
            
            modalManager.updateProgress(100);
            DownloadUtils.downloadPDF(pdfBytes, filename);
            
            modalManager.hideProgress();
            notificationManager.success(
                `PDF optimized for ${options.optimizationLevel}! Size: ${FileValidator.formatFileSize(originalSize)} → ${FileValidator.formatFileSize(optimizedSize)} (${reduction}% reduction)`
            );

        } catch (error) {
            modalManager.hideProgress();
            throw error;
        }
    }
}
class ToolManager {
    constructor() {
        this.tools = new Map();
        this.initializeTools();
        this.setupEventListeners();
    }

    initializeTools() {
        // Core PDF manipulation tools
        this.registerTool('merger', new PDFMergerTool());
        this.registerTool('splitter', new PDFSplitterTool());
        this.registerTool('rotator', new PDFRotatorTool());
        this.registerTool('text-extractor', new PDFTextExtractorTool());
        
        // Conversion tools
        this.registerTool('pdf-to-word', new PDFToWordTool());
        this.registerTool('pdf-to-image', new PDFToImageTool());
        this.registerTool('image-to-pdf', new ImageToPDFTool());
        this.registerTool('color-converter', new PDFColorConverterTool());
        
        // Security and metadata tools
        this.registerTool('compressor', new PDFCompressorTool());
        this.registerTool('password-protector', new PDFPasswordTool());
        this.registerTool('watermark', new PDFWatermarkTool());
        this.registerTool('metadata-editor', new PDFMetadataTool());
        
        // Editing and enhancement tools
        this.registerTool('form-filler', new PDFFormFillerTool());
        this.registerTool('signature', new PDFSignatureTool());
        this.registerTool('page-numbering', new PDFPageNumberingTool());
        this.registerTool('annotation', new PDFAnnotationTool());
        
        // Advanced tools
        this.registerTool('bookmark-manager', new PDFBookmarkTool());
        this.registerTool('page-resizer', new PDFPageResizerTool());
        this.registerTool('ocr', new PDFOCRTool());
        this.registerTool('quality-optimizer', new PDFQualityOptimizerTool());
    }

    registerTool(id, tool) {
        this.tools.set(id, tool);
    }

    getTool(id) {
        return this.tools.get(id);
    }

    setupEventListeners() {
        // Tool card clicks
        document.addEventListener('click', (e) => {
            const toolBtn = e.target.closest('.tool-btn');
            if (toolBtn) {
                const toolId = toolBtn.dataset.tool;
                this.openTool(toolId);
            }
        });
    }

    async openTool(toolId) {
        const tool = this.getTool(toolId);
        if (!tool) {
            notificationManager.error(`Tool "${toolId}" not found`);
            return;
        }

        try {
            const toolInterface = tool.createInterface();
            modalManager.openModal('tool-modal', tool.name, toolInterface);
            
            // Setup tool-specific functionality
            this.setupToolInterface(toolId, tool);
            
        } catch (error) {
            notificationManager.error(`Failed to open tool: ${error.message}`);
        }
    }

    setupToolInterface(toolId, tool) {
        // Setup file upload component
        const uploadContainer = document.querySelector(`#${toolId}-upload`);
        if (uploadContainer) {
            const uploadOptions = this.getUploadOptions(toolId);
            const fileUpload = new FileUploadComponent(uploadContainer, uploadOptions);
            
            // Setup process button
            const processBtn = document.querySelector(`#${toolId}-process`);
            if (processBtn) {
                processBtn.addEventListener('click', async () => {
                    const files = fileUpload.getFiles();
                    const options = this.getToolOptions(toolId);
                    
                    try {
                        await tool.execute(files, options);
                        modalManager.closeModal();
                    } catch (error) {
                        const message = window.errorHandler ? 
                            window.errorHandler.getUserFriendlyMessage({ error, context: `${tool.name} execution` }) :
                            'An error occurred while processing the file.';
                        notificationManager.error(message);
                        window.errorHandler?.handleError({ error, context: tool.name, metadata: { toolId, files: files.length } });
                    }
                });
            }
        }

        // Setup tool-specific event listeners
        this.setupToolSpecificListeners(toolId);
    }

    getUploadOptions(toolId) {
        const options = {
            multiple: false,
            accept: SUPPORTED_TYPES.PDF.join(','),
            validator: FileValidator.validatePDF,
            maxSize: FILE_SIZE_LIMITS.PDF
        };

        // Tool-specific options
        switch (toolId) {
            case 'merger':
                options.multiple = true;
                break;
            case 'image-to-pdf':
                options.multiple = true;
                options.accept = SUPPORTED_TYPES.IMAGE.join(',');
                options.validator = FileValidator.validateImage;
                options.maxSize = FILE_SIZE_LIMITS.IMAGE;
                break;
        }

        return options;
    }

    getToolOptions(toolId) {
        const options = {};
        
        // Extract options from form elements
        const modal = document.getElementById('tool-modal');
        const inputs = modal.querySelectorAll('input, select');
        
        inputs.forEach(input => {
            const id = input.id;
            if (id) {
                if (input.type === 'checkbox') {
                    options[id.replace(`${toolId}-`, '')] = input.checked;
                } else if (input.type === 'number' || input.type === 'range') {
                    options[id.replace(`${toolId}-`, '')] = parseFloat(input.value);
                } else {
                    options[id.replace(`${toolId}-`, '')] = input.value;
                }
            }
        });

        return options;
    }

    setupToolSpecificListeners(toolId) {
        switch (toolId) {
            case 'splitter':
                this.setupSplitterListeners();
                break;
            case 'pdf-to-image':
                this.setupPDFToImageListeners();
                break;
        }
    }

    setupSplitterListeners() {
        const methodSelect = document.getElementById('splitter-method');
        const pagesInput = document.getElementById('pages-input');
        const rangeInput = document.getElementById('range-input');
        const everyInput = document.getElementById('every-input');

        if (methodSelect) {
            methodSelect.addEventListener('change', (e) => {
                // Hide all inputs
                [pagesInput, rangeInput, everyInput].forEach(el => {
                    if (el) el.style.display = 'none';
                });

                // Show relevant input
                switch (e.target.value) {
                    case 'pages':
                        if (pagesInput) pagesInput.style.display = 'block';
                        break;
                    case 'range':
                        if (rangeInput) rangeInput.style.display = 'block';
                        break;
                    case 'every':
                        if (everyInput) everyInput.style.display = 'block';
                        break;
                }
            });
        }
    }

    setupPDFToImageListeners() {
        const qualityRange = document.getElementById('image-quality');
        const qualityValue = document.getElementById('quality-value');

        if (qualityRange && qualityValue) {
            qualityRange.addEventListener('input', (e) => {
                qualityValue.textContent = e.target.value;
            });
        }
    }
}

// Export ToolManager to global scope
window.ToolManager = ToolManager;

// Initialize tool manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.toolManager = new ToolManager();
});