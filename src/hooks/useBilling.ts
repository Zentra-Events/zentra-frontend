"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
    buildClientBillNumber,
    createClientBill,
    createVendorBill,
    fetchClientBillsForEvent,
    fetchVendorBillsForEvent,
} from "@/lib/api/bill";
import { useBillMutations } from "@/hooks/useBillMutations";
import { fetchClient } from "@/lib/api/client";
import { fetchEventEstimates } from "@/lib/api/estimate";
import { fetchVendors } from "@/lib/api/vendor";
import type { BillStatus, ClientBill, VendorBill } from "@/types/bill";
import type { Client } from "@/types/client";
import type { EstimateDto } from "@/types/estimate";
import type { Vendor } from "@/types/vendor";

interface UseBillingOptions {
    /** The event the bills belong to. */
    eventID?: string | null;
    /** Enquiry of the event, used to resolve the estimate versions. */
    enquiryId?: string | null;
    /** Client of the event. */
    clientId?: string | null;
    /** Whether the data should be loaded. */
    enabled?: boolean;
    /** Called after a bill was generated successfully. */
    onSaved?: () => void;
}

interface UseBillingReturn {
    loading: boolean;
    error: string | null;
    /** Every estimate version of the event (billable ones are filtered by the caller). */
    estimates: EstimateDto[];
    /** Bills already raised for the event. */
    clientBills: ClientBill[];
    vendorBills: VendorBill[];
    vendors: Vendor[];
    client: Client | null;
    /** `true` while a client or vendor bill is being generated. */
    generating: boolean;
    /** `true` while a client or vendor bill is being deleted. */
    deleting: boolean;
    /** `true` while a client or vendor bill is being updated. */
    updating: boolean;
    /** `true` while the status of a bill is being updated. */
    updatingStatus: boolean;
    refetch: () => Promise<void>;
    /** Creates the client bill; resolves to `true` when the bill was created. */
    generateClientBill: (body: Partial<ClientBill>) => Promise<boolean>;
    /** Creates the vendor bill; resolves to `true` when the bill was created. */
    generateVendorBill: (body: Partial<VendorBill>) => Promise<boolean>;
    /** Updates a client bill; resolves to `true` when the bill was updated. */
    updateClientBill: (bill: ClientBill, body: Partial<ClientBill>) => Promise<boolean>;
    /** Updates a vendor bill; resolves to `true` when the bill was updated. */
    updateVendorBill: (bill: VendorBill, body: Partial<VendorBill>) => Promise<boolean>;
    /** Deletes a client bill; resolves to `true` when the bill was deleted. */
    deleteClientBill: (bill: ClientBill) => Promise<boolean>;
    /** Deletes a vendor bill; resolves to `true` when the bill was deleted. */
    deleteVendorBill: (bill: VendorBill) => Promise<boolean>;
    /** Updates the status of a client bill. */
    updateClientBillStatus: (bill: ClientBill, status: BillStatus) => Promise<boolean>;
    /** Updates the status of a vendor bill. */
    updateVendorBillStatus: (bill: VendorBill, status: BillStatus) => Promise<boolean>;
}

export function useBilling({
    eventID,
    enquiryId,
    clientId,
    enabled = true,
    onSaved,
}: UseBillingOptions = {}): UseBillingReturn {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [estimates, setEstimates] = useState<EstimateDto[]>([]);
    const [clientBills, setClientBills] = useState<ClientBill[]>([]);
    const [vendorBills, setVendorBills] = useState<VendorBill[]>([]);
    const [vendors, setVendors] = useState<Vendor[]>([]);
    const [client, setClient] = useState<Client | null>(null);
    const [generating, setGenerating] = useState(false);

    // Guards against double submissions while a request is in flight.
    const inFlight = useRef(false);

    const loadBills = useCallback(async () => {
        if (!eventID) {
            setClientBills([]);
            setVendorBills([]);
            return;
        }

        const [clientBillList, vendorBillList] = await Promise.all([
            fetchClientBillsForEvent(eventID),
            fetchVendorBillsForEvent(eventID),
        ]);

        setClientBills(clientBillList);
        setVendorBills(vendorBillList);
    }, [eventID]);

    /**
     * The update and delete operations are shared with the global bills page,
     * so the business rules live in a single place.
     */
    const {
        updating,
        deleting,
        updatingStatus,
        updateClientBill: updateClientBillRequest,
        updateVendorBill: updateVendorBillRequest,
        deleteClientBill: deleteClientBillRequest,
        deleteVendorBill: deleteVendorBillRequest,
        updateClientBillStatus: updateClientBillStatusRequest,
        updateVendorBillStatus: updateVendorBillStatusRequest,
    } = useBillMutations({
        onSaved: async () => {
            await loadBills();
            onSaved?.();
        },
    });

    const refetch = useCallback(async () => {
        if (!enabled) return;

        setLoading(true);
        setError(null);

        try {
            const [estimateList, vendorList] = await Promise.all([
                eventID ? fetchEventEstimates(eventID, enquiryId) : Promise.resolve([]),
                fetchVendors().catch(err => {
                    console.warn("Failed to load vendors:", err);
                    return [] as Vendor[];
                }),
            ]);

            setEstimates(estimateList);
            setVendors(vendorList);

            if (clientId) {
                fetchClient(clientId)
                    .then(setClient)
                    .catch(err => console.warn("Failed to load client:", err));
            } else {
                setClient(null);
            }

            await loadBills();
        } catch (err) {
            console.error("Failed to load billing data:", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load billing data. Please try again.",
            );
        } finally {
            setLoading(false);
        }
    }, [enabled, eventID, enquiryId, clientId, loadBills]);

    useEffect(() => {
        if (!enabled) {
            setEstimates([]);
            setClientBills([]);
            setVendorBills([]);
            setVendors([]);
            setClient(null);
            setError(null);
            return;
        }
        refetch();
    }, [enabled, refetch]);

    const generateClientBill = useCallback(
        async (body: Partial<ClientBill>): Promise<boolean> => {
            if (!eventID) {
                toast.error("This event is missing an identifier, the bill cannot be created.");
                return false;
            }

            if (inFlight.current) return false;

            // The backend stores client bills without an event column, so the
            // event linkage lives in the bill number. A bill that already
            // carries this event's number means a bill was already raised.
            const reference = body.billNo?.trim() || buildClientBillNumber(eventID);
            if (clientBills.some(bill => (bill.billNo ?? "") === reference)) {
                toast.error("A client bill has already been generated for this event.");
                return false;
            }

            inFlight.current = true;
            setGenerating(true);

            try {
                const res = await createClientBill(
                    {
                        ...body,
                        billNo: reference,
                        // A newly raised bill is always unpaid.
                        status: body.status ?? "UNPAID",
                    },
                    eventID,
                );

                if (!res.ok) {
                    const detail = await res.text().catch(() => "");
                    throw new Error(
                        `Failed to generate client bill (status ${res.status})${
                            detail ? `: ${detail}` : ""
                        }`,
                    );
                }

                toast.success("Client bill generated successfully");
                await loadBills();
                onSaved?.();
                return true;
            } catch (err) {
                console.error("Failed to generate client bill:", err);
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Failed to generate client bill. Please try again.",
                );
                return false;
            } finally {
                inFlight.current = false;
                setGenerating(false);
            }
        },
        [clientBills, eventID, loadBills, onSaved],
    );

    const generateVendorBill = useCallback(
        async (body: Partial<VendorBill>): Promise<boolean> => {
            if (!eventID) {
                toast.error("This event is missing an identifier, the bill cannot be created.");
                return false;
            }

            if (inFlight.current) return false;

            // The bill reference identifies the event and the vendor, so a
            // bill can only be raised once for the same vendor of an event.
            const reference = body.invoiceNumber?.trim();
            if (!reference) {
                toast.error("The vendor bill reference could not be determined.");
                return false;
            }

            if (vendorBills.some(bill => (bill.invoiceNumber ?? "") === reference)) {
                toast.error("A vendor bill has already been generated for this vendor.");
                return false;
            }

            inFlight.current = true;
            setGenerating(true);

            try {
                const res = await createVendorBill(
                    {
                        ...body,
                        invoiceNumber: reference,
                        // A newly raised bill is always unpaid.
                        status: body.status ?? "UNPAID",
                    },
                    eventID,
                );

                if (!res.ok) {
                    const detail = await res.text().catch(() => "");
                    throw new Error(
                        `Failed to generate vendor bill (status ${res.status})${
                            detail ? `: ${detail}` : ""
                        }`,
                    );
                }

                toast.success("Vendor bill generated successfully");
                await loadBills();
                onSaved?.();
                return true;
            } catch (err) {
                console.error("Failed to generate vendor bill:", err);
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Failed to generate vendor bill. Please try again.",
                );
                return false;
            } finally {
                inFlight.current = false;
                setGenerating(false);
            }
        },
        [eventID, loadBills, onSaved, vendorBills],
    );

    /**
     * Updates an already generated client bill.
     *
     * The bill keeps its identity, only the edited fields are sent to the
     * backend together with the event it belongs to.
     */
    const updateClientBill = useCallback(
        (bill: ClientBill, body: Partial<ClientBill>): Promise<boolean> =>
            updateClientBillRequest(bill, body, eventID),
        [updateClientBillRequest, eventID],
    );

    /** Updates an already generated vendor bill. */
    const updateVendorBill = useCallback(
        (bill: VendorBill, body: Partial<VendorBill>): Promise<boolean> =>
            updateVendorBillRequest(bill, body, eventID),
        [updateVendorBillRequest, eventID],
    );

    /**
     * Deletes a client bill.
     *
     * Client and vendor bills live on separate backend collections, so each
     * side is deleted through its own endpoint.
     */
    const deleteClientBill = useCallback(
        (bill: ClientBill): Promise<boolean> => deleteClientBillRequest(bill),
        [deleteClientBillRequest],
    );

    /** Deletes a vendor bill through the vendor bill endpoint. */
    const deleteVendorBill = useCallback(
        (bill: VendorBill): Promise<boolean> => deleteVendorBillRequest(bill),
        [deleteVendorBillRequest],
    );

    /** Updates the status of a client bill of the event. */
    const updateClientBillStatus = useCallback(
        (bill: ClientBill, status: BillStatus): Promise<boolean> =>
            updateClientBillStatusRequest(bill, status, eventID),
        [updateClientBillStatusRequest, eventID],
    );

    /** Updates the status of a vendor bill of the event. */
    const updateVendorBillStatus = useCallback(
        (bill: VendorBill, status: BillStatus): Promise<boolean> =>
            updateVendorBillStatusRequest(bill, status, eventID),
        [updateVendorBillStatusRequest, eventID],
    );

    return {
        loading,
        error,
        estimates,
        clientBills,
        vendorBills,
        vendors,
        client,
        generating,
        deleting,
        updating,
        updatingStatus,
        refetch,
        generateClientBill,
        generateVendorBill,
        updateClientBill,
        updateVendorBill,
        deleteClientBill,
        deleteVendorBill,
        updateClientBillStatus,
        updateVendorBillStatus,
    };
}
