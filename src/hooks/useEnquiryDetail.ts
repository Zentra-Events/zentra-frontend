"use client";

import { useCallback, useEffect, useState } from "react";

import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { Enquiry } from "@/types/enquiry";

type WorkflowState = "" | "ESTIMATE_CREATED" | "EVENT_CREATED";

const PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

/** Normalises a backend priority value; returns null when absent/invalid. */
function normalizePriority(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const upper = value.trim().toUpperCase();
    return (PRIORITY_VALUES as readonly string[]).includes(upper) ? upper : null;
}

interface UseEnquiryDetailResult {
    enquiry: Enquiry | null;
    priority: string | null;
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
    workflowState: WorkflowState;
    workflowLoading: boolean;
    updateFields: (patch: Partial<Enquiry>) => Promise<boolean>;
    updating: boolean;
}

function extractEnquiry(payload: unknown): Enquiry | null {
    if (!payload || typeof payload !== "object") return null;
    const obj = payload as Record<string, unknown>;
    // Detail endpoint returns the object directly; accept common wrappers.
    const candidate =
        (obj.data as unknown) ?? (obj.enquiry as unknown) ?? (obj.content as unknown) ?? payload;
    if (candidate && typeof candidate === "object" && ("id" in (candidate as object) || "eventName" in (candidate as object))) {
        return candidate as Enquiry;
    }
    return null;
}

/** Pulls the `priority` field out of an event/enquiry payload (handles wrappers). */
function extractPriority(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null;
    const obj = payload as Record<string, unknown>;
    const candidates: unknown[] = [
        payload,
        obj.data,
        obj.event,
        obj.enquiry,
        obj.content,
    ];
    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== "object") continue;
        const value = normalizePriority((candidate as Record<string, unknown>).priority);
        if (value) return value;
    }
    return null;
}

/**
 * Pulls the new pipeline status (`ennquiryStatus`) out of a payload.
 * The field may sit next to the enquiry or inside one of the usual wrappers.
 */
function extractEnquiryStatus(payload: unknown): string | null {
    if (!payload || typeof payload !== "object") return null;
    const obj = payload as Record<string, unknown>;
    const candidates: unknown[] = [
        payload,
        obj.data,
        obj.enquiry,
        obj.content,
        obj.event,
    ];
    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== "object") continue;
        const value = (candidate as Record<string, unknown>).ennquiryStatus;
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return null;
}

/**
 * Route-level data orchestration for the enquiry detail page.
 * Single fetch per id; field updates POST the full object (same contract as
 * CreateEnquiryModal) because the backend has no PATCH endpoint yet.
 */
export function useEnquiryDetail(id: string | undefined): UseEnquiryDetailResult {
    const [enquiry, setEnquiry] = useState<Enquiry | null>(null);
    const [priority, setPriority] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [workflowState, setWorkflowState] = useState<WorkflowState>("");
    const [workflowLoading, setWorkflowLoading] = useState(false);
    const [updating, setUpdating] = useState(false);

    const fetchDetail = useCallback(async () => {
        if (!id) {
            setLoading(false);
            setError("Missing enquiry id");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await apiRequest(API_ENDPOINTS.enquiries.detail(id), { method: "GET" });
            if (!res.ok) {
                if (res.status === 404) throw new Error("Enquiry not found");
                throw new Error(`Failed to load enquiry (${res.status})`);
            }
            const body = await res.json().catch(() => null);
            const parsed = extractEnquiry(body);
            if (!parsed) throw new Error("Enquiry not found");
            // The new pipeline status can live outside the enquiry object,
            // so it is read separately and merged back onto the enquiry.
            const enquiryStatus = extractEnquiryStatus(body);
            setEnquiry(enquiryStatus ? { ...parsed, ennquiryStatus: enquiryStatus } : parsed);
            // Priority is read from the event detail API (see workflow effect below);
            // the enquiry payload is only a fallback for enquiries without an event.
            setPriority(extractPriority(body));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load enquiry");
            setEnquiry(null);
            setPriority(null);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        void fetchDetail();
    }, [fetchDetail]);

    // Workflow derivation mirrors EnquiryViewModal: event wins over estimate.
    useEffect(() => {
        if (!enquiry) return;
        let cancelled = false;
        const check = async () => {
            setWorkflowLoading(true);
            try {
                try {
                    const eventRes = await apiRequest(
                        API_ENDPOINTS.events.detail(enquiry.eventID || enquiry.id),
                        { method: "GET" },
                    );
                    if (!cancelled && eventRes.ok) {
                        setWorkflowState("EVENT_CREATED");
                        // Priority is served by the event detail API.
                        const eventBody = await eventRes.json().catch(() => null);
                        const eventPriority = extractPriority(eventBody);
                        if (!cancelled && eventPriority) setPriority(eventPriority);
                        return;
                    }
                } catch {
                    // fall through to estimate check
                }
                try {
                    const estRes = await apiRequest(API_ENDPOINTS.estimates.byEnquiry(enquiry.id), {
                        method: "GET",
                    });
                    const body = await estRes.json().catch(() => null);
                    if (!cancelled) {
                        setWorkflowState(
                            body?.estimates?.length > 0 ? "ESTIMATE_CREATED" : "",
                        );
                    }
                } catch {
                    if (!cancelled) setWorkflowState("");
                }
            } finally {
                if (!cancelled) setWorkflowLoading(false);
            }
        };
        void check();
        return () => {
            cancelled = true;
        };
    }, [enquiry?.id, enquiry?.eventID]);

    const updateFields = useCallback(
        async (patch: Partial<Enquiry>): Promise<boolean> => {
            if (!enquiry) return false;
            setUpdating(true);
            try {
                // Full-object POST — identical contract to the edit modal.
                const body = { ...enquiry, ...patch, id: enquiry.id };
                const res = await apiRequest(API_ENDPOINTS.enquiries.list, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                });
                if (!res.ok) throw new Error(`Update failed (${res.status})`);
                setEnquiry(prev => (prev ? { ...prev, ...patch } : prev));
                // Keep the priority state in sync so every priority control
                // (topbar, side panel) reflects the persisted value.
                const nextPriority = normalizePriority(patch.priority);
                if (nextPriority) setPriority(nextPriority);
                return true;
            } catch {
                return false;
            } finally {
                setUpdating(false);
            }
        },
        [enquiry],
    );

    const refresh = useCallback(async () => {
        await fetchDetail();
    }, [fetchDetail]);

    return { enquiry, priority, loading, error, refresh, workflowState, workflowLoading, updateFields, updating };
}
