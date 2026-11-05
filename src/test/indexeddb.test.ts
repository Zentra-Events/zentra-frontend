import { describe, it, expect, beforeEach, afterEach } from "vitest";
import indexedDBFactory from "fake-indexeddb";

describe("IndexedDB read/write", () => {
    let db: IDBDatabase;

    beforeEach(async () => {
        (globalThis as any).indexedDB = indexedDBFactory;

        const openRequest = indexedDBFactory.open("test-db", 1);

        openRequest.onupgradeneeded = () => {
            const database = openRequest.result;
            if (!database.objectStoreNames.contains("items")) {
                database.createObjectStore("items", { keyPath: "id", autoIncrement: true });
            }
        };

        db = await new Promise<IDBDatabase>((resolve, reject) => {
            openRequest.onsuccess = () => resolve(openRequest.result);
            openRequest.onerror = () => reject(openRequest.error);
        });
    });

    afterEach(() => {
        db.close();
    });

    it("should write and read data from IndexedDB", async () => {
        const transaction = db.transaction("items", "readwrite");
        const store = transaction.objectStore("items");

        const addRequest = store.add({ name: "test-item", value: 42 });
        await new Promise<void>((resolve, reject) => {
            addRequest.onsuccess = () => resolve();
            addRequest.onerror = () => reject(addRequest.error);
        });

        const getRequest = store.get(1);
        const result = await new Promise<any>((resolve, reject) => {
            getRequest.onsuccess = () => resolve(getRequest.result);
            getRequest.onerror = () => reject(getRequest.error);
        });

        expect(result).toBeDefined();
        expect(result.name).toBe("test-item");
        expect(result.value).toBe(42);
    });

    it("should handle empty database reads", async () => {
        // Use a separate empty database for this test
        const emptyRequest = indexedDBFactory.open("test-db-empty", 1);

        emptyRequest.onupgradeneeded = () => {
            const database = emptyRequest.result;
            if (!database.objectStoreNames.contains("items")) {
                database.createObjectStore("items", { keyPath: "id", autoIncrement: true });
            }
        };

        const emptyDb = await new Promise<IDBDatabase>((resolve, reject) => {
            emptyRequest.onsuccess = () => resolve(emptyRequest.result);
            emptyRequest.onerror = () => reject(emptyRequest.error);
        });

        const transaction = emptyDb.transaction("items", "readonly");
        const store = transaction.objectStore("items");

        const getAllRequest = store.getAll();
        const results = await new Promise<any[]>((resolve, reject) => {
            getAllRequest.onsuccess = () => resolve(getAllRequest.result);
            getAllRequest.onerror = () => reject(getAllRequest.error);
        });

        emptyDb.close();
        expect(results).toEqual([]);
    });
});
