/**
 * IndexedDB wrapper for storing and querying LogEntry objects
 * This allows handling files of any size without memory exhaustion
 */

import type { LogEntry } from '../types';

const DB_NAME = 'NocLenseDB';
const DB_VERSION = 1;
const STORE_NAME = 'logs';
const METADATA_STORE = 'metadata';

interface DBMetadata {
    totalLogs: number;
    fileNames: string[];
    dateRange: { min: number; max: number };
    lastUpdated: number;
}

class IndexedDBManager {
    private db: IDBDatabase | null = null;
    private initPromise: Promise<IDBDatabase> | null = null;

    /**
     * Initialize IndexedDB database
     */
    async init(): Promise<IDBDatabase> {
        if (this.db) return this.db;
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;

                // Create logs store with indexes
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const logsStore = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: false });
                    
                    // Create indexes for efficient querying
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

                // Create metadata store
                if (!db.objectStoreNames.contains(METADATA_STORE)) {
                    db.createObjectStore(METADATA_STORE, { keyPath: 'key' });
                }
            };
        });

        return this.initPromise;
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
     * Add multiple log entries in batch (more efficient)
     */
    async addLogsBatch(logs: LogEntry[]): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            let completed = 0;
            let hasError = false;

            logs.forEach((log) => {
                const request = store.put(log);
                request.onsuccess = () => {
                    completed++;
                    if (completed === logs.length && !hasError) {
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
     * Get all unique values for an index (for correlation sidebar)
     */
    async getUniqueValues(indexName: string): Promise<Set<string>> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index(indexName);
            const values = new Set<string>();
            
            const request = index.openKeyCursor();
            
            request.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    if (cursor.key) values.add(String(cursor.key));
                    cursor.continue();
                } else {
                    resolve(values);
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
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete logs by file name
     */
    async deleteLogsByFileName(fileName: string): Promise<void> {
        const db = await this.getDB();
        return new Promise((resolve, reject) => {
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
        return new Promise(async (resolve, reject) => {
            const current = await this.getMetadata();
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
}

// Export singleton instance
export const dbManager = new IndexedDBManager();
