import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { HttpResponse, http } from "msw";
import { server } from "@/test/mocks/server";

describe("MSW API mocking", () => {
    beforeAll(() => {
        server.listen();
    });

    afterEach(() => {
        server.resetHandlers();
    });

    afterAll(() => {
        server.close();
    });

    it("should mock a successful API response", async () => {
        server.use(
            http.get("http://localhost:3000/api/test-success", () => {
                return HttpResponse.json({ message: "success", data: { id: 1 } });
            }),
        );

        const response = await fetch("http://localhost:3000/api/test-success");
        const data = await response.json();

        expect(response.ok).toBe(true);
        expect(data.message).toBe("success");
        expect(data.data.id).toBe(1);
    });

    it("should mock a 401 authentication failure", async () => {
        server.use(
            http.get("http://localhost:3000/api/test-unauthorized", () => {
                return HttpResponse.json(
                    { message: "Unauthorized" },
                    { status: 401 },
                );
            }),
        );

        const response = await fetch("http://localhost:3000/api/test-unauthorized");

        expect(response.status).toBe(401);
        expect(response.ok).toBe(false);
    });

    it("should mock a 500 server error", async () => {
        server.use(
            http.get("http://localhost:3000/api/test-server-error", () => {
                return HttpResponse.json(
                    { message: "Internal server error" },
                    { status: 500 },
                );
            }),
        );

        const response = await fetch("http://localhost:3000/api/test-server-error");

        expect(response.status).toBe(500);
        expect(response.ok).toBe(false);
    });

    it("should mock a 422 validation error", async () => {
        server.use(
            http.post("http://localhost:3000/api/test-validation", () => {
                return HttpResponse.json(
                    {
                        message: "Validation failed",
                        errors: { email: ["Invalid email"] },
                    },
                    { status: 422 },
                );
            }),
        );

        const response = await fetch("http://localhost:3000/api/test-validation", {
            method: "POST",
        });
        const data = await response.json();

        expect(response.status).toBe(422);
        expect(data.errors.email).toContain("Invalid email");
    });

    it("should support delayed responses", async () => {
        server.use(
            http.get("http://localhost:3000/api/test-delayed", async () => {
                await new Promise((resolve) => setTimeout(resolve, 100));
                return HttpResponse.json({ message: "delayed response" });
            }),
        );

        const start = Date.now();
        const response = await fetch("http://localhost:3000/api/test-delayed");
        const elapsed = Date.now() - start;
        const data = await response.json();

        expect(response.ok).toBe(true);
        expect(data.message).toBe("delayed response");
        expect(elapsed).toBeGreaterThanOrEqual(100);
    });
});
