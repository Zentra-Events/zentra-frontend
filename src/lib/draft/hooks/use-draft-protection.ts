/**
 * Reusable draft protection hook.
 *
 * Guards against data loss when the user closes a modal, refreshes the
 * browser, closes the tab, or navigates away while there are unsaved
 * changes. Uses `beforeunload` for browser-level protection and an optional
 * close handler for modal/programmatic closure.
 *
 * No persistent save-status indicator is exposed; callers only react when
 * an actual user action or exceptional situation requires attention.
 */

import { useCallback, useEffect, useRef } from "react";
import type {
    UseDraftProtectionOptions,
    UseDraftProtectionResult,
} from "../types";

let beforeUnloadHandler: (() => void) | null = null;
let beforeUnloadMessage = "";

function handleBeforeUnload(event: BeforeUnloadEvent) {
    if (!beforeUnloadHandler) return;
    beforeUnloadHandler();
    if (beforeUnloadMessage) {
        event.preventDefault();
        event.returnValue = beforeUnloadMessage;
    }
}

export function useDraftProtection({
    isDirty,
    enabled = true,
    onSaveBeforeClose,
    onDiscardBeforeClose,
}: UseDraftProtectionOptions): UseDraftProtectionResult {
    const dirtyRef = useRef(!!isDirty);
    dirtyRef.current = !!isDirty;
    const onSaveRef = useRef(onSaveBeforeClose);
    onSaveRef.current = onSaveBeforeClose;
    const onDiscardRef = useRef(onDiscardBeforeClose);
    onDiscardRef.current = onDiscardBeforeClose;
    const closeHandlers = useRef<Set<() => void | Promise<void>>>(new Set());

    const registerCloseHandler = useCallback((handler: () => void | Promise<void>) => {
        closeHandlers.current.add(handler);
        return () => closeHandlers.current.delete(handler);
    }, []);

    const setBeforeUnloadMessage = useCallback((message: string) => {
        beforeUnloadMessage = message;
    }, []);

    const runCloseHandlers = useCallback(async () => {
        const handlers = Array.from(closeHandlers.current);
        for (const handler of handlers) {
            try {
                await handler();
            } catch {
                // A close handler must not block closure.
            }
        }
    }, []);

    useEffect(() => {
        if (!enabled) return;
        if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
            window.addEventListener("beforeunload", handleBeforeUnload);
        }
        return () => {
            if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
                window.removeEventListener("beforeunload", handleBeforeUnload);
            }
        };
    }, [enabled]);

    useEffect(() => {
        const active = enabled && dirtyRef.current;
        beforeUnloadHandler = active ? runCloseHandlers : null;
    }, [enabled, dirtyRef.current, runCloseHandlers]);

    return { registerCloseHandler, setBeforeUnloadMessage };
}
