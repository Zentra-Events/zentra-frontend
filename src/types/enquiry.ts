import type { EnquiryPriorityValue } from "@/constants/enquiry";

/**
 * A follow-up note stored on an enquiry.
 * Mirrors the backend payload: `{ userName, note, createdDate }`.
 */
export interface EnquiryNote {
    /** Name of the user who wrote the note. */
    userName: string;
    /** Note text. */
    note: string;
    /** ISO timestamp of when the note was created. */
    createdDate: string;
}

export interface EnquiryFormData {
    id?: string | number; // Optional for create, required for edit
    status?: string; // Legacy status — kept for the estimate / event flows
    ennquiryStatus?: string; // New enquiry pipeline status (NEW_LEAD, PROSPECT, ...)
    highlvelRequirement: string;
    title?: string;
    enquiryDate?: string;
    fromDate?: string;
    toDate?: string;
    venue: string;
    eventName?: string;
    location?: string;
    clientType?: "corporate" | "individual"; // deprecated in favor of eventType
    clientPoC: string;
    enquiryPoCNumber: string;
    alternateClientPoC?: string;
    alternateEnquiryPocNumber?: string;
    eventPoCNumber?: string;
    eventPoC?: string;
    enquiryPoC?: string;
    assignedTo?: string;
    priority?: EnquiryPriorityValue; // Enum: LOW, MEDIUM, HIGH, URGENT
    client: string; // Client ID
    clientName?: string; // For new client creation upon submit
    eventType?: "PERSONAL" | "CORPORATE" | "OTHER";
    /** Follow-up notes attached to the enquiry. */
    notes?: EnquiryNote[] | null;
}

export interface Enquiry {
    id: number | string;
    eventID?: string;
    client: string;
    clientName?: string;
    date: string;
    poc: string;
    /** Legacy status — untouched, still drives the estimate / event flows. */
    status: string;
    /** New enquiry pipeline status used by the detail page tracker / dropdown. */
    ennquiryStatus?: string | null;
    assignee: string;
    assignedTo?: string;
    highlvelRequirement?: string;
    enquiryDate?: string;
    fromDate?: string;
    toDate?: string;
    venue?: string;
    enquiryPoCNumber?: string;
    eventType?: "PERSONAL" | "CORPORATE" | "OTHER";
    eventName?: string;
    enquiryPoC?: string;
    eventPoC?: string;
    eventPoCNumber?: string;
    alternateClientPoC?: string;
    alternateEnquiryPocNumber?: string;
    location?: string;
    title?: string;
    clientPoC?: string;
    clientID?: string;
    priority?: string | null;
    /** Follow-up notes attached to the enquiry (source of truth for the timeline). */
    notes?: EnquiryNote[] | null;
}

export interface EnquiriesTableFiltersFormValues {
    search: string;
    status: string;
    sortBy: string;
    sortOrder: "asc" | "desc";
}

export interface CreateEnquiryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    editData?: EnquiryFormData | null; // Optional edit data
    mode?: "create" | "edit"; // Modal mode
    onSaveSuccess?: (enquiry: Enquiry) => void; // Called after successful creation with the created enquiry
}
