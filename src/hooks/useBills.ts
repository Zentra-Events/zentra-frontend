"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchClientBills, fetchVendorBills, type BillListParams } from "@/lib/api/bill";
import type { ClientBill, PagedResponse, VendorBill } from "@/types/bill";

/**
 * Number of bills requested per backend page.
 *
 * The list endpoints are paged, so the pages are read one after the other to
 * collect the bills of every event.
 */
const BILLS_PAGE_SIZE = 100;

/**
 * Maximum number of backend pages that are read for a single tab.
 *
 * The cap keeps the page responsive when the backend answers with a very
 * large collection; the bills beyond the cap are not listed.
 */
const MAX_PAGES = 5;

export interface BillTabState<T> {
    /** The bills of the tab. */
    bills: T[];
    loading: boolean;
    error: string | null;
    /** The search term of the tab. */
    search: string;
    /** Total number of loaded bills. */
    totalElements: number;
}

export interface BillTabControl<T> extends BillTabState<T> {
    /** Sets the search term of the tab. */
    setSearch: (value: string) => void;
    /** Reloads the bills of the tab. */
    refetch: () => Promise<void>;
}

/**
 * Reads every page of a bill list endpoint.
 *
 * The endpoints answer with a Spring Data `Page`, so the pages are read one
 * after the other to collect the bills of all events.
 */
async function fetchAllBills<T>(
    fetcher: (params: BillListParams) => Promise<PagedResponse<T>>,
): Promise<T[]> {
    const first = await fetcher({ page: 0, size: BILLS_PAGE_SIZE });
    const content = first.content ?? [];
    const totalPages = Math.max(1, first.totalPages ?? 1);

    if (totalPages <= 1 || totalPages > MAX_PAGES) {
        return content;
    }

    const remaining = await Promise.all(
        Array.from({ length: totalPages - 1 }, (_, index) =>
            fetcher({ page: index + 1, size: BILLS_PAGE_SIZE }),
        ),
    );

    return [...content, ...remaining.flatMap(page => page.content ?? [])];
}

/**
 * The bills of all events, split into the client and the vendor bills.
 *
 * Both lists are loaded from the main bill list endpoints, so the page does
 * not have to walk through the events of the organisation.
 */
export function useBills() {
    const [clientBills, setClientBills] = useState<ClientBill[]>([]);
    const [clientLoading, setClientLoading] = useState(true);
    const [clientError, setClientError] = useState<string | null>(null);
    const [clientSearch, setClientSearch] = useState("");

    const [vendorBills, setVendorBills] = useState<VendorBill[]>([]);
    const [vendorLoading, setVendorLoading] = useState(true);
    const [vendorError, setVendorError] = useState<string | null>(null);
    const [vendorSearch, setVendorSearch] = useState("");

    const refetchClient = useCallback(async () => {
        setClientLoading(true);
        setClientError(null);

        try {
            setClientBills(await fetchAllBills<ClientBill>(fetchClientBills));
        } catch (err) {
            console.error("Failed to load client bills:", err);
            setClientBills([]);
            setClientError(
                err instanceof Error
                    ? err.message
                    : "Unable to load the client bills. Please try again.",
            );
        } finally {
            setClientLoading(false);
        }
    }, []);

    const refetchVendor = useCallback(async () => {
        setVendorLoading(true);
        setVendorError(null);

        try {
            setVendorBills(await fetchAllBills<VendorBill>(fetchVendorBills));
        } catch (err) {
            console.error("Failed to load vendor bills:", err);
            setVendorBills([]);
            setVendorError(
                err instanceof Error
                    ? err.message
                    : "Unable to load the vendor bills. Please try again.",
            );
        } finally {
            setVendorLoading(false);
        }
    }, []);

    useEffect(() => {
        refetchClient();
        refetchVendor();
    }, [refetchClient, refetchVendor]);

    const client: BillTabControl<ClientBill> = {
        bills: clientBills,
        loading: clientLoading,
        error: clientError,
        search: clientSearch,
        totalElements: clientBills.length,
        setSearch: setClientSearch,
        refetch: refetchClient,
    };

    const vendor: BillTabControl<VendorBill> = {
        bills: vendorBills,
        loading: vendorLoading,
        error: vendorError,
        search: vendorSearch,
        totalElements: vendorBills.length,
        setSearch: setVendorSearch,
        refetch: refetchVendor,
    };

    return { client, vendor };
}
