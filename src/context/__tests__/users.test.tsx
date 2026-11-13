import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, fireEvent, waitFor } from "@testing-library/react";
import {
    UserProvider,
    useUsers,
    __resetUsersCacheForTests,
    // type UserContextType,
} from "@/context/users";
import { apiRequest } from "@/lib/api/api-client";
import type { User } from "@/types/user";

vi.mock("@/lib/api/api-client", () => ({
    apiRequest: vi.fn(),
}));

const mockApiRequest = vi.mocked(apiRequest);

const baseUsers: User[] = [
    { id: "1", name: "Alice", email: "a@x.com", uid: "alice", phone: "1", role: "admin" },
    { id: "2", name: "Bob", email: "b@x.com", uid: "bob", phone: "2", role: "user" },
];

function jsonResponse(body: unknown, ok = true, status = 200) {
    return {
        ok,
        status,
        statusText: ok ? "OK" : "Error",
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue(body),
    } as unknown as Response;
}

function StoreHarness() {
    const ctx = useUsers();
    return (
        <div>
            <span data-testid="count">{ctx.users.length}</span>
            <span data-testid="loading">{String(ctx.loading)}</span>
            <span data-testid="error">{ctx.error ?? ""}</span>
            <button data-testid="btn-refresh" onClick={() => void ctx.refresh()}>
                refresh
            </button>
            <button
                data-testid="btn-add"
                onClick={() =>
                    ctx.addUser({
                        id: "3",
                        name: "Carol",
                        email: "c@x.com",
                        uid: "carol",
                        phone: "3",
                        role: "customer",
                    })
                }
            >
                add
            </button>
            <button
                data-testid="btn-update"
                onClick={() =>
                    ctx.updateUser({
                        id: "1",
                        name: "Alice Updated",
                        email: "a@x.com",
                        uid: "alice",
                        phone: "1",
                        role: "admin",
                    })
                }
            >
                update
            </button>
            <button data-testid="btn-delete" onClick={() => ctx.deleteUser("2")}>
                delete
            </button>
            <button
                data-testid="btn-set"
                onClick={() =>
                    ctx.setUsers([
                        {
                            id: "9",
                            name: "Zed",
                            email: "z@x.com",
                            uid: "zed",
                            phone: "9",
                            role: "user",
                        },
                    ])
                }
            >
                set
            </button>
        </div>
    );
}

describe("useUsers centralized store", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        __resetUsersCacheForTests();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("fetches users on mount and exposes them through the store", async () => {
        mockApiRequest.mockResolvedValue(jsonResponse({ content: baseUsers }));

        render(
            <UserProvider>
                <StoreHarness />
            </UserProvider>,
        );

        await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
        expect(mockApiRequest).toHaveBeenCalled();
        expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    it("refresh re-fetches the user list from the API", async () => {
        mockApiRequest.mockResolvedValue(jsonResponse({ content: baseUsers }));

        render(
            <UserProvider>
                <StoreHarness />
            </UserProvider>,
        );

        await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));
        mockApiRequest.mockClear();

        // Defer the refresh response so the in-flight loading state is observable.
        let resolveFetch: (value: Response) => void = () => {};
        const deferred = new Promise<Response>(resolve => {
            resolveFetch = resolve;
        });
        mockApiRequest.mockReturnValue(deferred);

        await act(async () => {
            fireEvent.click(screen.getByTestId("btn-refresh"));
        });

        // Loading flips to true while the deferred fetch is in flight.
        await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("true"));
        expect(mockApiRequest).toHaveBeenCalled();

        resolveFetch(jsonResponse({ content: baseUsers }));
        await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));
    });

    it("addUser appends a new user and ignores duplicates by id", async () => {
        mockApiRequest.mockResolvedValue(jsonResponse({ content: baseUsers }));

        render(
            <UserProvider>
                <StoreHarness />
            </UserProvider>,
        );

        await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));

        await act(async () => {
            fireEvent.click(screen.getByTestId("btn-add"));
        });

        expect(screen.getByTestId("count")).toHaveTextContent("3");

        // Re-adding the same id should not duplicate.
        await act(async () => {
            fireEvent.click(screen.getByTestId("btn-add"));
        });

        expect(screen.getByTestId("count")).toHaveTextContent("3");
    });

    it("updateUser replaces the existing user by id", async () => {
        mockApiRequest.mockResolvedValue(jsonResponse({ content: baseUsers }));

        render(
            <UserProvider>
                <StoreHarness />
            </UserProvider>,
        );

        await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));

        await act(async () => {
            fireEvent.click(screen.getByTestId("btn-update"));
        });

        expect(screen.getByTestId("count")).toHaveTextContent("2");
    });

    it("deleteUser removes the user by id", async () => {
        mockApiRequest.mockResolvedValue(jsonResponse({ content: baseUsers }));

        render(
            <UserProvider>
                <StoreHarness />
            </UserProvider>,
        );

        await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));

        await act(async () => {
            fireEvent.click(screen.getByTestId("btn-delete"));
        });

        expect(screen.getByTestId("count")).toHaveTextContent("1");
    });

    it("setUsers replaces the entire store contents", async () => {
        mockApiRequest.mockResolvedValue(jsonResponse({ content: baseUsers }));

        render(
            <UserProvider>
                <StoreHarness />
            </UserProvider>,
        );

        await waitFor(() => expect(screen.getByTestId("count")).toHaveTextContent("2"));

        await act(async () => {
            fireEvent.click(screen.getByTestId("btn-set"));
        });

        expect(screen.getByTestId("count")).toHaveTextContent("1");
    });

    it("handles API failure by setting error and empty users", async () => {
        mockApiRequest.mockResolvedValue(jsonResponse({ message: "boom" }, false, 500));

        render(
            <UserProvider>
                <StoreHarness />
            </UserProvider>,
        );

        expect(await screen.findByTestId("count")).toHaveTextContent("0");
        expect(screen.getByTestId("error")).not.toHaveTextContent("");
        expect(screen.getByTestId("loading")).toHaveTextContent("false");
    });

    it("synchronizes across multiple consumers sharing the store", async () => {
        mockApiRequest.mockResolvedValue(jsonResponse({ content: baseUsers }));

        function ConsumerA() {
            const { addUser } = useUsers();
            return (
                <button
                    data-testid="btn-add-cross"
                    onClick={() =>
                        addUser({
                            id: "4",
                            name: "Dev",
                            email: "d@x.com",
                            uid: "dev",
                            phone: "4",
                            role: "user",
                        })
                    }
                >
                    add cross
                </button>
            );
        }
        function ConsumerB() {
            const { users } = useUsers();
            return <span data-testid="cross-count">{users.length}</span>;
        }

        render(
            <UserProvider>
                <div>
                    <ConsumerA />
                    <ConsumerB />
                </div>
            </UserProvider>,
        );

        await waitFor(() => expect(screen.getByTestId("cross-count")).toHaveTextContent("2"));

        await act(async () => {
            fireEvent.click(screen.getByTestId("btn-add-cross"));
        });

        await waitFor(() => expect(screen.getByTestId("cross-count")).toHaveTextContent("3"));
    });
});
