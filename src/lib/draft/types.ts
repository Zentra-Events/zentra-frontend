/**
 * Reusable draft management infrastructure - core types.
 *
 * This layer is intentionally generic and knows nothing about estimates,
 * checklists, or any other business domain. Entity-specific concerns are
 * encapsulated in an adapter (see src/lib/draft/adapters).
 */

export type DraftStatus = "editing" | "saving" | "synced" | "failed";

export interface DraftIdentity {
    entityType: string;
    entityId: string;
    draftId: string;
    enquiryId?: string;
    eventId?: string;
}

export interface DraftRecord<TFormData = unknown> {
    draftId: string;
    entityType: string;
    entityId: string;
    enquiryId?: string;
    eventId?: string;
    formData: TFormData;
    createdAt: number;
    lastModifiedAt: number;
    lastServerSaveAt?: number;
    localRevision: number;
    serverRevision?: string | number;
    serverDataHash?: string;
    status: DraftStatus;
}

export interface DraftMetadata {
    draftId: string;
    entityType: string;
    entityId: string;
    enquiryId?: string;
    eventId?: string;
    createdAt: number;
    lastModifiedAt: number;
    lastServerSaveAt?: number;
    localRevision: number;
    serverRevision?: string | number;
    status: DraftStatus;
}

export type DraftRelation = "local-newer" | "server-newer" | "identical" | "conflict";

export interface ComparisonResult {
    relation: DraftRelation;
    local?: DraftMetadata;
    server: unknown;
    serverRevision?: string | number;
}

export interface RecoveryInfo {
    title: string;
    subtitle?: string;
    lastModified: string;
    entityId?: string;
    enquiryId?: string;
    eventId?: string;
}

export interface DraftSaveOptions {
    /** When true the draft is marked as actively being sent to the server. */
    saving?: boolean;
    /** Revision returned by the server after a successful save. */
    serverRevision?: string | number;
    /** Hash of the server payload that was saved, used for change detection. */
    serverDataHash?: string;
}

export interface DraftAdapter<TFormData, TServerData = unknown> {
    entityType: string;
    /** Build a stable draft identity from the current editing context. */
    getIdentity(context: {
        entityId?: string;
        enquiryId?: string;
        eventId?: string;
    }): DraftIdentity;
    /** Strip non-persistable / derived values before storing. */
    serialize(formData: TFormData): TFormData;
    /** Rehydrate stored form data into an editor-consumable shape. */
    restore(stored: TFormData): TFormData;
    /** Load the current server record for comparison / recovery. */
    loadServerData(identity: DraftIdentity): Promise<TServerData | null>;
    /** Persist to the backend and return the server record (or null on failure). */
    saveToServer(formData: TFormData): Promise<TServerData | null>;
    /** Compare local form data against server data to decide recovery. */
    compare(localFormData: TFormData, serverData: TServerData | null): ComparisonResult;
    /** Human readable label shown in recovery / protection dialogs. */
    getDraftLabel(formData: TFormData): string;
    /** Detailed recovery information shown to the user. */
    getRecoveryInfo(formData: TFormData, metadata: DraftMetadata): RecoveryInfo;
}

export interface DraftConfig {
    /** Draft retention in milliseconds. Defaults to 30 days. */
    retentionMs?: number;
    /** Auto-save debounce in milliseconds. Defaults to 750ms. */
    debounceMs?: number;
    /** Whether IndexedDB persistence is enabled. */
    enabled?: boolean;
}

export interface UseAutoSaveOptions<TFormData> {
    adapter: DraftAdapter<TFormData, unknown>;
    identity: DraftIdentity;
    /** Latest editor form data (serialized by the adapter before persisting). */
    formData: TFormData;
    /** Whether auto-save is currently active. */
    enabled?: boolean;
    debounceMs?: number;
    /** Optional callback invoked when the draft save status changes. */
    onStatusChange?: (status: DraftStatus) => void;
}

export interface UseAutoSaveResult {
    status: DraftStatus;
    /** Persist the latest form data immediately (awaits the write). */
    flush: () => Promise<void>;
    /** Mark the draft as synchronized with the server and clear local-only state. */
    markSynced: (serverRevision?: string | number, serverDataHash?: string) => void;
    /** Mark the last server save as failed, preserving the local draft. */
    markFailed: () => void;
}

export interface UseDraftProtectionOptions {
    /** Whether there are unsaved changes not yet confirmed at the server. */
    isDirty: boolean;
    /** Whether protection is active. Defaults to true. */
    enabled?: boolean;
    /** Invoked when the user confirms a save before closing. */
    onSaveBeforeClose?: () => Promise<void>;
    /** Invoked when the user confirms discarding before closing. */
    onDiscardBeforeClose?: () => Promise<void>;
}

export interface UseDraftProtectionResult {
    /** Register a handler that runs before the editor closes (modal / navigation). */
    registerCloseHandler: (handler: () => void | Promise<void>) => void;
    /** Trigger the browser-level beforeunload guard manually. */
    setBeforeUnloadMessage: (message: string) => void;
}
