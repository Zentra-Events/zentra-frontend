"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Receipt, RefreshCw, Truck } from "lucide-react";

import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { Tabs } from "@/components/ui/tabs";
import { ClientBillsPanel } from "./client-bills-panel";
import { VendorBillsPanel } from "./vendor-bills-panel";
import { BillingExpenseModal } from "@/components/billing-expense-modal";
import { useBilling } from "@/hooks/useBilling";
import { useAuth } from "@/context/auth";
import { hasPermission } from "@/lib/utils/permissions";
import type { EventResponse } from "@/types/event";

type BillingTab = "client" | "vendor";

interface ManageBillingModalProps {
    open: boolean;
    onClose: () => void;
    /** The event the bills belong to. */
    event: EventResponse | null;
    /** Called after a bill was generated so the event can be refreshed. */
    onSaved?: () => void;
}

/**
 * Manage billing for an event.
 *
 * The modal hosts the two billing sides of the event:
 *  - Client Bills: the bill raised against the client, based on the
 *    approved estimate versions of the event.
 *  - Vendor Bills: the bills raised against the vendors of the event's
 *    purchase orders.
 */
export function ManageBillingModal({
    open,
    onClose,
    event,
    onSaved,
}: ManageBillingModalProps) {
    const { user } = useAuth();
    const [tab, setTab] = useState<BillingTab>("client");
    const [billingDetailsOpen, setBillingDetailsOpen] = useState(false);

    const canViewBills = hasPermission(user, undefined, ["r:bills"]);
    const canManageBills = hasPermission(user, undefined, ["w:bills"]);

    const eventID = event?.eventID ?? event?.id ?? "";

    const {
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
    } = useBilling({
        eventID,
        enquiryId: event?.enquiryId ?? null,
        clientId: event?.clientID ?? null,
        enabled: open && Boolean(eventID),
        onSaved,
    });

    // Reset the active tab every time the modal is opened so it never shows
    // the previous session's selection.
    useEffect(() => {
        if (open) {
            setTab("client");
            setBillingDetailsOpen(false);
        }
    }, [open]);

    if (!event) {
        return (
            <Modal open={open} onClose={onClose} size="xxl" showCloseIcon>
                <ModalBody className="flex h-56 items-center justify-center">
                    <Loading />
                </ModalBody>
            </Modal>
        );
    }

    return (
        <>
            <Modal
                open={open}
                onClose={onClose}
                size="xxl"
                title="Manage Billing"
                description={`${event.title ?? "Event"} · ${
                    event.eventID ?? event.id ?? ""
                }`}
                showCloseIcon
                closeOnEscape
                icon={
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-light text-primary">
                        <Receipt size={20} aria-hidden="true" />
                    </span>
                }
            >
                <ModalBody className="space-y-5">
                    <Tabs
                        value={tab}
                        onChange={key => setTab(key as BillingTab)}
                        items={[
                            {
                                key: "client",
                                label: "Client Bills",
                                icon: <Receipt size={14} />,
                                count: clientBills.length,
                            },
                            {
                                key: "vendor",
                                label: "Vendor Bills",
                                icon: <Truck size={14} />,
                                count: vendorBills.length,
                            },
                        ]}
                    />

                    {!canViewBills ? (
                        <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4 text-xs text-muted-foreground">
                            <AlertCircle size={15} className="mt-0.5 shrink-0" />
                            <p>You do not have permission to view the bills of this event.</p>
                        </div>
                    ) : error ? (
                        <div className="flex flex-col items-start gap-3 rounded-lg border border-error/30 bg-error-light/40 p-4">
                            <div className="flex items-start gap-3 text-xs text-foreground">
                                <AlertCircle
                                    size={15}
                                    className="mt-0.5 shrink-0 text-error"
                                />
                                <p>{error}</p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                icon={<RefreshCw size={14} />}
                                onClick={refetch}
                            >
                                Retry
                            </Button>
                        </div>
                    ) : tab === "client" ? (
                        <ClientBillsPanel
                            event={event}
                            client={client}
                            estimates={estimates}
                            clientBills={clientBills}
                            loading={loading}
                            generating={generating}
                            deleting={deleting}
                            updating={updating}
                            updatingStatus={updatingStatus}
                            onGenerate={generateClientBill}
                            onEdit={updateClientBill}
                            onDelete={deleteClientBill}
                            onStatusChange={updateClientBillStatus}
                            onEditBillingDetails={() => setBillingDetailsOpen(true)}
                            canGenerate={canManageBills}
                        />
                    ) : (
                        <VendorBillsPanel
                            event={event}
                            vendors={vendors}
                            vendorBills={vendorBills}
                            loading={loading}
                            generating={generating}
                            deleting={deleting}
                            updating={updating}
                            updatingStatus={updatingStatus}
                            onGenerate={generateVendorBill}
                            onEdit={updateVendorBill}
                            onDelete={deleteVendorBill}
                            onStatusChange={updateVendorBillStatus}
                            canGenerate={canManageBills}
                        />
                    )}
                </ModalBody>

                <ModalFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[11px] text-muted-foreground">
                        {canManageBills
                            ? "Bills are raised from the current event data. Review the preview before generating."
                            : "You have read-only access to the bills of this event."}
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            icon={<RefreshCw size={14} />}
                            onClick={refetch}
                            disabled={loading}
                        >
                            Refresh
                        </Button>
                        <Button size="sm" onClick={onClose}>
                            Close
                        </Button>
                    </div>
                </ModalFooter>
            </Modal>

            <BillingExpenseModal
                isOpen={billingDetailsOpen}
                onClose={() => setBillingDetailsOpen(false)}
                eventData={event}
                onSave={() => {
                    setBillingDetailsOpen(false);
                    onSaved?.();
                    refetch();
                }}
            />
        </>
    );
}
