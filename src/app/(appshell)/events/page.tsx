"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useRequestApi } from "@/hooks/useRequestApi";
import { Button } from "@/components/ui/button";
import { LinkText, MenuList } from "@/components/ui";
import { MoreVerticalIcon, TrashIcon, FileTextIcon, CalendarIcon } from "@/components/ui/icons";
import { CalendarPlus, Download } from "lucide-react";
import { PageHeader } from "@/components/ui";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { MobileCardList } from "@/components/shared/mobile-card-list";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import CreateEventModal from "@/components/create-event-modal";
import { EventFormData } from "@/types/event";
import { useEventPrefill } from "@/context/event-prefill";
import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { AccessButton } from "@/components/shared/access-button";
import { MenuItem } from "@/types";

type EventItem = {
    id: number | string;
    eventID?: string;
    title: string;
    client?:
        | {
              id?: string;
              name?: string;
              email?: string;
              phone?: string;
              address?: string;
          }
        | string;
    startDate?: string;
    endDate?: string;
    eventStartDate?: string;
    eventEndDate?: string;
    location?: string;
    venue?: string;
    status?: string;
    estimateId?: string;
    enquiryId?: string;
};

const getStatusVariant = (
    status?: string,
): "default" | "success" | "warning" | "danger" | "info" => {
    const s = String(status ?? "").toLowerCase();
    if (s === "in progress" || s === "in_progress" || s === "ongoing") return "warning";
    if (s === "cancelled" || s === "canceled") return "danger";
    if (s === "completed" || s === "done" || s === "finished") return "success";
    return "default";
};

// Helper function to format dates using native JavaScript Date
const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) {
            return "-";
        }
        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    } catch {
        return "-";
    }
};

const formatDateRange = (startDate?: string, endDate?: string) => {
    if (!startDate && !endDate) return "-";
    if (!endDate) return formatDateTime(startDate);
    if (!startDate) return "-";

    try {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return "-";
        }

        const sameDay = start.toDateString() === end.toDateString();

        if (sameDay) {
            const dateStr = start.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            });
            const startTime = start.toLocaleString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            });
            const endTime = end.toLocaleString("en-US", {
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
            });
            return `${dateStr} · ${startTime} - ${endTime}`;
        }

        const startStr = start.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
        const endStr = end.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
        return `${startStr} - ${endStr}`;
    } catch {
        return "-";
    }
};

const columns = (
    onView: (ev: EventItem) => void,
    onEdit: (ev: EventItem) => void,
    onClone: (ev: EventItem) => void,
    onDelete: (ev: EventItem) => void,
    deletingIds: Set<string>,
    cloningIds: Set<string>,
): Column<EventItem>[] => [
    {
        key: "title",
        header: "Event Name",
        render: row => {
            const isDeleting = deletingIds.has(String(row.id));
            return (
                <div className="font-medium">
                    {isDeleting ? (
                        <span className="inline-flex items-center gap-2 text-red-600">
                            <svg
                                className="animate-spin h-4 w-4"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                            >
                                <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                ></circle>
                                <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                            </svg>
                            {row.title}
                        </span>
                    ) : (
                        <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
                                <CalendarIcon size={18} />
                            </div>
                            <div className="min-w-0">
                                <LinkText
                                    href={`/events/${row.eventID}`}
                                    className="hover:underline"
                                >
                                    {row.title}
                                </LinkText>
                                <p className="truncate text-xs text-muted-foreground">
                                    {row.location || row.venue || "Location not specified"}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            );
        },
    },
    {
        key: "client",
        header: "Client",
        render: row => (
            <div>
                <div className="font-medium">
                    {typeof row.client === "string" ? row.client : row.client?.name}
                </div>
                {typeof row.client !== "string" && row.client && (
                    <div className="text-xs text-muted-foreground">
                        {row.client.email && <div>{row.client.email}</div>}
                        {row.client.phone && <div>{row.client.phone}</div>}
                    </div>
                )}
            </div>
        ),
    },
    {
        key: "schedule",
        header: "Schedule",
        render: row => (
            <div className="text-sm">
                <div className="text-muted-foreground">
                    {formatDateTime(row.startDate || row.eventStartDate)}
                </div>
                {row.endDate || row.eventEndDate ? (
                    <div className="text-muted-foreground">
                        {formatDateTime(row.endDate || row.eventEndDate)}
                    </div>
                ) : null}
            </div>
        ),
    },
    {
        key: "status",
        header: "Status",
        render: row => (
            <Badge variant={getStatusVariant(row.status)}>{row.status || "Not Started"}</Badge>
        ),
    },
    {
        key: "actions",
        header: "",
        className: "text-right",
        render: row => {
            const isDeleting = deletingIds.has(String(row.id));
            const isCloning = cloningIds.has(String(row.id));
            const isBusy = isDeleting || isCloning;

            const items: MenuItem[] = [
                {
                    key: "view",
                    label: "View",
                    icon: <FileTextIcon size={16} />,
                    onClick: () => onView(row),
                    disabled: isBusy,
                },
                // Hide edit option for now, as we are not allowing editing of events
                // {
                //     key: "edit",
                //     label: "Edit",
                //     icon: <PencilIcon size={16} />,
                //     onClick: () => onEdit(row),
                //     disabled: isBusy,
                //     scopes: ["w:events"],
                // },
                // Clone button commented down — not working properly
                // {
                //     key: "clone",
                //     label: isCloning ? "Cloning..." : "Clone",
                //     icon: <Copy size={16} />,
                //     onClick: () => onClone(row),
                //     disabled: isBusy,
                //     scopes: ["w:events"],
                // },
                {
                    key: "delete",
                    label: isDeleting ? "Deleting..." : "Delete",
                    icon: <TrashIcon size={16} />,
                    onClick: () => onDelete(row),
                    className: "text-destructive focus:text-destructive",
                    disabled: isBusy,
                    scopes: ["w:events"],
                },
            ];

            return (
                <div className="flex justify-center">
                    <MenuList
                        align="end"
                        items={items}
                        trigger={
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVerticalIcon size={16} />
                            </Button>
                        }
                    />
                </div>
            );
        },
    },
];

export default function EventsPage() {
    const router = useRouter();
    const { request, loading } = useRequestApi<EventItem[]>();
    const [events, setEvents] = useState<EventItem[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<EventFormData | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [eventToDelete, setEventToDelete] = useState<EventItem | null>(null);
    const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
    const [cloningIds, setCloningIds] = useState<Set<string>>(new Set());
    const { prefill: contextPrefill, clearPrefill } = useEventPrefill();

    // Handle prefill from context (coming from estimates page)
    useEffect(() => {
        if (contextPrefill) {
            setEditingEvent(null);
            setIsModalOpen(true);
            clearPrefill();
        }
    }, [contextPrefill, clearPrefill]);

    const fetchEvents = async () => {
        try {
            const res = await request(API_ENDPOINTS.events.list, {
                method: "GET",
            });
            if (res !== null) {
                const normalizedData = Array.isArray(res)
                    ? res.map((ev: EventItem) => ({
                          ...ev,
                          startDate: ev.eventStartDate || ev.startDate,
                          endDate: ev.eventEndDate || ev.endDate,
                      }))
                    : [];
                setEvents(normalizedData);
            }
        } catch (err: unknown) {
            toast.error("Failed to fetch events");
            console.error(err);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const handleView = (ev: EventItem) => {
        router.push(`/events/${ev.eventID || ev.id}`);
    };

    const handleEdit = async (ev: EventItem) => {
        try {
            const res = await apiRequest(`/api/events/${encodeURIComponent(String(ev.id))}`);
            if (!res.ok) {
                toast.error("Failed to load event details");
                return;
            }
            const fullEvent = await res.json();

            setEditingEvent({
                id: String(fullEvent.id ?? ev.id),
                title: fullEvent.title || fullEvent.eventName || "",
                eventStartDate: fullEvent.eventStartDate ?? fullEvent.startDate ?? "",
                eventEndDate: fullEvent.eventEndDate ?? fullEvent.endDate ?? "",
                location: fullEvent.location ?? "",
                venue: fullEvent.venue ?? "",
                clientId: typeof fullEvent.client === "string" ? "" : (fullEvent.client?.id ?? ""),
                estimateId: fullEvent.estimateId ?? "",
                enquiryId: fullEvent.enquiryId ?? "",
            });
            setIsModalOpen(true);
        } catch {
            toast.error("Failed to load event details");
        }
    };

    const handleClone = async (ev: EventItem) => {
        const idString = String(ev.id);
        setCloningIds(prev => new Set(prev).add(idString));

        try {
            const lookupId = ev.eventID || ev.id;
            const detailRes = await apiRequest(
                `/api/events/${encodeURIComponent(String(lookupId))}`,
            );
            if (!detailRes.ok) {
                toast.error("Failed to load event details for cloning");
                return;
            }
            const fullEvent = await detailRes.json();

            const cloneRes = await apiRequest("/api/events/clone", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(fullEvent),
            });

            if (!cloneRes.ok) {
                const errText = await cloneRes.text().catch(() => "");
                throw new Error(`Clone failed: ${cloneRes.status} ${errText}`);
            }

            const clonedEvent = await cloneRes.json();
            toast.success(`Event cloned successfully`, {
                action: {
                    label: "View",
                    onClick: () =>
                        (window.location.href = `/events/${clonedEvent.eventID || clonedEvent.id}`),
                },
            });

            await fetchEvents();
        } catch {
            toast.error("Failed to clone event");
        } finally {
            setCloningIds(prev => {
                const next = new Set(prev);
                next.delete(idString);
                return next;
            });
        }
    };

    const handleDeleteClick = (ev: EventItem) => {
        setEventToDelete(ev);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!eventToDelete) return;
        const idString = String(eventToDelete.id);

        setDeletingIds(prev => new Set(prev).add(idString));

        try {
            const res = await apiRequest(`/api/events/${idString}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                throw new Error(`Delete failed: ${res.status} ${txt}`);
            }
            setEvents(prev => prev.filter(e => String(e.id) !== idString));
            toast.success("Event deleted successfully");
        } catch {
            toast.error("Failed to delete event");
        } finally {
            setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(idString);
                return next;
            });
            setDeleteModalOpen(false);
            setEventToDelete(null);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteModalOpen(false);
        setEventToDelete(null);
    };

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            <PageHeader
                title="Event Management"
                description={`Manage all events. You have ${events.length} ${events.length === 1 ? "event" : "events"}`}
                actions={
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
                        <Button
                            variant="ghost"
                            className="w-full sm:w-auto"
                            // onClick={handleExport}
                            icon={<Download size={16} />}
                        >
                            Export
                        </Button>
                        <AccessButton
                            scope={["w:events"]}
                            className="w-full sm:w-auto"
                            onClick={() => setIsModalOpen(true)}
                            icon={<CalendarPlus size={16} />}
                        >
                            Create Event
                        </AccessButton>
                    </div>
                }
            />
            <div className="flex flex-col gap-4 sm:gap-1">
                <div className="rounded-lg bg-surface p-4 sm:p-6 shadow-sm hidden md:block">
                    <DataTable
                        columns={columns(
                            handleView,
                            handleEdit,
                            handleClone,
                            handleDeleteClick,
                            deletingIds,
                            cloningIds,
                        )}
                        data={events}
                        rowKey={row => String(row.id)}
                        emptyMessage="No events found."
                        hoverable
                        isLoading={loading}
                    />
                </div>
                <MobileCardList
                    className="flex flex-col gap-4 md:hidden"
                    items={events.map(ev => ({ id: String(ev.id), data: ev }))}
                    renderHeader={ev => (
                        <div className="flex items-center justify-between">
                            <div className="font-bold text-lg">{ev.title}</div>
                            <Badge variant={getStatusVariant(ev.status)}>
                                {ev.status || "Not Started"}
                            </Badge>
                        </div>
                    )}
                    renderContent={ev => (
                        <>
                            <div className="mb-1">
                                Schedule:{" "}
                                <span className="font-medium">
                                    {formatDateRange(ev.startDate, ev.endDate)}
                                </span>
                            </div>
                            <div className="mb-1">
                                Client:{" "}
                                <span className="font-medium">
                                    {typeof ev.client === "string" ? ev.client : ev.client?.name}
                                </span>
                            </div>
                            {typeof ev.client !== "string" && ev.client && (
                                <>
                                    {ev.client.email && (
                                        <div className="mb-1">
                                            Email:{" "}
                                            <span className="font-medium">{ev.client.email}</span>
                                        </div>
                                    )}
                                    {ev.client.phone && (
                                        <div className="mb-1">
                                            Phone:{" "}
                                            <span className="font-medium">{ev.client.phone}</span>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}
                    renderActions={ev => {
                        const isDeleting = deletingIds.has(String(ev.id));
                        const isCloning = cloningIds.has(String(ev.id));
                        const isBusy = isDeleting || isCloning;

                        return (
                            <div className="flex gap-2 justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleView(ev)}
                                    disabled={isBusy}
                                >
                                    View
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEdit(ev)}
                                    disabled={isBusy}
                                >
                                    Edit
                                </Button>
                                {/* Clone button commented down — not working properly
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleClone(ev)}
                                    disabled={isBusy}
                                >
                                    {isCloning ? "Cloning..." : "Clone"}
                                </Button> */}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleDeleteClick(ev)}
                                    disabled={isBusy}
                                >
                                    {isDeleting ? "Deleting..." : "Delete"}
                                </Button>
                            </div>
                        );
                    }}
                    emptyMessage="No events found."
                    isLoading={loading}
                />
                <CreateEventModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setEditingEvent(null);
                    }}
                    onSubmit={async () => {
                        await fetchEvents();
                        setIsModalOpen(false);
                        setEditingEvent(null);
                        toast.success("Event created successfully");
                    }}
                    editData={editingEvent}
                />
                <ConfirmationModal
                    open={deleteModalOpen}
                    onClose={handleDeleteCancel}
                    onConfirm={handleDeleteConfirm}
                    title="Delete Event"
                    description={
                        eventToDelete
                            ? `Are you sure you want to delete "${eventToDelete.title}"? This action cannot be undone.`
                            : undefined
                    }
                    confirmText="Delete"
                    cancelText="Cancel"
                />
            </div>
        </div>
    );
}
