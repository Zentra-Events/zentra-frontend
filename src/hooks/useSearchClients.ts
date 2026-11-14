"use client";

import { useCallback } from "react";

import { apiRequest } from "@/lib/api/api-client";
import { buildQueryUrl } from "@/lib/api/query-params";
import { usePaginatedSearch } from "@/hooks/usePaginatedSearch";
import type { Client } from "@/types/client";

export interface UseSearchClientsReturn {
    clients: Client[];
    loading: boolean;
    error: string | null;
    search: string;
    setSearch: (value: string) => void;
    hasMore: boolean;
    loadMore: () => void;
    reset: () => void;
}

/**
 * Backend-driven search for clients.
 *
 * Queries `GET /api/clients?page=&size=&search=` (zero-based page). The
 * backend returns a plain JSON array (no pagination wrapper/total), so
 * `hasMore` is inferred from whether the last page filled the page size.
 */
export function useSearchClients(pageSize = 10): UseSearchClientsReturn {
    const fetchPage = useCallback(
        async (search: string, page: number): Promise<{ items: Client[]; total?: number }> => {
            const url = buildQueryUrl("/api/clients", {
                page,
                size: pageSize,
                search,
            });
            const res = await apiRequest(url);
            if (!res.ok) {
                throw new Error(`Failed to search clients: ${res.statusText}`);
            }
            const data = await res.json();
            const items = Array.isArray(data) ? (data as Client[]) : [];
            return { items };
        },
        [pageSize],
    );

    const { items, loading, error, search, setSearch, hasMore, loadMore, reset } =
        usePaginatedSearch<Client>({ fetchPage, pageSize });

    return {
        clients: items,
        loading,
        error,
        search,
        setSearch,
        hasMore,
        loadMore,
        reset,
    };
}
