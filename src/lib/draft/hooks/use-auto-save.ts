/**
 * Reusable auto-save hook.
 *
 * Debounces form-data changes and persists them to IndexedDB through the
 * draft lifecycle manager. Revision tracking ensures an older asynchronous
 * write can never overwrite a newer draft. Safe to use across component
 * unmounts and modal closures.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createDraftLifecycleManager } from "../lifecycle";
import { draftCleanup } from "../cleanup";
import type { DraftStatus, UseAutoSaveOptions, UseAutoSaveResult } from "../types";

export function useAutoSave<TFormData>({
    adapter,
    identity,
    formData,
    enabled = true,
    debounceMs = 750,
    onStatusChange,
}: UseAutoSaveOptions<TFormData>): UseAutoSaveResult {
    const lifecycleRef = useRef<ReturnType<typeof createDraftLifecycleManager<TFormData>> | null>(null);
    if (!lifecycleRef.current) {
        lifecycleRef.current = createDraftLifecycleManager(adapter);
    }
    const lifecycle = lifecycleRef.current;

    const [status, setStatusState] = useState<DraftStatus>("editing");
    const statusRef = useRef<DraftStatus>("editing");
    const formDataRef = useRef(formData);
    formDataRef.current = formData;

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const writeSeqRef = useRef(0);

    const setStatus = (next: DraftStatus) => {
        statusRef.current = next;
        setStatusState(next);
        onStatusChange?.(next);
    };

    const persist = useCallback(async () => {
        if (!enabled) return;
        const seq = ++writeSeqRef.current;
        setStatus("saving");
        try {
            await lifecycle.enqueueWrite(identity.draftId, formDataRef.current, {
                status: "editing",
            });
            if (seq === writeSeqRef.current) {
                setStatus("editing");
            }
        } catch {
            if (seq === writeSeqRef.current) {
                setStatus("failed");
            }
        }
    }, [enabled, identity.draftId, lifecycle]);

    // Restart the debounce timer whenever form data changes.
    useEffect(() => {
        if (!enabled) return;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            void persist();
        }, debounceMs);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [formData, enabled, debounceMs, persist]);

    const flush = useCallback(async () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
            await persist();
        }
        await lifecycle.flush();
    }, [lifecycle, persist]);

    const markSynced = useCallback(
        (serverRevision?: string | number, serverDataHash?: string) => {
            setStatus("synced");
            void lifecycle.markSynced(identity.draftId, serverRevision, serverDataHash);
        },
        [lifecycle, identity.draftId],
    );

    const markFailed = useCallback(() => {
        setStatus("failed");
        void lifecycle.markFailed(identity.draftId);
    }, [lifecycle, identity.draftId]);

    // Track this draft as actively edited so cleanup never removes it.
    useEffect(() => {
        if (!enabled || !identity.draftId) return;
        draftCleanup.trackActive(identity.draftId);
        return () => {
            draftCleanup.releaseActive(identity.draftId);
        };
    }, [enabled, identity.draftId]);

    // Flush any pending write on unmount so the latest draft survives closure.
    useEffect(() => {
        return () => {
            void flush();
        };
    }, [flush]);

    return { status, flush, markSynced, markFailed };
}
