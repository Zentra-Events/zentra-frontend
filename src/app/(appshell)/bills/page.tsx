"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Receipt, RefreshCw, Search, Truck } from "lucide-react";

import { DEFAULT_PAGE_SIZE } from "@/constants";
import { useBillMutations } from "@/hooks/useBillMutations";
import { useBills } from "@/hooks/useBills";
import { usePagination } from "@/hooks/usePagination";
import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { useAuth } from "@/context/auth";
import { hasPermission } from "@/lib/utils/permissions";
import { downloadCSV } from "@/lib/utils/file";
import { pickFirst, toList } from "@/lib/utils";
import { formatShortDate, toDatePart, toLocalDateTime } from "@/lib/utils/date";
import {
    normalizeVendorKey,
    summarizeClientBill,
    summarizeVendorBill,
    type VendorSummaryLike,
} from "@/lib/utils/billing";
import {
    BILL_STATUSES,
    BILL_STATUS_LABELS,
    getBillStatusLabel,
    resolveBillStatus,
} from "@/lib/utils/bill-status";

import { Button, Input, PageHeader, Pagination, Select } from "@/components/ui";
import { Loading } from "@/components/ui/loading";
import { Tabs } from "@/components/ui/tabs";
import {
    ClientBillConfirmModal,
    VendorBillConfirmModal,
    type ClientBillFormValues,
    type VendorBillFormValues,
} from "@/components/billing/bill-confirm-modal";
import { DeleteBillConfirmationModal } from "@/components/billing/delete-bill-confirmation-modal";
import type { BillTotalRow } from "@/components/billing/bill-totals-card";
import {
    ClientBillsTable,
    VendorBillsTable,
    type ClientBillRow,
    type VendorBillRow,
} from "@/components/billing/bills-table";

import type { BillStatus, ClientBill, VendorBill } from "@/types/bill";

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

/** Options of the status filter. */
const STATUS_OPTIONS = [
    { label: "All Statuses", value: "" },
    ...BILL_STATUSES.map(status => ({
        label: BILL_STATUS_LABELS[status],
        value: status,
    })),
];

type BillTab = "client" | "vendor";

/* ------------------------------------------------------------------ */
/*  Event helpers                                                      */
/* ------------------------------------------------------------------ */

/** The event of the organisation, reduced to the fields the bills need. */
interface EventRecord {
    /** Every id the event is known by (`eventID` and the database id). */
    ids: string[];
    title: string;
    /** Name of the client of the event. */
    clientName: string;
    /** Per vendor financial rollup of the purchase order of the event. */
    vendorSummary: VendorSummaryLike[];
}

/** The client of an event is either a name or the client object. */
function resolveClientName(event: Record<string, unknown>): string {
    const client = event.client;
    if (typeof client === "string") return client;

    if (client && typeof client === "object") {
        const name = (client as { name?: unknown }).name;
        if (typeof name === "string") return name;
    }

    return typeof event.clientName === "string" ? event.clientName : "";
}

/**
 * Event of a client bill.
 *
 * The backend entity of a client bill has no event column, so the event is
 * carried by the bill number (`CB/<eventID>/<MM-YYYY>`).
 */
function resolveClientBillEventID(bill: ClientBill): string {
    if (bill.eventID) return String(bill.eventID);

    const parts = (bill.billNo ?? "").split("/");
    return parts[0] === "CB" && parts[1] ? parts[1] : "";
}

/**
 * Event of a vendor bill.
 *
 * The bill reference carries the event and the vendor
 * (`VB/<eventID>/<vendorKey>/<MM-YYYY>`).
 */
function resolveVendorBillEventID(bill: VendorBill): string {
    if (bill.eventID) return String(bill.eventID);

    const parts = (bill.invoiceNumber ?? "").split("/");
    return parts[0] === "VB" && parts[1] ? parts[1] : "";
}

/** Vendor key of a vendor bill, taken from its reference. */
function resolveVendorBillKey(bill: VendorBill): string {
    const parts = (bill.invoiceNumber ?? "").split("/");
    return parts[0] === "VB" && parts[2] ? parts[2] : "";
}

/** Every value of a record that can be searched. */
function searchableText(values: (string | number | null | undefined)[]): string {
    return values
        .filter(value => value !== null && value !== undefined && value !== "")
        .join(" ")
        .toLowerCase();
}

export default function BillsPage() {
    /* ------------------------------------------------------------------ */
    /*  Data                                                               */
    /* ------------------------------------------------------------------ */

    const { client, vendor } = useBills();

    // The status of a bill may only be changed by a user who may manage bills.
    const { user } = useAuth();
    const canManageBills = hasPermission(user, undefined, ["w:bills"]);

    const { setSearch: setClientSearch, refetch: refetchClient } = client;
    const { setSearch: setVendorSearch, refetch: refetchVendor } = vendor;

    // The events are read to resolve the readable event names, the client of a
    // client bill and the per vendor amounts of a vendor bill.
    const [events, setEvents] = useState<EventRecord[]>([]);
    const [eventsLoading, setEventsLoading] = useState(false);

    const fetchEvents = useCallback(async () => {
        setEventsLoading(true);
        try {
            const res = await apiRequest(API_ENDPOINTS.events.list, { method: "GET" });
            if (!res.ok) {
                throw new Error(`Failed to load events (status ${res.status})`);
            }

            const data = (await res.json()) as unknown;
            // The events endpoint may return the array directly or wrapped in
            // an envelope, so normalize before using it.
            const list = toList<Record<string, unknown>>(data, ["events"]);

            setEvents(
                list.map(event => {
                    const eventID = pickFirst<string>(event, ["eventID"]);
                    const id = pickFirst<string>(event, ["id"]);
                    const title =
                        pickFirst<string>(event, ["title", "eventName", "name"]) ?? "";

                    return {
                        ids: [eventID, id].filter(Boolean).map(String),
                        title,
                        clientName: resolveClientName(event),
                        vendorSummary:
                            (event.vendorSummary as VendorSummaryLike[] | undefined) ?? [],
                    };
                }),
            );
        } catch (err) {
            console.error("Failed to load events:", err);
        } finally {
            setEventsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    /** The events indexed by every id they are known by. */
    const eventMap = useMemo(() => {
        const map = new Map<string, EventRecord>();
        for (const event of events) {
            for (const id of event.ids) {
                map.set(id, event);
            }
        }
        return map;
    }, [events]);

    const eventOptions = useMemo(
        () => [
            { label: "All Events", value: "" },
            ...events.map(event => ({
                label: event.title || event.ids[0] || "",
                value: event.ids[0] || "",
            })),
        ],
        [events],
    );

    /* ------------------------------------------------------------------ */
    /*  Rows                                                               */
    /* ------------------------------------------------------------------ */

    const clientRows = useMemo<ClientBillRow[]>(
        () =>
            client.bills.map(bill => {
                const event = eventMap.get(resolveClientBillEventID(bill));

                return {
                    bill,
                    eventTitle: event?.title || bill.event || "",
                    clientName: event?.clientName || "",
                    summary: summarizeClientBill(bill),
                };
            }),
        [client.bills, eventMap],
    );

    const vendorRows = useMemo<VendorBillRow[]>(
        () =>
            vendor.bills.map(bill => {
                const event = eventMap.get(resolveVendorBillEventID(bill));
                const vendorKey = resolveVendorBillKey(bill);

                // The amounts of a vendor bill live in the per vendor rollup
                // of the event, so the rollup of the vendor of the bill is
                // used when it is available.
                const vendorName = bill.name?.trim() ?? "";
                const vendorSummary = event
                    ? (vendorKey
                          ? event.vendorSummary.find(
                                summary =>
                                    normalizeVendorKey(summary.vendor) ===
                                    normalizeVendorKey(vendorKey),
                            )
                          : undefined) ??
                      (vendorName
                          ? event.vendorSummary.find(
                                summary =>
                                    normalizeVendorKey(summary.vendor) ===
                                    normalizeVendorKey(vendorName),
                            )
                          : undefined)
                    : undefined;

                return {
                    bill,
                    eventTitle: event?.title || "",
                    summary: summarizeVendorBill(bill.items, vendorSummary),
                };
            }),
        [vendor.bills, eventMap],
    );

    /* ------------------------------------------------------------------ */
    /*  Filtering & pagination                                             */
    /* ------------------------------------------------------------------ */

    const [clientEventID, setClientEventID] = useState("");
    const [vendorEventID, setVendorEventID] = useState("");
    const [clientStatus, setClientStatus] = useState<BillStatus | "">("");
    const [vendorStatus, setVendorStatus] = useState<BillStatus | "">("");

    /** The status of a client bill, falling back to the derived one. */
    const resolveClientRowStatus = useCallback(
        (row: ClientBillRow) =>
            resolveBillStatus(
                row.bill.status,
                row.summary.outstandingAmount,
                row.summary.receivedAmount,
            ),
        [],
    );

    /** The status of a vendor bill, falling back to the derived one. */
    const resolveVendorRowStatus = useCallback(
        (row: VendorBillRow) =>
            resolveBillStatus(
                row.bill.status,
                row.summary.outstandingAmount,
                row.summary.paidAmount,
            ),
        [],
    );

    const filteredClientRows = useMemo(() => {
        const query = client.search.trim().toLowerCase();

        return clientRows.filter(row => {
            const matchesSearch =
                !query ||
                searchableText([
                    row.bill.billNo,
                    row.bill.event,
                    row.bill.estimateNo,
                    row.bill.enquiryCordinate,
                    row.bill.clientPONumber,
                    row.bill.phonecompany,
                    row.bill.eventID,
                    row.bill.id,
                    row.eventTitle,
                    row.clientName,
                ]).includes(query);

            const event = eventMap.get(resolveClientBillEventID(row.bill));
            const matchesEvent =
                !clientEventID || (event?.ids ?? []).includes(clientEventID);

            const matchesStatus = !clientStatus || resolveClientRowStatus(row) === clientStatus;

            return matchesSearch && matchesEvent && matchesStatus;
        });
    }, [clientRows, client.search, clientEventID, clientStatus, eventMap, resolveClientRowStatus]);

    const filteredVendorRows = useMemo(() => {
        const query = vendor.search.trim().toLowerCase();

        return vendorRows.filter(row => {
            const matchesSearch =
                !query ||
                searchableText([
                    row.bill.invoiceNumber,
                    row.bill.name,
                    row.bill.email,
                    row.bill.phone,
                    row.bill.address,
                    row.bill.poc,
                    row.bill.gst,
                    row.bill.pan,
                    row.bill.gstCertificate,
                    row.bill.accountHolderName,
                    row.bill.placeOfSupply,
                    row.bill.eventID,
                    row.bill.id,
                    row.eventTitle,
                    ...(row.bill.items ?? []).map(item => item.item),
                ]).includes(query);

            const event = eventMap.get(resolveVendorBillEventID(row.bill));
            const matchesEvent =
                !vendorEventID || (event?.ids ?? []).includes(vendorEventID);

            const matchesStatus = !vendorStatus || resolveVendorRowStatus(row) === vendorStatus;

            return matchesSearch && matchesEvent && matchesStatus;
        });
    }, [vendorRows, vendor.search, vendorEventID, vendorStatus, eventMap, resolveVendorRowStatus]);

    const clientTotalPages = Math.max(1, Math.ceil(filteredClientRows.length / PAGE_SIZE));
    const {
        currentPage: clientPage,
        handlePageChange: handleClientPageChange,
        pagination: clientPagination,
        setCurrentPage: setClientPage,
    } = usePagination({
        totalPages: clientTotalPages,
        pageSize: PAGE_SIZE,
        totalElements: filteredClientRows.length,
        itemName: "client bill",
    });

    const vendorTotalPages = Math.max(1, Math.ceil(filteredVendorRows.length / PAGE_SIZE));
    const {
        currentPage: vendorPage,
        handlePageChange: handleVendorPageChange,
        pagination: vendorPagination,
        setCurrentPage: setVendorPage,
    } = usePagination({
        totalPages: vendorTotalPages,
        pageSize: PAGE_SIZE,
        totalElements: filteredVendorRows.length,
        itemName: "vendor bill",
    });

    // Keep the current page valid when filtering shrinks the list.
    useEffect(() => {
        if (clientPage > clientTotalPages) setClientPage(clientTotalPages);
    }, [clientPage, clientTotalPages, setClientPage]);

    useEffect(() => {
        if (vendorPage > vendorTotalPages) setVendorPage(vendorTotalPages);
    }, [vendorPage, vendorTotalPages, setVendorPage]);

    const pagedClientRows = useMemo(() => {
        const start = (clientPage - 1) * PAGE_SIZE;
        return filteredClientRows.slice(start, start + PAGE_SIZE);
    }, [filteredClientRows, clientPage]);

    const pagedVendorRows = useMemo(() => {
        const start = (vendorPage - 1) * PAGE_SIZE;
        return filteredVendorRows.slice(start, start + PAGE_SIZE);
    }, [filteredVendorRows, vendorPage]);

    /* ------------------------------------------------------------------ */
    /*  Modals                                                             */
    /* ------------------------------------------------------------------ */

    const [tab, setTab] = useState<BillTab>("client");
    const [editingClientBill, setEditingClientBill] = useState<ClientBill | null>(null);
    const [editingVendorBill, setEditingVendorBill] = useState<VendorBill | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{
        type: BillTab;
        bill: ClientBill | VendorBill;
    } | null>(null);

    const {
        updating,
        deleting,
        updateClientBill,
        updateVendorBill,
        deleteClientBill,
        deleteVendorBill,
        updateClientBillStatus,
        updateVendorBillStatus,
    } = useBillMutations({
        onSaved: async () => {
            // Only the tab that is shown has to be refreshed, the other one is
            // not affected by the operation.
            if (tab === "client") await refetchClient();
            else await refetchVendor();
        },
    });

    const clientFormValues = useMemo<ClientBillFormValues>(() => {
        const bill = editingClientBill;
        if (!bill) {
            return {
                billNo: "",
                billDate: "",
                event: "",
                eventDate: "",
                clientPONumber: "",
                phonecompany: "",
                estimateNo: "",
                enquiryCordinate: "",
            };
        }

        const event = eventMap.get(resolveClientBillEventID(bill));

        return {
            billNo: bill.billNo ?? "",
            billDate: toDatePart(bill.billDate) || new Date().toISOString().slice(0, 10),
            event: bill.event ?? event?.title ?? "",
            eventDate: toDatePart(bill.eventDate),
            clientPONumber: bill.clientPONumber ?? "",
            phonecompany: bill.phonecompany ?? "",
            estimateNo: bill.estimateNo ?? "",
            enquiryCordinate: bill.enquiryCordinate ?? "",
        };
    }, [editingClientBill, eventMap]);

    const clientTotalsRows = useMemo<BillTotalRow[]>(() => {
        if (!editingClientBill) return [];

        const summary = summarizeClientBill(editingClientBill);

        return [
            { label: "Taxable amount", value: summary.taxableAmount },
            { label: "GST", value: summary.gstAmount },
            {
                label: "Total bill amount",
                value: summary.grossAmount,
                emphasis: "total",
            },
            {
                label: "TDS deducted",
                value: summary.tdsAmount,
                deduction: summary.tdsAmount > 0,
            },
            { label: "Net bill amount", value: summary.totalAmount },
            { label: "Amount received", value: summary.receivedAmount },
            {
                label: "Outstanding balance",
                value: summary.outstandingAmount,
                emphasis: "total",
            },
        ];
    }, [editingClientBill]);

    const vendorFormValues = useMemo<VendorBillFormValues>(() => {
        const bill = editingVendorBill;
        if (!bill) {
            return {
                invoiceNumber: "",
                billCreateDate: "",
                eventDate: "",
                name: "",
                phone: "",
                address: "",
                gst: "",
                gstCertificate: "",
                accountHolderName: "",
            };
        }

        return {
            invoiceNumber: bill.invoiceNumber ?? "",
            billCreateDate:
                toDatePart(bill.billCreateDate) || new Date().toISOString().slice(0, 10),
            eventDate: toDatePart(bill.eventDate),
            name: bill.name ?? "",
            phone: bill.phone ?? "",
            address: bill.address ?? "",
            gst: bill.gst ?? "",
            gstCertificate: bill.gstCertificate ?? "",
            accountHolderName: bill.accountHolderName ?? bill.name ?? "",
        };
    }, [editingVendorBill]);

    /**
     * Saves the edited client bill.
     *
     * The amounts of a generated bill are not editable here, they belong to
     * the event data, so the stored ones are kept and only the bill details
     * are updated.
     */
    const handleClientBillConfirm = useCallback(
        async (values: ClientBillFormValues) => {
            const bill = editingClientBill;
            if (!bill) return false;

            const body: Partial<ClientBill> = {
                estimateNo: values.estimateNo,
                enquiryCordinate: values.enquiryCordinate,
                phonecompany: values.phonecompany,
                event: values.event,
                eventDate: toLocalDateTime(values.eventDate),
                clientPONumber: values.clientPONumber,
                billNo: values.billNo,
                billDate: toLocalDateTime(values.billDate) ?? bill.billDate ?? null,
                billAmt: bill.billAmt,
                gst: bill.gst,
                totalAmt: bill.totalAmt,
                clientTDSDeduction: bill.clientTDSDeduction,
                advanceAmtReceived: bill.advanceAmtReceived,
                poAmt: bill.poAmt,
                tdsPayable: bill.tdsPayable,
                reverseCredit: bill.reverseCredit,
                profit: bill.profit,
                netHand: bill.netHand,
                // The status is managed on its own, it is kept as it is.
                status: bill.status ?? undefined,
            };

            // The event of the bill is kept with the bill, exactly like the
            // billing modal of the event does.
            return updateClientBill(
                bill,
                body,
                resolveClientBillEventID(bill) || undefined,
            );
        },
        [editingClientBill, updateClientBill],
    );

    /** Saves the edited vendor bill, keeping the stored line items. */
    const handleVendorBillConfirm = useCallback(
        async (values: VendorBillFormValues) => {
            const bill = editingVendorBill;
            if (!bill) return false;

            const body: Partial<VendorBill> = {
                name: values.name,
                phone: values.phone,
                address: values.address,
                gst: values.gst,
                gstCertificate: values.gstCertificate,
                accountHolderName: values.accountHolderName,
                invoiceNumber: values.invoiceNumber,
                billCreateDate: values.billCreateDate || null,
                eventDate: values.eventDate || null,
                // The line items come from the purchase order of the event and
                // are not editable in this modal.
                items: bill.items ?? [],
                // The status is managed on its own, it is kept as it is.
                status: bill.status ?? undefined,
            };

            return updateVendorBill(bill, body, resolveVendorBillEventID(bill) || undefined);
        },
        [editingVendorBill, updateVendorBill],
    );

    const handleDeleteConfirm = useCallback(async () => {
        if (!deleteTarget) return;

        const deleted =
            deleteTarget.type === "client"
                ? await deleteClientBill(deleteTarget.bill as ClientBill)
                : await deleteVendorBill(deleteTarget.bill as VendorBill);

        if (deleted) setDeleteTarget(null);
    }, [deleteTarget, deleteClientBill, deleteVendorBill]);

    /* ------------------------------------------------------------------ */
    /*  Handlers                                                           */
    /* ------------------------------------------------------------------ */

    const handleResetFilters = useCallback(() => {
        if (tab === "client") {
            setClientSearch("");
            setClientEventID("");
            setClientStatus("");
            setClientPage(1);
        } else {
            setVendorSearch("");
            setVendorEventID("");
            setVendorStatus("");
            setVendorPage(1);
        }
    }, [tab, setClientSearch, setVendorSearch, setClientPage, setVendorPage]);

    const handleExport = useCallback(() => {
        if (tab === "client") {
            downloadCSV(
                filteredClientRows.map(row => ({
                    "Bill Number": row.bill.billNo ?? "",
                    Client: row.clientName,
                    Event: row.eventTitle,
                    "Bill Date": row.bill.billDate
                        ? formatShortDate(row.bill.billDate)
                        : "",
                    "Bill Amount": row.summary.grossAmount,
                    "Received Amount": row.summary.receivedAmount,
                    "Outstanding Amount": row.summary.outstandingAmount,
                    Status: getBillStatusLabel(resolveClientRowStatus(row)),
                })),
                "client-bills-export.csv",
            );
            return;
        }

        downloadCSV(
            filteredVendorRows.map(row => ({
                "Bill Number": row.bill.invoiceNumber ?? "",
                Vendor: row.bill.name ?? "",
                Event: row.eventTitle,
                "Bill Date": row.bill.billCreateDate
                    ? formatShortDate(row.bill.billCreateDate)
                    : "",
                "Bill Amount": row.summary.totalAmount ?? row.summary.subtotalAmount,
                "Paid Amount": row.summary.paidAmount ?? "",
                "Outstanding Amount": row.summary.outstandingAmount ?? "",
                Status: getBillStatusLabel(resolveVendorRowStatus(row)),
            })),
            "vendor-bills-export.csv",
        );
    }, [tab, filteredClientRows, filteredVendorRows, resolveClientRowStatus, resolveVendorRowStatus]);

    /* ------------------------------------------------------------------ */
    /*  Table                                                              */
    /* ------------------------------------------------------------------ */

    const isClientTab = tab === "client";
    const activeLoading = isClientTab ? client.loading : vendor.loading;
    const activeError = isClientTab ? client.error : vendor.error;
    const activeEventID = isClientTab ? clientEventID : vendorEventID;
    const activeEventOption =
        eventOptions.find(option => option.value === activeEventID) ?? null;

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            <PageHeader
                title="Bill Management"
                description="View and manage client and vendor bills across all events"
                actions={
                    <Button
                        variant="ghost"
                        onClick={handleExport}
                        icon={<Download size={16} />}
                        className="w-full sm:w-auto"
                        disabled={activeLoading || activeError !== null}
                    >
                        Export
                    </Button>
                }
            />

            <div className="flex flex-col gap-4 sm:gap-1">
                <Tabs
                    value={tab}
                    onChange={key => setTab(key as BillTab)}
                    items={[
                        {
                            key: "client",
                            label: "Client Bills",
                            icon: <Receipt size={14} />,
                            count: filteredClientRows.length,
                        },
                        {
                            key: "vendor",
                            label: "Vendor Bills",
                            icon: <Truck size={14} />,
                            count: filteredVendorRows.length,
                        },
                    ]}
                />

                <div className="rounded-lg bg-surface p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder={
                                    isClientTab
                                        ? "Search by bill number, client, event or estimate..."
                                        : "Search by bill number, vendor, event or GSTIN..."
                                }
                                value={isClientTab ? client.search : vendor.search}
                                onChange={event => {
                                    if (isClientTab) {
                                        setClientSearch(event.target.value);
                                        setClientPage(1);
                                    } else {
                                        setVendorSearch(event.target.value);
                                        setVendorPage(1);
                                    }
                                }}
                                className="h-10 pl-9"
                            />
                        </div>
                        <div className="sm:w-[240px]">
                            <Select
                                options={eventOptions}
                                value={activeEventOption}
                                placeholder="All Events"
                                isClearable={false}
                                isDisabled={eventsLoading}
                                onChange={option => {
                                    if (isClientTab) {
                                        setClientEventID(option?.value ?? "");
                                        setClientPage(1);
                                    } else {
                                        setVendorEventID(option?.value ?? "");
                                        setVendorPage(1);
                                    }
                                }}
                            />
                        </div>
                        <div className="sm:w-[200px]">
                            <Select
                                options={STATUS_OPTIONS}
                                value={
                                    STATUS_OPTIONS.find(
                                        option =>
                                            option.value ===
                                            (isClientTab ? clientStatus : vendorStatus),
                                    ) ?? null
                                }
                                placeholder="All Statuses"
                                isClearable={false}
                                onChange={option => {
                                    const value = (option?.value ?? "") as BillStatus | "";
                                    if (isClientTab) {
                                        setClientStatus(value);
                                        setClientPage(1);
                                    } else {
                                        setVendorStatus(value);
                                        setVendorPage(1);
                                    }
                                }}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                            title="Reset Filters"
                            disabled={activeLoading}
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="rounded-lg bg-surface p-4 sm:p-6 shadow-sm">
                    {activeLoading ? (
                        <div className="flex min-h-[200px] items-center justify-center">
                            <Loading />
                        </div>
                    ) : activeError ? (
                        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
                            <p className="text-sm text-muted-foreground">{activeError}</p>
                            <Button
                                variant="ghost"
                                onClick={() =>
                                    isClientTab ? refetchClient() : refetchVendor()
                                }
                                icon={<RefreshCw size={16} />}
                            >
                                Try Again
                            </Button>
                        </div>
                    ) : isClientTab ? (
                        <>
                            <ClientBillsTable
                                data={pagedClientRows}
                                onEdit={setEditingClientBill}
                                onDelete={bill => setDeleteTarget({ type: "client", bill })}
                                onStatusChange={updateClientBillStatus}
                                canEditStatus={canManageBills}
                                emptyMessage={
                                    client.bills.length === 0
                                        ? "No client bills found."
                                        : "No client bills match your search."
                                }
                            />
                            {filteredClientRows.length > 0 && (
                                <div className="mt-4">
                                    <Pagination
                                        pagination={clientPagination}
                                        onPageChange={handleClientPageChange}
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <VendorBillsTable
                                data={pagedVendorRows}
                                onEdit={setEditingVendorBill}
                                onDelete={bill => setDeleteTarget({ type: "vendor", bill })}
                                onStatusChange={updateVendorBillStatus}
                                canEditStatus={canManageBills}
                                emptyMessage={
                                    vendor.bills.length === 0
                                        ? "No vendor bills found."
                                        : "No vendor bills match your search."
                                }
                            />
                            {filteredVendorRows.length > 0 && (
                                <div className="mt-4">
                                    <Pagination
                                        pagination={vendorPagination}
                                        onPageChange={handleVendorPageChange}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Edit the details of a generated bill. */}
            <ClientBillConfirmModal
                open={editingClientBill !== null}
                onClose={() => setEditingClientBill(null)}
                onConfirm={handleClientBillConfirm}
                defaultValues={clientFormValues}
                items={[]}
                totals={clientTotalsRows}
                submitting={updating}
                mode="edit"
            />

            <VendorBillConfirmModal
                open={editingVendorBill !== null}
                onClose={() => setEditingVendorBill(null)}
                onConfirm={handleVendorBillConfirm}
                defaultValues={vendorFormValues}
                submitting={updating}
                mode="edit"
            />

            <DeleteBillConfirmationModal
                open={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDeleteConfirm}
                title={
                    deleteTarget?.type === "client"
                        ? "Delete client bill?"
                        : "Delete vendor bill?"
                }
                description={
                    deleteTarget
                        ? `The bill ${
                              (deleteTarget.type === "client"
                                  ? (deleteTarget.bill as ClientBill).billNo
                                  : (deleteTarget.bill as VendorBill).invoiceNumber) || "bill"
                          } will be permanently deleted. This action cannot be undone.`
                        : "The bill will be permanently deleted. This action cannot be undone."
                }                isLoading={deleting}
            />
        </div>
    );
}
