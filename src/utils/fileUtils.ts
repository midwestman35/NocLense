/**
 * File utility functions for log file handling
 */

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
    WARNING: 50 * 1024 * 1024,  // 50 MB - show warning
    MAX_RECOMMENDED: 200 * 1024 * 1024,  // 200 MB - warn strongly
    // Note: No hard limit, but browser memory constraints apply
} as const;

/**
 * Format file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Check if file size should trigger a warning
 */
export function shouldWarnAboutFileSize(fileSize: number): boolean {
    return fileSize >= FILE_SIZE_LIMITS.WARNING;
}

/**
 * Check if file size exceeds recommended maximum
 */
export function exceedsRecommendedSize(fileSize: number): boolean {
    return fileSize >= FILE_SIZE_LIMITS.MAX_RECOMMENDED;
}

/**
 * Get file size warning message
 */
export function getFileSizeWarning(fileSize: number): string | null {
    if (exceedsRecommendedSize(fileSize)) {
        return `⚠️ Large file detected (${formatFileSize(fileSize)}). Parsing may take a while and could impact performance.`;
    }
    if (shouldWarnAboutFileSize(fileSize)) {
        return `Large file detected (${formatFileSize(fileSize)}). Processing...`;
    }
    return null;
}

/**
 * Validate file before processing
 */
export function validateFile(file: File): { valid: boolean; error?: string; warning?: string } {
    // Check file extension
    const validExtensions = ['.log', '.txt', '.csv'];
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
        return {
            valid: false,
            error: `Invalid file type. Please select a .log, .txt, or .csv file.`
        };
    }

    // Check file size warnings
    const warning = getFileSizeWarning(file.size);
    
    return {
        valid: true,
        warning: warning || undefined
    };
}

