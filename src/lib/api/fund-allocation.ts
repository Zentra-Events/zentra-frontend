"use client";

import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { toList } from "@/lib/utils";
import type { FundAllocation } from "@/types/fund-allocation";

/* ------------------------------------------------------------------ */
/*  Fund Allocation API service                                       */
/* ------------------------------------------------------------------ */

/**
 * Normalize a list payload into an array of fund allocations.
 *
 * The backend returns the collection directly as an array per the swagger
 * contract, but we keep the tolerance for envelopes used elsewhere in the app.
 */
function toFundAllocationList(payload: unknown): FundAllocation[] {
    return toList<FundAllocation>(payload);
}

/** Fetch fund allocations for a specific event. */
export async function fetchFundAllocations(eventID: string): Promise<FundAllocation[]> {
    if (!eventID) return [];
    const res = await apiRequest(API_ENDPOINTS.fundAllocations.list(eventID));
    if (!res.ok) {
        throw new Error(`Failed to fetch fund allocations (status ${res.status})`);
    }
    const data = (await res.json()) as unknown;
    return toFundAllocationList(data);
}

/** Fetch a single fund allocation by ID. */
export async function fetchFundAllocationById(id: string): Promise<FundAllocation | null> {
    const res = await apiRequest(API_ENDPOINTS.fundAllocations.byId(id));
    if (!res.ok) {
        throw new Error(`Failed to fetch fund allocation (status ${res.status})`);
    }
    return (await res.json()) as FundAllocation;
}

/** Create a new fund allocation. */
export async function createFundAllocation(body: unknown): Promise<Response> {
    return apiRequest(API_ENDPOINTS.fundAllocations.create, {
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
    });
}

/** Update an existing fund allocation. */
export async function updateFundAllocation(
    id: string | number,
    body: unknown
): Promise<Response> {
    return apiRequest(API_ENDPOINTS.fundAllocations.update(id), {
        method: "PUT",
        body: typeof body === "string" ? body : JSON.stringify(body),
    });
}

/** Delete a fund allocation by ID. */
export async function deleteFundAllocation(id: string | number): Promise<Response> {
    return apiRequest(API_ENDPOINTS.fundAllocations.delete(id), {
        method: "DELETE",
    });
}
