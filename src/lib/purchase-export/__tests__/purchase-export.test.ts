import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";
import type { CategoryPurchaseRow, EventResponse, VendorFinancialRow } from "@/types/event";

vi.mock("@/lib/estimate-export/estimate-logo", () => ({
    getEstimateLogoDataUrl: vi.fn().mockResolvedValue(null),
    getEstimateLogoPngBase64: vi.fn().mockResolvedValue(null),
}));

import { generatePurchaseOrderExcelBuffer } from "../purchase-excel";
import { generatePurchaseOrderPdfBlob } from "../purchase-pdf";
import { purchaseArgbToRgb, PURCHASE_EXPORT_COLORS } from "../purchase-document";

const categories: CategoryPurchaseRow[] = [
    {
        category: "Lighting",
        directItems: [
            {
                serial: 1,
                itemName: "LED par",
                description: "Warm white",
                qty: 4,
                unit: "nos",
                days: 2,
                rate: 500,
                amount: 4000,
                gstAmount: 720,
                tdsAmount: 40,
                netTotal: 4680,
                vendorName: "Stage Co",
            },
        ],
        subCategories: [
            {
                name: "Control",
                items: [
                    {
                        serial: 2,
                        itemName: "DMX console",
                        description: "",
                        qty: 1,
                        unit: "nos",
                        days: 1,
                        rate: 1000,
                        amount: 1000,
                        gstAmount: 180,
                        tdsAmount: 10,
                        netTotal: 1170,
                        vendorName: "SELF",
                    },
                ],
            },
        ],
        items: [],
        subtotal: 5000,
    },
];
categories[0].items = [...categories[0].directItems, ...categories[0].subCategories[0].items];

const vendorRows: VendorFinancialRow[] = [
    {
        vendorName: "Stage Co",
        totalAmount: 5000,
        gstPercent: 18,
        gstType: "CGST_SGST",
        tdsPercent: 1,
        adjustedAmt: 5850,
        advanceAmount: 1000,
        balance: 4850,
    },
];

const eventData = {
    title: "Launch Event",
    client: "Acme",
    eventStartDate: "2026-11-10",
    eventEndDate: "2026-11-11",
    venue: "Hall A",
    eventID: "EV-10",
    checkListCompleted: false,
} as EventResponse;

describe("purchase order exports", () => {
    it("converts the modal ARGB palette to matching PDF RGB colors", () => {
        expect(purchaseArgbToRgb(PURCHASE_EXPORT_COLORS.titleBg)).toEqual([230, 224, 248]);
        expect(purchaseArgbToRgb(PURCHASE_EXPORT_COLORS.categoryBg)).toEqual([217, 234, 211]);
        expect(purchaseArgbToRgb(PURCHASE_EXPORT_COLORS.totalBg)).toEqual([180, 198, 231]);
    });

    it("generates an Excel workbook with purchase order hierarchy and financial values", async () => {
        const buffer = await generatePurchaseOrderExcelBuffer(
            eventData,
            undefined,
            categories,
            vendorRows,
        );
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const sheet = workbook.getWorksheet("Purchase Order");
        const values = sheet!
            .getSheetValues()
            .flat()
            .filter(value => value != null);

        expect(values).toContain("i");
        expect(values).toContain("Lighting");
        expect(values).toContain("Sub Category: Control");
        expect(values).toContain("LED par");
        expect(values).toContain(720);
        expect(values).toContain(-40);
        expect(values).toContain("Stage Co");
        expect(values).toContain("GRAND OUTSTANDING BALANCE");
        expect(values).toContain(4850);
        expect(values).not.toContain("Profit Summary");

        const twoCategoryBuffer = await generatePurchaseOrderExcelBuffer(
            eventData,
            undefined,
            [...categories, { ...categories[0], category: "Audio" }],
            vendorRows,
        );
        const twoCategoryWorkbook = new ExcelJS.Workbook();
        await twoCategoryWorkbook.xlsx.load(twoCategoryBuffer);
        const twoCategoryValues = twoCategoryWorkbook
            .getWorksheet("Purchase Order")!
            .getSheetValues()
            .flat();
        expect(twoCategoryValues.filter(value => value === "Sl. No")).toHaveLength(1);
        expect(twoCategoryValues).toContain("ii");
        expect(twoCategoryValues).toContain("Audio");

        const adminBuffer = await generatePurchaseOrderExcelBuffer(
            eventData,
            undefined,
            categories,
            vendorRows,
            {
                totalEstimatedCost: 5000,
                includeProfitSummary: true,
            },
        );
        const adminWorkbook = new ExcelJS.Workbook();
        await adminWorkbook.xlsx.load(adminBuffer);
        const adminValues = adminWorkbook.getWorksheet("Purchase Order")!.getSheetValues().flat();
        expect(adminValues).toContain("PROFIT SUMMARY");
        expect(adminValues).toContain("Total Client Billed Amount");
    });

    it("includes the Client Bill Summary before Profit Summary in Excel and PDF", async () => {
        const richEventData = {
            ...eventData,
            gst: 18,
            tds: 400,
            serviceCharge: 10,
            discounts: 500,
            advanceAmt: 2000,
            amountRecievedFromClient: 12000,
            amountRecievedFromClientDate: "2026-11-08",
            vendorSummary: [
                {
                    vendor: "v1",
                    totalAmount: 5000,
                    gst: 18,
                    tds: 1,
                    advanceAmount: 1000,
                    adjustedAmt: 5850,
                    balance: 4850,
                },
            ],
        } as EventResponse;

        const buffer = await generatePurchaseOrderExcelBuffer(
            richEventData,
            undefined,
            categories,
            vendorRows,
            {
                totalEstimatedCost: 10000,
                includeProfitSummary: true,
            },
        );
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        const sheet = workbook.getWorksheet("Purchase Order")!;
        const values = sheet
            .getSheetValues()
            .flat()
            .filter(value => value != null);

        expect(values).toContain("CLIENT BILL SUMMARY");
        expect(values).toContain("Estimated Amount");
        expect(values).toContain("Service Charge (10%)");
        expect(values).toContain("Discount");
        expect(values).toContain("Original Amount");
        expect(values).toContain("GST Amount");
        expect(values).toContain("Total (Original + GST)");
        expect(values).toContain("Amount Received from Client (8 Nov 2026)");
        expect(values).toContain("TDS Deducted by Client");
        expect(values).toContain("Final Amount");
        expect(values).toContain("Advance");
        expect(values).toContain("Balance");
        expect(values).toContain(10000); // estimated amount
        expect(values).toContain(1000); // service charge
        expect(values).toContain(-500); // discount (stored as negative)
        expect(values).toContain(10500); // client estimate + service charge - discount
        expect(values).toContain(1890); // client estimate GST (10500 * 18%)
        expect(values).toContain(12390); // total (original + GST)
        expect(values).toContain(12000); // amount received from client
        expect(values).toContain(-400); // client TDS (stored as negative)
        expect(values).toContain(10110); // final amount (12000 - 1890)
        expect(values).toContain(2000); // client advance
        expect(values).toContain(-2010); // balance = total(12390) - received(12000) - advance(2000) - tds(400)

        const cbIndex = values.indexOf("CLIENT BILL SUMMARY");
        const profitIndex = values.indexOf("PROFIT SUMMARY");
        expect(cbIndex).toBeGreaterThanOrEqual(0);
        expect(profitIndex).toBeGreaterThan(cbIndex);

        const pdfBlob = await generatePurchaseOrderPdfBlob(
            richEventData,
            undefined,
            categories,
            vendorRows,
            {
                totalEstimatedCost: 10000,
                includeProfitSummary: true,
            },
        );
        const pdfText = await pdfBlob.text();
        expect(pdfText).toContain("CLIENT BILL SUMMARY");
        expect(pdfText).toContain("Original Amount");
        expect(pdfText).toContain("Balance");
        const cbPos = pdfText.indexOf("CLIENT BILL SUMMARY");
        const profitPos = pdfText.indexOf("PROFIT SUMMARY");
        expect(cbPos).toBeGreaterThanOrEqual(0);
        expect(profitPos).toBeGreaterThan(cbPos);
    });

    it("generates a non-empty PDF for the displayed purchase order", async () => {
        const blob = await generatePurchaseOrderPdfBlob(
            eventData,
            undefined,
            categories,
            vendorRows,
        );
        expect(blob.type).toBe("application/pdf");
        expect(blob.size).toBeGreaterThan(500);
    });
});
