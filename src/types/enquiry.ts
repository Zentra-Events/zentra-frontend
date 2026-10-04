export interface EnquiryFormData {
    id?: string | number; // Optional for create, required for edit
    status?: string; // Enum: OPEN, CLOSED, etc.
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
    eventPoCNumber?: string;
    eventPoC?: string;
    enquiryPoC?: string;
    assignedTo?: string;
    client: string; // Client ID
    clientName?: string; // For new client creation upon submit
    eventType?: "PERSONAL" | "CORPORATE" | "OTHER";
}

export interface Enquiry {
    id: number | string;
    eventID?: string;
    client: string;
    clientName?: string;
    date: string;
    poc: string;
    status: string;
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
    location?: string;
    title?: string;
    clientPoC?: string;
    clientID?: string;
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
