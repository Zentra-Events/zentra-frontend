import { describe, it, expect } from "vitest";
import { generateId } from "@/lib/utils/id";

describe("generateId", () => {
    it("should generate a unique identifier", () => {
        const id1 = generateId();
        const id2 = generateId();
        expect(id1).toBeTypeOf("string");
        expect(id1.length).toBeGreaterThan(0);
        expect(id1).not.toBe(id2);
    });

    it("should generate IDs of reasonable length", () => {
        const id = generateId();
        expect(id.length).toBeGreaterThanOrEqual(8);
    });
});
