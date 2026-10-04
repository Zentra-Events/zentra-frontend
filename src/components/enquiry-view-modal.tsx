"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InfoCard } from "@/components/ui/info-card";
import { InfoRow } from "@/components/ui/info-row";
import {
    CalendarIcon,
    UserIcon,
    PhoneIcon,
    MapPinIcon,
    ExternalLinkIcon,
    HashIcon,
    BriefcaseIcon,
    UsersIcon,
    FileTextIcon,
    CalendarDaysIcon,
    PencilIcon,
} from "@/components/ui/icons";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import { Enquiry } from "@/types/enquiry";
import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { formatScheduleRange, formatShortDateTime } from "@/lib/utils/date";
import { FilePlus2Icon } from "lucide-react";
import { useEstimatePrefill } from "@/context/estimate-prefill";

interface EnquiryViewModalProps {
    open: boolean;
    onClose: () => void;
    enquiry: Enquiry | null;
    onEdit?: (enquiry: Enquiry) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getStatusVariant(status: string): "default" | "success" | "warning" | "danger" | "info" {
    const s = status.toUpperCase();
    if (s === "OPEN" || s === "NEW") return "info";
    if (s === "IN_PROGRESS" || s === "PENDING") return "warning";
    if (s === "CLOSED" || s === "COMPLETED" || s === "CONVERTED") return "success";
    if (s === "CANCELLED" || s === "REJECTED" || s === "LOST") return "danger";
    return "default";
}

function getEventTypeVariant(type?: string): "default" | "success" | "warning" | "danger" | "info" {
    const t = (type || "").toUpperCase();
    if (t === "CORPORATE") return "info";
    if (t === "PERSONAL") return "success";
    if (t === "OTHER") return "default";
    return "default";
}

function isEventCreated(statusFlag: string): boolean {
    return statusFlag === "EVENT_CREATED";
}

function isEstimateCreated(statusFlag: string): boolean {
    return statusFlag === "ESTIMATE_CREATED";
}

function getEnquiryAssignee(enquiry: Enquiry): string {
    const assignedTo = enquiry.assignedTo?.trim() || "";
    if (assignedTo && assignedTo !== "Unassigned") return assignedTo;
    return enquiry.assignee?.trim() || "";
}

// ─── Main Component ─────────────────────────────────────────────────────────

export function EnquiryViewModal({ open, onClose, enquiry, onEdit }: EnquiryViewModalProps) {
    const router = useRouter();
    const { setPrefill: setEstimatePrefill } = useEstimatePrefill();
    const [eventSaving, setEventSaving] = useState(false);
    const [estimateLoading, setEstimateLoading] = useState(false);
    const [enquiryStatuses, setEnquiryStatuses] = useState<string>("");
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [cloning, setCloning] = useState(false);

    useEffect(() => {
        if (!enquiry?.id || !open) return;

        const fetchEvents = async () => {
            setEstimateLoading(true);

            try {
                const eventUrl = API_ENDPOINTS.events.detail(enquiry.eventID || enquiry.id);

                let hasEvent = false;

                try {
                    const eventRes = await apiRequest(eventUrl, { method: "GET" });

                    if (eventRes.ok) {
                        hasEvent = true;
                        setEnquiryStatuses("EVENT_CREATED");
                    }
                } catch (error) {
                    console.log("Event API failed:", error);
                }

                if (!hasEvent) {
                    try {
                        const estimateUrl = API_ENDPOINTS.estimates.byEnquiry(enquiry.id);

                        const estimateRes = await apiRequest(estimateUrl, {
                            method: "GET",
                        });
                        const body = await estimateRes.json();
                        if (body?.estimates?.length > 0) {
                            setEnquiryStatuses("ESTIMATE_CREATED");
                        } else {
                            setEnquiryStatuses("");
                        }
                    } catch (error) {
                        console.log("Estimate API failed:", error);
                        setEnquiryStatuses("");
                    }
                }
            } finally {
                setEstimateLoading(false);
            }
        };

        fetchEvents();
    }, [enquiry, open]);

    const openEstimatePage = () => {
        if (!enquiry) return;
        onClose();
        router.push(`/estimates?enquiryId=${enquiry.id}`);
    };

    const handleCreateEstimate = async () => {
        if (!enquiry) return;
        setEventSaving(true);
        try {
            const payload = {
                title: enquiry.eventName || enquiry.title || "Event",
                status: "ENQUIRY_CREATED",
                enquiryDate: enquiry.date || new Date().toISOString(),
                fromDate: enquiry.fromDate || enquiry.date || new Date().toISOString(),
                toDate: enquiry.toDate || enquiry.date || new Date().toISOString(),
                assignedTo: getEnquiryAssignee(enquiry),
                eventID: enquiry.eventID,
                venue: enquiry.venue || "",
                eventName: enquiry.eventName || enquiry.title || "Event",
                location: enquiry.location || "",
                clientPoC: enquiry.clientPoC || "",
                pocContactNumber: enquiry.enquiryPoCNumber || "",
                eventPoCNumber: enquiry.eventPoCNumber || "",
                eventPoC: enquiry.eventPoC || "",
                client: enquiry.client,
                enquiryId: String(enquiry.id ?? ""),
                eventType: enquiry.eventType || "CORPORATE",
                highlvelRequirement: enquiry.highlvelRequirement || "",
                enquiryPoC: enquiry.enquiryPoC || "",
                clientID: enquiry.clientID || "",
            };

            const res = await apiRequest(API_ENDPOINTS.estimates.list, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errText = await res.text().catch(() => "");
                throw new Error(`Failed to create estimate: ${res.status} ${errText}`);
            }

            const createdEstimate = await res.json();
            onClose();

            if (createdEstimate) {
                toast.success("Estimate created from enquiry");
                // Ensure title is populated for the estimate modal prefill
                const prefillPayload = {
                    ...createdEstimate,
                    location: createdEstimate.location || enquiry.location || "",
                    title:
                        createdEstimate.title ||
                        createdEstimate.eventName ||
                        enquiry.eventName ||
                        enquiry.title ||
                        "Event",
                };
                // Set the prefill context so the estimates page opens the edit modal
                setEstimatePrefill(prefillPayload);
                router.push(`/estimates`);
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create estimate";
            toast.error(message);
        } finally {
            setEventSaving(false);
        }
    };

    const handleClose = () => {
        setEnquiryStatuses("");
        onClose();
    };

    const handleEditClick = () => {
        if (!enquiry || !onEdit) return;
        onClose();
        onEdit(enquiry);
    };

    const handleDeleteClick = () => {
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!enquiry) return;
        setDeleting(true);
        try {
            const res = await apiRequest(API_ENDPOINTS.enquiries.detail(enquiry.id), {
                method: "DELETE",
            });

            if (res.ok) {
                toast.success("Enquiry deleted successfully");
                setDeleteModalOpen(false);
                handleClose();
            } else {
                throw new Error(`Failed to delete enquiry: ${res.status}`);
            }
        } catch {
            toast.error("Failed to delete enquiry. Please try again.");
        } finally {
            setDeleting(false);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteModalOpen(false);
    };

    const handleClone = async () => {
        if (!enquiry) return;
        setCloning(true);
        try {
            // Fetch full enquiry details first
            const detailRes = await apiRequest(API_ENDPOINTS.enquiries.detail(enquiry.id), {
                method: "GET",
            });

            if (!detailRes.ok) {
                toast.error("Failed to load enquiry details for cloning");
                return;
            }

            const fullEnquiry = await detailRes.json();

            const cloneRes = await apiRequest(API_ENDPOINTS.enquiries.clone, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(fullEnquiry),
            });

            if (!cloneRes.ok) {
                const errText = await cloneRes.text().catch(() => "");
                throw new Error(`Clone failed: ${cloneRes.status} ${errText}`);
            }

            const clonedEnquiry = await cloneRes.json();
            toast.success("Enquiry cloned successfully");
            handleClose();
            router.refresh();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to clone enquiry";
            toast.error(message);
        } finally {
            setCloning(false);
        }
    };

    if (!enquiry) return null;

    const title = enquiry.eventName || enquiry.title || "Untitled Enquiry";
    const clientDisplay = enquiry.clientName || enquiry.client || "";
    // Build the schedule string with the shared formatter so the enquiry list
    // and view modal render dates identically. Times are shown only when both
    // the start and end date-times are available.
    const schedule = formatScheduleRange(enquiry.fromDate, enquiry.toDate);
    const hasSchedule = !!schedule;
    const highLevelReq = enquiry.highlvelRequirement || "";

    const isDeletingOrCloning = deleting || cloning;

    return (
        <Modal open={open} onClose={handleClose} size="xxl">
            <ModalBody className="space-y-5">
                {/* ── Header Summary ─────────────────────────────────────── */}
                <Card variant="elevated" className="overflow-hidden">
                    <div className="relative bg-gradient-to-br from-primary/5 via-primary/[0.02] to-transparent px-5 py-4 sm:px-6">
                        <div className="flex items-start justify-between gap-3">
                            {/* Left: title + badges + client */}
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <h2 className="min-w-0 flex-1 truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                                        {title}
                                    </h2>
                                    {enquiry.eventType && (
                                        <Badge variant={getEventTypeVariant(enquiry.eventType)}>
                                            {enquiry.eventType}
                                        </Badge>
                                    )}
                                    {enquiry.status && (
                                        <Badge variant={getStatusVariant(enquiry.status)}>
                                            {enquiry.status.replace(/_/g, " ")}
                                        </Badge>
                                    )}
                                </div>
                                {clientDisplay && (
                                    <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                                        <UserIcon size={14} className="shrink-0" />
                                        <span className="truncate">{clientDisplay}</span>
                                    </p>
                                )}
                            </div>

                            {/* Right: actions, aligned with the title row */}
                            <div className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground -mr-1">
                                {onEdit && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                        onClick={handleEditClick}
                                        disabled={isDeletingOrCloning}
                                        title="Edit Enquiry"
                                    >
                                        <PencilIcon size={16} />
                                    </Button>
                                )}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0"
                                    onClick={handleClone}
                                    disabled={isDeletingOrCloning || cloning}
                                    title="Clone Enquiry"
                                >
                                    {cloning ? (
                                        <span className="animate-spin h-4 w-4 border-2 border-foreground border-t-transparent rounded-full" />
                                    ) : (
                                        <Copy size={16} />
                                    )}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                    onClick={handleDeleteClick}
                                    disabled={isDeletingOrCloning}
                                    title="Delete Enquiry"
                                >
                                    {deleting ? (
                                        <span className="animate-spin h-4 w-4 border-2 border-destructive border-t-transparent rounded-full" />
                                    ) : (
                                        <Trash2 size={16} />
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </Card>

                {/* ── Info Cards Grid ────────────────────────────────────── */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {/* Customer Information */}
                    <InfoCard title="Customer Information" icon={<UserIcon size={16} />}>
                        <InfoRow
                            label="Client"
                            value={clientDisplay}
                            icon={<BriefcaseIcon size={14} />}
                        />
                        <InfoRow
                            label="Enquiry POC"
                            value={enquiry.enquiryPoC || enquiry.poc}
                            icon={<UserIcon size={14} />}
                        />
                        <InfoRow
                            label="Enquiry POC Number"
                            value={enquiry.enquiryPoCNumber}
                            isPhone
                            icon={<PhoneIcon size={14} />}
                        />
                    </InfoCard>

                    {/* Event Information */}
                    <InfoCard title="Event Information" icon={<CalendarDaysIcon size={16} />}>
                        <InfoRow
                            label="Event Type"
                            value={
                                enquiry.eventType ? (
                                    <Badge variant={getEventTypeVariant(enquiry.eventType)}>
                                        {enquiry.eventType}
                                    </Badge>
                                ) : undefined
                            }
                            icon={<BriefcaseIcon size={14} />}
                        />
                        <InfoRow
                            label="Venue"
                            value={enquiry.venue}
                            icon={<MapPinIcon size={14} />}
                        />
                        <InfoRow
                            label="Location"
                            value={enquiry.location}
                            icon={<MapPinIcon size={14} />}
                        />
                        <InfoRow
                            label="Schedule"
                            value={hasSchedule ? schedule : undefined}
                            icon={<CalendarDaysIcon size={14} />}
                        />
                        {highLevelReq && (
                            <InfoRow
                                label="High-level Requirement"
                                value={highLevelReq}
                                icon={<FileTextIcon size={14} />}
                                spanFull
                            />
                        )}
                    </InfoCard>

                    {/* Ownership & Assignment */}
                    <InfoCard title="Ownership & Assignment" icon={<UsersIcon size={16} />}>
                        <InfoRow
                            label="Event POC"
                            value={enquiry.eventPoC}
                            icon={<UserIcon size={14} />}
                        />
                        <InfoRow
                            label="Event POC Number"
                            value={enquiry.eventPoCNumber}
                            isPhone
                            icon={<PhoneIcon size={14} />}
                        />
                        <InfoRow
                            label="Assigned To"
                            value={getEnquiryAssignee(enquiry)}
                            icon={<BriefcaseIcon size={14} />}
                        />
                    </InfoCard>

                    {/* Reference Information */}
                    <InfoCard title="Reference Information" icon={<HashIcon size={16} />}>
                        <InfoRow
                            spanFull
                            label="Enquiry ID"
                            value={String(enquiry.id)}
                            copyValue={enquiry.id}
                            icon={<HashIcon size={14} />}
                        />
                        <InfoRow
                            spanFull
                            label="Event ID"
                            value={enquiry.eventID}
                            copyValue={enquiry.eventID}
                            icon={<HashIcon size={14} />}
                        />
                        {enquiry.date && (
                            <InfoRow
                                label="Enquiry Date"
                                value={formatShortDateTime(enquiry.date)}
                                icon={<CalendarIcon size={14} />}
                            />
                        )}
                    </InfoCard>
                </div>
            </ModalBody>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            <ModalFooter>
                <Button
                    variant="outline"
                    onClick={handleClose}
                    disabled={eventSaving || isDeletingOrCloning}
                >
                    Close
                </Button>

                {isEventCreated(enquiryStatuses) ? (
                    <Button
                        onClick={() => {
                            onClose();
                            router.push(`/events/${enquiry.eventID}`);
                        }}
                        disabled={estimateLoading || eventSaving || isDeletingOrCloning}
                    >
                        View Event
                    </Button>
                ) : (
                    <Button
                        onClick={
                            isEstimateCreated(enquiryStatuses)
                                ? openEstimatePage
                                : handleCreateEstimate
                        }
                        disabled={eventSaving || estimateLoading || isDeletingOrCloning}
                    >
                        {eventSaving ? (
                            "Creating Estimate..."
                        ) : isEstimateCreated(enquiryStatuses) ? (
                            <>
                                <ExternalLinkIcon size={16} />
                                <span>View Estimate</span>
                            </>
                        ) : (
                            <>
                                <FilePlus2Icon size={16} /> <span>Create Estimate</span>
                            </>
                        )}
                    </Button>
                )}
            </ModalFooter>

            {/* ── Delete Confirmation Modal ──────────────────────────────── */}
            <ConfirmationModal
                open={deleteModalOpen}
                onClose={handleDeleteCancel}
                onConfirm={handleDeleteConfirm}
                title="Delete Enquiry"
                description={
                    enquiry
                        ? `Are you sure you want to delete "${enquiry.eventName || enquiry.client || "this enquiry"}"? This action cannot be undone.`
                        : undefined
                }
                confirmText={deleting ? "Deleting..." : "Delete"}
                cancelText="Cancel"
                isLoading={deleting}
            />
        </Modal>
    );
}
