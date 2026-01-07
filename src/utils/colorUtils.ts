/**
 * Shared color utilities for SIP methods and Call-IDs.
 */

// Simple string-to-color function for Call-IDs etc
export const stc = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    return '#' + '00000'.substring(0, 6 - c.length) + c;
};

// Comprehensive SIP coloring helper
// Returns Tailwind classes for LogRow badges
export const getSipColorClasses = (method: string | null): string => {
    if (!method) return 'bg-slate-700/50 text-slate-400 border-slate-600/30';
    const m = method.toUpperCase();

    // Status Codes (1xx, 2xx, 3xx, 4xx, 5xx, 6xx)
    if (/^[1]/.test(m)) return 'bg-cyan-900/40 text-cyan-400 border-cyan-500/30'; // 1xx Provisional
    if (/^200/.test(m)) return 'bg-emerald-900/40 text-emerald-500 border-emerald-500/30'; // 200 OK
    if (/^[2]/.test(m)) return 'bg-green-900/40 text-green-500 border-green-500/30'; // 2xx Success
    if (/^[4]/.test(m)) return 'bg-orange-900/40 text-orange-400 border-orange-500/30'; // 4xx Client Error
    if (/^[56]/.test(m)) return 'bg-rose-900/40 text-rose-500 border-rose-500/30'; // 5xx/6xx Server/Global Error

    // Methods
    if (['INVITE', 'ACK', 'PRACK', 'UPDATE'].includes(m)) return 'bg-emerald-900/40 text-emerald-500 border-emerald-500/30';
    if (['BYE', 'CANCEL'].includes(m)) return 'bg-amber-900/40 text-amber-500 border-amber-500/30';
    if (m === 'OPTIONS') return 'bg-indigo-900/40 text-indigo-400 border-indigo-500/30';

    return 'bg-slate-800/60 text-slate-400 border-slate-700/50'; // Default (REGISTER, NOTIFY, etc.)
};

// Returns raw hex/rgb color for Timeline markers
export const getSipColorHex = (method: string | null): string => {
    if (!method) return '#64748b';
    const m = method.toUpperCase();

    if (/^[1]/.test(m)) return '#22d3ee'; // Cyan-400
    if (/^200/.test(m)) return '#10b981'; // Emerald-500
    if (/^[2]/.test(m)) return '#4ade80'; // Green-400
    if (/^[4]/.test(m)) return '#fb923c'; // Orange-400
    if (/^[56]/.test(m)) return '#f43f5e'; // Rose-500

    if (['INVITE', 'ACK', 'PRACK', 'UPDATE'].includes(m)) return '#10b981'; // Emerald-500
    if (['BYE', 'CANCEL'].includes(m)) return '#f59e0b'; // Amber-500
    if (m === 'OPTIONS') return '#818cf8'; // Indigo-400

    return '#64748b'; // Slate-500
};
