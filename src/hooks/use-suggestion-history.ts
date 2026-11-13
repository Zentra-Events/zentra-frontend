"use client";

import { useCallback, useEffect, useState } from "react";
import {
    addSuggestion,
    clearSuggestions,
    getSuggestions,
    saveMany,
} from "@/lib/utils/suggestion-storage";

export interface UseSuggestionHistoryOptions {
    maxSize?: number;
}

export interface UseSuggestionHistoryReturn {
    suggestions: string[];
    add: (value: string) => void;
    commitMany: (values: string[]) => void;
    clear: () => void;
    loaded: boolean;
}

export function useSuggestionHistory(
    storageKey: string,
    options: UseSuggestionHistoryOptions = {},
): UseSuggestionHistoryReturn {
    const maxSize = options.maxSize ?? 100;
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        setSuggestions(getSuggestions(storageKey));
        setLoaded(true);
    }, [storageKey]);

    const add = useCallback(
        (value: string) => {
            const next = addSuggestion(storageKey, value, { maxSize });
            setSuggestions(next);
        },
        [storageKey, maxSize],
    );

    const commitMany = useCallback(
        (values: string[]) => {
            const next = saveMany(storageKey, values, { maxSize });
            setSuggestions(next);
        },
        [storageKey, maxSize],
    );

    const clear = useCallback(() => {
        clearSuggestions(storageKey);
        setSuggestions([]);
    }, [storageKey]);

    return { suggestions, add, commitMany, clear, loaded };
}
