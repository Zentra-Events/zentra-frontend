"use client";

import { useEffect } from "react";
import { draftCleanup } from "@/lib/draft/cleanup";

interface DraftProviderProps {
    children: React.ReactNode;
}

/**
 * Application-level draft provider.
 *
 * Runs IndexedDB draft cleanup on startup so abandoned drafts are reaped
 * according to the retention policy. Individual editors register themselves
 * as active (via the auto-save hook) so cleanup never removes an in-use
 * draft. This provider is optional for modules that manage cleanup
 * themselves, but keeps the retention policy centralized.
 */
export function DraftProvider({ children }: DraftProviderProps) {
    useEffect(() => {
        void draftCleanup.cleanupExpired();
    }, []);

    return <>{children}</>;
}
