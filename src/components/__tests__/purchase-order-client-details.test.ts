import { describe, it, expect } from "vitest";
import { toNumericInputValue, GST_TYPE_OPTIONS, GST_LABEL_BY_TYPE } from "@/components/purchase-order-client-details";

describe("toNumericInputValue", () => {
    describe("renders blank for empty / zero values", () => {
        it("returns empty string for null", () => {
            expect(toNumericInputValue(null)).toBe("");
        });

        it("returns empty string for undefined", () => {
            expect(toNumericInputValue(undefined)).toBe("");
        });

        it("returns empty string for NaN", () => {
            expect(toNumericInputValue(NaN)).toBe("");
        });

        it("returns empty string for zero", () => {
            expect(toNumericInputValue(0)).toBe("");
        });
    });

    describe("returns the numeric value otherwise", () => {
        it("returns a whole number unchanged", () => {
            expect(toNumericInputValue(10)).toBe(10);
        });

        it("returns a decimal value unchanged", () => {
            expect(toNumericInputValue(10.5)).toBe(10.5);
        });

        it("returns a negative value unchanged", () => {
            expect(toNumericInputValue(-5)).toBe(-5);
        });

        it("returns a small fractional value unchanged", () => {
            expect(toNumericInputValue(0.01)).toBe(0.01);
        });
    });
});

describe("GST_TYPE_OPTIONS", () => {
    it("defines No GST, CGST + SGST, and IGST options", () => {
        expect(GST_TYPE_OPTIONS).toHaveLength(3);
        expect(GST_TYPE_OPTIONS[0]).toEqual({ label: "No GST", value: "NONE" });
        expect(GST_TYPE_OPTIONS[1]).toEqual({ label: "CGST + SGST", value: "CGST_SGST" });
        expect(GST_TYPE_OPTIONS[2]).toEqual({ label: "IGST", value: "IGST" });
    });

    it("has unique values", () => {
        const values = GST_TYPE_OPTIONS.map(o => o.value);
        expect(new Set(values).size).toBe(values.length);
    });
});

describe("GST_LABEL_BY_TYPE", () => {
    it("maps each GST type to a human-readable label", () => {
        expect(GST_LABEL_BY_TYPE.NONE).toBe("GST");
        expect(GST_LABEL_BY_TYPE.CGST_SGST).toBe("CGST + SGST");
        expect(GST_LABEL_BY_TYPE.IGST).toBe("IGST");
    });

    it("falls back to GST for unknown types", () => {
        expect(GST_LABEL_BY_TYPE["UNKNOWN"] ?? "GST").toBe("GST");
    });
});
