import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    addSuggestion,
    clearSuggestions,
    getSuggestions,
    saveMany,
    saveSuggestions,
} from "./suggestion-storage";

const KEY = "test-suggestions";

beforeEach(() => {
    localStorage.removeItem(KEY);
});

afterEach(() => {
    localStorage.removeItem(KEY);
});

describe("getSuggestions", () => {
    it("returns empty array when no data stored", () => {
        expect(getSuggestions(KEY)).toEqual([]);
    });

    it("returns stored suggestions", () => {
        saveSuggestions(KEY, ["Apple", "Banana"]);
        expect(getSuggestions(KEY)).toEqual(["Apple", "Banana"]);
    });

    it("returns empty array for invalid JSON", () => {
        localStorage.setItem(KEY, "not-json");
        expect(getSuggestions(KEY)).toEqual([]);
    });

    it("filters out non-string entries", () => {
        localStorage.setItem(KEY, JSON.stringify(["Apple", 123, null, "Banana"]));
        expect(getSuggestions(KEY)).toEqual(["Apple", "Banana"]);
    });

    it("filters out empty strings", () => {
        localStorage.setItem(KEY, JSON.stringify(["Apple", "", "Banana"]));
        expect(getSuggestions(KEY)).toEqual(["Apple", "Banana"]);
    });
});

describe("saveSuggestions", () => {
    it("persists suggestions as JSON", () => {
        saveSuggestions(KEY, ["Apple", "Banana"]);
        expect(localStorage.getItem(KEY)).toBe(JSON.stringify(["Apple", "Banana"]));
    });
});

describe("addSuggestion", () => {
    it("adds a new suggestion", () => {
        expect(addSuggestion(KEY, "Apple")).toEqual(["Apple"]);
    });

    it("trims whitespace", () => {
        expect(addSuggestion(KEY, "  Apple  ")).toEqual(["Apple"]);
    });

    it("ignores empty values", () => {
        localStorage.setItem(KEY, JSON.stringify(["Existing"]));
        expect(addSuggestion(KEY, "   ")).toEqual(["Existing"]);
    });

    it("prevents duplicates case-insensitively and moves to top", () => {
        localStorage.setItem(KEY, JSON.stringify(["banana", "Apple"]));
        expect(addSuggestion(KEY, "APPLE")).toEqual(["APPLE", "banana"]);
    });

    it("moves recently added value to the top", () => {
        localStorage.setItem(KEY, JSON.stringify(["First", "Second"]));
        expect(addSuggestion(KEY, "Second")).toEqual(["Second", "First"]);
    });

    it("caps the list at maxSize", () => {
        const items = Array.from({ length: 105 }, (_, i) => `item-${i}`);
        localStorage.setItem(KEY, JSON.stringify(items));
        expect(addSuggestion(KEY, "new-item", { maxSize: 100 })).toHaveLength(100);
        expect(addSuggestion(KEY, "new-item", { maxSize: 100 })[0]).toBe("new-item");
    });

    it("defaults maxSize to 100", () => {
        const items = Array.from({ length: 105 }, (_, i) => `item-${i}`);
        localStorage.setItem(KEY, JSON.stringify(items));
        expect(addSuggestion(KEY, "new-item")).toHaveLength(100);
    });
});

describe("clearSuggestions", () => {
    it("removes stored suggestions", () => {
        saveSuggestions(KEY, ["Apple"]);
        clearSuggestions(KEY);
        expect(getSuggestions(KEY)).toEqual([]);
        expect(localStorage.getItem(KEY)).toBeNull();
    });
});

describe("saveMany", () => {
    it("saves multiple new item names", () => {
        const result = saveMany(KEY, ["Apple", "Banana", "Cherry"]);
        expect(result).toEqual(["Apple", "Banana", "Cherry"]);
        expect(getSuggestions(KEY)).toEqual(["Apple", "Banana", "Cherry"]);
    });

    it("trims whitespace and skips empty values", () => {
        const result = saveMany(KEY, ["  Apple  ", "", "   ", "Banana"]);
        expect(result).toEqual(["Apple", "Banana"]);
    });

    it("prevents duplicates case-insensitively and moves re-used names to top", () => {
        localStorage.setItem(KEY, JSON.stringify(["banana", "Apple"]));
        const result = saveMany(KEY, ["APPLE", "Cherry"]);
        expect(result).toEqual(["APPLE", "Cherry", "banana"]);
    });

    it("merges with existing history without replacing", () => {
        localStorage.setItem(KEY, JSON.stringify(["Existing1", "Existing2"]));
        const result = saveMany(KEY, ["New1", "New2"]);
        expect(result).toEqual(["New1", "New2", "Existing1", "Existing2"]);
    });

    it("does not add already-existing names again (dedup against existing)", () => {
        localStorage.setItem(KEY, JSON.stringify(["Apple", "Banana"]));
        const result = saveMany(KEY, ["Apple", "Cherry"]);
        expect(result).toEqual(["Apple", "Cherry", "Banana"]);
    });

    it("applies max history size limit with single write", () => {
        localStorage.setItem(
            KEY,
            JSON.stringify(Array.from({ length: 90 }, (_, i) => `existing-${i}`)),
        );
        const result = saveMany(
            KEY,
            ["new-1", "new-2", "new-3", "new-4", "new-5", "new-6", "new-7", "new-8", "new-9", "new-10"],
            { maxSize: 100 },
        );
        expect(result).toHaveLength(100);
        expect(result[0]).toBe("new-1");
        expect(result[9]).toBe("new-10");
    });

    it("returns existing suggestions when called with empty array", () => {
        localStorage.setItem(KEY, JSON.stringify(["Existing"]));
        const result = saveMany(KEY, []);
        expect(result).toEqual(["Existing"]);
    });
});
