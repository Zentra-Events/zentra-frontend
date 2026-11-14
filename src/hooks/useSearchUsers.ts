"use client";

import { useCallback } from "react";

import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { buildQueryUrl } from "@/lib/api/query-params";
import { usePaginatedSearch } from "@/hooks/usePaginatedSearch";
import type { User } from "@/types/user";

interface PagedUserResponse {
    content: User[];
    totalElements?: number;
}

export interface UseSearchUsersReturn {
    users: User[];
    loading: boolean;
    error: string | null;
    search: string;
    setSearch: (value: string) => void;
    hasMore: boolean;
    loadMore: () => void;
    reset: () => void;
}

/**
 * Backend-driven search for users.
 *
 * Queries `GET /api/users?page=&size=&search=` (zero-based page) and maps the
 * Spring Data `content` array plus `totalElements` into paginated dropdown
 * state. Falls back gracefully if the backend ever returns a bare array.
 */
export function useSearchUsers(pageSize = 10, enabled = true): UseSearchUsersReturn {
    const fetchPage = useCallback(
        async (search: string, page: number): Promise<{ items: User[]; total?: number }> => {
            const url = buildQueryUrl(API_ENDPOINTS.users, {
                page,
                size: pageSize,
                search,
            });
            const res = await apiRequest(url);
            if (!res.ok) {
                throw new Error(`Failed to search users: ${res.statusText}`);
            }
            const data = (await res.json()) as PagedUserResponse;
            return {
                items: Array.isArray(data) ? data : data.content ?? [],
                total: data.totalElements,
            };
        },
        [pageSize],
    );

    const { items, loading, error, search, setSearch, hasMore, loadMore, reset } =
        usePaginatedSearch<User>({ fetchPage, pageSize, enabled });

    return {
        users: items,
        loading,
        error,
        search,
        setSearch,
        hasMore,
        loadMore,
        reset,
    };
}
