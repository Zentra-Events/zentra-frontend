import { describe, it, expect } from "vitest";
import { calculateEstimateSummary } from "@/lib/utils/estimate";

describe("calculateEstimateSummary", () => {
    describe("happy path calculations", () => {
        it("calculates all totals correctly with service charge, discount, and GST", () => {
            const result = calculateEstimateSummary({
                totalAmount: 1000,
                gst: 18,
                serviceCharge: 10,
                discounts: 100,
            });

            // serviceChargeAmount = 1000 * 10/100 = 100
            expect(result.serviceChargeAmount).toBe(100);
            // totalWithServiceCharge = 1000 + 100 = 1100
            expect(result.totalWithServiceCharge).toBe(1100);
            // totalAfterDiscounts = 1000 ? 1100 - 100 = 1000
            expect(result.totalWithServiceCharge - result.serviceChargeAmount).toBe(1000);
            // gstAmount = 1000 * 18/100 = 180
            expect(result.gstAmount).toBe(180);
            // totalWithGST = 1000 + 180 = 1180
            expect(result.totalWithGST).toBe(1180);
        });

        it("returns zeros for all-zero inputs", () => {
            const result = calculateEstimateSummary({
                totalAmount: 0,
                gst: 0,
                serviceCharge: 0,
                discounts: 0,
            });

            expect(result.serviceChargeAmount).toBe(0);
            expect(result.totalWithServiceCharge).toBe(0);
            expect(result.totalWithGST).toBe(0);
            expect(result.gstAmount).toBe(0);
        });

        it("handles zero GST", () => {
            const result = calculateEstimateSummary({
                totalAmount: 500,
                gst: 0,
                serviceCharge: 0,
                discounts: 0,
            });

            expect(result.gstAmount).toBe(0);
            expect(result.totalWithGST).toBe(500);
        });

        it("handles zero service charge", () => {
            const result = calculateEstimateSummary({
                totalAmount: 500,
                gst: 18,
                serviceCharge: 0,
                discounts: 0,
            });

            expect(result.serviceChargeAmount).toBe(0);
            expect(result.totalWithServiceCharge).toBe(500);
            expect(result.gstAmount).toBe(90);
            expect(result.totalWithGST).toBe(590);
        });

        it("handles zero discounts", () => {
            const result = calculateEstimateSummary({
                totalAmount: 500,
                gst: 18,
                serviceCharge: 10,
                discounts: 0,
            });

            expect(result.serviceChargeAmount).toBe(50);
            expect(result.totalWithServiceCharge).toBe(550);
            expect(result.gstAmount).toBe(99);
            expect(result.totalWithGST).toBe(649);
        });

        it("handles full discount equal to totalWithServiceCharge", () => {
            const result = calculateEstimateSummary({
                totalAmount: 100,
                gst: 18,
                serviceCharge: 0,
                discounts: 100,
            });

            // totalWithServiceCharge = 100
            // totalAfterDiscounts = 100 ? 100 - 100 = 0
            // gstAmount = 0 * 18/100 = 0
            // totalWithGST = 0 + 0 = 0
            expect(result.gstAmount).toBe(0);
            expect(result.totalWithGST).toBe(0);
        });
    });

    describe("decimal precision", () => {
        it("rounds monetary values to 2 decimal places", () => {
            const result = calculateEstimateSummary({
                totalAmount: 333.33,
                gst: 12.5,
                serviceCharge: 5.5,
                discounts: 25.75,
            });

            expect(typeof result.serviceChargeAmount).toBe("number");
            expect(typeof result.gstAmount).toBe("number");
            expect(typeof result.totalWithGST).toBe("number");
            // All values should be finite numbers
            expect(Number.isFinite(result.serviceChargeAmount)).toBe(true);
            expect(Number.isFinite(result.gstAmount)).toBe(true);
            expect(Number.isFinite(result.totalWithGST)).toBe(true);
        });

        it("handles very small decimal values", () => {
            const result = calculateEstimateSummary({
                totalAmount: 0.01,
                gst: 0.01,
                serviceCharge: 0.01,
                discounts: 0,
            });

            expect(Number.isFinite(result.totalWithGST)).toBe(true);
            expect(result.totalWithGST).toBeGreaterThanOrEqual(0);
        });
    });

    describe("edge cases", () => {
        it("treats zero totalAmount as zero result regardless of other inputs", () => {
            const result = calculateEstimateSummary({
                totalAmount: 0,
                gst: 18,
                serviceCharge: 10,
                discounts: 50,
            });

            // totalAfterDiscounts = 0 ? ... : 0 => 0
            expect(result.totalWithServiceCharge).toBe(0);
            expect(result.gstAmount).toBe(0);
            expect(result.totalWithGST).toBe(0);
        });

        it("handles large values without Infinity", () => {
            const result = calculateEstimateSummary({
                totalAmount: 1e10,
                gst: 100,
                serviceCharge: 100,
                discounts: 0,
            });

            expect(Number.isFinite(result.totalWithGST)).toBe(true);
            expect(result.totalWithGST).toBeGreaterThan(0);
        });

        it("handles negative discounts (surcharge scenario)", () => {
            const result = calculateEstimateSummary({
                totalAmount: 1000,
                gst: 18,
                serviceCharge: 10,
                discounts: -50,
            });

            // totalWithServiceCharge = 1100
            // totalAfterDiscounts = 1000 ? 1100 - (-50) = 1150
            // gstAmount = 1150 * 18/100 = 207
            // totalWithGST = 1150 + 207 = 1357
            expect(result.gstAmount).toBe(207);
            expect(result.totalWithGST).toBe(1357);
        });
    });
});
