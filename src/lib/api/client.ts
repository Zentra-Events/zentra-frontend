"use client";

import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import type { Client } from "@/types/client";

/**
 * Load a single client. Returns `null` when the client cannot be loaded, so
 * that a missing client never blocks the surrounding screen.
 */
export async function fetchClient(id: string): Promise<Client | null> {
    if (!id) return null;

    const res = await apiRequest(API_ENDPOINTS.clients.get(id));
    if (!res.ok) {
        throw new Error(`Failed to fetch client (status ${res.status})`);
    }
    return (await res.json()) as Client;
}
