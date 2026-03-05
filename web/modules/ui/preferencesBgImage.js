/**
 * Preferences Background Image Sub-Module
 *
 * Handles background image upload, compression, storage (IndexedDB),
 * and display mode management for the preferences panel.
 *
 * Loaded dynamically by preferencesManager.js with version cache-busting.
 *
 * @module ui/preferencesBgImage
 */

import { DOM_IDS } from '../core/constants.js';
import { updateThemeColor } from '../features/themeManager.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// BACKGROUND IMAGE CONSTANTS
// ============================================================================

const BG_IMAGE_DB_NAME = 'miniCycleBackgroundDB';
const BG_IMAGE_DB_VERSION = 1;
const BG_IMAGE_STORE = 'backgroundImage';
const BG_IMAGE_MAX_SIZE = 2 * 1024 * 1024; // 2MB
const BG_IMAGE_MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20MB - max file size to even attempt
const BG_IMAGE_MAX_DIMENSION = 1920; // Max width/height for compression
const BG_IMAGE_COMPRESSION_TIMEOUT = 30000; // 30 seconds timeout

// Allowed image MIME types (security: block SVG to prevent XSS)
const ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif'
];

// ============================================================================
// VALIDATION & COMPRESSION
// ============================================================================

/**
 * Validate image file for security
 * @param {File} file - The file to validate
 * @returns {{valid: boolean, error?: string}}
 */
function validateImageFile(file) {
    // Check if file exists
    if (!file) {
        return { valid: false, error: 'No file selected' };
    }

    // Check MIME type (block SVG for XSS prevention)
    if (!ALLOWED_IMAGE_TYPES.includes(file.type.toLowerCase())) {
        return { valid: false, error: 'Invalid file type. Please use JPG, PNG, WebP, or GIF.' };
    }

    // Check file size limit for attempting compression
    if (file.size > BG_IMAGE_MAX_UPLOAD_SIZE) {
        return { valid: false, error: 'Image too large (max 20MB). Please use a smaller image.' };
    }

    // Check file extension matches MIME type (basic validation)
    const ext = file.name.toLowerCase().split('.').pop();
    const validExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    if (!validExtensions.includes(ext)) {
        return { valid: false, error: 'Invalid file extension. Please use JPG, PNG, WebP, or GIF.' };
    }

    return { valid: true };
}

/**
 * Compress an image file to fit within size limit
 * Uses Canvas API - no external libraries needed
 * @param {File} file - The image file to compress
 * @param {number} maxSize - Maximum size in bytes
 * @param {number} maxDimension - Maximum width/height
 * @returns {Promise<{dataUrl: string, originalSize: number, compressedSize: number, quality: number}>}
 */
async function compressImage(file, maxSize = BG_IMAGE_MAX_SIZE, maxDimension = BG_IMAGE_MAX_DIMENSION) {
    return new Promise((resolve, reject) => {
        // Set timeout to prevent hanging on corrupt files
        const timeout = setTimeout(() => {
            cleanup();
            reject(new Error('Image processing timed out. The file may be corrupt.'));
        }, BG_IMAGE_COMPRESSION_TIMEOUT);

        const img = new Image();
        let objectUrl = null;

        // Cleanup function to revoke object URL and clear timeout
        const cleanup = () => {
            clearTimeout(timeout);
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };

        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    cleanup();
                    reject(new Error('Failed to create canvas context'));
                    return;
                }

                // Calculate new dimensions (maintain aspect ratio)
                let { width, height } = img;
                const originalWidth = width;
                const originalHeight = height;

                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                // Try progressively lower quality until under size limit
                let quality = 0.9;
                let dataUrl = canvas.toDataURL('image/jpeg', quality);

                while (dataUrl.length > maxSize && quality > 0.1) {
                    quality -= 0.1;
                    dataUrl = canvas.toDataURL('image/jpeg', quality);
                }

                // If still too large, reduce dimensions further
                if (dataUrl.length > maxSize) {
                    const scale = 0.7;
                    canvas.width = Math.round(width * scale);
                    canvas.height = Math.round(height * scale);
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    quality = 0.7;
                }

                const compressedSize = Math.round(dataUrl.length * 0.75); // Approximate actual size (base64 overhead)

                console.log(`📸 Image compressed: ${originalWidth}x${originalHeight} → ${canvas.width}x${canvas.height}, ${(file.size / 1024).toFixed(0)}KB → ${(compressedSize / 1024).toFixed(0)}KB (quality: ${(quality * 100).toFixed(0)}%)`);

                cleanup();
                resolve({
                    dataUrl,
                    originalSize: file.size,
                    compressedSize,
                    quality: Math.round(quality * 100)
                });
            } catch (err) {
                cleanup();
                reject(new Error('Failed to process image: ' + err.message));
            }
        };

        img.onerror = () => {
            cleanup();
            reject(new Error('Failed to load image. The file may be corrupt or unsupported.'));
        };

        // Create object URL and load image
        objectUrl = URL.createObjectURL(file);
        img.src = objectUrl;
    });
}

// ============================================================================
// INDEXEDDB OPERATIONS
// ============================================================================

/**
 * Open the background image IndexedDB database
 * @returns {Promise<IDBDatabase>}
 */
export function openBgImageDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(BG_IMAGE_DB_NAME, BG_IMAGE_DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(BG_IMAGE_STORE)) {
                db.createObjectStore(BG_IMAGE_STORE, { keyPath: 'id' });
            }
        };
    });
}

/**
 * Save background image to IndexedDB
 * @param {string} dataUrl - The image data URL
 * @param {string} mode - The display mode
 */
export async function saveBgImage(dataUrl, mode) {
    const db = await openBgImageDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([BG_IMAGE_STORE], 'readwrite');
        const store = transaction.objectStore(BG_IMAGE_STORE);

        const data = {
            id: 'background',
            dataUrl: dataUrl,
            mode: mode,
            updatedAt: Date.now()
        };

        const request = store.put(data);
        request.onsuccess = () => resolve();
        request.onerror = () => {
            db.close(); // Fix #70: Close on error to prevent leak
            reject(request.error);
        };

        transaction.oncomplete = () => db.close();
    });
}

/**
 * Load background image from IndexedDB
 * @returns {Promise<{dataUrl: string, mode: string}|null>}
 */
export async function loadBgImage() {
    try {
        const db = await openBgImageDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([BG_IMAGE_STORE], 'readonly');
            const store = transaction.objectStore(BG_IMAGE_STORE);
            const request = store.get('background');

            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? { dataUrl: result.dataUrl, mode: result.mode } : null);
            };
            request.onerror = () => {
                db.close(); // Fix #70: Close on error to prevent leak
                reject(request.error);
            };

            transaction.oncomplete = () => db.close();
        });
    } catch (error) {
        console.warn('Failed to load background image:', error);
        return null;
    }
}

// ============================================================================
// FILE READING
// ============================================================================

/**
 * Read a file as data URL
 * @param {File} file - The file to read
 * @returns {Promise<string>} - The data URL
 */
export function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

// ============================================================================
// APPLY / REMOVE BACKGROUND IMAGE
// ============================================================================

/**
 * Apply background image to body
 * @param {string} dataUrl - The image data URL
 * @param {string} mode - The display mode (cover, center, tile)
 * @param {Object} AppState - AppState dependency
 */
export function applyBgImage(dataUrl, mode, AppState) {
    const body = document.body;

    // Set the CSS variable for the image (always set it so it's ready when toggled on)
    document.documentElement.style.setProperty('--custom-bg-image', `url("${dataUrl}")`);

    // Check if the image should be visible based on user preference
    const customColors = AppState?.get()?.settings?.customColors || {};
    const showBgImage = customColors.showBgImage !== false; // Default to true

    // Only add has-bg-image class if the toggle is on
    if (showBgImage) {
        body.classList.add('has-bg-image');
        // Update status bar color to black for custom background
        updateThemeColor();
    }

    // Remove any existing mode classes
    body.classList.remove('bg-mode-cover', 'bg-mode-center', 'bg-mode-tile');

    // Add the appropriate mode class
    body.classList.add(`bg-mode-${mode}`);
}

/**
 * Remove background image
 * @param {Object} deps - Dependencies { showNotification }
 */
export async function removeBgImage(deps) {
    try {
        // Remove from IndexedDB
        const db = await openBgImageDB();
        await new Promise((resolve, reject) => {
            const transaction = db.transaction([BG_IMAGE_STORE], 'readwrite');
            const store = transaction.objectStore(BG_IMAGE_STORE);
            const request = store.delete('background');

            request.onsuccess = () => resolve();
            request.onerror = () => {
                db.close(); // Fix #70: Close on error to prevent leak
                reject(request.error);
            };

            transaction.oncomplete = () => db.close();
        });

        // Remove from body
        const body = document.body;
        document.documentElement.style.removeProperty('--custom-bg-image');
        body.classList.remove('has-bg-image', 'bg-mode-cover', 'bg-mode-center', 'bg-mode-tile');

        // Update status bar color (back to blue for default view)
        updateThemeColor();

        deps.showNotification?.(getLabel('notify.bgImageRemoved'), 'info', 2000);
        return true;
    } catch (error) {
        console.error('Failed to remove background image:', error);
        deps.showNotification?.(getLabel('notify.bgImageRemoveFailed'), 'error', 3000);
        return false;
    }
}

// ============================================================================
// UPLOAD HANDLING
// ============================================================================

/**
 * Handle background image file upload
 * @param {Event} event - The file input change event
 * @param {Object} deps - Dependencies { AppState, showNotification }
 * @returns {Promise<{dataUrl: string, mode: string}|null>} - Upload result or null on failure
 */
export async function handleBgImageUpload(event, deps) {
    const file = event.target.files?.[0];

    // Reset input early so same file can be selected again
    if (event.target) {
        event.target.value = '';
    }

    if (!file) return null;

    // Security validation
    const validation = validateImageFile(file);
    if (!validation.valid) {
        deps.showNotification?.(validation.error, 'error', 4000);
        console.warn('🚫 Image upload rejected:', validation.error);
        return null;
    }

    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    console.log(`📤 Processing image: ${file.name} (${fileSizeMB}MB, ${file.type})`);

    try {
        let dataUrl;
        let compressionInfo = null;

        // Compress if over size limit, otherwise read directly
        if (file.size > BG_IMAGE_MAX_SIZE) {
            deps.showNotification?.(`Compressing ${fileSizeMB}MB image...`, 'info', 3000);

            const result = await compressImage(file);
            dataUrl = result.dataUrl;
            compressionInfo = result;
        } else {
            // File is small enough, read directly
            dataUrl = await readFileAsDataURL(file);
        }

        // Verify we got valid data
        if (!dataUrl || !dataUrl.startsWith('data:image/')) {
            throw new Error('Invalid image data generated');
        }

        // Get current display mode
        const getElementById = deps.getElementById || ((id) => document.getElementById(id));
        const modeSelect = getElementById(DOM_IDS.BG_IMAGE_MODE);
        const mode = modeSelect?.value || 'cover';

        // Save to IndexedDB
        await saveBgImage(dataUrl, mode);

        // Apply to body
        applyBgImage(dataUrl, mode, deps.AppState);

        // Show success notification with compression details
        if (compressionInfo) {
            const savedKB = Math.round((compressionInfo.originalSize - compressionInfo.compressedSize) / 1024);
            deps.showNotification?.(
                `Image set! Compressed ${savedKB}KB (${compressionInfo.quality}% quality)`,
                'success',
                3000
            );
        } else {
            deps.showNotification?.(getLabel('notify.bgImageSet'), 'success', 2000);
        }

        console.log('✅ Background image uploaded successfully');
        return { dataUrl, mode };

    } catch (error) {
        console.error('❌ Failed to upload background image:', error);

        // Provide specific error messages
        let errorMessage = 'Failed to set background image';
        if (error.message.includes('timed out')) {
            errorMessage = 'Image processing timed out. Try a smaller image.';
        } else if (error.message.includes('corrupt')) {
            errorMessage = 'Image appears to be corrupt. Try another file.';
        } else if (error.message.includes('memory') || error.message.includes('quota')) {
            errorMessage = 'Not enough storage space. Try a smaller image.';
        } else if (error.message) {
            errorMessage = error.message;
        }

        deps.showNotification?.(errorMessage, 'error', 4000);
        return null;
    }
}

// ============================================================================
// DISPLAY MODE
// ============================================================================

/**
 * Handle display mode change
 * @param {string} mode - The new display mode
 */
export async function handleBgImageModeChange(mode) {
    try {
        // Load current image
        const bgData = await loadBgImage();
        if (!bgData) return;

        // Save with new mode
        await saveBgImage(bgData.dataUrl, mode);

        // Apply new mode
        const body = document.body;
        body.classList.remove('bg-mode-cover', 'bg-mode-center', 'bg-mode-tile');
        body.classList.add(`bg-mode-${mode}`);
    } catch (error) {
        console.error('Failed to change display mode:', error);
    }
}

// ============================================================================
// UI STATE
// ============================================================================

/**
 * Update the background image UI elements
 * @param {string|null} dataUrl - The image data URL (null if no image)
 * @param {string} mode - The display mode
 * @param {Object} AppState - AppState dependency
 * @param {Object} [deps={}] - Optional dependencies { getElementById }
 */
export function updateBgImageUI(dataUrl, mode, AppState, deps = {}) {
    const getElementById = deps.getElementById || ((id) => document.getElementById(id));

    const optionsDiv = getElementById(DOM_IDS.BG_IMAGE_OPTIONS);
    const removeBtn = getElementById(DOM_IDS.BG_IMAGE_REMOVE_BTN);
    const preview = getElementById(DOM_IDS.BG_IMAGE_PREVIEW);
    const modeSelect = getElementById(DOM_IDS.BG_IMAGE_MODE);
    const visibleToggle = getElementById(DOM_IDS.TOGGLE_BG_IMAGE_VISIBLE);

    if (dataUrl) {
        // Show options and remove button
        if (optionsDiv) optionsDiv.style.display = 'block';
        if (removeBtn) removeBtn.style.display = 'inline-block';
        if (preview) preview.src = dataUrl;
        if (modeSelect) modeSelect.value = mode;

        // Set the visibility toggle state from saved preference
        if (visibleToggle) {
            const customColors = AppState?.get()?.settings?.customColors || {};
            visibleToggle.checked = customColors.showBgImage !== false; // Default to true
        }
    } else {
        // Hide options and remove button
        if (optionsDiv) optionsDiv.style.display = 'none';
        if (removeBtn) removeBtn.style.display = 'none';
        if (preview) preview.src = '';
        if (modeSelect) modeSelect.value = 'cover';
    }
}

/**
 * Handle background image visibility toggle
 * @param {boolean} visible - Whether the background image should be visible
 * @param {Object} AppState - AppState dependency
 */
export function handleBgImageVisibleToggle(visible, AppState) {
    console.log('🖼️ Background image visibility toggle:', visible);

    // Save to appState
    if (AppState) {
        AppState.update(state => {
            if (!state.settings.customColors) {
                state.settings.customColors = {};
            }
            state.settings.customColors.showBgImage = visible;
        });
    }

    // Toggle body class to show/hide background image
    // The image data stays in IndexedDB, we just hide/show it via CSS class
    document.body.classList.toggle('has-bg-image', visible);

    // Update status bar color (black for custom background, blue for default)
    updateThemeColor();
}

/**
 * Initialize background image on startup
 * @param {Object} AppState - AppState dependency
 */
export async function initBgImage(AppState) {
    try {
        const bgData = await loadBgImage();
        if (bgData) {
            applyBgImage(bgData.dataUrl, bgData.mode, AppState);
            updateBgImageUI(bgData.dataUrl, bgData.mode, AppState);
        }
    } catch (error) {
        console.warn('Failed to initialize background image:', error);
    }
}
