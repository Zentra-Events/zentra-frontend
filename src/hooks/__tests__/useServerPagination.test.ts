import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useServerPagination } from "@/hooks/useServerPagination";

interface Item {
    id: string;
    name: string;
}

const makeItems = (count: number): Item[] =>
    Array.from({ length: count }, (_, i) => ({ id: `i-${i}`, name: `Item ${i}` }));

describe("useServerPagination", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("fetches page 1 on mount and maps Spring Data response", async () => {
        const fetchPage = vi.fn(async () => ({
            items: makeItems(2),
            total: 6,
        }));
        const { result } = renderHook(() =>
            useServerPagination<Item>({ fetchPage, pageSize: 2 }),
        );

        expect(result.current.loading).toBe(true);
        expect(result.current.currentPage).toBe(1);

        await act(async () => {
            await Promise.resolve();
        });

        expect(fetchPage).toHaveBeenCalledTimes(1);
        expect(fetchPage).toHaveBeenCalledWith({ search: "", page: 1, pageSize: 2 });
        expect(result.current.items).toHaveLength(2);
        expect(result.current.total).toBe(6);
        expect(result.current.totalPages).toBe(3);
        expect(result.current.hasMore).toBe(true);
        expect(result.current.isFirstPage).toBe(true);
        expect(result.current.isLastPage).toBe(false);
        expect(result.current.loading).toBe(false);
    });

    it("debounces search and resets to page 1", async () => {
        const fetchPage = vi.fn(async () => ({
            items: makeItems(2),
            total: 6,
        }));
        const { result } = renderHook(() =>
            useServerPagination<Item>({ fetchPage, pageSize: 2 }),
        );

        await act(async () => {
            await Promise.resolve();
        });
        expect(fetchPage).toHaveBeenCalledWith({ search: "", page: 1, pageSize: 2 });

        act(() => {
            result.current.setSearch("item 1");
        });
        // Debounce has not fired yet: no additional fetch.
        expect(fetchPage).toHaveBeenCalledTimes(1);

        act(() => {
            vi.advanceTimersByTime(150);
        });

        expect(fetchPage).toHaveBeenCalledTimes(2);
        expect(fetchPage).toHaveBeenLastCalledWith({
            search: "item 1",
            page: 1,
            pageSize: 2,
        });
        expect(result.current.currentPage).toBe(1);
        expect(result.current.search).toBe("item 1");
    });

    it("navigates to a requested page", async () => {
        const fetchPage = vi.fn(async () => ({
            items: makeItems(2),
            total: 6,
        }));
        const { result } = renderHook(() =>
            useServerPagination<Item>({ fetchPage, pageSize: 2 }),
        );

        await act(async () => {
            await Promise.resolve();
        });

        act(() => {
            result.current.setPage(3);
        });

        expect(fetchPage).toHaveBeenLastCalledWith({
            search: "",
            page: 3,
            pageSize: 2,
        });
        expect(result.current.currentPage).toBe(3);
        expect(result.current.isFirstPage).toBe(false);
    });

    it("resets to page 1 when the filter signature changes", async () => {
        const fetchPage = vi.fn(async () => ({
            items: makeItems(2),
            total: 6,
        }));
        const { result, rerender } = renderHook(
            ({ sig }) =>
                useServerPagination<Item>({
                    fetchPage,
                    pageSize: 2,
                    filterSignature: sig,
                }),
            { initialProps: { sig: "role:user" } },
        );

        await act(async () => {
            await Promise.resolve();
        });
        expect(fetchPage).toHaveBeenLastCalledWith({
            search: "",
            page: 1,
            pageSize: 2,
        });

        rerender({ sig: "role:admin" });

        expect(result.current.currentPage).toBe(1);
        expect(fetchPage).toHaveBeenLastCalledWith({
            search: "",
            page: 1,
            pageSize: 2,
        });
    });

    it("infers hasMore when the backend returns no total (bare array)", async () => {
        const fullPage = vi.fn(async () => ({ items: makeItems(2) }));
        const { result: full } = renderHook(() =>
            useServerPagination<Item>({ fetchPage: fullPage, pageSize: 2 }),
        );
        await act(async () => {
            await Promise.resolve();
        });
        expect(full.current.total).toBe(0);
        expect(full.current.totalPages).toBe(2);
        expect(full.current.hasMore).toBe(true);

        const partialPage = vi.fn(async () => ({ items: makeItems(1) }));
        const { result: partial } = renderHook(() =>
            useServerPagination<Item>({ fetchPage: partialPage, pageSize: 2 }),
        );
        await act(async () => {
            await Promise.resolve();
        });
        expect(partial.current.totalPages).toBe(1);
        expect(partial.current.hasMore).toBe(false);
    });

    it("sets error and stops loading when fetch fails", async () => {
        const fetchPage = vi.fn(async () => {
            throw new Error("upstream failure");
        });
        const { result } = renderHook(() =>
            useServerPagination<Item>({ fetchPage, pageSize: 2 }),
        );

        await act(async () => {
            await Promise.resolve();
        });

        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe("upstream failure");
        expect(result.current.items).toHaveLength(0);
    });

    it("reset clears search, page and items", async () => {
        const fetchPage = vi.fn(async () => ({
            items: makeItems(2),
            total: 6,
        }));
        const { result } = renderHook(() =>
            useServerPagination<Item>({ fetchPage, pageSize: 2 }),
        );

        await act(async () => {
            await Promise.resolve();
        });
        act(() => {
            result.current.setSearch("item 1");
        });
        act(() => {
            vi.advanceTimersByTime(150);
        });
        expect(result.current.search).toBe("item 1");
        expect(result.current.items).toHaveLength(2);

        act(() => {
            result.current.reset();
        });

        expect(result.current.search).toBe("");
        expect(result.current.currentPage).toBe(1);
        expect(result.current.items).toHaveLength(0);
        expect(result.current.total).toBe(0);
        expect(result.current.error).toBeNull();
    });
});
