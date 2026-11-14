import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    getDaysInMonth,
    getFirstDayOfMonth,
    toDateKey,
    parseApiDate,
    formatDate,
    formatDateTime,
    formatRelativeTime,
    formatApiTimestamp,
    formatDisplayTime,
    toDatePart,
    toLocalDateTime,
    formatShortDate,
    formatShortDateTime,
    toLocalISOString,
    parseLocalDateTime,
    formatLocalDateTime,
    formatScheduleRange,
} from "@/lib/utils/date";

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-13T12:00:00Z"));
});

afterEach(() => {
    vi.useRealTimers();
});

describe("getDaysInMonth", () => {
    it("returns 28 for February 2026", () => {
        expect(getDaysInMonth(2026, 1)).toBe(28);
    });

    it("returns 29 for February 2024", () => {
        expect(getDaysInMonth(2024, 1)).toBe(29);
    });

    it("returns 31 for January", () => {
        expect(getDaysInMonth(2026, 0)).toBe(31);
    });

    it("returns 30 for April", () => {
        expect(getDaysInMonth(2026, 3)).toBe(30);
    });
});

describe("getFirstDayOfMonth", () => {
    it("returns 0 for Sunday", () => {
        expect(getFirstDayOfMonth(2026, 10)).toBe(0);
    });

    it("returns 1 for Monday", () => {
        expect(getFirstDayOfMonth(2026, 5)).toBe(1);
    });
});

describe("toDateKey", () => {
    it("formats YYYY-MM-DD with zero padding", () => {
        expect(toDateKey(2026, 10, 4)).toBe("2026-11-04");
        expect(toDateKey(2026, 0, 3)).toBe("2026-01-03");
    });
});

describe("parseApiDate", () => {
    it("returns Date instances unchanged", () => {
        const d = new Date("2026-11-13T12:00:00Z");
        expect(parseApiDate(d)).toBe(d);
    });

    it("appends Z to timezone-less datetimes", () => {
        const d = parseApiDate("2026-11-19T09:30:00");
        expect(d.getUTCFullYear()).toBe(2026);
        expect(d.getUTCMonth()).toBe(10);
        expect(d.getUTCDate()).toBe(19);
        expect(d.getUTCHours()).toBe(9);
        expect(d.getUTCMinutes()).toBe(30);
    });

    it("leaves Z-suffixed values untouched", () => {
        const d = parseApiDate("2026-11-19T09:30:00Z");
        expect(d.getUTCHours()).toBe(9);
    });

    it("parses plain dates", () => {
        const d = parseApiDate("2026-11-19");
        expect(d.getUTCDate()).toBe(19);
    });
});

describe("formatDate", () => {
    it("formats with default options", () => {
        expect(formatDate("2026-11-04")).toBe("November 4, 2026");
    });

    it("accepts custom options", () => {
        expect(formatDate("2026-11-04", { month: "short" })).toBe("Nov");
    });
});

describe("formatDateTime", () => {
    it("formats date and time", () => {
        expect(formatDateTime("2026-11-04T14:30:00Z")).toContain("2026");
        expect(formatDateTime("2026-11-04T14:30:00Z")).toContain("Nov");
    });
});

describe("formatRelativeTime", () => {
    it("returns Today for the same day", () => {
        expect(formatRelativeTime(new Date("2026-11-13T12:00:00Z"))).toBe("Today");
    });

    it("returns Tomorrow for the next day", () => {
        expect(formatRelativeTime(new Date("2026-11-14T12:00:00Z"))).toBe("Tomorrow");
    });

    it("returns Yesterday for the previous day", () => {
        expect(formatRelativeTime(new Date("2026-11-12T12:00:00Z"))).toBe("Yesterday");
    });

    it("returns In N days for near future", () => {
        expect(formatRelativeTime(new Date("2026-11-16T12:00:00Z"))).toBe("In 3 days");
    });

    it("returns N days ago for near past", () => {
        expect(formatRelativeTime(new Date("2026-11-10T12:00:00Z"))).toBe("3 days ago");
    });

    it("falls back to formatDate beyond a week", () => {
        expect(formatRelativeTime(new Date("2026-12-01T12:00:00Z"))).toBe("December 1, 2026");
    });
});

describe("formatApiTimestamp", () => {
    it("formats to YYYY-MM-DDTHH:mm:ss", () => {
        expect(formatApiTimestamp("2026-11-19T09:30:00Z")).toBe("2026-11-19T09:30:00");
    });
});

describe("formatDisplayTime", () => {
    it("returns Just now for under a minute", () => {
        expect(formatDisplayTime(new Date("2026-11-13T11:59:45Z"))).toBe("Just now");
    });

    it("returns Nmin ago", () => {
        expect(formatDisplayTime(new Date("2026-11-13T11:30:00Z"))).toBe("30min ago");
    });

    it("returns Nhr ago", () => {
        expect(formatDisplayTime(new Date("2026-11-13T09:00:00Z"))).toBe("3hr ago");
    });

    it("returns Nd ago within a week", () => {
        expect(formatDisplayTime(new Date("2026-11-11T12:00:00Z"))).toBe("2d ago");
    });

    it("returns locale date beyond a week", () => {
        expect(formatDisplayTime(new Date("2026-11-01T12:00:00Z"))).toBe("11/1/2026");
    });
});

describe("toDatePart", () => {
    it("returns the YYYY-MM-DD part", () => {
        expect(toDatePart("2026-11-19T09:30:00")).toBe("2026-11-19");
    });

    it("returns empty string for null or undefined", () => {
        expect(toDatePart(undefined)).toBe("");
        expect(toDatePart(null)).toBe("");
        expect(toDatePart("")).toBe("");
    });
});

describe("toLocalDateTime", () => {
    it("appends T00:00:00 to a date", () => {
        expect(toLocalDateTime("2026-11-19")).toBe("2026-11-19T00:00:00");
    });

    it("returns null for empty input", () => {
        expect(toLocalDateTime(undefined)).toBe(null);
        expect(toLocalDateTime(null)).toBe(null);
        expect(toLocalDateTime("")).toBe(null);
    });
});

describe("formatShortDate", () => {
    it("formats as d MMM yyyy", () => {
        expect(formatShortDate("2026-11-04T09:30:00")).toBe("4 Nov 2026");
    });

    it("returns empty string for falsy input", () => {
        expect(formatShortDate(undefined)).toBe("");
        expect(formatShortDate(null)).toBe("");
        expect(formatShortDate("")).toBe("");
    });
});

describe("formatShortDateTime", () => {
    it("formats date and time", () => {
        expect(formatShortDateTime("2026-11-04T09:30:00")).toBe("4 Nov 2026, 09:30 am");
    });

    it("returns empty string for falsy input", () => {
        expect(formatShortDateTime(undefined)).toBe("");
        expect(formatShortDateTime(null)).toBe("");
    });
});

describe("toLocalISOString", () => {
    it("serializes wall-clock components without UTC shift", () => {
        expect(toLocalISOString(new Date(2026, 10, 4, 14, 30, 5))).toBe("2026-11-04T14:30:05");
    });
});

describe("parseLocalDateTime", () => {
    it("parses wall-clock components as local time", () => {
        const d = parseLocalDateTime("2026-11-04T14:30:00")!;
        expect(d.getFullYear()).toBe(2026);
        expect(d.getMonth()).toBe(10);
        expect(d.getDate()).toBe(4);
        expect(d.getHours()).toBe(14);
        expect(d.getMinutes()).toBe(30);
    });

    it("strips trailing Z", () => {
        const d = parseLocalDateTime("2026-11-04T14:30:00Z")!;
        expect(d.getHours()).toBe(14);
    });

    it("returns null for invalid input", () => {
        expect(parseLocalDateTime(undefined)).toBe(null);
        expect(parseLocalDateTime("")).toBe(null);
        expect(parseLocalDateTime("not-a-date")).toBe(null);
    });
});

describe("formatLocalDateTime", () => {
    it("formats naive local datetime without shifting", () => {
        expect(formatLocalDateTime("2026-11-04T14:30:00")).toBe("4 Nov 2026, 02:30 pm");
    });

    it("returns empty string for falsy input", () => {
        expect(formatLocalDateTime(undefined)).toBe("");
        expect(formatLocalDateTime(null)).toBe("");
    });
});

describe("formatScheduleRange", () => {
    it("renders start – end when both present", () => {
        expect(formatScheduleRange("2026-11-04T09:00:00", "2026-11-04T17:00:00")).toBe(
            "4 Nov 2026, 09:00 am – 4 Nov 2026, 05:00 pm",
        );
    });

    it("renders only the start date when end is missing", () => {
        expect(formatScheduleRange("2026-11-04T09:00:00", undefined)).toBe("4 Nov 2026");
    });

    it("renders only the end date when start is missing", () => {
        expect(formatScheduleRange(undefined, "2026-11-04T17:00:00")).toBe("4 Nov 2026");
    });

    it("returns empty string when neither is present", () => {
        expect(formatScheduleRange(undefined, undefined)).toBe("");
        expect(formatScheduleRange(null, null)).toBe("");
    });
});
