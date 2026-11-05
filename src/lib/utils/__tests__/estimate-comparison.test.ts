import { describe, it, expect } from "vitest";
import type { EventItem } from "@/types/event";
import {
    compareAdditionalEstimateItems,
    groupEventItemsByCategory,
    flattenGroupedToComparisonItems,
    buildComparisonKey,
    summarizeComparisonResults,
    type GroupedCategory,
    type GroupedItem,
    type ItemComparisonResult,
} from "@/lib/utils/estimate-comparison";

const makeItem = (
    overrides: Partial<GroupedItem> & { category?: string; subCategory?: string } = {},
): GroupedItem & { category: string; subCategory: string } => ({
    id: "item-1",
    item: "Sound System",
    specification: "Wireless mic",
    days: 1,
    sqft: 2,
    rate: 1000,
    vendor: "Vendor A",
    unit: "nos",
    category: "",
    subCategory: "",
    ...overrides,
});

const makeCategory = (
    name: string,
    directItems: GroupedItem[] = [],
    subCategories: Array<{ name: string; items: GroupedItem[] }> = [],
): GroupedCategory => ({
    id: `cat-${name}`,
    name,
    directItems,
    subCategories: subCategories.map(sub => ({
        id: `sub-${name}-${sub.name}`,
        name: sub.name,
        items: sub.items,
        romanIndex: "",
    })),
});

describe("groupEventItemsByCategory", () => {
    it("groups items by category name", () => {
        const items = [
            { ...makeItem({ id: "i1", category: "Catering", item: "Food", sqft: 10, rate: 100 }) },
            { ...makeItem({ id: "i2", category: "Decor", item: "Flowers", sqft: 5, rate: 50 }) },
            { ...makeItem({ id: "i3", category: "Catering", item: "Drinks", sqft: 20, rate: 20 }) },
        ];

        const result = groupEventItemsByCategory(items as unknown as EventItem[]);

        expect(result.length).toBe(2);
        const catering = result.find(c => c.name === "Catering");
        const decor = result.find(c => c.name === "Decor");
        expect(catering?.directItems.length).toBe(2);
        expect(decor?.directItems.length).toBe(1);
    });

    it("places items with missing category under 'General'", () => {
        const items = [
            { ...makeItem({ id: "i1", item: "No Category Item", category: undefined }) },
            { ...makeItem({ id: "i2", item: "Empty Category", category: "" }) },
        ];

        const result = groupEventItemsByCategory(items as unknown as EventItem[]);

        const general = result.find(c => c.name === "General");
        expect(general).toBeDefined();
        expect(general?.directItems.length).toBe(2);
    });

    it("places all items in directItems (no subcategory grouping)", () => {
        const items = [
            { ...makeItem({ id: "i1", category: "Audio", item: "Mic 1", sqft: 1, rate: 500 }) },
            { ...makeItem({ id: "i2", category: "Audio", item: "Mic 2", sqft: 2, rate: 500 }) },
            { ...makeItem({ id: "i3", category: "Audio", item: "Speaker 1", sqft: 1, rate: 1000 }) },
        ];

        const result = groupEventItemsByCategory(items as unknown as EventItem[]);

        const audio = result.find(c => c.name === "Audio");
        expect(audio).toBeDefined();
        // groupEventItemsByCategory puts all items in directItems, not subCategories
        expect(audio?.directItems.length).toBe(3);
        expect(audio?.subCategories.length).toBe(0);
    });

    it("returns empty array for empty input", () => {
        const result = groupEventItemsByCategory([]);
        expect(result).toEqual([]);
    });

    it("handles undefined input gracefully", () => {
        const result = groupEventItemsByCategory(undefined as unknown as EventItem[]);
        expect(result).toEqual([]);
    });
});

describe("flattenGroupedToComparisonItems", () => {
    it("flattens direct items with their category", () => {
        const categories = [
            makeCategory("Catering", [
                makeItem({ id: "i1", item: "Food", category: "Catering" }),
                makeItem({ id: "i2", item: "Drinks", category: "Catering" }),
            ]),
        ];

        const result = flattenGroupedToComparisonItems(categories);

        expect(result.length).toBe(2);
        expect(result[0].category).toBe("Catering");
        expect(result[0].subCategory).toBe("");
        expect(result[0].item).toBe("Food");
        expect(result[1].item).toBe("Drinks");
    });

    it("flattens subcategory items with category and subcategory", () => {
        const categories = [
            makeCategory("Audio", [], [
                { name: "Mics", items: [makeItem({ id: "i1", item: "Mic 1", category: "Audio", subCategory: "Mics" })] },
            ]),
        ];

        const result = flattenGroupedToComparisonItems(categories);

        expect(result.length).toBe(1);
        expect(result[0].category).toBe("Audio");
        expect(result[0].subCategory).toBe("Mics");
        expect(result[0].item).toBe("Mic 1");
    });

    it("returns empty array for empty input", () => {
        expect(flattenGroupedToComparisonItems([])).toEqual([]);
    });
});

describe("buildComparisonKey", () => {
    it("builds lowercase trimmed composite key", () => {
        expect(buildComparisonKey("Catering", "Main", "Food")).toBe("catering::main::food");
        // buildComparisonKey trims the whole result but not individual segments
        expect(buildComparisonKey("Audio", "Mics", "Mic 1")).toBe("audio::mics::mic 1");
    });

    it("handles empty strings", () => {
        expect(buildComparisonKey("", "", "")).toBe("::::");
    });
});

describe("compareAdditionalEstimateItems", () => {
    it("marks items with no existing match as new-item", () => {
        const existing: GroupedCategory[] = [];
        const newItems = [makeCategory("Catering", [makeItem({ id: "n1", item: "New Dish" })])];

        const results = compareAdditionalEstimateItems(existing, newItems);

        expect(results.length).toBe(1);
        expect(results[0].status).toBe("new-item");
        expect(results[0].existingItem).toBeNull();
        expect(results[0].message).toBeNull();
    });

    it("marks exact match when category, subCategory, item, specification, days, rate, and sqft all match", () => {
        const item = makeItem({ id: "e1", item: "Mic", sqft: 2, rate: 500, days: 1 });
        const existing = [makeCategory("Audio", [item])];
        const newItems = [makeCategory("Audio", [makeItem({ id: "n1", item: "Mic", sqft: 2, rate: 500, days: 1 })])];

        const results = compareAdditionalEstimateItems(existing, newItems);

        expect(results.length).toBe(1);
        expect(results[0].status).toBe("exact-match");
    });

    it("marks quantity-changed when everything matches except sqft", () => {
        const existing = [makeCategory("Audio", [makeItem({ id: "e1", item: "Mic", sqft: 2, rate: 500, days: 1 })])];
        const newItems = [makeCategory("Audio", [makeItem({ id: "n1", item: "Mic", sqft: 5, rate: 500, days: 1 })])];

        const results = compareAdditionalEstimateItems(existing, newItems);

        expect(results.length).toBe(1);
        expect(results[0].status).toBe("quantity-changed");
        expect(results[0].existingItem).not.toBeNull();
        expect(results[0].message).toContain("quantity");
    });

    it("marks partial-match when category/item match but specification differs", () => {
        const existing = [makeCategory("Audio", [makeItem({ id: "e1", item: "Mic", specification: "Wired", rate: 500 })])];
        const newItems = [makeCategory("Audio", [makeItem({ id: "n1", item: "Mic", specification: "Wireless", rate: 500 })])];

        const results = compareAdditionalEstimateItems(existing, newItems);

        expect(results.length).toBe(1);
        expect(results[0].status).toBe("partial-match");
        expect(results[0].message).toContain("Specification");
    });

    it("marks partial-match when days differ", () => {
        const existing = [makeCategory("Audio", [makeItem({ id: "e1", item: "Mic", days: 1, rate: 500 })])];
        const newItems = [makeCategory("Audio", [makeItem({ id: "n1", item: "Mic", days: 3, rate: 500 })])];

        const results = compareAdditionalEstimateItems(existing, newItems);

        expect(results[0].status).toBe("partial-match");
    });

    it("marks partial-match when rate differs", () => {
        const existing = [makeCategory("Audio", [makeItem({ id: "e1", item: "Mic", rate: 500 })])];
        const newItems = [makeCategory("Audio", [makeItem({ id: "n1", item: "Mic", rate: 800 })])];

        const results = compareAdditionalEstimateItems(existing, newItems);

        expect(results[0].status).toBe("partial-match");
    });

    it("matches case-insensitively (exact match without internal whitespace)", () => {
        const existing = [makeCategory("AUDIO", [makeItem({ id: "e1", item: "MIC", sqft: 2, rate: 500 })])];
        const newItems = [makeCategory("audio", [makeItem({ id: "n1", item: "mic", sqft: 2, rate: 500 })])];

        const results = compareAdditionalEstimateItems(existing, newItems);

        expect(results[0].status).toBe("exact-match");
    });

    it("does not match when internal whitespace differs", () => {
        const existing = [makeCategory("Audio", [makeItem({ id: "e1", item: "Mic", sqft: 2, rate: 500 })])];
        const newItems = [makeCategory(" Audio ", [makeItem({ id: "n1", item: " Mic ", sqft: 2, rate: 500 })])];

        const results = compareAdditionalEstimateItems(existing, newItems);

        expect(results[0].status).toBe("new-item");
    });

    it("handles multiple items with mixed statuses", () => {
        const existing = [
            makeCategory("Audio", [makeItem({ id: "e1", item: "Mic", sqft: 2, rate: 500 })]),
            makeCategory("Catering", [makeItem({ id: "e2", item: "Food", sqft: 10, rate: 100 })]),
        ];
        const newItems = [
            makeCategory("Audio", [makeItem({ id: "n1", item: "Mic", sqft: 2, rate: 500 })]), // exact-match
            makeCategory("Audio", [makeItem({ id: "n2", item: "Mic", sqft: 5, rate: 500 })]), // quantity-changed
            makeCategory("Lighting", [makeItem({ id: "n3", item: "Light", sqft: 1, rate: 200 })]), // new-item
        ];

        const results = compareAdditionalEstimateItems(existing, newItems);

        expect(results.length).toBe(3);
        expect(results[0].status).toBe("exact-match");
        expect(results[1].status).toBe("quantity-changed");
        expect(results[2].status).toBe("new-item");
    });

    it("returns empty array when no new items", () => {
        const existing = [makeCategory("Audio", [makeItem()])];
        const results = compareAdditionalEstimateItems(existing, []);
        expect(results).toEqual([]);
    });
});

describe("summarizeComparisonResults", () => {
    it("counts each status correctly", () => {
        const results: ItemComparisonResult[] = [
            { item: makeItem({ id: "1" }), status: "exact-match", message: null, existingItem: null },
            { item: makeItem({ id: "2" }), status: "quantity-changed", message: "qty", existingItem: null },
            { item: makeItem({ id: "3" }), status: "partial-match", message: "partial", existingItem: null },
            { item: makeItem({ id: "4" }), status: "new-item", message: null, existingItem: null },
            { item: makeItem({ id: "5" }), status: "new-item", message: null, existingItem: null },
        ];

        const summary = summarizeComparisonResults(results);

        expect(summary.exactMatchCount).toBe(1);
        expect(summary.quantityChangedCount).toBe(1);
        expect(summary.partialMatchCount).toBe(1);
        expect(summary.newItemCount).toBe(2);
        expect(summary.totalCount).toBe(5);
    });

    it("returns zeros for empty results", () => {
        const summary = summarizeComparisonResults([]);
        expect(summary.totalCount).toBe(0);
        expect(summary.exactMatchCount).toBe(0);
        expect(summary.quantityChangedCount).toBe(0);
        expect(summary.partialMatchCount).toBe(0);
        expect(summary.newItemCount).toBe(0);
    });
});
