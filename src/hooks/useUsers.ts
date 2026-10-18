"use client";

import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import type { User } from "@/types/user";
import type { APIResponse } from "@/types";

// Module-level cache so every mount of the hook (e.g. reopening the enquiry
// modal or rendering several user dropdowns at once) reuses a single fetch
// instead of hitting the API again.
let usersCache: User[] | null = null;
let usersInflight: Promise<User[]> | null = null;

function extractUsers(payload: unknown): User[] {
    if (Array.isArray(payload)) return payload as User[];
    if (payload && typeof payload === "object") {
        const content = (payload as APIResponse<User[]>).content;
        if (Array.isArray(content)) return content;
    }
    return [];
}

async function fetchUsersOnce(): Promise<User[]> {
    if (usersCache) return usersCache;
    if (usersInflight) return usersInflight;
    usersInflight = (async () => {
        const response = await apiRequest(API_ENDPOINTS.users, { method: "GET" });
        if (!response.ok) {
            throw new Error(`Failed to fetch users: ${response.statusText}`);
        }
        const data = await response.json();
        usersCache = extractUsers(data);
        return usersCache;
    })();
    try {
        return await usersInflight;
    } finally {
        usersInflight = null;
    }
}

export function useUsers() {
    const [users, setUsers] = useState<User[]>(usersCache ?? []);
    const [loading, setLoading] = useState(!usersCache);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (force = false) => {
        if (force) usersCache = null;
        if (usersCache && !force) {
            setUsers(usersCache);
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            setUsers(await fetchUsersOnce());
        } catch (err) {
            console.error("Error fetching users:", err);
            setError(err instanceof Error ? err.message : "Failed to fetch users");
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const refresh = useCallback(() => load(true), [load]);

    return { users, loading, error, refresh };
}
