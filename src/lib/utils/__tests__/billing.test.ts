import { describe, it, expect } from "vitest";
import { calculateClientBillSummary } from "@/lib/utils/billing";

const vendorSummaries = [
    { vendor: "v1", totalAmount: 5000, gst: 18, tds: 1 },
    { vendor: "v2", totalAmount: 2000, gst: 12, tds: 2 },
    { vendor: "", totalAmount: 1000, gst: 0, tds: 0 },
];

const baseInput = {
    totalEstimatedCost: 10000,
    gstPercent: 18,
    serviceChargePercent: 10,
    discountAmount: 500,
    clientTdsAmount: 400,
    advanceAmount: 2000,
    receivedAmount: 12000,
    vendorSummaries,
};

describe("calculateClientBillSummary", () => {
    it("computes all eight rows from client estimate and received amount", () => {
        // taxable = 10000 + 1000 - 500 = 10500
        // client GST = 10500 * 18% = 1890
        // service charge = 10000 * 10% = 1000
        // Original Amount = Estimated Amount + Service Charge - Discount = 10000 + 1000 - 500 = 10500
        // Total = 10500 + 1890 = 12390
        // Amount Received = receivedAmount = 12000
        // Final Amount = 12000 - 1890 = 10110
        // Balance = 10110 - 2000 = 8110
        const summary = calculateClientBillSummary(baseInput);

        expect(summary.estimatedAmount).toBe(10000);
        expect(summary.serviceChargeAmount).toBe(1000);
        expect(summary.discountAmount).toBe(500);
        expect(summary.originalAmount).toBe(10500);
        expect(summary.gstAmount).toBe(1890);
        expect(summary.total).toBe(12390);
        expect(summary.amountReceivedFromClient).toBe(12000);
        expect(summary.tdsDeducted).toBe(400);
        expect(summary.finalAmount).toBe(10110);
        expect(summary.advance).toBe(2000);
        expect(summary.balance).toBe(-2010); // total(12390) - received(12000) - advance(2000) - tds(400)
    });

    it("uses the client estimate GST, not the vendor summary GST", () => {
        // vendor GST total = 5000*18% + 2000*12% = 900 + 240 = 1140 (ignored)
        // client GST = 1890
        const summary = calculateClientBillSummary(baseInput);
        expect(summary.gstAmount).toBe(1890);
        expect(summary.gstAmount).not.toBe(1140);
    });

    it("uses the estimate amount plus service charge minus discount, not the vendor total", () => {
        // vendor totalAmount sum = 5000 + 2000 + 1000 = 8000 (ignored)
        // Original Amount = totalEstimatedCost + service charge - discount = 10000 + 1000 - 500 = 10500
        const summary = calculateClientBillSummary(baseInput);
        expect(summary.originalAmount).toBe(10500);
        expect(summary.originalAmount).not.toBe(8000);
    });

    it("includes service charge and discount in original amount", () => {
        const summary = calculateClientBillSummary({
            ...baseInput,
            serviceChargePercent: 0,
            discountAmount: 0,
        });
        expect(summary.originalAmount).toBe(10000);
    });

    it("handles zero client GST", () => {
        const summary = calculateClientBillSummary({
            ...baseInput,
            gstPercent: 0,
        });
        expect(summary.originalAmount).toBe(10500);
        expect(summary.gstAmount).toBe(0);
        expect(summary.total).toBe(10500);
        expect(summary.amountReceivedFromClient).toBe(12000);
        expect(summary.tdsDeducted).toBe(400);
        expect(summary.finalAmount).toBe(12000);
        expect(summary.balance).toBe(-3900); // total(10500) - received(12000) - advance(2000) - tds(400)
    });

    it("handles zero client TDS", () => {
        const summary = calculateClientBillSummary({
            ...baseInput,
            clientTdsAmount: 0,
        });
        expect(summary.originalAmount).toBe(10500);
        expect(summary.gstAmount).toBe(1890);
        expect(summary.total).toBe(12390);
        expect(summary.amountReceivedFromClient).toBe(12000);
        expect(summary.tdsDeducted).toBe(0);
        expect(summary.finalAmount).toBe(10110);
        expect(summary.balance).toBe(-1610); // total(12390) - received(12000) - advance(2000)
    });

    it("received amount lower than estimate total", () => {
        const summary = calculateClientBillSummary({
            ...baseInput,
            receivedAmount: 5000,
        });
        expect(summary.amountReceivedFromClient).toBe(5000);
        expect(summary.finalAmount).toBe(3110);
        expect(summary.balance).toBe(4990); // total(12390) - received(5000) - advance(2000) - tds(400)
    });

    it("received amount equal to estimate total (with GST)", () => {
        const summary = calculateClientBillSummary({
            ...baseInput,
            receivedAmount: 12890,
        });
        expect(summary.finalAmount).toBe(11000);
        expect(summary.balance).toBe(-2900); // total(12390) - received(12890) - advance(2000) - tds(400)
    });

    it("received amount greater than estimate total", () => {
        const summary = calculateClientBillSummary({
            ...baseInput,
            receivedAmount: 15000,
        });
        expect(summary.finalAmount).toBe(13110);
        expect(summary.balance).toBe(-5010); // total(12390) - received(15000) - advance(2000) - tds(400)
    });

    it("handles zero advance", () => {
        const summary = calculateClientBillSummary({
            ...baseInput,
            advanceAmount: 0,
        });
        expect(summary.advance).toBe(0);
        expect(summary.balance).toBe(-10); // total(12390) - received(12000) - advance(0) - tds(400)
    });

    it("handles advance equal to final amount", () => {
        const summary = calculateClientBillSummary({
            ...baseInput,
            advanceAmount: 10110,
        });
        expect(summary.balance).toBe(-10120); // total(12390) - received(12000) - advance(10110) - tds(400)
    });

    it("handles advance greater than final amount", () => {
        const summary = calculateClientBillSummary({
            ...baseInput,
            advanceAmount: 12000,
        });
        expect(summary.balance).toBe(-12010); // total(12390) - received(12000) - advance(12000) - tds(400)
    });

    it("handles zero values across the board", () => {
        const summary = calculateClientBillSummary({
            totalEstimatedCost: 0,
            gstPercent: 0,
            serviceChargePercent: 0,
            discountAmount: 0,
            clientTdsAmount: 0,
            advanceAmount: 0,
            receivedAmount: 0,
            vendorSummaries: [],
        });
        expect(summary.originalAmount).toBe(0);
        expect(summary.gstAmount).toBe(0);
        expect(summary.total).toBe(0);
        expect(summary.amountReceivedFromClient).toBe(0);
        expect(summary.tdsDeducted).toBe(0);
        expect(summary.finalAmount).toBe(0);
        expect(summary.advance).toBe(0);
        expect(summary.balance).toBe(0);
    });
});
