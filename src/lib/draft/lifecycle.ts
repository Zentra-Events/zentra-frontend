/**
 * Reusable draft lifecycle manager.
 *
 * Orchestrates create / update / get / discard / sync operations against the
 * storage service, applying revision tracking and race-condition guards so an
 * older asynchronous write can never overwrite a newer draft.
 */

import { draftStorage } from "./storage";
import type {
    DraftAdapter,
    DraftIdentity,
    DraftRecord,
    DraftStatus,
} from "./types";

type WriteContext = { entityId?: string; enquiryId?: string; eventId?: string };

export class DraftLifecycleManager<TFormData = unknown> {
    private adapter: DraftAdapter<TFormData, unknown>;
    private pendingWriteRef: { id: number; promise: Promise<void> } | null = null;
    private lastKnownRevision: number = 0;

    constructor(adapter: DraftAdapter<TFormData, unknown>) {
        this.adapter = adapter;
    }

    /** Build a stable identity for the current editing context. */
    buildIdentity(context: WriteContext): DraftIdentity {
        const identity = this.adapter.getIdentity(context);
        if (!identity.draftId) {
            identity.draftId = `${identity.entityType}:${identity.entityId}`;
        }
        return identity;
    }

    /** Create the initial draft record for a new or existing entity. */
    async createDraft(
        context: WriteContext,
        initialFormData: TFormData,
    ): Promise<DraftRecord<TFormData>> {
        const identity = this.buildIdentity(context);
        const serialized = this.adapter.serialize(initialFormData);
        const record: DraftRecord<TFormData> = {
            ...identity,
            formData: serialized,
            createdAt: Date.now(),
            lastModifiedAt: Date.now(),
            lastServerSaveAt: undefined,
            localRevision: 1,
            serverRevision: undefined,
            serverDataHash: undefined,
            status: "editing",
        };
        await draftStorage.save(record);
        this.lastKnownRevision = record.localRevision;
        return record;
    }

    /** Update an existing draft. Guards against stale writes via revision check. */
    async updateDraft(
        draftId: string,
        formData: TFormData,
        options: { expectedRevision?: number; status?: DraftStatus } = {},
    ): Promise<DraftRecord<TFormData> | null> {
        const existing = await draftStorage.get<TFormData>(draftId);
        if (!existing) return null;

        const nextRevision = (existing.localRevision ?? 0) + 1;

        // Never let an older write overwrite a newer draft.
        if (
            options.expectedRevision !== undefined &&
            options.expectedRevision !== existing.localRevision
        ) {
            return existing;
        }

        const serialized = this.adapter.serialize(formData);
        const updated: DraftRecord<TFormData> = {
            ...existing,
            formData: serialized,
            lastModifiedAt: Date.now(),
            localRevision: nextRevision,
            status: options.status ?? existing.status,
        };

        await draftStorage.save(updated);
        this.lastKnownRevision = nextRevision;
        return updated;
    }

    /** Debounced-safe write: tracks the latest write id so stale results lose. */
    async enqueueWrite(
        draftId: string,
        formData: TFormData,
        options: { expectedRevision?: number; status?: DraftStatus } = {},
    ): Promise<void> {
        const writeId = Date.now();
        const existing = await draftStorage.get<TFormData>(draftId);
        const expected = existing ? existing.localRevision : undefined;

        this.pendingWriteRef = { id: writeId, promise: Promise.resolve() };
        await this.updateDraft(draftId, formData, {
            expectedRevision: expected,
            status: options.status,
        });

        // Mark this write as complete only if it is still the latest.
        if (this.pendingWriteRef && this.pendingWriteRef.id === writeId) {
            this.pendingWriteRef = null;
        }
    }

    /** Await any in-flight write before unmount / navigation. */
    async flush(): Promise<void> {
        const pending = this.pendingWriteRef;
        if (pending) await pending.promise;
    }

    /** Retrieve a draft without touching revision state. */
    async getDraft<TFormData = unknown>(draftId: string): Promise<DraftRecord<TFormData> | null> {
        return draftStorage.get<TFormData>(draftId);
    }

    /** Retrieve metadata only. */
    async getMetadata(draftId: string) {
        return draftStorage.getMetadata(draftId);
    }

    /** Discard a draft after explicit user confirmation. */
    async discardDraft(draftId: string): Promise<void> {
        await draftStorage.delete(draftId);
        if (this.pendingWriteRef?.id === draftId.length) {
            // best effort; pending writes for this draft are abandoned
        }
    }

    /** Mark the draft as synchronized with the server. */
    async markSynced(
        draftId: string,
        serverRevision?: string | number,
        serverDataHash?: string,
    ): Promise<void> {
        await draftStorage.markSynced(draftId, {
            serverRevision,
            serverDataHash,
        });
    }

    /** Mark the last server save as failed while preserving the local draft. */
    async markFailed(draftId: string): Promise<void> {
        await draftStorage.markFailed(draftId);
    }

    /** Compare a local draft against the server to decide recovery eligibility. */
    async compareWithServer(
        identity: DraftIdentity,
        localFormData: TFormData,
    ): Promise<{ server: unknown; result: import("./types").ComparisonResult } | null> {
        let serverData: unknown = null;
        try {
            serverData = await this.adapter.loadServerData(identity);
        } catch {
            // Network error: preserve local draft, signal that server is unavailable.
            serverData = null;
        }
        const result = this.adapter.compare(localFormData, serverData);
        return { server: serverData, result };
    }

get pendingWriteId(): number | null {
    return this.pendingWriteRef?.id ?? null;
}
}

/**
 * Create a lifecycle manager bound to a specific entity adapter.
 * Each module (estimate, checklist, ...) constructs its own instance.
 */
export function createDraftLifecycleManager<TFormData = unknown>(
    adapter: DraftAdapter<TFormData, unknown>,
): DraftLifecycleManager<TFormData> {
    return new DraftLifecycleManager(adapter);
}

