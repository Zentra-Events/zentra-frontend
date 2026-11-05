/**
 * Reusable draft recovery mechanism.
 *
 * Detects an existing local draft, compares it with the server record, and
 * determines whether recovery is appropriate. The decision logic is generic;
 * entity-specific labels and server access are provided through the adapter.
 */

import { draftStorage } from "./storage";
import type {
    ComparisonResult,
    DraftAdapter,
    DraftIdentity,
    DraftRecord,
    RecoveryInfo,
} from "./types";

interface RecoveryDecision {
    /** Whether a recovery dialog should be shown. */
    shouldRecover: boolean;
    /** The local draft, if one exists. */
    draft: DraftRecord | null;
    /** The comparison result between local and server. */
    comparison: ComparisonResult | null;
    /** The server record, if retrievable. */
    server: unknown;
    reason: "no-draft" | "stale" | "newer-local" | "network-error" | "identical" | "server-newer";
}

export class DraftRecovery<TFormData = unknown> {
    private adapter: DraftAdapter<TFormData, unknown>;

    constructor(adapter: DraftAdapter<TFormData, unknown>) {
        this.adapter = adapter;
    }

    /**
     * Evaluate whether a local draft should be offered for recovery.
     *
     * 1. No local draft -> load server normally.
     * 2. Local draft older than server -> ignore stale draft.
     * 3. Local draft newer than server -> offer recovery.
     * 4. Server unreachable (network error) -> preserve local, allow recovery.
     * 5. Server newer -> do not overwrite with older local draft.
     * 6. Identical -> treat as synchronized, remove redundant draft.
     */
    async evaluate(
        identity: DraftIdentity,
        localFormData: TFormData,
    ): Promise<RecoveryDecision> {
        const draft = await draftStorage.get<TFormData>(identity.draftId);
        if (!draft) {
            return {
                shouldRecover: false,
                draft: null,
                comparison: null,
                server: null,
                reason: "no-draft",
            };
        }

        let server: unknown = null;
        let serverError = false;
        try {
            server = await this.adapter.loadServerData(identity);
        } catch {
            serverError = true;
        }

        const comparison = this.adapter.compare(localFormData, server);

        if (serverError) {
            // Server unreachable: preserve local draft and allow recovery.
            return {
                shouldRecover: true,
                draft,
                comparison,
                server: null,
                reason: "network-error",
            };
        }

        switch (comparison.relation) {
            case "identical":
                // Redundant draft; remove it and load server.
                await draftStorage.delete(identity.draftId).catch(() => {});
                return {
                    shouldRecover: false,
                    draft: null,
                    comparison,
                    server,
                    reason: "identical",
                };
            case "server-newer":
                // Server is newer; do not overwrite it. Remove the stale local
                // draft silently so the server version loads.
                await draftStorage.delete(identity.draftId).catch(() => {});
                return {
                    shouldRecover: false,
                    draft: null,
                    comparison,
                    server,
                    reason: "server-newer",
                };
            case "local-newer":
            case "conflict":
                return {
                    shouldRecover: true,
                    draft,
                    comparison,
                    server,
                    reason: "newer-local",
                };
            default:
                return {
                    shouldRecover: false,
                    draft,
                    comparison,
                    server,
                    reason: "stale",
                };
        }
    }

    /** Restore the draft's form data into an editor-consumable shape. */
    restore(draft: DraftRecord<TFormData>): TFormData {
        return this.adapter.restore(draft.formData);
    }

    /** Build recovery UI information from a draft. */
    recoveryInfo(draft: DraftRecord<TFormData>, formData: TFormData): RecoveryInfo {
        return this.adapter.getRecoveryInfo(formData, draft);
    }

    /** Discard a draft after explicit user confirmation. */
    async discard(draftId: string): Promise<void> {
        await draftStorage.delete(draftId);
    }
}

export function createDraftRecovery<TFormData = unknown>(
    adapter: DraftAdapter<TFormData, unknown>,
): DraftRecovery<TFormData> {
    return new DraftRecovery(adapter);
}
