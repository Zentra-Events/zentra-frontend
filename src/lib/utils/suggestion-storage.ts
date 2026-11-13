import {
    getLocalStorageItem,
    removeLocalStorageItem,
    setLocalStorageItem,
} from "./storage";

export function getSuggestions(key: string): string[] {
    if (typeof window === "undefined") return [];
    const raw = getLocalStorageItem(key);
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(
            (item): item is string => typeof item === "string" && item.length > 0,
        );
    } catch {
        return [];
    }
}

export function saveSuggestions(key: string, suggestions: string[]): void {
    if (typeof window === "undefined") return;
    setLocalStorageItem(key, JSON.stringify(suggestions));
}

export function addSuggestion(
    key: string,
    value: string,
    options: { maxSize?: number } = {},
): string[] {
    const maxSize = options.maxSize ?? 100;
    const trimmed = value.trim();
    if (!trimmed) return getSuggestions(key);
    const existing = getSuggestions(key);
    const lower = trimmed.toLowerCase();
    const filtered = existing.filter(item => item.toLowerCase() !== lower);
    const next = [trimmed, ...filtered].slice(0, maxSize);
    saveSuggestions(key, next);
    return next;
}

export function saveMany(
    key: string,
    itemNames: string[],
    options: { maxSize?: number } = {},
): string[] {
    const maxSize = options.maxSize ?? 100;
    const existing = getSuggestions(key);
    const seen = new Set<string>();
    const result: string[] = [];

    // New names first (recently used to the top), preserving input order.
    for (const name of itemNames) {
        const trimmed = name.trim();
        if (!trimmed) continue;
        const lower = trimmed.toLowerCase();
        if (seen.has(lower)) continue;
        seen.add(lower);
        result.push(trimmed);
    }

    // Then existing names that were not re-submitted.
    for (const item of existing) {
        const lower = item.toLowerCase();
        if (seen.has(lower)) continue;
        seen.add(lower);
        result.push(item);
    }

    const next = result.slice(0, maxSize);
    saveSuggestions(key, next);
    return next;
}

export function clearSuggestions(key: string): void {
    if (typeof window === "undefined") return;
    removeLocalStorageItem(key);
}
