import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@/test/utils/render";
import ClientsPage from "@/app/(appshell)/clients/page";
import { apiRequest } from "@/lib/api/api-client";

vi.mock("@/lib/api/api-client", () => ({
    apiRequest: vi.fn(),
}));

const mockApiRequest = vi.mocked(apiRequest);

const CLIENTS = Array.from({ length: 20 }, (_, i) => {
    const types = ["CORPORATE", "PERSONAL", "OTHER", null];
    return {
        id: `c-${i + 1}`,
        name: i < 2 ? (i === 0 ? "ust" : "tcs") : `Client ${i + 1}`,
        email: i % 2 === 0 ? `client${i + 1}@example.com` : null,
        phone: `9000000${String(i + 1).padStart(2, "0")}`,
        address: `Address ${i + 1}`,
        poc: `Contact ${i + 1}`,
        gst: null,
        pan: null,
        clientType: types[i % types.length],
        gstCertificate: null,
    };
});

const clientCount = (text: string) => screen.queryAllByText(text).length;

describe("ClientsPage", () => {
    beforeEach(() => {
        mockApiRequest.mockReset();
        mockApiRequest.mockImplementation(async (url: string) => {
            const parsed = new URL(url, "http://localhost");
            const page = Number(parsed.searchParams.get("page")) || 0;
            const size = Number(parsed.searchParams.get("size")) || 10;
            const search = (parsed.searchParams.get("search") || "").toLowerCase();

            const results = CLIENTS.filter(
                c => !search || c.name.toLowerCase().includes(search),
            );
            const start = page * size;
            return {
                ok: true,
                statusText: "OK",
                json: async () => results.slice(start, start + size),
            } as unknown as Response;
        });
    });

    it("loads page 1 clients and shows pagination controls", async () => {
        render(<ClientsPage />);

        await waitFor(() => expect(mockApiRequest).toHaveBeenCalled());
        const firstCall = mockApiRequest.mock.calls[0][0] as string;
        expect(firstCall).toContain("page=0");
        expect(firstCall).toContain("size=10");

        await waitFor(() => expect(clientCount("ust")).toBeGreaterThan(0));
        await waitFor(() => expect(clientCount("tcs")).toBeGreaterThan(0));

        // The clients API returns a bare array (no total), so pagination is
        // inferred from whether a full page was returned.
        expect(screen.getAllByRole("button", { name: "1" }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole("button", { name: "2" }).length).toBeGreaterThan(0);
    });

    it("navigates to page 2 and fetches the next offset", async () => {
        render(<ClientsPage />);

        await waitFor(() => expect(clientCount("ust")).toBeGreaterThan(0));
        fireEvent.click(screen.getAllByRole("button", { name: "2" })[0]);

        await waitFor(() =>
            expect(mockApiRequest).toHaveBeenLastCalledWith(
                expect.stringContaining("page=1"),
            ),
        );
        await waitFor(() => expect(clientCount("Client 11")).toBeGreaterThan(0));
        expect(clientCount("ust")).toBe(0);
    });

    it("debounces search and filters via the backend", async () => {
        render(<ClientsPage />);

        await waitFor(() => expect(clientCount("ust")).toBeGreaterThan(0));

        const searchInput = screen.getByPlaceholderText(
            "Search by name, email, phone or POC...",
        );
        fireEvent.input(searchInput, { target: { value: "tcs" } });

        expect(mockApiRequest).not.toHaveBeenLastCalledWith(
            expect.stringContaining("search=tcs"),
        );

        await waitFor(() =>
            expect(mockApiRequest).toHaveBeenLastCalledWith(
                expect.stringContaining("search=tcs"),
            ),
        );
        await waitFor(() => expect(clientCount("tcs")).toBeGreaterThan(0));
        expect(clientCount("ust")).toBe(0);
    });

    it("resets to page 1 when a new search is entered", async () => {
        render(<ClientsPage />);

        await waitFor(() => expect(clientCount("ust")).toBeGreaterThan(0));
        fireEvent.click(screen.getAllByRole("button", { name: "2" })[0]);
        await waitFor(() => expect(clientCount("Client 11")).toBeGreaterThan(0));

        const searchInput = screen.getByPlaceholderText(
            "Search by name, email, phone or POC...",
        );
        fireEvent.input(searchInput, { target: { value: "ust" } });

        await waitFor(() =>
            expect(mockApiRequest).toHaveBeenLastCalledWith(
                expect.stringContaining("page=0"),
            ),
        );
        await waitFor(() => expect(clientCount("ust")).toBeGreaterThan(0));
        expect(clientCount("Client 11")).toBe(0);
    });

    it("shows an empty state when a search matches nothing", async () => {
        render(<ClientsPage />);

        await waitFor(() => expect(clientCount("ust")).toBeGreaterThan(0));

        const searchInput = screen.getByPlaceholderText(
            "Search by name, email, phone or POC...",
        );
        fireEvent.input(searchInput, { target: { value: "zzz" } });

        await waitFor(() =>
            expect(mockApiRequest).toHaveBeenLastCalledWith(
                expect.stringContaining("search=zzz"),
            ),
        );
        await waitFor(() =>
            expect(
                screen.getAllByText("No clients match your search.").length,
            ).toBeGreaterThan(0),
        );
    });
});
