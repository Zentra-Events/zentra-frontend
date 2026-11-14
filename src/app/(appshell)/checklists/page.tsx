"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, SquarePlus } from "lucide-react";

import { AccessButton } from "@/components/shared/access-button";
import { MobileCardList } from "@/components/shared/mobile-card-list";
import { ExecutionChecklistModal } from "@/components/checklist-modal";
import type { ChecklistModalProps } from "@/components/checklist-modal/types";
import CreateChecklistModal from "@/components/create-checklist-modal";
import { PageHeader } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { CheckSquareIcon } from "@/components/ui/icons";
import { fetchVendors } from "@/lib/api/vendor";
import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { downloadCSV } from "@/lib/utils/file";
import { useRequestApi } from "@/hooks/useRequestApi";
import type { ChecklistFormData } from "@/types/checklist";
import type { Inventory } from "@/types/inventory";
import type { Vendor } from "@/types/vendor";

type EventRow = ChecklistFormData & {
    location?: string;
    assignee?: string | null;
    startDate?: string;
    endDate?: string;
};

type ChecklistEvent = {
    id?: string | number;
    eventID?: string;
    title: string;
    enquiryDate?: string;
    gst?: string | number;
    status?: string;
    client?: string | { name?: string };
    checklistAssignedTo?: string | null;
    startDate?: string;
    endDate?: string;
    eventStartDate?: string;
    eventEndDate?: string;
    location?: string;
    venue?: string;
};

type EventDetails = ChecklistModalProps["eventData"] & {
    eventID?: string;
    checklistAssignedTo?: string;
};

const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
};

const eventColumns = (onView: (row: EventRow) => void): Column<EventRow>[] => [
    {
        key: "eventName",
        header: "Event Name",
        render: row => (
            <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                    <CheckSquareIcon size={18} />
                </div>
                <div className="min-w-0">
                    <button
                        type="button"
                        onClick={() => onView(row)}
                        className="cursor-pointer text-left font-medium text-primary transition-colors hover:text-primary-hover hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        {row.eventName}
                    </button>
                    <p className="truncate text-xs text-muted-foreground">
                        {row.location || "Location not specified"}
                    </p>
                </div>
            </div>
        ),
    },
    {
        key: "clientPoc",
        header: "Client",
        render: row => row.clientPoc,
        className: "text-muted-foreground",
    },
    {
        key: "startDate",
        header: "Start Date",
        render: row => formatDateTime(row.startDate),
        className: "text-muted-foreground",
    },
    {
        key: "endDate",
        header: "End Date",
        render: row => formatDateTime(row.endDate),
        className: "text-muted-foreground",
    },
];

export default function ChecklistsPage() {
    const { request: requestEvents, loading: loadingEvents } = useRequestApi<ChecklistEvent[]>();
    const { request: requestRecords } = useRequestApi<ChecklistFormData[]>();
    const { request: requestEventDetails, loading: loadingEventDetails } =
        useRequestApi<EventDetails>();
    const [events, setEvents] = useState<EventRow[]>([]);
    const [checklistRecords, setChecklistRecords] = useState<ChecklistFormData[]>([]);
    const [modalOpen, setModalOpen] = useState(false);
    const [checklistModalOpen, setChecklistModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<EventDetails | null>(null);
    const [vendorList, setVendorList] = useState<Vendor[]>([]);
    const [loadingVendors, setLoadingVendors] = useState(false);
    const [inventoryList, setInventoryList] = useState<Inventory[]>([]);
    const [loadingInventory, setLoadingInventory] = useState(false);

    const fetchEvents = useCallback(async () => {
        const result = await requestEvents(API_ENDPOINTS.events.list, { method: "GET" });
        setEvents(
            (result ?? []).map(event => ({
                id: event.eventID ?? event.id,
                eventName: event.title,
                enquiryDate: event.enquiryDate || "",
                clientPoc:
                    typeof event.client === "string" ? event.client : event.client?.name || "-",
                status: event.status || "Not Started",
                gst: String(event.gst ?? ""),
                location: event.location || event.venue,
                assignee: event.checklistAssignedTo || "",
                startDate: event.startDate || event.eventStartDate || "",
                endDate: event.endDate || event.eventEndDate || "",
            })),
        );
    }, [requestEvents]);

    const fetchChecklistRecords = useCallback(async () => {
        const result = await requestRecords(API_ENDPOINTS.checklists.list, { method: "GET" });
        setChecklistRecords(result ?? []);
    }, [requestRecords]);

    useEffect(() => {
        fetchEvents();
        fetchChecklistRecords();
    }, [fetchEvents, fetchChecklistRecords]);

    const fetchInventory = useCallback(async () => {
        setLoadingInventory(true);
        try {
            const response = await apiRequest(API_ENDPOINTS.inventory.list);
            if (!response.ok) throw new Error("Failed to fetch inventory");
            const result: Inventory[] = await response.json();
            setInventoryList(Array.isArray(result) ? result : []);
        } catch (error) {
            console.error("Error fetching inventory:", error);
            setInventoryList([]);
        } finally {
            setLoadingInventory(false);
        }
    }, []);

    const loadVendors = useCallback(async () => {
        setLoadingVendors(true);
        try {
            setVendorList(await fetchVendors());
        } catch (error) {
            console.error("Error fetching vendors:", error);
            toast.error("Failed to load vendors");
        } finally {
            setLoadingVendors(false);
        }
    }, []);

    useEffect(() => {
        loadVendors();
        fetchInventory();
    }, [loadVendors, fetchInventory]);

    const handleViewEvent = async (event: EventRow) => {
        if (!event.id) {
            toast.error("Event ID not found");
            return;
        }
        const details = await requestEventDetails(API_ENDPOINTS.events.detail(event.id), {
            method: "GET",
        });
        if (!details) {
            toast.error("Failed to load event details");
            return;
        }
        setSelectedEvent({ ...details, id: String(details.id || details.eventID || event.id) });
        setChecklistModalOpen(true);
    };

    const handleExport = () => {
        downloadCSV(
            checklistRecords.map(checklist => ({
                "Event Name": checklist.eventName,
                "Enquiry Date": checklist.enquiryDate,
                "Client POC": checklist.clientPoc,
                Status: checklist.status,
                GST: checklist.gst,
            })),
            "checklists-export.csv",
        );
    };

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            <PageHeader
                title="Checklist Management"
                description="Manage event checklists, assignees, and schedules"
                actions={
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
                        <Button
                            variant="ghost"
                            className="w-full sm:w-auto"
                            onClick={handleExport}
                            icon={<Download size={16} />}
                        >
                            Export
                        </Button>
                        <AccessButton
                            scope={["w:checklists"]}
                            className="w-full sm:w-auto"
                            onClick={() => setModalOpen(true)}
                            icon={<SquarePlus size={16} />}
                        >
                            Create Checklist
                        </AccessButton>
                    </div>
                }
            />

            <section className="rounded-lg bg-surface p-4 shadow-sm sm:p-6">
                <h2 className="mb-4 text-lg font-semibold">Event Execution Checklists</h2>
                <div className="hidden md:block">
                    <DataTable
                        columns={eventColumns(handleViewEvent)}
                        data={events}
                        rowKey={row => String(row.id)}
                        emptyMessage="No event checklists found."
                        hoverable
                        isLoading={loadingEvents || loadingEventDetails}
                    />
                </div>
                <MobileCardList
                    className="flex flex-col gap-4 md:hidden"
                    items={events.map(event => ({ id: String(event.id), data: event }))}
                    renderHeader={event => <div className="font-semibold">{event.eventName}</div>}
                    renderContent={event => (
                        <div className="space-y-1 text-sm text-muted-foreground">
                            <div>Client: {event.clientPoc}</div>
                            <div>Assignee: {event.assignee || "-"}</div>
                            <div>Start: {formatDateTime(event.startDate)}</div>
                            <div>End: {formatDateTime(event.endDate)}</div>
                        </div>
                    )}
                    renderActions={event => (
                        <div className="flex justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewEvent(event)}
                            >
                                View Checklist
                            </Button>
                        </div>
                    )}
                    emptyMessage="No event checklists found."
                    isLoading={loadingEvents}
                />
            </section>

            <CreateChecklistModal
                open={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                }}
                onSave={fetchChecklistRecords}
            />
            {selectedEvent && (
                <ExecutionChecklistModal
                    isOpen={checklistModalOpen}
                    onClose={() => {
                        setChecklistModalOpen(false);
                        setSelectedEvent(null);
                    }}
                    eventData={selectedEvent}
                    checklistAssignedTo={selectedEvent.checklistAssignedTo || ""}
                    onSave={() => {
                        fetchEvents();
                    }}
                    vendorList={vendorList}
                    loadingVendors={loadingVendors}
                    inventoryList={inventoryList}
                    loadingInventory={loadingInventory}
                />
            )}
        </div>
    );
}
