/**
 * Reusable IndexedDB draft cleanup and lifecycle management.
 *
 * Implements a configurable retention policy so abandoned drafts do not
 * accumulate indefinitely, while never removing drafts tied to an active
 * editing session or failed unsynchronized drafts within the retention window.
 */

import { draftStorage } from "./storage";

const DEFAULT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Drafts currently being actively edited (tracked by the auto-save hook).
const activeDrafts = new Set<string>();

let cleanupRunning = false;

export class DraftCleanup {
    private retentionMs: number;

    constructor(retentionMs = DEFAULT_RETENTION_MS) {
        this.retentionMs = retentionMs;
    }

    /** Mark a draft as actively being edited so cleanup skips it. */
    trackActive(draftId: string): void {
        activeDrafts.add(draftId);
    }

    /** Release a draft from active tracking when editing ends. */
    releaseActive(draftId: string): void {
        activeDrafts.delete(draftId);
    }

    /** Check whether a draft is currently being actively edited. */
    isActive(draftId: string): boolean {
        return activeDrafts.has(draftId);
    }

    /**
     * Remove drafts older than the retention window that are not actively
     * being edited. Safe to run on app initialization or when the editor
     * opens. Never runs on every keystroke.
     */
    async cleanupExpired(beforeMs?: number): Promise<string[]> {
        if (cleanupRunning) return [];
        cleanupRunning = true;
        try {
            const cutoff = beforeMs ?? Date.now() - this.retentionMs;
            const removed = await draftStorage.cleanupOlderThan(cutoff, activeDrafts);
            return removed;
        } finally {
            cleanupRunning = false;
        }
    }

    /** Change the retention window at runtime. */
    setRetentionMs(retentionMs: number): void {
        this.retentionMs = retentionMs;
    }

    get activeCount(): number {
        return activeDrafts.size;
    }
}

export const draftCleanup = new DraftCleanup();
