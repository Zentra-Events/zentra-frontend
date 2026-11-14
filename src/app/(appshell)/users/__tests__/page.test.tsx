import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@/test/utils/render";
import UsersPage from "@/app/(appshell)/users/page";
import { apiRequest } from "@/lib/api/api-client";

vi.mock("@/lib/api/api-client", () => ({
    apiRequest: vi.fn(),
}));

const mockApiRequest = vi.mocked(apiRequest);

const USERS = Array.from({ length: 25 }, (_, i) => ({
    id: `u-${i}`,
    name: `User ${i}`,
    role: i % 3 === 0 ? "admin" : i % 3 === 1 ? "user" : "customer",
    phone: `9000000${String(i).padStart(2, "0")}`,
    email: `user${i}@example.com`,
    uid: `user_${i}`,
    status: "active",
}));

const userCount = (text: string) => screen.queryAllByText(text).length;

describe("UsersPage", () => {
    beforeEach(() => {
        mockApiRequest.mockReset();
        mockApiRequest.mockImplementation(async (url: string) => {
            const parsed = new URL(url, "http://localhost");
            const page = Number(parsed.searchParams.get("page")) || 0;
            const size = Number(parsed.searchParams.get("size")) || 10;
            const search = (parsed.searchParams.get("search") || "").toLowerCase();
            const role = parsed.searchParams.get("role") || "";

            let results = USERS.filter(
                u => !search || u.name.toLowerCase().includes(search),
            );
            if (role) {
                results = results.filter(u => u.role === role);
            }

            const start = page * size;
            const content = results.slice(start, start + size);
            return {
                ok: true,
                statusText: "OK",
                json: async () => ({ content, totalElements: results.length }),
            } as unknown as Response;
        });
    });

    it("loads page 1 users and shows pagination metadata", async () => {
        render(<UsersPage />);

        await waitFor(() => expect(mockApiRequest).toHaveBeenCalled());
        const firstCall = mockApiRequest.mock.calls[0][0] as string;
        expect(firstCall).toContain("page=0");
        expect(firstCall).toContain("size=10");
        expect(firstCall).toContain("sortBy=createdAt");
        expect(firstCall).toContain("direction=desc");

        await waitFor(() => expect(userCount("User 0")).toBeGreaterThan(0));
        expect(screen.getAllByRole("button", { name: "3" }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole("button", { name: "1" }).length).toBeGreaterThan(0);
        expect(screen.getAllByRole("button", { name: "2" }).length).toBeGreaterThan(0);
    });

    it("navigates to page 2 and fetches the correct offset", async () => {
        render(<UsersPage />);

        await waitFor(() => expect(userCount("User 0")).toBeGreaterThan(0));
        fireEvent.click(screen.getAllByRole("button", { name: "2" })[0]);

        await waitFor(() =>
            expect(mockApiRequest).toHaveBeenLastCalledWith(
                expect.stringContaining("page=1"),
            ),
        );
        await waitFor(() => expect(userCount("User 10")).toBeGreaterThan(0));
        expect(userCount("User 0")).toBe(0);
    });

    it("debounces search and filters via the backend", async () => {
        render(<UsersPage />);

        await waitFor(() => expect(userCount("User 0")).toBeGreaterThan(0));

        const searchInput = screen.getByPlaceholderText(
            "Search by name, email, or username...",
        );
        fireEvent.input(searchInput, { target: { value: "User 5" } });

        // Debounce has not fired yet: last call is still the initial fetch.
        expect(mockApiRequest).not.toHaveBeenLastCalledWith(
            expect.stringContaining("search=User%205"),
        );

        await waitFor(() =>
            expect(mockApiRequest).toHaveBeenLastCalledWith(
                expect.stringContaining("search=User"),
            ),
        );
        await waitFor(() => expect(userCount("User 5")).toBeGreaterThan(0));
        expect(userCount("User 0")).toBe(0);
    });

    it("resets to page 1 when a new search is entered", async () => {
        render(<UsersPage />);

        await waitFor(() => expect(userCount("User 0")).toBeGreaterThan(0));
        fireEvent.click(screen.getAllByRole("button", { name: "3" })[0]);
        await waitFor(() => expect(userCount("User 20")).toBeGreaterThan(0));

        const searchInput = screen.getByPlaceholderText(
            "Search by name, email, or username...",
        );
        fireEvent.input(searchInput, { target: { value: "User 0" } });

        await waitFor(() =>
            expect(mockApiRequest).toHaveBeenLastCalledWith(
                expect.stringContaining("page=0"),
            ),
        );
        await waitFor(() => expect(userCount("User 0")).toBeGreaterThan(0));
        expect(userCount("User 20")).toBe(0);
    });

    it("shows an empty state when a search matches nothing", async () => {
        render(<UsersPage />);

        await waitFor(() => expect(userCount("User 0")).toBeGreaterThan(0));

        const searchInput = screen.getByPlaceholderText(
            "Search by name, email, or username...",
        );
        fireEvent.input(searchInput, { target: { value: "zzz" } });

        await waitFor(() =>
            expect(mockApiRequest).toHaveBeenLastCalledWith(
                expect.stringContaining("search=zzz"),
            ),
        );
        await waitFor(() =>
            expect(
                screen.getAllByText("No users match your search.").length,
            ).toBeGreaterThan(0),
        );
    });
});
