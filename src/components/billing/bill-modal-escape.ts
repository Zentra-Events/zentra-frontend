"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps the Escape key inside a modal that is nested in another modal.
 *
 * The parent modal listens for Escape on the document, so a nested modal has
 * to intercept the key during the capture phase. Otherwise Escape would close
 * the nested modal and the parent modal at the same time.
 */
export function useNestedModalEscape(active: boolean, onEscape: () => void) {
    const callbackRef = useRef(onEscape);
    callbackRef.current = onEscape;

    useEffect(() => {
        if (!active) return;

        const handler = (event: KeyboardEvent) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            event.preventDefault();
            callbackRef.current();
        };

        document.addEventListener("keydown", handler, true);
        return () => document.removeEventListener("keydown", handler, true);
    }, [active]);
}
