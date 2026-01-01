/**
 * Message cleanup utilities for LogScrub
 * Simplifies component names and messages for better readability
 */

export interface ServiceMappings {
    [key: string]: string;
}

export interface CleanupResult {
    displayComponent: string;
    displayMessage: string;
    discoveredService?: string; // The raw service name extracted from the path
}

// Will be loaded from /service-mappings.json
let serviceMappings: ServiceMappings = {};

/**
 * Load service mappings from JSON file
 */
export async function loadServiceMappings(): Promise<ServiceMappings> {
    try {
        const response = await fetch('/service-mappings.json');
        if (response.ok) {
            serviceMappings = await response.json();
            console.log(`Loaded ${Object.keys(serviceMappings).length} service mappings`);
        }
    } catch (error) {
        console.warn('Could not load service-mappings.json, using defaults:', error);
    }
    return serviceMappings;
}

/**
 * Extract service name from pekko actor path
 * Pattern: pekko://operator-actor-system/user/controller/view-manager/{SERVICE}/...
 */
function extractServiceFromPath(componentPath: string): string | null {
    // Try to match pekko actor system paths within controller
    // Matches .../controller/group/service...
    const pekkoMatch = componentPath.match(/\/controller\/((?:[^/$]+\/?)+)/);
    if (pekkoMatch) {
        const fullPath = pekkoMatch[1];
        const segments = fullPath.split('/').filter(s => s && !s.startsWith('$'));
        return segments[segments.length - 1];
    }

    // Try to match simpler patterns
    const simpleMatch = componentPath.match(/\/([^\/\$]+)$/);
    if (simpleMatch) {
        return simpleMatch[1];
    }

    return null;
}

/**
 * Convert kebab-case or snake_case to PascalCase
 * Examples:
 *   report-processor -> ReportProcessor
 *   audio_stream_handler -> AudioStreamHandler
 */
function toPascalCase(str: string): string {
    return str
        .split(/[-_]/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

/**
 * Clean up component name
 */
export function cleanComponentName(originalComponent: string): CleanupResult['displayComponent'] {
    const extracted = extractServiceFromPath(originalComponent);

    if (!extracted) {
        // Fallback: try to make the whole path readable
        const lastSegment = originalComponent.split('/').pop()?.replace(/\$[a-z]$/, '');
        return lastSegment ? toPascalCase(lastSegment) : originalComponent;
    }

    // Check if we have a mapping for this service
    const mapped = serviceMappings[extracted.toLowerCase()];
    if (mapped) {
        return mapped;
    }

    // Auto-generate a clean name
    return toPascalCase(extracted);
}

/**
 * Clean up message content
 * - Remove redundant timestamps
 * - Clean up Optional[...] syntax
 * - Remove timezone strings
 */
export function cleanMessage(originalMessage: string): string {
    let cleaned = originalMessage;

    // Remove timestamp patterns like "Wed Dec 17 2025 09:22:17 GMT-0500 (Eastern Standard Time)"
    cleaned = cleaned.replace(/\b[A-Z][a-z]{2}\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT[+-]\d{4}\s+\([^)]+\)/g, '');

    // Remove standalone time patterns like "at 09:23:08 EST"
    cleaned = cleaned.replace(/\s+at\s+\d{2}:\d{2}:\d{2}\s+[A-Z]{2,4}/g, '');

    // Clean up Optional[value] -> value
    cleaned = cleaned.replace(/Optional\[([^\]]+)\]/g, '$1');

    // Clean up multiple spaces
    cleaned = cleaned.replace(/\s+/g, ' ');

    // Remove leading/trailing commas or brackets artifacts
    cleaned = cleaned.replace(/^[\s,\]]+|[\s,\[]+$/g, '');

    // Remove standalone timestamp markers like "[CallTakingTimestamp] 548893269616100:"
    cleaned = cleaned.replace(/\[CallTakingTimestamp\]\s+\d+:\s*/g, '');

    return cleaned.trim();
}

/**
 * Clean both component and message
 */
export function cleanupLogEntry(component: string, message: string): CleanupResult {
    // First, check if the message starts with a pekko path
    // Pattern: [pekko://operator-actor-system/user/controller/...]
    const messagePekkoMatch = message.match(/^\[pekko:\/\/operator-actor-system\/user\/controller\/((?:[^/$\]]+\/?)+)/);

    let extractedService: string | null = null;
    let cleanedMessage = message;

    if (messagePekkoMatch) {
        // Extract service path from message
        const fullPath = messagePekkoMatch[1]; // e.g., "model-manager/reports-manager-router/"

        // Take the last meaningful segment as the service name
        const segments = fullPath.split('/').filter(s => s && !s.startsWith('$'));
        extractedService = segments[segments.length - 1];

        // Remove the pekko path from the message
        cleanedMessage = message.replace(/^\[pekko:\/\/[^\]]+\]\s*/, '');
    } else {
        // Try extracting from component as fallback
        extractedService = extractServiceFromPath(component);
    }

    // Map the service name or auto-generate
    let displayComponent: string;
    if (extractedService) {
        const mapped = serviceMappings[extractedService.toLowerCase()];
        displayComponent = mapped || toPascalCase(extractedService);
    } else {
        // Fallback to cleaning the component name
        const lastSegment = component.split('.').pop()?.split('-')[0];
        displayComponent = lastSegment ? toPascalCase(lastSegment) : component;
    }

    return {
        displayComponent,
        displayMessage: cleanMessage(cleanedMessage),
        discoveredService: extractedService || undefined,
    };
}

/**
 * Discover all unique services from a list of component paths
 */
export function discoverServices(components: string[]): {
    all: string[];
    mapped: string[];
    unmapped: string[];
} {
    const discovered = new Set<string>();

    components.forEach(comp => {
        const service = extractServiceFromPath(comp);
        if (service) {
            discovered.add(service);
        }
    });

    const all = Array.from(discovered);
    const mapped = all.filter(s => serviceMappings[s.toLowerCase()]);
    const unmapped = all.filter(s => !serviceMappings[s.toLowerCase()]);

    return { all, mapped, unmapped };
}

/**
 * Get current service mappings
 */
export function getServiceMappings(): ServiceMappings {
    return { ...serviceMappings };
}
