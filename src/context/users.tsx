"use client";

import React, { useContext, useCallback, useState, useEffect, ReactNode } from "react";

import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import type { User } from "@/types/user";
import type { APIResponse } from "@/types";

export interface UserContextType {
    /** Centralized, synchronized list of all users. */
    users: User[];
    /** Whether a user list fetch is in flight. */
    loading: boolean;
    /** Fetch error, if any. */
    error: string | null;
    /** Force a refetch of the full user list from the API and update the store. */
    refresh: () => Promise<void>;
    /** Add a user to the store (used after a successful create). */
    addUser: (user: User) => void;
    /** Replace a user in the store by id (used after a successful update). */
    updateUser: (user: User) => void;
    /** Remove a user from the store by id (used after a successful delete). */
    deleteUser: (id: string) => void;
    /** Replace the entire store contents. */
    setUsers: (users: User[]) => void;
}

const UserContext = React.createContext<UserContextType | undefined>(undefined);

// Module-level cache shared across provider instances so concurrent mounts
// (e.g. reopening a modal while several dropdowns are mounted) do not trigger
// redundant API fetches.
let usersCache: User[] | null = null;
let usersInflight: Promise<User[]> | null = null;

// Test-only escape hatch to reset the module-level cache between tests.
export function __resetUsersCacheForTests(): void {
    usersCache = null;
    usersInflight = null;
}

function extractUsers(payload: unknown): User[] {
    if (Array.isArray(payload)) return payload as User[];
    if (payload && typeof payload === "object") {
        const content = (payload as APIResponse<User[]>).content;
        if (Array.isArray(content)) return content;
    }
    return [];
}

async function fetchUsersList(): Promise<User[]> {
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

/**
 * Centralized user store provider.
 *
 * Holds the single source of truth for the application's user list and exposes
 * mutation helpers (`addUser`, `updateUser`, `deleteUser`) so every successful
 * user create/update/delete is reflected everywhere the list is consumed
 * (e.g. `UserSelectDropdown`, the Users table, detail panels) without a page
 * reload.
 */
export function UserProvider({ children }: { children: ReactNode }) {
    const [users, setUsersState] = useState<User[]>(usersCache ?? []);
    const [loading, setLoading] = useState(!usersCache);
    const [error, setError] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        // Serve from cache when already populated and nothing is in flight.
        if (usersCache && !usersInflight) {
            setUsersState(usersCache);
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const list = await fetchUsersList();
            setUsersState(list);
        } catch (err) {
            console.error("Error fetching users:", err);
            setError(err instanceof Error ? err.message : "Failed to fetch users");
            setUsersState([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Keep local state in sync with the shared cache when another provider
    // instance updates it (e.g. after a mutation elsewhere in the tree).
    useEffect(() => {
        if (usersCache) {
            setUsersState(usersCache);
            setLoading(false);
        }
    }, [usersCache]);

    // Fetch the user list once when the provider mounts.
    useEffect(() => {
        void fetchUsers();
    }, [fetchUsers]);

    const refresh = useCallback(async () => {
        usersCache = null;
        usersInflight = null;
        await fetchUsers();
    }, [fetchUsers]);

    const addUser = useCallback((user: User) => {
        setUsersState(prev => {
            if (prev.some(u => u.id === user.id)) return prev;
            const next = [...prev, user];
            usersCache = next;
            return next;
        });
    }, []);

    const updateUser = useCallback((user: User) => {
        setUsersState(prev => {
            const next = prev.map(u => (u.id === user.id ? user : u));
            usersCache = next;
            return next;
        });
    }, []);

    const deleteUser = useCallback((id: string) => {
        setUsersState(prev => {
            const next = prev.filter(u => u.id !== id);
            usersCache = next;
            return next;
        });
    }, []);

    const setUsers = useCallback((next: User[]) => {
        setUsersState(next);
        usersCache = next;
    }, []);

    const value: UserContextType = {
        users,
        loading,
        error,
        refresh,
        addUser,
        updateUser,
        deleteUser,
        setUsers,
    };

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/**
 * Consumes the centralized user store. Must be used within a `UserProvider`.
 */
export function useUsers(): UserContextType {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error("useUsers must be used within a UserProvider");
    }
    return context;
}
