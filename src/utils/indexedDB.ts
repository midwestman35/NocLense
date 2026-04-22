/**
 * IndexedDB wrapper for storing and querying LogEntry objects
 * This allows handling files of any size without memory exhaustion
 */

import type { LogEntry } from '../types';
import type { Case } from '../types/case';

export const DB_NAME = 'NocLenseDB';
export const DB_VERSION = 5;
const SEARCH_INDEX_STORE = 'search_index';
const MAX_TRIGRAM_IDS = 25000;
const STORE_NAME = 'logs';
const METADATA_STORE = 'metadata';
const CASES_STORE = 'cases';

interface DBMetadata {
    totalLogs: number;
    fileNames: string[];
    dateRange: { min: number; max: number };
    lastUpdated: number;
}

function createCasesStore(db: IDBDatabase): void {
    const casesStore = db.createObjectStore(CASES_STORE, { keyPath: 'id' });
    casesStore.createIndex('createdAt', 'createdAt', { unique: false });
    casesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
}

export class IndexedDBManager {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<IDBDatabase> | null = null;

    /**
     * Initialize IndexedDB database
     */
    async init(): Promise<IDBDatabase> {
        if (this.db) return this.db;
        if (this.initPromise) return this.initPromise;

        if (typeof indexedDB === 'undefined') {
            return Promise.reject(new Error('IndexedDB is not available in this environment.'));
        }

        const openPromise = new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            let settled = false;

            const rejectOnce = (error: Error) => {
                if (settled) return;
                settled = true;
                reject(error);
            };

            const resolveOnce = () => {
                if (settled) return;
                settled = true;
                this.db = request.result;
                resolve(this.db);
            };

            request.onerror = () => {
                rejectOnce(new Error(`Failed to open IndexedDB database "${DB_NAME}": ${request.error?.message ?? 'Unknown error'}`));
            };
            request.onblocked = () => {
                const message = `IndexedDB upgrade for "${DB_NAME}" is blocked by another open NocLense tab. Close other tabs and reload.`;
                console.warn(message);
                rejectOnce(new Error(message));
            };
            request.onsuccess = () => {
                resolveOnce();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                const oldVersion = (event as IDBVersionChangeEvent).oldVersion;

                // Create logs store with indexes
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const logsStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: false });
                    logsStore.createIndex('timestamp', 'timestamp', { unique: false });
                    logsStore.createIndex('level', 'level', { unique: false });
                    logsStore.createIndex('component', 'component', { unique: false });
                    logsStore.createIndex('displayComponent', 'displayComponent', { unique: false });
                    logsStore.createIndex('callId', 'callId', { unique: false });
                    logsStore.createIndex('fileName', 'fileName', { unique: false });
                    logsStore.createIndex('isSip', 'isSip', { unique: false });
                    logsStore.createIndex('reportId', 'reportId', { unique: false });
                    logsStore.createIndex('operatorId', 'operatorId', { unique: false });
                    logsStore.createIndex('extensionId', 'extensionId', { unique: false });
                }

                // V2: add cncID / messageID indexes for correlation
                if (oldVersion < 2) {
                    const tx = (event.target as IDBOpenDBRequest).transaction;
                    if (tx) {
                        const store = tx.objectStore(STORE_NAME);
                        if (!store.indexNames.contains('cncID')) store.createIndex('cncID', 'cncID', { unique: false });
                        if (!store.indexNames.contains('messageID')) store.createIndex('messageID', 'messageID', { unique: false });
                    }
                }

                // V3: add embedding status index for retrieval augmentation
                if (oldVersion < 3) {
                    const tx = (event.target as IDBOpenDBRequest).transaction;
                    if (tx) {
                        const store = tx.objectStore(STORE_NAME);
                        if (!store.indexNames.contains('hasEmbedding')) {
                            store.createIndex('hasEmbedding', 'hasEmbedding', { unique: false });
                        }
                    }
                }

                // V4: add search_index store for trigram text search
                if (oldVersion < 4) {
                    if (!db.objectStoreNames.contains(SEARCH_INDEX_STORE)) {
                        db.createObjectStore(SEARCH_INDEX_STORE, { keyPath: 'trigram' });
                    }
                }

                // V5: add cases store for Case Library persistence
                if (oldVersion < 5) {
                    if (!db.objectStoreNames.contains(CASES_STORE)) {
                        createCasesStore(db);
                    } else {
                        const tx = (event.target as IDBOpenDBRequest).transaction;
                        if (tx) {
                            const store = tx.objectStore(CASES_STORE);
                            if (!store.indexNames.contains('createdAt')) {
                                store.createIndex('createdAt', 'createdAt', { unique: false });
                            }
                            if (!store.indexNames.contains('updatedAt')) {
                                store.createIndex('updatedAt', 'updatedAt', { unique: false });
                            }
                        }
                    }
                }

                // Create metadata store
                if (!db.objectStoreNames.contains(METADATA_STORE)) {
                    db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
                }
            };
        });

        this.initPromise = openPromise.catch((error) => {
            this.initPromise = null;
            throw error;
        });

        return this.initPromise;
    }

    close(): void {
        if (this.db) {
            this.db.close();
        }
        this.db = null;
        this.initPromise = null;
    }

    /**
     * Get database instance (ensure initialized)
     */
    private async getDB(): Promise<IDBDatabase> {
        if (!this.db) {
            await this.init();
        }
        if (!this.db) throw new Error('Failed to initialize IndexedDB');
        return this.db;
    }

    /**
     * Add a single log entry
     */
    async addLog(log: LogEntry): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(log);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Add multiple log entries in batch (more efficient).
     * Splits into sub-batches of 500, retries once on failure per sub-batch.
     * @returns The number of logs successfully written.
     */
    async addLogsBatch(logs: LogEntry[]): Promise<number> {
        const db = await this.getDB();
        const SUB_BATCH_SIZE = 500;
        let totalWritten = 0;

        for (let i = 0; i < logs.length; i += SUB_BATCH_SIZE) {
            const subBatch = logs.slice(i, i + SUB_BATCH_SIZE);
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    await new Promise<void>((resolve, reject) => {
                        const transaction = db.transaction([STORE_NAME], 'readwrite');
                        const store = transaction.objectStore(STORE_NAME);

                        let completed = 0;
                        let hasError = false;

                        subBatch.forEach((log) => {
                            const request = store.put(log);
                            request.onsuccess = () => {
                                completed++;
                                if (completed === subBatch.length && !hasError) {
                                    resolve();
                                }
                            };
                            request.onerror = () => {
                                if (!hasError) {
                                    hasError = true;
                                    reject(request.error);
                                }
                            };
                        });
                    });
                    totalWritten += subBatch.length;
                    break;
                } catch (error) {
                    if (attempt === 0) {
                        // Wait 100ms then retry once
                        await new Promise(r => setTimeout(r, 100));
                    } else {
                        console.error(
                            `IndexedDB: sub-batch ${Math.floor(i / SUB_BATCH_SIZE) + 1} failed after retry (${subBatch.length} logs lost):`,
                            error
                        );
                    }
                }
            }
        }

        return totalWritten;
    }

    /**
     * Get log by ID
     */
    async getLog(id: number): Promise<LogEntry | undefined> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get logs by ID range (for virtual scrolling)
     */
    async getLogsByIdRange(startId: number, endId: number): Promise<LogEntry[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const results: LogEntry[] = [];
            
            const range = IDBKeyRange.bound(startId, endId);
            const request = store.openCursor(range);
            
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    /**
     * Update a contiguous ID range with shared fields such as import provenance.
     */
    async updateLogsByIdRange(startId: number, endId: number, updates: Partial<LogEntry>): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const range = IDBKeyRange.bound(startId, endId);
            const request = store.openCursor(range);

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (!cursor) {
                    resolve();
                    return;
                }

                const value = { ...cursor.value, ...updates };
                cursor.update(value);
                cursor.continue();
            };

            request.onerror = () => reject(request.error);
        });
    }


    /**
     * Get logs by timestamp range (for timeline and filtering)
     */
    async getLogsByTimestampRange(startTime: number, endTime: number, limit?: number): Promise<LogEntry[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('timestamp');
            const results: LogEntry[] = [];
            
            const range = IDBKeyRange.bound(startTime, endTime);
            const request = index.openCursor(range);
            
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor && (!limit || results.length < limit)) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get logs with filters (component, level, callId, etc.)
     */
    async getLogsFiltered(filters: {
        component?: string;
        level?: string;
        callId?: string;
        fileName?: string;
        isSip?: boolean;
        timestampRange?: { start: number; end: number };
        limit?: number;
    }): Promise<LogEntry[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const results: LogEntry[] = [];
            
            // Use most selective index first
            let indexName: string;
            let keyRange: IDBKeyRange | null = null;
            
            if (filters.callId) {
                indexName = 'callId';
                keyRange = IDBKeyRange.only(filters.callId);
            } else if (filters.component) {
                indexName = 'displayComponent';
                keyRange = IDBKeyRange.only(filters.component);
            } else if (filters.fileName) {
                indexName = 'fileName';
                keyRange = IDBKeyRange.only(filters.fileName);
            } else if (filters.timestampRange) {
                indexName = 'timestamp';
                keyRange = IDBKeyRange.bound(filters.timestampRange.start, filters.timestampRange.end);
            } else {
                indexName = 'timestamp';
            }
            
            const index = store.index(indexName);
            const request = keyRange ? index.openCursor(keyRange) : index.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor && (!filters.limit || results.length < filters.limit)) {
                    const log = cursor.value;
                    
                    // Apply remaining filters
                    let matches = true;
                    if (filters.level && log.level !== filters.level) matches = false;
                    if (filters.isSip !== undefined && log.isSip !== filters.isSip) matches = false;
                    if (filters.component && log.displayComponent !== filters.component) matches = false;
                    if (filters.callId && log.callId !== filters.callId) matches = false;
                    if (filters.fileName && log.fileName !== filters.fileName) matches = false;
                    
                    if (matches) {
                        results.push(log);
                    }
                    
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    /**
     * Get the highest log ID currently stored.
     */
    async getMaxLogId(): Promise<number> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.openCursor(null, 'prev');

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                resolve(cursor ? Number(cursor.key) : 0);
            };

            request.onerror = () => reject(request.error);
        });
    }


    /**
     * Get total count of logs
     */
    async getTotalCount(): Promise<number> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.count();
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get count of logs for a specific index value (e.g., count logs per fileName)
     */
    async getCountByIndexValue(indexName: string, value: string): Promise<number> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            
            let index: IDBIndex;
            try {
                index = store.index(indexName);
            } catch {
                resolve(0);
                return;
            }
            
            const request = index.count(IDBKeyRange.only(value));
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get counts for all unique values of an index (e.g., count per fileName)
     * More efficient than calling getCountByIndexValue for each value
     */
    async getCountsByIndex(indexName: string): Promise<Map<string, number>> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            
            let index: IDBIndex;
            try {
                index = store.index(indexName);
            } catch {
                resolve(new Map());
                return;
            }
            
            const counts = new Map<string, number>();
            const request = index.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    const key = cursor.key;
                    if (key !== null && key !== undefined) {
                        const keyStr = String(key);
                        counts.set(keyStr, (counts.get(keyStr) || 0) + 1);
                    }
                    cursor.continue();
                } else {
                    resolve(counts);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all unique values for an index (for correlation sidebar)
     * Optimized to handle null/undefined values
     */
    async getUniqueValues(indexName: string): Promise<Set<string>> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            
            // Handle case where index might not exist
            let index: IDBIndex;
            try {
                index = store.index(indexName);
            } catch {
                // Index doesn't exist, return empty set
                resolve(new Set());
                return;
            }
            
            const values = new Set<string>();
            
            const request = index.openKeyCursor();
            
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    const key = cursor.key;
                    // Only add non-null, non-undefined values
                    if (key !== null && key !== undefined) {
                        values.add(String(key));
                    }
                    cursor.continue();
                } else {
                    resolve(values);
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Iterate all logs with a cursor, calling `visitor` on each record.
     * Memory-efficient: only one record is held at a time.
     */
    async forEachLog(visitor: (log: LogEntry) => void): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.openCursor();

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    visitor(cursor.value as LogEntry);
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all logs
     */
    async clearAll(): Promise<void> {
        const db = await this.getDB();
        // Clear logs store
        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        // Clear search index store (guard: may not exist on older DB versions)
        if (db.objectStoreNames.contains(SEARCH_INDEX_STORE)) {
            await new Promise<void>((resolve, reject) => {
                const transaction = db.transaction([SEARCH_INDEX_STORE], 'readwrite');
                const store = transaction.objectStore(SEARCH_INDEX_STORE);
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
        // Clear metadata store so rehydration doesn't reload stale data
        if (db.objectStoreNames.contains(METADATA_STORE)) {
            await new Promise<void>((resolve, reject) => {
                const transaction = db.transaction([METADATA_STORE], 'readwrite');
                const store = transaction.objectStore(METADATA_STORE);
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    }

    /**
     * Persist embedding vector for a log entry.
     *
     * Why: allows retrieval augmentation across sessions without recomputing
     * embeddings for already-indexed logs.
     */
    async updateLogEmbedding(id: number, embedding: number[]): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                const log = request.result as LogEntry | undefined;
                if (!log) {
                    resolve();
                    return;
                }
                const updated: LogEntry = {
                    ...log,
                    embedding,
                    hasEmbedding: true,
                };
                const putRequest = store.put(updated);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Fetch logs that already have embeddings.
     */
    async getLogsWithEmbeddings(limit?: number): Promise<LogEntry[]> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('hasEmbedding');
            const request = index.openCursor(IDBKeyRange.only(true));
            const results: LogEntry[] = [];

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor && (!limit || results.length < limit)) {
                    results.push(cursor.value as LogEntry);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async saveCase(caseItem: Case): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CASES_STORE], 'readwrite');
            const store = transaction.objectStore(CASES_STORE);
            const request = store.put(caseItem);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async getCase(id: string): Promise<Case | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CASES_STORE], 'readonly');
            const store = transaction.objectStore(CASES_STORE);
            const request = store.get(id);

            request.onsuccess = () => resolve((request.result as Case | undefined) ?? null);
            request.onerror = () => reject(request.error);
        });
    }

    async listCases(opts?: {
        limit?: number;
        orderBy?: 'createdAt' | 'updatedAt';
    }): Promise<Case[]> {
        const db = await this.getDB();
        const limit = opts?.limit;
        const orderBy = opts?.orderBy ?? 'updatedAt';

        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CASES_STORE], 'readonly');
            const store = transaction.objectStore(CASES_STORE);
            const index = store.index(orderBy);
            const request = index.openCursor(null, 'prev');
            const results: Case[] = [];

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor && (!limit || results.length < limit)) {
                    results.push(cursor.value as Case);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    async deleteCase(id: string): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CASES_STORE], 'readwrite');
            const store = transaction.objectStore(CASES_STORE);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async updateCaseEmbedding(id: string, embedding: number[], version: string): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([CASES_STORE], 'readwrite');
            const store = transaction.objectStore(CASES_STORE);
            const request = store.get(id);

            request.onsuccess = () => {
                const caseItem = request.result as Case | undefined;
                if (!caseItem) {
                    resolve();
                    return;
                }

                const updatedCase: Case = {
                    ...caseItem,
                    embedding,
                    embeddingVersion: version,
                };
                const putRequest = store.put(updatedCase);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete logs by file name
     */
    async deleteLogsByFileName(fileName: string): Promise<void> {
        const db = await this.getDB();
        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('fileName');
            const request = index.openKeyCursor(IDBKeyRange.only(fileName));

            const idsToDelete: number[] = [];

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    idsToDelete.push(cursor.primaryKey as number);
                    cursor.continue();
                } else {
                    // Delete all found IDs
                    const deletePromises = idsToDelete.map(id => {
                        return new Promise<void>((resolveDelete, rejectDelete) => {
                            const deleteRequest = store.delete(id);
                            deleteRequest.onsuccess = () => resolveDelete();
                            deleteRequest.onerror = () => rejectDelete(deleteRequest.error);
                        });
                    });

                    Promise.all(deletePromises)
                        .then(() => resolve())
                        .catch(reject);
                }
            };

            request.onerror = () => reject(request.error);
        });

        // Invalidate the trigram search index (partial rebuild not practical)
        if (db.objectStoreNames.contains(SEARCH_INDEX_STORE)) {
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction([SEARCH_INDEX_STORE], 'readwrite');
                const store = tx.objectStore(SEARCH_INDEX_STORE);
                const req = store.clear();
                req.onsuccess = () => resolve();
                req.onerror = () => reject(req.error);
            });
        }
    }

    /**
     * Get metadata
     */
    async getMetadata(): Promise<DBMetadata | null> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([METADATA_STORE], 'readonly');
            const store = transaction.objectStore(METADATA_STORE);
            const request = store.get('main');
            
            request.onsuccess = () => resolve(request.result?.value || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update metadata
     */
    async updateMetadata(metadata: Partial<DBMetadata>): Promise<void> {
        const db = await this.getDB();
        const current = await this.getMetadata();
        return new Promise((resolve, reject) => {
            const updated: DBMetadata = {
                totalLogs: metadata.totalLogs ?? current?.totalLogs ?? 0,
                fileNames: metadata.fileNames ?? current?.fileNames ?? [],
                dateRange: metadata.dateRange ?? current?.dateRange ?? { min: 0, max: 0 },
                lastUpdated: Date.now()
            };

            const transaction = db.transaction([METADATA_STORE], 'readwrite');
            const store = transaction.objectStore(METADATA_STORE);
            const request = store.put({ key: 'main', value: updated });
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get ID range for all logs (for virtual scrolling)
     */
    async getIdRange(): Promise<{ min: number; max: number }> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            
            let minId: number | null = null;
            let maxId: number | null = null;
            
            const request = store.openCursor();
            
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    const id = cursor.primaryKey as number;
                    if (minId === null || id < minId) minId = id;
                    if (maxId === null || id > maxId) maxId = id;
                    cursor.continue();
                } else {
                    resolve({ 
                        min: minId ?? 0, 
                        max: maxId ?? 0 
                    });
                }
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    /**
     * Build a trigram search index over all logs in IndexedDB.
     * Indexes _messageLower, _componentLower, and _callIdLower fields.
     * Clears and fully rebuilds the search_index store each time.
     */
    async buildTrigramIndex(): Promise<void> {
        const db = await this.getDB();
        if (!db.objectStoreNames.contains(SEARCH_INDEX_STORE)) return;

        // Clear existing index
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction([SEARCH_INDEX_STORE], 'readwrite');
            const store = tx.objectStore(SEARCH_INDEX_STORE);
            const req = store.clear();
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });

        // Build trigram map in memory
        const trigramMap = new Map<string, Set<number>>();
        let processed = 0;

        const addTrigrams = (text: string, logId: number) => {
            if (!text || text.length < 3) return;
            for (let i = 0; i <= text.length - 3; i++) {
                const tri = text.substring(i, i + 3);
                let ids = trigramMap.get(tri);
                if (!ids) {
                    ids = new Set<number>();
                    trigramMap.set(tri, ids);
                }
                if (ids.size < MAX_TRIGRAM_IDS) {
                    ids.add(logId);
                }
            }
        };

        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const request = store.openCursor();

            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    const log = cursor.value as LogEntry;
                    const logId = log.id;
                    addTrigrams(log._messageLower || '', logId);
                    addTrigrams(log._componentLower || '', logId);
                    addTrigrams(log._callIdLower || '', logId);
                    processed++;
                    cursor.continue();
                } else {
                    resolve();
                }
            };
            request.onerror = () => reject(request.error);
        });

        if (processed === 0) return;

        // Write trigram map to IDB in batches
        const WRITE_BATCH = 500;
        const entries = Array.from(trigramMap.entries());
        for (let i = 0; i < entries.length; i += WRITE_BATCH) {
            const batch = entries.slice(i, i + WRITE_BATCH);
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction([SEARCH_INDEX_STORE], 'readwrite');
                const store = tx.objectStore(SEARCH_INDEX_STORE);
                let completed = 0;
                let hasError = false;

                batch.forEach(([trigram, ids]) => {
                    const req = store.put({ trigram, logIds: Array.from(ids) });
                    req.onsuccess = () => {
                        completed++;
                        if (completed === batch.length && !hasError) resolve();
                    };
                    req.onerror = () => {
                        if (!hasError) { hasError = true; reject(req.error); }
                    };
                });
            });

            // Yield to event loop every batch to stay non-blocking
            if (i + WRITE_BATCH < entries.length) {
                await new Promise<void>(r => setTimeout(r, 0));
            }
        }

        console.log(`Trigram index built: ${trigramMap.size} trigrams from ${processed} logs`);
    }

    /**
     * Search the trigram index for candidate log IDs matching a query.
     * @returns Array of candidate log IDs, null if index is empty/not built or query < 3 chars.
     */
    async searchByTrigram(query: string): Promise<number[] | null> {
        if (query.length < 3) return null;

        const db = await this.getDB();
        if (!db.objectStoreNames.contains(SEARCH_INDEX_STORE)) return null;
        const lowerQuery = query.toLowerCase();

        // Extract trigrams from query
        const queryTrigrams: string[] = [];
        for (let i = 0; i <= lowerQuery.length - 3; i++) {
            queryTrigrams.push(lowerQuery.substring(i, i + 3));
        }
        if (queryTrigrams.length === 0) return null;

        // Look up each trigram
        const trigramResults: Array<{ trigram: string; logIds: number[] }> = [];
        for (const tri of queryTrigrams) {
            const result = await new Promise<{ trigram: string; logIds: number[] } | undefined>((resolve, reject) => {
                const tx = db.transaction([SEARCH_INDEX_STORE], 'readonly');
                const store = tx.objectStore(SEARCH_INDEX_STORE);
                const req = store.get(tri);
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });

            if (!result) {
                // Trigram not in index — index may be incomplete or query has no matches
                return [];
            }
            trigramResults.push(result);
        }

        if (trigramResults.length === 0) return null;

        // Intersect: start with smallest set for efficiency
        trigramResults.sort((a, b) => a.logIds.length - b.logIds.length);

        let candidateSet = new Set<number>(trigramResults[0].logIds);
        for (let i = 1; i < trigramResults.length; i++) {
            // Skip saturated trigrams (they aren't selective)
            if (trigramResults[i].logIds.length >= MAX_TRIGRAM_IDS) continue;
            const nextSet = new Set<number>(trigramResults[i].logIds);
            candidateSet = new Set([...candidateSet].filter(id => nextSet.has(id)));
            if (candidateSet.size === 0) return [];
        }

        return Array.from(candidateSet);
    }

    /**
     * Fetch logs by their primary keys in a single transaction.
     * @param ids - Array of log IDs to fetch
     * @returns LogEntry array in the order of the input IDs
     */
    async getLogsByIds(ids: number[]): Promise<LogEntry[]> {
        if (ids.length === 0) return [];
        const db = await this.getDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction([STORE_NAME], 'readonly');
            const store = tx.objectStore(STORE_NAME);
            const results = new Map<number, LogEntry>();
            let completed = 0;
            let hasError = false;

            ids.forEach(id => {
                const req = store.get(id);
                req.onsuccess = () => {
                    if (req.result) results.set(id, req.result);
                    completed++;
                    if (completed === ids.length && !hasError) {
                        // Preserve input order
                        const ordered: LogEntry[] = [];
                        for (const id of ids) {
                            const log = results.get(id);
                            if (log) ordered.push(log);
                        }
                        resolve(ordered);
                    }
                };
                req.onerror = () => {
                    if (!hasError) { hasError = true; reject(req.error); }
                };
            });
        });
    }
}

// Export singleton instance
export const dbManager = new IndexedDBManager();
