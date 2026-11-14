"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_PAGE_SIZE } from "@/constants";

export interface PagedData<T> {
    items: T[];
    total?: number;
}

export interface UseServerPaginationProps<T> {
    fetchPage: (args: {
        search: string;
        page: number;
        pageSize: number;
    }) => Promise<PagedData<T>>;
    debounceMs?: number;
    pageSize?: number;
    /**
     * External filter signature (e.g. role/sort for users, type for clients).
     * When it changes, pagination resets to page 1 and refetches. Search is
     * managed internally by this hook and is NOT part of this signature.
     */
    filterSignature?: string;
    enabled?: boolean;
}

export interface UseServerPaginationReturn<T> {
    items: T[];
    total: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
    search: string;
    setSearch: (value: string) => void;
    loading: boolean;
    error: string | null;
    hasMore: boolean;
    isFirstPage: boolean;
    isLastPage: boolean;
    setPage: (page: number) => void;
    setPageSize: (size: number) => void;
    refetch: () => void;
    reset: () => void;
}

/**
 * Server-driven pagination + search hook for list pages.
 *
 * - Debounces search input and resets to page 1 on search/filter change.
 * - Aborts in-flight requests when superseded so stale responses can never
 *   overwrite newer results.
 * - Replaces the current page's items on each fetch (no appending).
 * - Infers `hasMore` / `totalPages` when the backend does not return a total
 *   count (e.g. clients returns a bare array).
 */
export function useServerPagination<T>({
    fetchPage,
    debounceMs = 150,
    pageSize = DEFAULT_PAGE_SIZE,
    filterSignature,
    enabled = true,
}: UseServerPaginationProps<T>): UseServerPaginationReturn<T> {
    const [search, setSearchState] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [page, setPageState] = useState(1);
    const [pageSizeState, setPageSizeState] = useState(pageSize);
    const [items, setItems] = useState<T[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastPageSize, setLastPageSize] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);

    const fetchPageRef = useRef(fetchPage);
    fetchPageRef.current = fetchPage;

    const abortRef = useRef<AbortController | null>(null);
    const mountedRef = useRef(true);
    // Holds the last-processed filter signature so the effect can detect
    // genuine changes (it must not be written during render).
    const filterSignatureRef = useRef(filterSignature ?? "");

    const cancel = useCallback(() => {
        if (abortRef.current) {
            try {
                abortRef.current.abort();
            } catch {
                // Aborting an already-settled controller is harmless.
            }
            abortRef.current = null;
        }
    }, []);

    const fetchItems = useCallback(
        async (nextPage: number) => {
            if (!enabled) return;
            cancel();
            const controller = new AbortController();
            abortRef.current = controller;

            setLoading(true);
            setError(null);

            try {
                const result = await fetchPageRef.current({
                    search: debouncedSearch,
                    page: nextPage,
                    pageSize: pageSizeState,
                });
                if (controller.signal.aborted) return;
                if (!mountedRef.current) return;

                setItems(result.items);
                if (result.total !== undefined) setTotal(result.total);
                setLastPageSize(result.items.length);
                setLoading(false);
            } catch (err) {
                if (controller.signal.aborted || !mountedRef.current) return;
                setLoading(false);
                setLastPageSize(0);
                setError(err instanceof Error ? err.message : "Failed to load data");
            }
        },
        [debouncedSearch, pageSizeState, enabled, cancel],
    );

    // Debounce search input.
    useEffect(() => {
        if (!enabled) return;
        const id = setTimeout(() => setDebouncedSearch(search), debounceMs);
        return () => clearTimeout(id);
    }, [search, debounceMs, enabled]);

    // Search change -> reset to page 1 (fetch effect picks up page change).
    useEffect(() => {
        if (!enabled) return;
        setPageState(1);
    }, [debouncedSearch, enabled]);

    // Filter signature change -> reset to page 1 and refetch.
    useEffect(() => {
        if (!enabled) return;
        const prev = filterSignatureRef.current;
        const curr = filterSignature ?? "";
        if (prev !== curr) {
            filterSignatureRef.current = curr;
            setPageState(1);
        }
    }, [filterSignature, enabled]);

    // Page / page-size change -> fetch that page (replace items).
    useEffect(() => {
        if (!enabled) return;
        fetchItems(page);
    }, [page, fetchItems, enabled, refreshKey]);

    const hasMore =
        total > 0
            ? items.length < total
            : lastPageSize === pageSizeState && lastPageSize > 0;

    const totalPages =
        total > 0 ? Math.ceil(total / pageSizeState) : Math.max(1, hasMore ? page + 1 : page);

    const isFirstPage = page <= 1;
    const isLastPage = !hasMore;

    const setPage = useCallback((nextPage: number) => {
        setPageState(Math.max(1, nextPage));
    }, []);

    const setPageSize = useCallback((nextSize: number) => {
        setPageSizeState(Math.max(1, nextSize));
        setPageState(1);
    }, []);

    const refetch = useCallback(() => {
        setRefreshKey(key => key + 1);
    }, []);

    const reset = useCallback(() => {
        cancel();
        setSearchState("");
        setDebouncedSearch("");
        setPageState(1);
        setItems([]);
        setTotal(0);
        setLastPageSize(0);
        setError(null);
        setLoading(false);
    }, [cancel]);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            cancel();
        };
    }, [cancel]);

    return {
        items,
        total,
        totalPages,
        currentPage: page,
        pageSize: pageSizeState,
        search,
        setSearch: setSearchState,
        loading,
        error,
        hasMore,
        isFirstPage,
        isLastPage,
        setPage,
        setPageSize,
        refetch,
        reset,
    };
}
