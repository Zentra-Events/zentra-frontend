"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import {
    deleteClientBill as deleteClientBillRequest,
    deleteVendorBill as deleteVendorBillRequest,
    updateClientBill as updateClientBillRequest,
    updateClientBillStatus as updateClientBillStatusRequest,
    updateVendorBill as updateVendorBillRequest,
    updateVendorBillStatus as updateVendorBillStatusRequest,
} from "@/lib/api/bill";
import { getBillStatusLabel } from "@/lib/utils/bill-status";
import type { BillStatus, ClientBill, VendorBill } from "@/types/bill";

interface UseBillMutationsOptions {
    /** Called after a bill was updated or deleted successfully. */
    onSaved?: () => void | Promise<void>;
}

interface UseBillMutationsReturn {
    /** `true` while a bill is being updated. */
    updating: boolean;
    /** `true` while a bill is being deleted. */
    deleting: boolean;
    /** `true` while the status of a bill is being updated. */
    updatingStatus: boolean;
    /** Updates a client bill; resolves to `true` when the bill was updated. */
    updateClientBill: (
        bill: ClientBill,
        body: Partial<ClientBill>,
        eventID?: string | null,
    ) => Promise<boolean>;
    /** Updates a vendor bill; resolves to `true` when the bill was updated. */
    updateVendorBill: (
        bill: VendorBill,
        body: Partial<VendorBill>,
        eventID?: string | null,
    ) => Promise<boolean>;
    /** Deletes a client bill; resolves to `true` when the bill was deleted. */
    deleteClientBill: (bill: ClientBill) => Promise<boolean>;
    /** Deletes a vendor bill; resolves to `true` when the bill was deleted. */
    deleteVendorBill: (bill: VendorBill) => Promise<boolean>;
    /** Updates the status of a client bill. */
    updateClientBillStatus: (
        bill: ClientBill,
        status: BillStatus,
        eventID?: string | null,
    ) => Promise<boolean>;
    /** Updates the status of a vendor bill. */
    updateVendorBillStatus: (
        bill: VendorBill,
        status: BillStatus,
        eventID?: string | null,
    ) => Promise<boolean>;
}

/**
 * Update and delete operations of the bills.
 *
 * The same business rules are used by the billing modal of the event detail
 * page and by the global bills page, so the requests, the error handling and
 * the user feedback live in this single place.
 */
export function useBillMutations({
    onSaved,
}: UseBillMutationsOptions = {}): UseBillMutationsReturn {
    const [updating, setUpdating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    /**
     * Updates an already generated bill.
     *
     * The bill keeps its identity, only the edited fields are sent to the
     * backend together with the event it belongs to.
     */
    const updateClientBill = useCallback(
        async (
            bill: ClientBill,
            body: Partial<ClientBill>,
            eventID?: string | null,
        ): Promise<boolean> => {
            const identifier = bill.id?.trim();
            if (!identifier) {
                toast.error("This bill cannot be updated because the backend did not return its id.");
                return false;
            }

            setUpdating(true);
            try {
                const res = await updateClientBillRequest(
                    identifier,
                    { ...body, id: identifier },
                    eventID !== undefined ? eventID : bill.eventID,
                );

                if (!res.ok) {
                    const detail = await res.text().catch(() => "");
                    throw new Error(
                        `Failed to update client bill (status ${res.status})${
                            detail ? `: ${detail}` : ""
                        }`,
                    );
                }

                toast.success("Client bill updated successfully");
                await onSaved?.();
                return true;
            } catch (err) {
                console.error("Failed to update client bill:", err);
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Failed to update the client bill. Please try again.",
                );
                return false;
            } finally {
                setUpdating(false);
            }
        },
        [onSaved],
    );

    /** Updates an already generated vendor bill. */
    const updateVendorBill = useCallback(
        async (
            bill: VendorBill,
            body: Partial<VendorBill>,
            eventID?: string | null,
        ): Promise<boolean> => {
            const identifier = bill.id?.trim();
            if (!identifier) {
                toast.error("This bill cannot be updated because the backend did not return its id.");
                return false;
            }

            setUpdating(true);
            try {
                const res = await updateVendorBillRequest(
                    identifier,
                    { ...body, id: identifier },
                    eventID !== undefined ? eventID : bill.eventID,
                );

                if (!res.ok) {
                    const detail = await res.text().catch(() => "");
                    throw new Error(
                        `Failed to update vendor bill (status ${res.status})${
                            detail ? `: ${detail}` : ""
                        }`,
                    );
                }

                toast.success("Vendor bill updated successfully");
                await onSaved?.();
                return true;
            } catch (err) {
                console.error("Failed to update vendor bill:", err);
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Failed to update the vendor bill. Please try again.",
                );
                return false;
            } finally {
                setUpdating(false);
            }
        },
        [onSaved],
    );

    /**
     * Deletes a client bill.
     *
     * Client and vendor bills live on separate backend collections, so each
     * side is deleted through its own endpoint.
     */
    const deleteClientBill = useCallback(
        async (bill: ClientBill): Promise<boolean> => {
            const identifier = bill.id?.trim();
            if (!identifier) {
                toast.error("This bill cannot be deleted because the backend did not return its id.");
                return false;
            }

            setDeleting(true);
            try {
                const res = await deleteClientBillRequest(identifier);
                if (!res.ok) {
                    const detail = await res.text().catch(() => "");
                    throw new Error(
                        `Failed to delete client bill (status ${res.status})${
                            detail ? `: ${detail}` : ""
                        }`,
                    );
                }

                toast.success("Client bill deleted");
                await onSaved?.();
                return true;
            } catch (err) {
                console.error("Failed to delete client bill:", err);
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Failed to delete the client bill. Please try again.",
                );
                return false;
            } finally {
                setDeleting(false);
            }
        },
        [onSaved],
    );

    /** Deletes a vendor bill through the vendor bill endpoint. */
    const deleteVendorBill = useCallback(
        async (bill: VendorBill): Promise<boolean> => {
            const identifier = bill.id?.trim();
            if (!identifier) {
                toast.error("This bill cannot be deleted because the backend did not return its id.");
                return false;
            }

            setDeleting(true);
            try {
                const res = await deleteVendorBillRequest(identifier);
                if (!res.ok) {
                    const detail = await res.text().catch(() => "");
                    throw new Error(
                        `Failed to delete vendor bill (status ${res.status})${
                            detail ? `: ${detail}` : ""
                        }`,
                    );
                }

                toast.success("Vendor bill deleted");
                await onSaved?.();
                return true;
            } catch (err) {
                console.error("Failed to delete vendor bill:", err);
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Failed to delete the vendor bill. Please try again.",
                );
                return false;
            } finally {
                setDeleting(false);
            }
        },
        [onSaved],
    );

    /**
     * Updates the status of a client bill.
     *
     * The status is written through the same `PUT` endpoint that updates the
     * bill, the known fields of the bill are sent along with the new status.
     */
    const updateClientBillStatus = useCallback(
        async (
            bill: ClientBill,
            status: BillStatus,
            eventID?: string | null,
        ): Promise<boolean> => {
            const identifier = bill.id?.trim();
            if (!identifier) {
                toast.error(
                    "This bill cannot be updated because the backend did not return its id.",
                );
                return false;
            }

            setUpdatingStatus(true);
            try {
                const res = await updateClientBillStatusRequest(
                    identifier,
                    status,
                    { ...bill, id: identifier },
                    eventID !== undefined ? eventID : bill.eventID,
                );

                if (!res.ok) {
                    const detail = await res.text().catch(() => "");
                    throw new Error(
                        `Failed to update client bill status (status ${res.status})${
                            detail ? `: ${detail}` : ""
                        }`,
                    );
                }

                toast.success(`Client bill marked as ${getBillStatusLabel(status)}`);
                await onSaved?.();
                return true;
            } catch (err) {
                console.error("Failed to update client bill status:", err);
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Failed to update the client bill status. Please try again.",
                );
                return false;
            } finally {
                setUpdatingStatus(false);
            }
        },
        [onSaved],
    );

    /** Updates the status of a vendor bill. */
    const updateVendorBillStatus = useCallback(
        async (
            bill: VendorBill,
            status: BillStatus,
            eventID?: string | null,
        ): Promise<boolean> => {
            const identifier = bill.id?.trim();
            if (!identifier) {
                toast.error(
                    "This bill cannot be updated because the backend did not return its id.",
                );
                return false;
            }

            setUpdatingStatus(true);
            try {
                const res = await updateVendorBillStatusRequest(
                    identifier,
                    status,
                    { ...bill, id: identifier },
                    eventID !== undefined ? eventID : bill.eventID,
                );

                if (!res.ok) {
                    const detail = await res.text().catch(() => "");
                    throw new Error(
                        `Failed to update vendor bill status (status ${res.status})${
                            detail ? `: ${detail}` : ""
                        }`,
                    );
                }

                toast.success(`Vendor bill marked as ${getBillStatusLabel(status)}`);
                await onSaved?.();
                return true;
            } catch (err) {
                console.error("Failed to update vendor bill status:", err);
                toast.error(
                    err instanceof Error
                        ? err.message
                        : "Failed to update the vendor bill status. Please try again.",
                );
                return false;
            } finally {
                setUpdatingStatus(false);
            }
        },
        [onSaved],
    );

    return {
        updating,
        deleting,
        updatingStatus,
        updateClientBill,
        updateVendorBill,
        deleteClientBill,
        deleteVendorBill,
        updateClientBillStatus,
        updateVendorBillStatus,
    };
}
