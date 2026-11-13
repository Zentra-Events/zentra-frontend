export interface Checklist {
    id: string;
    eventName: string;
    enquiryDate: string;
    clientPoc: string;
    status: "In Progress" | "Not Started" | "Completed" | string;
    gst?: string;
    items?: ChecklistItem[];
}

export interface ChecklistItem {
    id: string;
    title: string;
    completed: boolean;
}

export interface ChecklistFormData extends Omit<Checklist, "id"> {
    id?: string | number;
}

export interface EventItem {
    id: string;
    eventID: string;
    title: string;
    enquiryDate?: string;
    eventStartDate?: string;
    eventEndDate?: string;
    location?: string;
    venue?: string;
    status?: string;
    gst?: number;
    client?: string;
}

export interface EventChecklistItem {
    item: string;
    inventoryID?: string | number;
    startDate?: string | null;
    endDate?: string | null;
    quantity?: number;
    pricePerItem?: number;
    deadlineDate?: string | null;
    itemStatus?: boolean;
    finalAmt?: number;
    category?: string;
    status?: string;
    unit?: string;
    subCategory?: string;
    description?: string;
    vendor?: string;
    days?: number;
}

export interface EventDetails extends EventItem {
    checklistAssignedTo?: string | null;
    items?: EventChecklistItem[];
    checklist?: EventChecklistItem[];
}
