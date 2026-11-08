import { describe, it, expect } from "vitest";
import type { EventResponse } from "@/types/event";
import {
    buildVendorFinancials,
    groupItemsByCategory,
} from "@/components/purchase-order-preview-modal";

const vendorList = [
    { id: "v1", name: "Stage Co" },
    { id: "v2", name: "Audio Co" },
];

const inventoryList = [{ id: "inv-1", name: "Inventory (Self)" }];

const vendorSummary: EventResponse["vendorSummary"] = [
    {
        vendor: "v1",
        totalAmount: 5000,
        advanceAmount: 1000,
        gst: 18,
        gstType: "CGST_SGST",
        tds: 1,
        adjustedAmt: 5850,
        balance: 4850,
    },
    {
        vendor: "v2",
        totalAmount: 2000,
        advanceAmount: 0,
        gst: 12,
        gstType: "IGST",
        tds: 2,
        adjustedAmt: 2400,
        balance: 2400,
    },
    {
        vendor: "",
        totalAmount: 1000,
        advanceAmount: 0,
        gst: 0,
        gstType: "NONE",
        tds: 0,
        adjustedAmt: 1000,
        balance: 1000,
    },
];

// Note: EventResponse.items type declares `count`, but the implementation reads
// `quantity` (see RawEventItem in create-purchase-order-modal). Fixtures use
// `quantity` to match runtime behaviour and are cast accordingly.
const baseItems = [
    {
        item: "LED par",
        description: "Warm white",
        quantity: 4,
        pricePerItem: 500,
        days: 2,
        vendor: "v1",
        category: "Lighting",
        unit: "nos",
    },
    {
        item: "DMX console",
        description: "",
        quantity: 1,
        pricePerItem: 1000,
        days: 1,
        vendor: "v1",
        category: "Lighting",
        subCategory: "Control",
        unit: "nos",
    },
    {
        item: "Mic",
        description: "Wireless mic",
        quantity: 2,
        pricePerItem: 300,
        days: 1,
        vendor: "v2",
        category: "Audio",
        unit: "nos",
    },
    {
        item: "Cable",
        description: "XLR cable",
        quantity: 5,
        pricePerItem: 40,
        days: 1,
        category: "Audio",
        unit: "nos",
    },
    {
        item: "Chair",
        description: "Plastic chair",
        quantity: 10,
        pricePerItem: 100,
        days: 1,
        vendor: "",
        category: "Furniture",
        unit: "nos",
    },
] as unknown as EventResponse["items"];

describe("buildVendorFinancials", () => {
    it("returns empty array for undefined vendor summary", () => {
        expect(buildVendorFinancials(undefined, vendorList)).toEqual([]);
    });

    it("returns empty array for empty vendor summary", () => {
        expect(buildVendorFinancials([], vendorList)).toEqual([]);
    });

    it("maps each vendor summary row with vendor name lookup", () => {
        const rows = buildVendorFinancials(vendorSummary, vendorList);

        expect(rows).toHaveLength(3);

        const stage = rows.find(r => r.vendorName === "Stage Co");
        expect(stage).toBeDefined();
        expect(stage!.totalAmount).toBe(5000);
        expect(stage!.gstPercent).toBe(18);
        expect(stage!.gstType).toBe("CGST_SGST");
        expect(stage!.tdsPercent).toBe(1);
        expect(stage!.adjustedAmt).toBe(5850);
        expect(stage!.advanceAmount).toBe(1000);
        expect(stage!.balance).toBe(4850);

        const self = rows.find(r => r.vendorName === "SELF");
        expect(self).toBeDefined();
        expect(self!.vendorName).toBe("SELF");
        expect(self!.totalAmount).toBe(1000);
        expect(self!.gstPercent).toBe(0);
    });

    it("falls back to vendor id when vendor list lookup fails", () => {
        const rows = buildVendorFinancials(vendorSummary, []);
        const row = rows.find(r => r.vendorName === "v2");
        expect(row?.vendorName).toBe("v2");
    });
});

describe("groupItemsByCategory", () => {
    it("returns empty array for undefined items", () => {
        expect(groupItemsByCategory(undefined, vendorList, inventoryList, vendorSummary)).toEqual(
            [],
        );
    });

    it("returns empty array for empty items", () => {
        expect(groupItemsByCategory([], vendorList, inventoryList, vendorSummary)).toEqual([]);
    });

    it("groups items by category and computes per-item financials", () => {
        const result = groupItemsByCategory(baseItems, vendorList, inventoryList, vendorSummary);

        expect(result.length).toBe(3);

        const lighting = result.find(c => c.category === "Lighting");
        expect(lighting).toBeDefined();
        expect(lighting!.items.length).toBe(2);

        const led = lighting!.items.find(i => i.itemName === "LED par")!;
        expect(led.qty).toBe(4);
        expect(led.rate).toBe(500);
        expect(led.amount).toBe(4000);
        expect(led.gstAmount).toBe(720); // 4000 * 18%
        expect(led.tdsAmount).toBe(40); // 4000 * 1%
        expect(led.netTotal).toBe(4680); // 4000 + 720 - 40
        expect(led.vendorName).toBe("Stage Co");
        expect(led.days).toBe(2);
        expect(led.unit).toBe("nos");

        const dmx = lighting!.items.find(i => i.itemName === "DMX console")!;
        expect(dmx.amount).toBe(1000);
        expect(dmx.gstAmount).toBe(180);
        expect(dmx.netTotal).toBe(1170);
    });

    it("places sub-category items under subCategories", () => {
        const result = groupItemsByCategory(baseItems, vendorList, inventoryList, vendorSummary);

        const lighting = result.find(c => c.category === "Lighting")!;
        expect(lighting.subCategories.length).toBe(1);
        expect(lighting.subCategories[0].name).toBe("Control");
        expect(lighting.subCategories[0].items.length).toBe(1);
        expect(lighting.subCategories[0].items[0].itemName).toBe("DMX console");

        // directItems excludes sub-category items
        expect(lighting.directItems.length).toBe(1);
        expect(lighting.directItems[0].itemName).toBe("LED par");

        // flat items includes both direct and sub-category items
        expect(lighting.items.length).toBe(2);
    });

    it("matches inventory (no vendor) items to SELF", () => {
        const result = groupItemsByCategory(baseItems, vendorList, inventoryList, vendorSummary);

        const furniture = result.find(c => c.category === "Furniture")!;
        const chair = furniture.items[0];
        expect(chair.vendorName).toBe("SELF");
        expect(chair.vendorId).toBe("");
    });

    it("computes category subtotal from item amounts", () => {
        const result = groupItemsByCategory(baseItems, vendorList, inventoryList, vendorSummary);

        const audio = result.find(c => c.category === "Audio")!;
        // Mic: 2 * 300 = 600, Cable: 5 * 40 = 200
        expect(audio.subtotal).toBe(800);
    });

    it("defaults missing category to Uncategorized", () => {
        const items = [
            { item: "Misc", quantity: 1, pricePerItem: 100, days: 1 },
        ] as unknown as EventResponse["items"];
        const result = groupItemsByCategory(items, vendorList, inventoryList, vendorSummary);

        expect(result.length).toBe(1);
        expect(result[0].category).toBe("Uncategorized");
        expect(result[0].items[0].vendorName).toBe("SELF");
    });

    it("defaults unit to nos when missing", () => {
        const items = [
            { item: "Thing", quantity: 1, pricePerItem: 100, days: 1 },
        ] as unknown as EventResponse["items"];
        const result = groupItemsByCategory(items, vendorList, inventoryList, vendorSummary);

        expect(result[0].items[0].unit).toBe("nos");
        expect(result[0].items[0].qty).toBe(1);
        expect(result[0].items[0].rate).toBe(100);
        expect(result[0].items[0].days).toBe(1);
    });

    it("serial numbers are sequential across the flat items list", () => {
        const result = groupItemsByCategory(baseItems, vendorList, inventoryList, vendorSummary);

        let serial = 1;
        for (const category of result) {
            for (const item of category.items) {
                expect(item.serial).toBe(serial);
                serial += 1;
            }
        }
    });

    it("uses GST/TDS of 0 when vendor has no summary entry", () => {
        const items = [
            { item: "Unknown Vendor Item", quantity: 1, pricePerItem: 100, days: 1, vendor: "v9" },
        ] as unknown as EventResponse["items"];
        const result = groupItemsByCategory(items, vendorList, inventoryList, vendorSummary);

        const item = result[0].items[0];
        expect(item.gstAmount).toBe(0);
        expect(item.tdsAmount).toBe(0);
        expect(item.netTotal).toBe(100);
        expect(item.vendorName).toBe("v9");
    });

    it("defaults rate to 0 when pricePerItem is missing", () => {
        const items = [
            { item: "Free Item", quantity: 3, days: 1, vendor: "v1" },
        ] as unknown as EventResponse["items"];
        const result = groupItemsByCategory(items, vendorList, inventoryList, vendorSummary);

        const item = result[0].items[0];
        expect(item.rate).toBe(0);
        expect(item.amount).toBe(0);
        expect(item.netTotal).toBe(0);
    });

    it("buildVendorFinancials falls back to vendor id when not in vendor list", () => {
        const summaryWithUnknown: EventResponse["vendorSummary"] = [
            {
                vendor: "v9",
                totalAmount: 700,
                advanceAmount: 0,
                gst: 5,
                tds: 0,
                adjustedAmt: 735,
                balance: 735,
            },
        ];
        const rows = buildVendorFinancials(summaryWithUnknown, vendorList);
        expect(rows).toHaveLength(1);
        expect(rows[0].vendorName).toBe("v9");
        expect(rows[0].totalAmount).toBe(700);
    });
});
