import { describe, it, expect } from "vitest";
import { enquiryFieldSchemas, validateEnquiryField } from "@/lib/validations/enquiry";
import type { EnquiryEditableField } from "@/lib/validations/enquiry";

const nonToDateFields: Exclude<EnquiryEditableField, "toDate">[] = [
    "title",
    "location",
    "venue",
    "highlvelRequirement",
    "enquiryPoCNumber",
    "clientPoC",
    "enquiryPoC",
    "eventPoC",
    "eventPoCNumber",
    "assignedTo",
    "status",
    "eventType",
    "fromDate",
];

describe("validateEnquiryField", () => {
    const validValues: Record<EnquiryEditableField, unknown> = {
        title: "Annual Day Celebration",
        location: "Hyderabad",
        venue: "Grand Ballroom",
        highlvelRequirement: "Catering for 200 guests",
        enquiryPoCNumber: "9876543210",
        clientPoC: "John Doe",
        enquiryPoC: "Jane Doe",
        eventPoC: "Event POC",
        eventPoCNumber: "9123456789",
        assignedTo: "user-1",
        status: "OPEN",
        eventType: "CORPORATE",
        fromDate: "2024-01-02",
        toDate: "2024-01-03",
    };

    it.each(nonToDateFields)("validates field %s without throwing for valid input", async field => {
        const err = await validateEnquiryField(field, validValues[field]);
        expect(err).toBeNull();
    });

    it("title: required", async () => {
        expect(await validateEnquiryField("title", "")).toBe("Event title is required");
        expect(await validateEnquiryField("title", undefined)).toBe("Event title is required");
    });

    it("title: min 3 characters", async () => {
        expect(await validateEnquiryField("title", "ab")).toBe("Add at least 3 characters");
    });

    it("location: required", async () => {
        expect(await validateEnquiryField("location", "")).toBe("Location is required");
    });

    it("venue: required", async () => {
        expect(await validateEnquiryField("venue", "")).toBe("Venue is required");
    });

    it("highlvelRequirement: required", async () => {
        expect(await validateEnquiryField("highlvelRequirement", "")).toBe(
            "High level requirement is required",
        );
    });

    it("enquiryPoCNumber: required", async () => {
        expect(await validateEnquiryField("enquiryPoCNumber", "")).toBe("Contact number is required");
    });

    it("optional fields pass with empty values", async () => {
        for (const field of [
            "clientPoC",
            "enquiryPoC",
            "eventPoC",
            "eventPoCNumber",
            "assignedTo",
        ] as EnquiryEditableField[]) {
            expect(await validateEnquiryField(field, "")).toBeNull();
        }
    });

    it("status: accepts valid enum values", async () => {
        for (const value of ["OPEN", "IN_PROGRESS", "CLOSED"]) {
            expect(await validateEnquiryField("status", value)).toBeNull();
        }
    });

    it("status: rejects invalid enum values", async () => {
        expect(await validateEnquiryField("status", "DRAFT")).toBe("Invalid status");
    });

    it("status: empty string fails oneOf before required", async () => {
        expect(await validateEnquiryField("status", "")).toBe("Invalid status");
    });

    it("status: undefined is required", async () => {
        expect(await validateEnquiryField("status", undefined)).toBe("Status is required");
    });

    it("eventType: accepts valid enum values", async () => {
        for (const value of ["PERSONAL", "CORPORATE", "OTHER"]) {
            expect(await validateEnquiryField("eventType", value)).toBeNull();
        }
    });

    it("eventType: rejects invalid enum values", async () => {
        expect(await validateEnquiryField("eventType", "WEDDING")).toBe("Invalid event type");
    });

    it("eventType: empty string fails oneOf before required", async () => {
        expect(await validateEnquiryField("eventType", "")).toBe("Invalid event type");
    });

    it("eventType: undefined is required", async () => {
        expect(await validateEnquiryField("eventType", undefined)).toBe("Event type is required");
    });

    it("fromDate: optional and nullable", async () => {
        expect(await validateEnquiryField("fromDate", "")).toBeNull();
        expect(await validateEnquiryField("fromDate", null)).toBeNull();
        expect(await validateEnquiryField("fromDate", undefined)).toBeNull();
    });
});

describe("enquiryFieldSchemas", () => {
    it("exports all expected field schemas", () => {
        expect(Object.keys(enquiryFieldSchemas)).toEqual([
            "title",
            "location",
            "venue",
            "highlvelRequirement",
            "enquiryPoCNumber",
            "clientPoC",
            "enquiryPoC",
            "eventPoC",
            "eventPoCNumber",
            "assignedTo",
            "status",
            "eventType",
            "fromDate",
            "toDate",
        ]);
    });

    it("EnquiryEditableField type is keyof the schemas", () => {
        const field: EnquiryEditableField = "title";
        expect(field).toBe("title");
    });
});
