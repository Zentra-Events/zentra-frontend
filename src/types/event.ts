export interface ClientRef {
    id?: string;
    name?: string;
}

export interface VendorRef {
    id?: string;
    name?: string;
}

export interface EventItem {
    category?: string;
    item?: string;
    description?: string;
    count?: number;
    pricePerItem?: number;
    days?: number;
    vendor?: VendorRef;
    serialNumber?: number;
}

export interface AdditionalCost {
    item: string;
    amount: number;
    remarks: string;
}

export interface Event {
    id?: string;
    eventID?: string;
    title: string;
    enquiryDate?: string;
    eventStartDate: string;
    eventEndDate: string;
    location?: string;
    venue?: string;
    discounts?: number;
    status?: string;
    gst?: number;
    tds?: number;
    serviceCharge?: number;
    advanceAmt?: number;
    client: ClientRef;
    address?: string;
    pan?: string;
    items?: EventItem[];
    additionalCostEstimate?: AdditionalCost[];
}

export interface EstimateDropdownItem {
    id: string;
    name: string;
    version: string;
}

export interface EstimateEventDetails {
    id: string;
    enquiryId: string;
    title: string;
    eventName?: string;
    fromDate: string;
    toDate: string;
    location?: string;
    venue?: string;
    status?: string;
    client?: string;
    vendor?: unknown[];
    items?: unknown[];
    clientID?: string;
}

export interface EventFormData {
    id?: string;
    title: string;
    eventName?: string; // For backward compatibility with backend responses
    enquiryDate?: string;
    eventStartDate: string;
    eventEndDate: string;
    location?: string;
    venue?: string;
    status?: string;
    clientId?: string;
    client?: string;
    estimateId?: string;
    enquiryId?: string;
    additionalCostEstimate?: AdditionalCost[];
}

export interface CreateEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    editData?: EventFormData | null;
    prefillData?: Partial<EventFormData> | null;
    mode?: "create" | "edit";
}

export interface CalendarEvent {
    id: string;
    title: string;
    date: string;
    client?: string;
    location?: string;
    status?: "open" | "completed" | "cancelled" | "closed";
    asignee?: string;
    currentTask?: string;
}

export type VendorSummary = {
    vendor: string;
    totalAmount: number;
    advanceAmount: number;
    gst?: number;
    gstType?: string;
    tds?: number;
    adjustedAmt?: number;
    balance: number;
    changeSummary?: string;
};

export type EventResponse = {
    id?: string;
    eventID?: string;
    title?: string;
    eventStartDate?: string;
    eventEndDate?: string;
    location?: string;
    venue?: string;
    status?: string;
    gst?: number;
    gstType?: string;
    tds?: number;
    advanceAmt?: number;
    serviceCharge?: number;
    discounts?: number;
    billingAddress?: string;
    pan?: string;
    highlvelRequirement?: string;
    additionalCostEstimate?: AdditionalCost[];
    checklist?: unknown[];
    checkListCompleted: boolean;
    invoiceSummary?: {
        discountAmount?: number;
        serviceChargeAmt?: number;
        additionalCostAmt?: number;
        expensesTotal?: number;
        gstAmount?: number;
        netTotal?: number;
    };
    client?: string;
    clientID?: string;
    items?: Array<{
        item?: string;
        description?: string;
        count?: number;
        pricePerItem?: number;
        vendor?: string;
        days?: number;
        serialNumber?: number;
    }>;
    categorySummary?: Array<{
        category?: string;
        gst?: number;
        tds?: number;
        totalAmount?: number;
        advanceAmount?: number;
        adjustedAmt?: number;
        balance?: number;
    }>;
    vendorSummary?: Array<VendorSummary>;
    purchaseOrders?: Array<{
        vendor?: string;
        items?: Array<{
            item?: string;
            description?: string;
            count?: number;
            pricePerItem?: number;
            vendor?: string;
            days?: number;
            serialNumber?: number;
        }>;
        gst?: number;
        tds?: number;
        totalAmount?: number;
        advanceAmount?: number;
        adjustedAmt?: number;
        balance?: number;
    }>;
    estimateId?: string;
    enquiryId?: string;
    [key: string]: unknown;
};

export interface PurchaseOrderPreviewModalProps {
    eventData: EventResponse;
    eventName?: string;
    vendorList?: Array<{ id?: string; name: string }>;
    inventoryList?: Array<{ id?: string; name: string }>;
    onClose: () => void;
    totalEstimatedCost: number;
}

/** A group of purchase items sharing the same sub-category within a category. */
export interface PurchaseSubCategoryRow {
    name: string;
    items: PurchaseItemRow[];
}

export interface CategoryPurchaseRow {
    category: string;
    /** Flat list of all items in this category (direct items then sub-category items). */
    items: PurchaseItemRow[];
    /** Items without a sub-category. */
    directItems: PurchaseItemRow[];
    /** Items grouped under their respective sub-category headers. */
    subCategories: PurchaseSubCategoryRow[];
    subtotal: number;
}

export interface PurchaseItemRow {
    serial: number;
    itemName: string;
    description: string;
    qty: number;
    unit?: string;
    rate: number;
    days: number;
    amount: number;
    gstAmount: number;
    tdsAmount: number;
    netTotal: number;
    vendorName: string;
    vendorId?: string;
}

/** Vendor summary for the per-vendor financial table */
export interface VendorFinancialRow {
    vendorName: string;
    totalAmount: number;
    gstPercent: number;
    /** Tax type applied for this vendor. One of "NONE", "CGST_SGST", "IGST". */
    gstType?: string;
    tdsPercent: number;
    adjustedAmt: number;
    advanceAmount: number;
    balance: number;
}
