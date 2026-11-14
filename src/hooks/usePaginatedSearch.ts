"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface PagedResult<T> {
    items: T[];
    total?: number;
}

export interface UsePaginatedSearchProps<T> {
    fetchPage: (search: string, page: number) => Promise<PagedResult<T>>;
    debounceMs?: number;
    pageSize?: number;
    /** When false, no searches are issued (useful to keep a component idle). */
    enabled?: boolean;
}

export interface UsePaginatedSearchReturn<T> {
    items: T[];
    loading: boolean;
    error: string | null;
    search: string;
    setSearch: (value: string) => void;
    hasMore: boolean;
    loadMore: () => void;
    reset: () => void;
}

/**
 * Hook backing searchable, paginated dropdowns.
 *
 * Handles debounced search input, resets pagination when the search term
 * changes, aborts in-flight requests when superseded (so stale responses
 * can never overwrite newer ones), appends additional pages on loadMore,
 * and exposes loading / error / empty / hasMore state.
 */
export function usePaginatedSearch<T>({
    fetchPage,
    debounceMs = 150,
    pageSize = 10,
    enabled = true,
}: UsePaginatedSearchProps<T>): UsePaginatedSearchReturn<T> {
    const [search, setSearchState] = useState("");
    const [page, setPage] = useState(0);
    const [items, setItems] = useState<T[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [total, setTotal] = useState<number | undefined>(undefined);
    // Number of items returned by the most recent page fetch. Used to infer
    // whether more pages exist when the backend does not return a total count.
    const [lastPageSize, setLastPageSize] = useState(0);

    const fetchPageRef = useRef(fetchPage);
    fetchPageRef.current = fetchPage;

    const abortRef = useRef<AbortController | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mountedRef = useRef(true);

    const cancel = useCallback(() => {
        if (abortRef.current) {
            try {
                abortRef.current.abort();
            } catch {
                // Abort on an already-settled controller is harmless.
            }
            abortRef.current = null;
        }
    }, []);

    const fetchItems = useCallback(
        async (nextSearch: string, nextPage: number, append: boolean) => {
            cancel();
            const controller = new AbortController();
            abortRef.current = controller;

            setLoading(true);
            setError(null);

            try {
                const result = await fetchPageRef.current(nextSearch, nextPage);
                if (controller.signal.aborted) return;
                if (!mountedRef.current) return;

                setItems(prev =>
                    append ? [...prev, ...result.items] : result.items,
                );
                if (result.total !== undefined) setTotal(result.total);
                setLastPageSize(result.items.length);
                setPage(append ? nextPage : 0);
                setLoading(false);
            } catch (err) {
                if (controller.signal.aborted || !mountedRef.current) return;
                setLoading(false);
                setLastPageSize(0);
                setError(err instanceof Error ? err.message : "Search failed");
            }
        },
        [cancel],
    );

    // Debounced search: reset pagination and fetch page 0.
    useEffect(() => {
        if (!enabled) return;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            fetchItems(search, 0, false);
        }, debounceMs);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [search, debounceMs, fetchItems, enabled]);

    const hasMore =
        total !== undefined
            ? items.length < total
            : lastPageSize === pageSize && lastPageSize > 0;

    const loadMore = useCallback(() => {
        if (loading || !hasMore) return;
        fetchItems(search, page + 1, true);
    }, [search, page, loading, hasMore, fetchItems]);

    const reset = useCallback(() => {
        cancel();
        setSearchState("");
        setPage(0);
        setItems([]);
        setTotal(undefined);
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
        loading,
        error,
        search,
        setSearch: setSearchState,
        hasMore,
        loadMore,
        reset,
    };
}
