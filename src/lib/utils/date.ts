export function getDaysInMonth(year: number, month: number) {
    return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number) {
    return new Date(year, month, 1).getDay();
}

export function toDateKey(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Parse a date/datetime coming from the backend into a Date.
 *
 * The backend stores naive `LocalDateTime` values that represent UTC, e.g.
 * "2026-11-19T09:30:00" (no timezone marker). Passing such a string straight to
 * `new Date()` makes JavaScript interpret it as *local* time, which shifts the
 * value by the browser's timezone offset (e.g. -5:30 for IST). Appending the
 * "Z" marker for timezone-less date-times makes them parse as UTC while leaving
 * values that already carry a timezone (or plain dates) untouched.
 */
export function parseApiDate(value: string | Date): Date {
    if (value instanceof Date) return value;
    const hasTimezone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value);
    const hasTime = value.includes("T");
    return new Date(!hasTimezone && hasTime ? `${value}Z` : value);
}

export function formatDate(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "long",
        day: "numeric",
    };
    return new Date(date).toLocaleDateString("en-US", options ?? defaultOptions);
}

export function formatDateTime(date: string | Date, options?: Intl.DateTimeFormatOptions): string {
    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    };
    return new Date(date).toLocaleDateString("en-US", options ?? defaultOptions);
}

export function formatRelativeTime(date: string | Date): string {
    const now = new Date();
    const target = new Date(date);
    const diffMs = target.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;

    return formatDate(date);
}

/**
 * Formats a timestamp to API format: YYYY-MM-DDTHH:mm:ss
 */
export function formatApiTimestamp(timestamp: string | Date): string {
    const date = new Date(timestamp);
    return date.toISOString().slice(0, 19);
}

/**
 * Formats a timestamp for display (e.g., "2min ago", "1hr ago")
 */
export function formatDisplayTime(timestamp: string | Date): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}min ago`;
    if (diffHours < 24) return `${diffHours}hr ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}

/**
 * Format a date/datetime for display in the shared short format,
 * e.g. "4 Oct 2026". Timezone-less API datetimes are parsed as UTC first so the
 * value is not shifted by the browser timezone offset.
 */
export function formatShortDate(value?: string | Date | null): string {
    if (!value) return "";
    try {
        return parseApiDate(value).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    } catch {
        return typeof value === "string" ? value : "";
    }
}

/**
 * Like {@link formatShortDate} but also includes the time,
 * e.g. "4 Oct 2026, 02:30 pm".
 */
export function formatShortDateTime(value?: string | Date | null): string {
    if (!value) return "";
    try {
        return parseApiDate(value).toLocaleString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return typeof value === "string" ? value : "";
    }
}

/**
 * Format an event schedule from its start/end date-times.
 *
 * - When both are present: "<start date, time> – <end date, time>"
 * - When only one is present: just that date (no time, no trailing separator)
 * - When neither is present: an empty string
 */
export function formatScheduleRange(
    fromDate?: string | Date | null,
    toDate?: string | Date | null,
): string {
    if (fromDate && toDate) {
        return `${formatShortDateTime(fromDate)} – ${formatShortDateTime(toDate)}`;
    }
    if (fromDate) return formatShortDate(fromDate);
    if (toDate) return formatShortDate(toDate);
    return "";
}

