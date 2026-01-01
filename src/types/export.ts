export type PackType = 'uc' | 'network' | 'rd' | 'aws' | 'full';
export type RedactionPreset = 'external' | 'internal' | 'raw';
export interface ExportOptions { packType: PackType; redactionPreset: RedactionPreset; includePayload: boolean; timeBufferSeconds: number; maxEvents: number; }
export interface Provenance { importedFiles: string[]; parserVersion?: string; appVersion?: string; redactionPreset: RedactionPreset; exportOptions: ExportOptions; truncationNote?: string; exportedAt: number; }
export interface ExportPack { report: string; caseJson: string; filteredLogs: string; queries: string; provenance: Provenance; }
