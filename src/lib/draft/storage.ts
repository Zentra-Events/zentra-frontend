/**
 * Reusable IndexedDB storage service for draft records.
 *
 * Generic over the form-data payload. Handles database initialization,
 * object store creation/upgrades, per-draft CRUD, metadata queries,
 * expiration-based cleanup, and graceful degradation when IndexedDB is
 * unavailable or quota-exceeded.
 */

import type {
    DraftMetadata,
    DraftRecord,
} from "./types";

const DEFAULT_DB_NAME = "zentra_drafts";
const DEFAULT_VERSION = 1;
const STORE_NAME = "drafts";

type StoredDraft = DraftRecord & {
    formData: unknown;
};

function isBrowser(): boolean {
    return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function now(): number {
    return Date.now();
}

export class DraftStorageService {
    private dbName: string;
    private version: number;
    private db: IDBDatabase | null = null;
    private initPromise: Promise<void> | null = null;

    constructor(dbName = DEFAULT_DB_NAME, version = DEFAULT_VERSION) {
        this.dbName = dbName;
        this.version = version;
    }

    /** Ensure the database and object store exist. Lazy-initialized on first use. */
    private async ensureDb(): Promise<void> {
        if (this.db) return;
        if (this.initPromise) return this.initPromise;

        this.initPromise = this.initInternal();
        return this.initPromise;
    }

    private async initInternal(): Promise<void> {
        if (!isBrowser()) return;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                reject(new Error(`IndexedDB open failed: ${request.error?.message ?? "unknown"}`));
            };

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: "draftId" });
                    store.createIndex("entityType", "entityType", { unique: false });
                    store.createIndex("entityId", "entityId", { unique: false });
                    store.createIndex("lastModifiedAt", "lastModifiedAt", { unique: false });
                    store.createIndex("status", "status", { unique: false });
                    store.createIndex("enquiryId", "enquiryId", { unique: false });
                }
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.db.onversionchange = () => {
                    // Another tab is upgrading; close our connection to unblock it.
                    this.db?.close();
                    this.db = null;
                };
                resolve();
            };
        });
    }

    private connection(): IDBDatabase | null {
        return this.db;
    }

    private transaction(
        mode: IDBTransactionMode,
        action: (store: IDBObjectStore) => void | Promise<void>,
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            const db = this.connection();
            if (!db) {
                reject(new Error("IndexedDB database not initialized"));
                return;
            }
            const tx = db.transaction(STORE_NAME, mode);
            tx.onerror = () => {
                reject(new Error(`IndexedDB transaction failed: ${tx.error?.message ?? "unknown"}`));
            };
            tx.onabort = () => {
                reject(new Error("IndexedDB transaction aborted"));
            };
            tx.oncomplete = () => {
                resolve();
            };

            try {
                const result = action(tx.objectStore(STORE_NAME));
                if (result && typeof result.then === "function") {
                    void result.then(resolve, reject);
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /** Persist or update a single draft (upsert by draftId). */
    async save<TFormData>(record: DraftRecord<TFormData>): Promise<void> {
        if (!isBrowser()) return;
        await this.ensureDb();
        const payload: StoredDraft = {
            ...record,
            formData: record.formData,
            lastModifiedAt: now(),
        };
        await this.transaction("readwrite", store => {
            store.put(payload);
        });
    }

    /** Retrieve a single draft by draftId. Returns null when absent. */
    async get<TFormData = unknown>(draftId: string): Promise<DraftRecord<TFormData> | null> {
        if (!isBrowser()) return null;
        await this.ensureDb();
        return new Promise((resolve, reject) => {
            const db = this.connection();
            if (!db) {
                reject(new Error("IndexedDB database not initialized"));
                return;
            }
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(draftId);
            req.onsuccess = () => {
                resolve((req.result as unknown as DraftRecord<TFormData> | undefined) ?? null);
            };
            req.onerror = () => {
                reject(new Error(`IndexedDB get failed: ${req.error?.message ?? "unknown"}`));
            };
        });
    }

    /** Delete a single draft. */
    async delete(draftId: string): Promise<void> {
        if (!isBrowser()) return;
        await this.ensureDb();
        await this.transaction("readwrite", store => {
            store.delete(draftId);
        });
    }

    /** Retrieve metadata only (no formData) for a draft. */
    async getMetadata(draftId: string): Promise<DraftMetadata | null> {
        const record = await this.get<unknown>(draftId);
        if (!record) return null;
        const { formData: _formData, ...metadata } = record;
        return metadata as DraftMetadata;
    }

    /** List metadata for all drafts of a given entity. */
    async getAllByEntity(entityType: string, entityId: string): Promise<DraftMetadata[]> {
        if (!isBrowser()) return [];
        await this.ensureDb();
        return new Promise((resolve, reject) => {
            const db = this.connection();
            if (!db) {
                reject(new Error("IndexedDB database not initialized"));
                return;
            }
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const index = store.index("entityType");
            const range = IDBKeyRange.only(entityType);
            const req = index.openCursor(range);
            const results: DraftMetadata[] = [];
            req.onsuccess = () => {
                const cursor = req.result;
                if (!cursor) {
                    resolve(results.filter(r => r.entityId === entityId));
                    return;
                }
                const record = cursor.value as StoredDraft;
                if (record.entityId === entityId) {
                    const { formData: _formData, ...metadata } = record;
                    results.push(metadata as DraftMetadata);
                }
                cursor.continue();
            };
            req.onerror = () => {
                reject(new Error(`IndexedDB cursor failed: ${req.error?.message ?? "unknown"}`));
            };
        });
    }

    /** List metadata for every draft in the store. Used by cleanup. */
    async getAllDrafts(): Promise<DraftMetadata[]> {
        if (!isBrowser()) return [];
        await this.ensureDb();
        return new Promise((resolve, reject) => {
            const db = this.connection();
            if (!db) {
                reject(new Error("IndexedDB database not initialized"));
                return;
            }
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.openCursor();
            const results: DraftMetadata[] = [];
            req.onsuccess = () => {
                const cursor = req.result;
                if (!cursor) {
                    resolve(results);
                    return;
                }
                const record = cursor.value as StoredDraft;
                const { formData: _formData, ...metadata } = record;
                results.push(metadata as DraftMetadata);
                cursor.continue();
            };
            req.onerror = () => {
                reject(new Error(`IndexedDB all-drafts scan failed: ${req.error?.message ?? "unknown"}`));
            };
        });
    }

    /**
     * Remove drafts older than a cutoff timestamp, excluding any draftIds
     * currently being actively edited. Returns the ids that were removed.
     */
    async cleanupOlderThan(
        beforeMs: number,
        excludeDraftIds: Set<string> = new Set(),
    ): Promise<string[]> {
        if (!isBrowser()) return [];
        await this.ensureDb();
        const all = await this.getAllDrafts();
        const toRemove = all.filter(
            meta => meta.lastModifiedAt < beforeMs && !excludeDraftIds.has(meta.draftId),
        );
        await this.transaction("readwrite", store => {
            for (const meta of toRemove) {
                store.delete(meta.draftId);
            }
        });
        return toRemove.map(meta => meta.draftId);
    }

    /** Mark a draft as synchronized with the server. */
    async markSynced(
        draftId: string,
        options: { serverRevision?: string | number; serverDataHash?: string } = {},
    ): Promise<void> {
        if (!isBrowser()) return;
        await this.ensureDb();
        const record = await this.get<unknown>(draftId);
        if (!record) return;
        const updated: DraftRecord = {
            ...record,
            status: "synced",
            lastServerSaveAt: now(),
            ...(options.serverRevision !== undefined
                ? { serverRevision: options.serverRevision }
                : {}),
            ...(options.serverDataHash !== undefined
                ? { serverDataHash: options.serverDataHash }
                : {}),
        };
        await this.transaction("readwrite", store => {
            store.put(updated);
        });
    }

    /** Mark a draft as failed (last server save did not succeed). */
    async markFailed(draftId: string): Promise<void> {
        if (!isBrowser()) return;
        await this.ensureDb();
        const record = await this.get<unknown>(draftId);
        if (!record) return;
        const updated: DraftRecord = { ...record, status: "failed" };
        await this.transaction("readwrite", store => {
            store.put(updated);
        });
    }

    /** Close the database connection. */
    close(): void {
        this.db?.close();
        this.db = null;
        this.initPromise = null;
    }
}

export const draftStorage = new DraftStorageService();
