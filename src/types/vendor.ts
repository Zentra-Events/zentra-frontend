export interface VendorItem {
    item: string;
    count: number;
    pricePerItem: number;
    description?: string;
}

export interface Vendor {
    id?: string;
    name: string;
    billingAddress: string;
    gst: number;
    tds: number;
    gstCertificate?: string;
    phone: string;
    items?: VendorItem[];
}

export interface VendorFormData {
    id?: string;
    name: string;
    billingAddress: string;
    gst: number | string;
    tds: number | string;
    gstCertificate: string;
    phone: string;
    items?: VendorItem[];
}

export interface CreateVendorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    mode?: "create" | "edit";
    vendor?: Vendor | null;
}
