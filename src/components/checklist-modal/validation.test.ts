import { describe, it, expect } from "vitest";
import type { ChecklistItem } from "@/components/checklist-modal/types";
import { validateInventoryStock } from "@/components/checklist-modal/validation";

const lookup = {
    availableStockById: { "inv-1": 10, "inv-2": 0 },
    itemNameById: { "inv-1": "Wireless Mic", "inv-2": "Cable" },
};

const baseItem: ChecklistItem = {
    item: "Test Item",
    description: "desc",
    quantity: 1,
    days: 1,
    unit: "nos",
    status: "PENDING",
    category: "",
};

describe("validateInventoryStock", () => {
    it("returns no errors when quantity is within available stock", () => {
        const item = { ...baseItem, isInventoryItem: true, inventoryID: "inv-1", quantity: 5 };
        expect(validateInventoryStock(item, lookup)).toEqual({});
    });

    it("returns no errors when not an inventory item", () => {
        const item = { ...baseItem, isInventoryItem: false, inventoryID: "inv-1", quantity: 100 };
        expect(validateInventoryStock(item, lookup)).toEqual({});
    });

    it("returns an insufficient-stock error including name, requested and available qty", () => {
        const item = { ...baseItem, isInventoryItem: true, inventoryID: "inv-1", quantity: 12 };
        const errors = validateInventoryStock(item, lookup);
        expect(errors.quantity).toContain("Wireless Mic");
        expect(errors.quantity).toContain("12");
        expect(errors.quantity).toContain("10");
    });

    it("returns an error when stock is zero and quantity is positive", () => {
        const item = { ...baseItem, isInventoryItem: true, inventoryID: "inv-2", quantity: 1 };
        const errors = validateInventoryStock(item, lookup);
        expect(errors.quantity).toBeDefined();
    });

    it("returns an error when stock data is unavailable for the inventory id", () => {
        const item = {
            ...baseItem,
            isInventoryItem: true,
            inventoryID: "inv-missing",
            quantity: 1,
        };
        const errors = validateInventoryStock(item, lookup);
        expect(errors.quantity).toContain("Unable to validate available stock");
    });

    it("returns no errors when inventory id is not set", () => {
        const item = { ...baseItem, isInventoryItem: true, inventoryID: undefined, quantity: 100 };
        expect(validateInventoryStock(item, lookup)).toEqual({});
    });
});
