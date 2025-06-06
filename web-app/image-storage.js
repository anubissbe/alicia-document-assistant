// Image Storage Module for Document Writer
// Manages saving and retrieving images

class ImageStorage {
    constructor() {
        // In-memory storage for data URLs
        this.images = new Map();
        
        // Counter for unique image IDs
        this.imageCounter = 0;
        
        // Memory limits
        this.maxImages = 50; // Limit to prevent memory issues
        this.totalSize = 0;
        this.maxTotalSize = 100 * 1024 * 1024; // 100MB total limit
    }
    
    /**
     * Store a data URL image and return a reference path
     * @param {string} dataUrl - The base64 data URL of the image
     * @param {string} description - Description of the image
     * @returns {string} Reference path to use in documents
     */
    storeImage(dataUrl, description = '') {
        // Check memory limits
        const imageSize = dataUrl.length;
        
        // If we're at image limit, remove oldest
        if (this.images.size >= this.maxImages) {
            const oldestKey = this.images.keys().next().value;
            const oldestImage = this.images.get(oldestKey);
            this.totalSize -= oldestImage.dataUrl.length;
            this.images.delete(oldestKey);
            console.log(`[IMAGE STORAGE] Removed oldest image due to limit: ${oldestKey}`);
        }
        
        // Check total size limit
        if (this.totalSize + imageSize > this.maxTotalSize) {
            console.error('[IMAGE STORAGE] Cannot store image: total size limit exceeded');
            throw new Error('Image storage limit exceeded. Please clear some images.');
        }
        
        // Generate unique ID
        const imageId = `img-${Date.now()}-${this.imageCounter++}`;
        const imagePath = `/stored-images/${imageId}.png`;
        
        // Store the image data
        this.images.set(imagePath, {
            dataUrl: dataUrl,
            description: description,
            timestamp: new Date().toISOString()
        });
        
        this.totalSize += imageSize;
        console.log(`[IMAGE STORAGE] Stored image: ${imagePath} (${(imageSize / 1024).toFixed(2)}KB)`);
        
        return imagePath;
    }
    
    /**
     * Get a stored image by its path
     * @param {string} path - The image path
     * @returns {object|null} Image data or null if not found
     */
    getImage(path) {
        return this.images.get(path) || null;
    }
    
    /**
     * Get all stored images
     * @returns {Map} All stored images
     */
    getAllImages() {
        return this.images;
    }
    
    /**
     * Process content to replace data URLs with stored references
     * @param {string} content - Content with data URL images
     * @returns {string} Content with stored image references
     */
    processContent(content) {
        // Regular expression to match markdown images with data URLs
        const imageRegex = /!\[([^\]]*)\]\((data:image\/[^;]+;base64,[^)]+)\)/g;
        
        return content.replace(imageRegex, (match, alt, dataUrl) => {
            // Store the image and get reference path
            const imagePath = this.storeImage(dataUrl, alt);
            
            // Return markdown with stored path
            return `![${alt}](${imagePath})`;
        });
    }
    
    /**
     * Convert stored paths back to data URLs for export
     * @param {string} content - Content with stored image paths
     * @returns {string} Content with data URLs
     */
    restoreDataUrls(content) {
        // Replace stored paths with actual data URLs
        return content.replace(/!\[([^\]]*)\]\((\/stored-images\/[^)]+)\)/g, (match, alt, path) => {
            const imageData = this.getImage(path);
            if (imageData) {
                return `![${alt}](${imageData.dataUrl})`;
            }
            return match; // Return unchanged if not found
        });
    }
    
    /**
     * Clear all stored images
     */
    clear() {
        this.images.clear();
        this.imageCounter = 0;
        this.totalSize = 0;
        console.log('[IMAGE STORAGE] Cleared all stored images');
    }
}

// Create global instance
window.imageStorage = new ImageStorage();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageStorage;
}