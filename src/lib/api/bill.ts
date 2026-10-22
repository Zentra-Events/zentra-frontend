"use client";

import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { buildQueryUrl } from "@/lib/api/query-params";
import { toList } from "@/lib/utils";
import { toFiniteNumber } from "@/lib/utils/billing";
import type { BillStatus, ClientBill, PagedResponse, VendorBill } from "@/types/bill";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/**
 * Normalise an event scoped bill payload.
 *
 * The event scoped endpoints answer with a bare list. A `null` body means the
 * request did not reach the list endpoint of the backend (an unknown path is
 * answered with `null` by the `/{id}` route), so it is reported as an error
 * instead of being shown as an event without bills.
 */
function toBillList<T>(payload: unknown, label: string): T[] {
    if (payload === null || payload === undefined) {
        throw new Error(`The backend returned an empty response for the ${label}.`);
    }

    if (Array.isArray(payload)) return payload as T[];

    return toList<T>(payload);
}

export interface BillListParams {
    search?: string;
    page?: number;
    size?: number;
    sortBy?: string;
    direction?: "asc" | "desc";
    /** Restricts the list to the bills with this status. */
    status?: BillStatus | null;
}

/**
 * Normalise the backend list payload. The endpoints answer with a Spring
 * Data `Page` (`{ content, totalElements, totalPages, ... }`); some
 * deployments answer with a bare array, so both shapes are accepted.
 */
function toPage<T>(payload: unknown): PagedResponse<T> {
    if (Array.isArray(payload)) {
        return {
            content: payload as T[],
            totalElements: payload.length,
            totalPages: 1,
            number: 0,
            size: payload.length,
        };
    }

    if (payload && typeof payload === "object") {
        const record = payload as Record<string, unknown>;
        const content = Array.isArray(record.content)
            ? (record.content as T[])
            : toList<T>(payload);

        return {
            content,
            totalElements: toFiniteNumber(record.totalElements, content.length),
            totalPages: toFiniteNumber(record.totalPages, content.length > 0 ? 1 : 0),
            number: toFiniteNumber(record.number, 0),
            size: toFiniteNumber(record.size, content.length),
        };
    }

    return { content: [] };
}

function monthStamp(date: Date = new Date()): string {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${month}-${date.getFullYear()}`;
}

/**
 * Bill number of a client bill.
 *
 * The backend `ClientBill` entity has no event id column, so the event
 * linkage is carried by the bill number. The format follows the house style
 * used by the estimate export (`ID/CLIENT/VERSION/MM-YYYY`).
 */
export function buildClientBillNumber(eventID: string, date: Date = new Date()): string {
    return `CB/${eventID}/${monthStamp(date)}`;
}

/**
 * Bill number of a vendor bill.
 *
 * The bill reference carries the event and the vendor so that a bill can be
 * located again without a dedicated event column on the backend entity.
 */
export function buildVendorBillNumber(
    eventID: string,
    vendorKey: string,
    date: Date = new Date(),
): string {
    return `VB/${eventID}/${vendorKey}/${monthStamp(date)}`;
}

/* ------------------------------------------------------------------ */
/*  Client bills                                                       */
/* ------------------------------------------------------------------ */

export async function fetchClientBills(
    params: BillListParams = {},
): Promise<PagedResponse<ClientBill>> {
    // The sort parameters are left to the backend defaults unless the caller
    // asks for a specific order.
    const url = buildQueryUrl(API_ENDPOINTS.bills.client.list, {
        search: params.search ?? "",
        page: params.page ?? 0,
        size: params.size ?? 50,
        sortBy: params.sortBy,
        direction: params.direction,
        status: params.status ?? undefined,
    });

    const res = await apiRequest(url);
    if (!res.ok) throw new Error(`Failed to fetch client bills (status ${res.status})`);
    return toPage<ClientBill>(await res.json());
}

export async function fetchClientBill(id: string): Promise<ClientBill> {
    const res = await apiRequest(API_ENDPOINTS.bills.client.detail(id));
    if (!res.ok) throw new Error(`Failed to fetch client bill (status ${res.status})`);
    return (await res.json()) as ClientBill;
}

export async function createClientBill(
    body: Partial<ClientBill>,
    eventID?: string | null,
): Promise<Response> {
    return apiRequest(API_ENDPOINTS.bills.client.list, {
        method: "POST",
        body: JSON.stringify({ ...body, ...(eventID ? { eventID } : {}) }),
    });
}

export async function updateClientBill(
    id: string,
    body: Partial<ClientBill>,
    eventID?: string | null,
): Promise<Response> {
    return apiRequest(API_ENDPOINTS.bills.client.detail(id), {
        method: "PUT",
        body: JSON.stringify({ ...body, ...(eventID ? { eventID } : {}) }),
    });
}

export async function deleteClientBill(id: string): Promise<Response> {
    return apiRequest(API_ENDPOINTS.bills.client.detail(id), { method: "DELETE" });
}

/**
 * Updates the status of a client bill.
 *
 * There is no dedicated status endpoint, the status is written through the
 * same `PUT` endpoint that updates the bill. The known fields of the bill are
 * sent along with the new status so a full update keeps the bill intact.
 */
export async function updateClientBillStatus(
    id: string,
    status: BillStatus,
    body: Partial<ClientBill> = {},
    eventID?: string | null,
): Promise<Response> {
    return apiRequest(API_ENDPOINTS.bills.client.detail(id), {
        method: "PUT",
        body: JSON.stringify({
            ...body,
            id,
            status,
            ...(eventID ? { eventID } : {}),
        }),
    });
}

/* ------------------------------------------------------------------ */
/*  Vendor bills                                                       */
/* ------------------------------------------------------------------ */

export async function fetchVendorBills(
    params: BillListParams = {},
): Promise<PagedResponse<VendorBill>> {
    // The sort parameters are left to the backend defaults unless the caller
    // asks for a specific order.
    const url = buildQueryUrl(API_ENDPOINTS.bills.vendor.list, {
        search: params.search ?? "",
        page: params.page ?? 0,
        size: params.size ?? 50,
        sortBy: params.sortBy,
        direction: params.direction,
        status: params.status ?? undefined,
    });

    const res = await apiRequest(url);
    if (!res.ok) throw new Error(`Failed to fetch vendor bills (status ${res.status})`);
    return toPage<VendorBill>(await res.json());
}

export async function fetchVendorBill(id: string): Promise<VendorBill> {
    const res = await apiRequest(API_ENDPOINTS.bills.vendor.detail(id));
    if (!res.ok) throw new Error(`Failed to fetch vendor bill (status ${res.status})`);
    return (await res.json()) as VendorBill;
}

export async function createVendorBill(
    body: Partial<VendorBill>,
    eventID?: string | null,
): Promise<Response> {
    return apiRequest(API_ENDPOINTS.bills.vendor.list, {
        method: "POST",
        body: JSON.stringify({ ...body, ...(eventID ? { eventID } : {}) }),
    });
}

export async function updateVendorBill(
    id: string,
    body: Partial<VendorBill>,
    eventID?: string | null,
): Promise<Response> {
    return apiRequest(API_ENDPOINTS.bills.vendor.detail(id), {
        method: "PUT",
        body: JSON.stringify({ ...body, ...(eventID ? { eventID } : {}) }),
    });
}

export async function deleteVendorBill(id: string): Promise<Response> {
    return apiRequest(API_ENDPOINTS.bills.vendor.detail(id), { method: "DELETE" });
}

/**
 * Updates the status of a vendor bill.
 *
 * There is no dedicated status endpoint, the status is written through the
 * same `PUT` endpoint that updates the bill. The known fields of the bill are
 * sent along with the new status so a full update keeps the bill intact.
 */
export async function updateVendorBillStatus(
    id: string,
    status: BillStatus,
    body: Partial<VendorBill> = {},
    eventID?: string | null,
): Promise<Response> {
    return apiRequest(API_ENDPOINTS.bills.vendor.detail(id), {
        method: "PUT",
        body: JSON.stringify({
            ...body,
            id,
            status,
            ...(eventID ? { eventID } : {}),
        }),
    });
}

/* ------------------------------------------------------------------ */
/*  Event scoped lookups                                               */
/* ------------------------------------------------------------------ */

/**
 * Fetch the client bills raised for an event.
 *
 * The backend filters the bills by the `eventID` query parameter, so the
 * whole list of the event is returned without scanning the pages of the
 * generic list endpoint.
 */
export async function fetchClientBillsForEvent(eventID: string): Promise<ClientBill[]> {
    if (!eventID) return [];

    const res = await apiRequest(API_ENDPOINTS.bills.client.event(eventID));
    if (!res.ok) throw new Error(`Failed to fetch client bills (status ${res.status})`);

    return toBillList<ClientBill>(await res.json(), "client bills of the event");
}

/**
 * Fetch the vendor bills raised for an event.
 *
 * The backend filters the bills by the `eventID` query parameter, so the
 * whole list of the event is returned without scanning the pages of the
 * generic list endpoint.
 */
export async function fetchVendorBillsForEvent(eventID: string): Promise<VendorBill[]> {
    if (!eventID) return [];

    const res = await apiRequest(API_ENDPOINTS.bills.vendor.event(eventID));
    if (!res.ok) throw new Error(`Failed to fetch vendor bills (status ${res.status})`);

    return toBillList<VendorBill>(await res.json(), "vendor bills of the event");
}
