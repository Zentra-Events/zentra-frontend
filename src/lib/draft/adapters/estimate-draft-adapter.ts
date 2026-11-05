/**
 * Estimate-specific draft adapter.
 *
 * This is Layer B: it knows about estimate forms, payloads, and the estimate
 * API, but delegates all persistence, auto-save, recovery, protection, and
 * cleanup to the generic infrastructure in Layer A.
 */

import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { fetchEstimateById } from "@/lib/api/estimate";
import { calculateEstimateSummary } from "@/lib/utils/estimate";
import type {
    DraftAdapter,
    DraftIdentity,
    DraftMetadata,
    RecoveryInfo,
} from "../types";
import type {
    CreateEstimatePayload,
    EstimateDto,
    EstimateStatus,
    EstimateLineItemPayload,
    InvoiceSummary,
} from "@/types/estimate";

export interface EstimateDraftFormData {
    title: string;
    highlvelRequirement: string;
    enquiryDate: string | null;
    fromDate: string | null;
    toDate: string | null;
    status: EstimateStatus;
    location: string;
    venue: string;
    clientPoC: string;
    pocContactNumber: string;
    enquiryPoC: string;
    serviceCharge: number;
    gst: number;
    gstType: string;
    discountAmount: number;
    billingAddress: string;
    client: string;
    clientID?: string;
    enquiryId: string;
    eventID?: string;
    lines: EstimateDraftLine[];
}

export interface EstimateDraftLine {
    id: string;
    category: string;
    subCategory: string;
    item: string;
    specification: string;
    days: number;
    sqft: number;
    rate: number;
    vendor: string;
    unit: string;
}

interface DraftContext {
    entityId?: string;
    enquiryId?: string;
    eventId?: string;
}

function draftKey(context: DraftContext): string {
    if (context.entityId) return `edit:${context.entityId}`;
    if (context.enquiryId) return `new:${context.enquiryId}`;
    return `new:${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
}

function objectHash(value: unknown): string {
    let str = "";
    try {
        str = JSON.stringify(value);
    } catch {
        str = String(value);
    }
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
    }
    return String(hash);
}

export { objectHash };

function buildPayload(formData: EstimateDraftFormData): CreateEstimatePayload {
    const discountAmount = Number(formData.discountAmount) || 0;
    const totalAmount = formData.lines.reduce(
        (sum, line) => sum + line.days * line.sqft * line.rate,
        0,
    );
    const summary = calculateEstimateSummary({
        totalAmount,
        gst: Number(formData.gst) || 0,
        serviceCharge: Number(formData.serviceCharge) || 0,
        discounts: discountAmount,
    });
    const invoiceSummary: InvoiceSummary = {
        discountAmount,
        serviceChargeAmt: Number(summary.serviceChargeAmount.toFixed(2)),
        additionalCostAmt: 0,
        expensesTotal: Number(totalAmount.toFixed(2)),
        gstAmount: Number(summary.gstAmount.toFixed(2)),
        netTotal: Number(summary.totalWithGST.toFixed(2)),
    };

    const items: Record<string, EstimateLineItemPayload[]> = {};
    for (const line of formData.lines) {
        const category = line.category?.trim() || "General";
        const serialNumber =
            (items[category]?.length ?? 0) + 1;
        const total = Number((line.days * line.sqft * line.rate).toFixed(2));
        (items[category] ??= []).push({
            item: line.item,
            serialNumber,
            quantity: line.sqft,
            pricePerItem: line.rate,
            finalAmt: total,
            description: line.specification || line.item,
            vendor: line.vendor || "",
            days: line.days,
            category,
            subCategory: line.subCategory || "",
            unit: line.unit || "nos",
        });
    }

    return {
        title: formData.title,
        highlvelRequirement: formData.highlvelRequirement,
        enquiryDate: formData.enquiryDate,
        fromDate: formData.fromDate,
        toDate: formData.toDate,
        status: formData.status,
        location: formData.location || undefined,
        venue: formData.venue,
        clientPoC: formData.clientPoC,
        pocContactNumber: formData.pocContactNumber,
        enquiryPoC: formData.enquiryPoC || undefined,
        client: formData.client,
        clientID: formData.clientID,
        items,
        enquiryId: formData.enquiryId,
        eventName: formData.title || undefined,
        eventID: formData.eventID || undefined,
        gst: formData.gst,
        gstType: formData.gstType || undefined,
        serviceCharge: formData.serviceCharge,
        discounts: discountAmount,
        billingAddress: formData.billingAddress || undefined,
        estimateStatus: "DRAFT",
        invoiceSummary,
    };
}

export const estimateDraftAdapter: DraftAdapter<EstimateDraftFormData, EstimateDto> = {
    entityType: "estimate",

    getIdentity(context: DraftContext): DraftIdentity {
        const key = draftKey(context);
        const draftId = `estimate:${key}`;
        return {
            entityType: "estimate",
            entityId: context.entityId ?? key,
            draftId,
            enquiryId: context.enquiryId,
            eventId: context.eventId,
        };
    },

    serialize(formData: EstimateDraftFormData): EstimateDraftFormData {
        return {
            ...formData,
            lines: formData.lines.map(line => ({
                ...line,
                days: Number.isFinite(line.days) ? line.days : 1,
                sqft: Number.isFinite(line.sqft) ? line.sqft : 1,
                rate: Number.isFinite(line.rate) ? line.rate : 0,
            })),
        };
    },

    restore(stored: EstimateDraftFormData): EstimateDraftFormData {
        return {
            ...stored,
            lines: (stored.lines ?? []).map(line => ({
                id: line.id,
                category: line.category || "General",
                subCategory: line.subCategory || "",
                item: line.item || "Item",
                specification: line.specification || "",
                days: Number.isFinite(line.days) && line.days > 0 ? line.days : 1,
                sqft: Number.isFinite(line.sqft) && line.sqft > 0 ? line.sqft : 1,
                rate: Number.isFinite(line.rate) ? line.rate : 0,
                vendor: line.vendor || "",
                unit: line.unit || "nos",
            })),
        };
    },

    async loadServerData(identity: DraftIdentity): Promise<EstimateDto | null> {
        if (!identity.entityId || identity.entityId.startsWith("new:")) return null;
        try {
            return await fetchEstimateById(identity.entityId);
        } catch {
            return null;
        }
    },

    async saveToServer(formData: EstimateDraftFormData): Promise<EstimateDto | null> {
        const payload = buildPayload(formData);
        const res = await apiRequest(API_ENDPOINTS.estimates.list, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) return null;
        const text = await res.text();
        try {
            return JSON.parse(text) as EstimateDto;
        } catch {
            return null;
        }
    },

    compare(localFormData: EstimateDraftFormData, serverData: EstimateDto | null) {
        const localHash = objectHash({
            title: localFormData.title,
            highlvelRequirement: localFormData.highlvelRequirement,
            venue: localFormData.venue,
            lines: localFormData.lines,
            gst: localFormData.gst,
            serviceCharge: localFormData.serviceCharge,
            discounts: localFormData.discountAmount,
        });

        if (!serverData) {
            return {
                relation: "local-newer",
                server: null,
                serverRevision: undefined,
            };
        }

        const serverHash = objectHash({
            title: serverData.title,
            highlvelRequirement: serverData.highlvelRequirement,
            venue: serverData.venue,
            items: serverData.items,
            gst: serverData.gst,
            serviceCharge: serverData.serviceCharge,
            discounts: serverData.discounts,
        });

        const serverUpdated = new Date(
            serverData.updatedAt || serverData.createdAt || 0,
        ).getTime();

        if (serverHash === localHash) {
            return {
                relation: "identical",
                server: serverData,
                serverRevision: serverData.version || serverData.id,
            };
        }
        if (serverUpdated > Date.now()) {
            return {
                relation: "server-newer",
                server: serverData,
                serverRevision: serverData.version || serverData.id,
            };
        }
        return {
            relation: "local-newer",
            server: serverData,
            serverRevision: serverData.version || serverData.id,
        };
    },

    getDraftLabel(formData: EstimateDraftFormData): string {
        return formData.title || formData.highlvelRequirement || "Untitled Estimate";
    },

    getRecoveryInfo(
        formData: EstimateDraftFormData,
        metadata: DraftMetadata,
    ): RecoveryInfo {
        const date = new Date(metadata.lastModifiedAt).toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
        return {
            title: formData.title || "Untitled Estimate",
            subtitle: formData.enquiryId ? `Enquiry ${formData.enquiryId}` : undefined,
            lastModified: date,
            entityId: metadata.entityId,
            enquiryId: formData.enquiryId,
            eventId: formData.eventID,
        };
    },
};

export function estimateDraftIdentity(context: {
    entityId?: string;
    enquiryId?: string;
    eventId?: string;
}): DraftIdentity {
    return estimateDraftAdapter.getIdentity(context);
}
