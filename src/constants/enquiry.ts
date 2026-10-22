// Enquiry domain constants — single source of truth for status / priority.
// Reuses Badge variants; labels always rendered alongside colour for a11y.

export type EnquiryStatusValue = "OPEN" | "IN_PROGRESS" | "CLOSED" | "ENQUIRY_CREATED" | string;
export type EnquiryPriorityValue = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

/** Status every newly created enquiry starts with on the new pipeline. */
export const DEFAULT_ENQUIRY_STATUS = "NEW_LEAD";

export const ENQUIRY_STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: "OPEN", label: "Open" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "CLOSED", label: "Closed" },
];

export const ENQUIRY_STATUS_LABELS: Record<string, string> = {
    OPEN: "Open",
    NEW: "Open",
    ENQUIRY_CREATED: "Open",
    IN_PROGRESS: "In Progress",
    PENDING: "In Progress",
    CLOSED: "Closed",
    COMPLETED: "Closed",
    CONVERTED: "Converted",
    CANCELLED: "Cancelled",
    REJECTED: "Rejected",
    LOST: "Lost",
};

export function getEnquiryStatusVariant(
    status?: string | null,
): "default" | "success" | "warning" | "danger" | "info" {
    const s = (status || "").toUpperCase();
    if (s === "OPEN" || s === "NEW" || s === "ENQUIRY_CREATED") return "info";
    if (s === "IN_PROGRESS" || s === "PENDING") return "warning";
    if (s === "CLOSED" || s === "COMPLETED" || s === "CONVERTED") return "success";
    if (s === "CANCELLED" || s === "REJECTED" || s === "LOST") return "danger";
    return "default";
}

export function getEnquiryStatusLabel(status?: string | null): string {
    if (!status) return "—";
    const key = status.toUpperCase();
    if (ENQUIRY_STATUS_LABELS[key]) return ENQUIRY_STATUS_LABELS[key];
    return status.replace(/_/g, " ");
}

export const ENQUIRY_PRIORITY_OPTIONS: { value: EnquiryPriorityValue; label: string }[] = [
    { value: "LOW", label: "Low" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HIGH", label: "High" },
    { value: "URGENT", label: "Urgent" },
];

/** Normalises a backend priority value; returns undefined when absent/invalid. */
export function normalizeEnquiryPriority(
    value?: string | null,
): EnquiryPriorityValue | undefined {
    const upper = (value || "").trim().toUpperCase();
    return ENQUIRY_PRIORITY_OPTIONS.find(o => o.value === upper)?.value;
}

export function getPriorityVariant(
    priority?: string | null,
): "default" | "success" | "warning" | "danger" | "info" {
    const p = (priority || "").toUpperCase();
    if (p === "URGENT") return "danger";
    if (p === "HIGH") return "warning";
    if (p === "MEDIUM") return "info";
    if (p === "LOW") return "success";
    return "default";
}

export function getEventTypeVariant(
    type?: string | null,
): "default" | "success" | "warning" | "danger" | "info" {
    const t = (type || "").toUpperCase();
    if (t === "CORPORATE") return "info";
    if (t === "PERSONAL") return "success";
    return "default";
}
