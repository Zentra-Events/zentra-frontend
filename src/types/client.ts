export type ClientType = "CORPORATE" | "PERSONAL" | "OTHER";

export interface ClientFormData {
    name: string;
    email: string;
    phone: string;
    address: string;
    poc: string;
    gst: string;
    pan: string;
    gstCertificate: string;
    clientType: ClientType;
}

export interface Client extends ClientFormData {
    id: string;
}
