/**
 * Generate a unique identifier for editable lines.
 *
 * Uses `crypto.randomUUID()` when available, otherwise falls back to a
 * random string. Kept as a standalone generic utility so both the
 * hierarchical editor and other parts of the app can share it.
 */
export function generateId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `id-${Math.random().toString(36).slice(2, 10)}`;
}