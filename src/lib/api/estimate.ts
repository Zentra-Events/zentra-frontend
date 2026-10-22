"use client";

import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { toList } from "@/lib/utils";
import type { EstimateDto, EstimateNetTotalResponse } from "@/types/estimate";

/**
 * Estimates of an enquiry.
 *
 * The backend answers with `{ eventName, estimates[] }`; the array is
 * normalised so callers always receive a list.
 */
export async function fetchEstimatesByEnquiry(enquiryId: string): Promise<EstimateDto[]> {
    if (!enquiryId) return [];

    const res = await apiRequest(API_ENDPOINTS.estimates.byEnquiry(enquiryId));
    if (!res.ok) {
        throw new Error(`Failed to fetch estimates (status ${res.status})`);
    }

    const payload = await res.json();
    if (Array.isArray(payload)) return payload as EstimateDto[];

    const estimates = (payload as { estimates?: unknown } | null)?.estimates;
    return toList<EstimateDto>(estimates);
}

export async function fetchEstimateById(id: string): Promise<EstimateDto> {
    const res = await apiRequest(API_ENDPOINTS.estimates.detail(id));
    if (!res.ok) throw new Error(`Failed to fetch estimate (status ${res.status})`);
    return (await res.json()) as EstimateDto;
}

/**
 * Per-estimate invoice summaries of an event, restricted by the backend to
 * the estimates with status `EVENT_CREATED` or `EVENT_MERGED`.
 */
export async function fetchEstimateNetTotals(
    eventID: string,
): Promise<EstimateNetTotalResponse[]> {
    if (!eventID) return [];

    const res = await apiRequest(API_ENDPOINTS.estimates.netTotal(eventID));
    if (!res.ok) {
        throw new Error(`Failed to fetch estimate totals (status ${res.status})`);
    }

    const payload = await res.json();
    return toList<EstimateNetTotalResponse>(payload);
}

/**
 * Every estimate version of an event, with their line items.
 *
 * The event's enquiry is used when available because it answers with the
 * complete estimate records in a single request. Without an enquiry id the
 * event's estimate summaries are used to resolve the estimate ids, and each
 * estimate is then fetched individually.
 */
export async function fetchEventEstimates(
    eventID: string,
    enquiryId?: string | null,
): Promise<EstimateDto[]> {
    if (enquiryId) {
        try {
            const estimates = await fetchEstimatesByEnquiry(enquiryId);
            if (estimates.length > 0) return estimates;
        } catch (error) {
            console.warn(
                "Failed to load estimates by enquiry, falling back to net-total:",
                error,
            );
        }
    }

    const summaries = await fetchEstimateNetTotals(eventID);
    const details = await Promise.all(
        summaries.map(summary =>
            fetchEstimateById(summary.id).catch(error => {
                console.warn(`Failed to load estimate ${summary.id}:`, error);
                return null;
            }),
        ),
    );

    return details.filter((estimate): estimate is EstimateDto => estimate !== null);
}
