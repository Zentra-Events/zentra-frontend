"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Formik, Form, FormikHelpers } from "formik";
import * as Yup from "yup";
import { Button } from "@/components/ui/button";
import { FormikFieldInput } from "@/components/ui/formik-field-input";
import { FormikFieldTextArea } from "@/components/ui/formik-field-textarea";
import { FormikFieldDatePicker } from "@/components/ui/formik-field-date-picker";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Label } from "@/components/ui-old/label";
import { toast } from "sonner";
import {
    CreateEstimatePayload,
    EstimateDto,
    EstimateItem,
    EstimateLineItemPayload,
    EstimateStatus,
    InvoiceSummary,
} from "@/types/estimate";
import { EventItem } from "@/types/event";
import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { calculateEstimateSummary } from "@/lib/utils/estimate";
import { groupLinesByCategory } from "@/lib/utils/artifact-utils";
import { groupEventItemsByCategory } from "@/lib/utils/estimate-comparison";
import AdditionalEstimateConfirmationModal from "@/components/ui/additional-estimate-confirmation-modal";
import { Select, FormikFieldSelect } from "./ui";
import { eventStatus } from "@/constants/event";
import { ArtifactsSection } from "@/components/artifacts-section";
import { CostSummary } from "@/components/cost-summary";
import type { ArtifactLine } from "@/lib/utils/artifact-utils";
import { isPersistableArtifactLine } from "@/lib/utils/artifact-utils";

type EstimateLine = {
    id: string;
    category: string;
    subCategory: string;
    item: string;
    specification: string;
    days: number;
    sqft: number;
    rate: number;
    vendor: string;
    unit?: string;
};

type ClientEnquirySummary = {
    clientId: string;
    clientName: string;
    enquiries: Array<{ enquiryId: string; title: string }>;
};

const GST_TYPE_OPTIONS: { label: string; value: string }[] = [
    { label: "No GST", value: "NONE" },
    { label: "CGST + SGST", value: "CGST_SGST" },
    { label: "IGST", value: "IGST" },
];

const GST_LABEL_BY_TYPE: Record<string, string> = {
    NONE: "GST",
    CGST_SGST: "CGST + SGST",
    IGST: "IGST",
};

const composeSelectionKey = (clientName: string, title: string) => {
    return `${clientName.trim().toLowerCase()}::${title.trim().toLowerCase()}`;
};

const findFirstArray = (input: unknown): unknown[] | null => {
    if (Array.isArray(input)) return input;
    if (input && typeof input === "object") {
        for (const value of Object.values(input as Record<string, unknown>)) {
            const found = findFirstArray(value);
            if (found) return found;
        }
    }
    return null;
};

const normaliseClientSummaryPayload = (payload: unknown): ClientEnquirySummary[] => {
    const list = findFirstArray(payload) ?? [];

    return list
        .map(entry => {
            if (!entry || typeof entry !== "object") return null;
            const item = entry as Record<string, unknown>;

            const clientId = (() => {
                if (typeof item.clientId === "string" && item.clientId.trim())
                    return item.clientId.trim();
                return undefined;
            })();

            const clientName = (() => {
                if (typeof item.clientName === "string" && item.clientName.trim())
                    return item.clientName.trim();
                if (typeof item.client === "string" && item.client.trim())
                    return item.client.trim();
                return undefined;
            })();

            if (!clientId || !clientName) return null;

            const enquiries = (() => {
                const raw = item.enquiries;
                if (!Array.isArray(raw)) return [];
                return raw
                    .map(enquiry => {
                        if (!enquiry || typeof enquiry !== "object") return null;
                        const enq = enquiry as Record<string, unknown>;
                        const enquiryId = (() => {
                            if (typeof enq.enquiryId === "string" && enq.enquiryId.trim())
                                return enq.enquiryId.trim();
                            if (typeof enq.id === "string" && enq.id.trim()) return enq.id.trim();
                            return undefined;
                        })();
                        const title = (() => {
                            if (typeof enq.title === "string" && enq.title.trim())
                                return enq.title.trim();
                            return undefined;
                        })();
                        if (!enquiryId || !title) return null;
                        return { enquiryId, title };
                    })
                    .filter((e): e is { enquiryId: string; title: string } => e !== null);
            })();

            if (enquiries.length === 0) return null;

            return { clientId, clientName, enquiries };
        })
        .filter((e): e is ClientEnquirySummary => e !== null)
        .sort((a, b) =>
            a.clientName.localeCompare(b.clientName, undefined, { sensitivity: "base" }),
        );
};
// };

const generateId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `id-${Math.random().toString(36).slice(2, 10)}`;
};

interface CreateEstimateModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Partial<EstimateDto> & { enquiryId?: string };
    isAdditionalEstimate?: boolean;
    onSaved: (estimate: EstimateDto) => void;
}

const validationSchema = Yup.object({
    title: Yup.string().required("Event title is required"),
    highlvelRequirement: Yup.string().required("Please add the enquiry summary"),
    location: Yup.string().optional(),
    venue: Yup.string().required("Venue is required"),
    pocContactNumber: Yup.string()
        // .matches(/^\d{10}$/u, "Enter a 10 digit number")
        .required("POC contact number is required"),
    enquiryPoC: Yup.string().optional(),
    status: Yup.mixed<EstimateStatus>()
        .oneOf(eventStatus.map(s => s.value))
        .required(),
    serviceCharge: Yup.number().optional().min(0, "Service charge must be 0 or more"),
    gst: Yup.number().optional().min(0, "GST must be 0 or more"),
    gstType: Yup.string().optional(),
    discountAmount: Yup.number().optional().min(0, "Discount amount must be 0 or more"),
    billingAddress: Yup.string().optional(),
});

function normalizeDate(value?: string | null) {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

function formatDateOutput(date: Date | null) {
    if (!date) return undefined;
    return date.toISOString().replace(/Z$/u, "");
}

export default function CreateEstimateModal({
    isOpen,
    onClose,
    initialData,
    onSaved,
    isAdditionalEstimate = false,
}: CreateEstimateModalProps) {
    const [prefillData, setPrefillData] = useState<
        (Partial<EstimateDto> & { enquiryId?: string }) | undefined
    >(initialData);
    const [selectedClientId, setSelectedClientId] = useState(initialData?.client ?? "");
    const [selectedEnquiryId, setSelectedEnquiryId] = useState<string | undefined>(
        initialData?.enquiryId,
    );
    const [clientSummaries, setClientSummaries] = useState<ClientEnquirySummary[]>([]);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [isFetchingEnquiry, setIsFetchingEnquiry] = useState(false);
    const [lines, setLines] = useState<EstimateLine[]>([]);
    const [invalidLineIds, setInvalidLineIds] = useState<Set<string>>(new Set());
    const [isSaving, setIsSaving] = useState(false);
    const [existingEventItems, setExistingEventItems] = useState<EventItem[]>([]);
    const [isFetchingEventItems, setIsFetchingEventItems] = useState(false);
    const [eventItemsError, setEventItemsError] = useState<string | null>(null);
    const [pendingAdditionalEstimate, setPendingAdditionalEstimate] = useState<{
        payload: CreateEstimatePayload;
        uiItemsForFallback: Record<string, EstimateItem[]>;
        lines: ArtifactLine[];
    } | null>(null);
    const [isAdditionalConfirmationOpen, setIsAdditionalConfirmationOpen] = useState(false);
    const selectionRef = useRef<{ clientName?: string; title?: string } | null>(
        initialData ? { clientName: initialData.client, title: initialData.title } : null,
    );
    const requestRef = useRef(0);
    const enquiryPrefillCache = useRef(
        new Map<
            string,
            { prefill: (Partial<EstimateDto> & { enquiryId?: string }) | undefined; id?: string }
        >(),
    );

    useEffect(() => {
        setPrefillData(initialData);
        setSelectedEnquiryId(initialData?.enquiryId);
        setSelectedClientId(initialData?.client ?? "");
        if (initialData?.client || initialData?.enquiryId) {
            selectionRef.current = {
                clientName: initialData?.client ?? undefined,
                title: initialData?.title ?? undefined,
            };
        } else {
            selectionRef.current = null;
        }
    }, [initialData]);

    useEffect(() => {
        if (initialData?.client && initialData.title) {
            const key = composeSelectionKey(initialData.client, initialData.title);
            enquiryPrefillCache.current.set(key, {
                prefill: initialData,
                id: initialData.enquiryId,
            });
        }
    }, [initialData]);

    useEffect(() => {
        if (!isOpen) return;

        let cancelled = false;
        const loadSummaries = async () => {
            setSummaryLoading(true);
            setSummaryError(null);
            try {
                const res = await apiRequest(API_ENDPOINTS.enquiries.clientSummary);
                if (!res.ok) {
                    throw new Error(`Unable to load enquiry summary. (${res.status})`);
                }
                const contentType = res.headers.get("content-type") ?? "";
                const text = await res.text();
                let parsed: unknown;
                if (contentType.includes("application/json")) {
                    parsed = text ? JSON.parse(text) : null;
                } else {
                    try {
                        parsed = text ? JSON.parse(text) : null;
                    } catch {
                        parsed = null;
                    }
                }

                if (cancelled) return;
                const summaries = normaliseClientSummaryPayload(parsed);
                setClientSummaries(summaries);
            } catch (error) {
                console.error("Failed to load client enquiry summary", error);
                if (!cancelled) {
                    setSummaryError(
                        error instanceof Error ? error.message : "Unable to load enquiries summary",
                    );
                    setClientSummaries([]);
                }
            } finally {
                if (!cancelled) {
                    setSummaryLoading(false);
                }
            }
        };

        void loadSummaries();

        return () => {
            cancelled = true;
        };
    }, [isOpen]);

    const mapEnquiryToPrefill = useCallback(
        (
            record: Record<string, unknown> | null | undefined,
            fallback?: { id?: string; clientId?: string; clientName?: string; title?: string },
        ) => {
            if (!record) return undefined;

            const pick = <T,>(keys: string[]): T | undefined => {
                for (const key of keys) {
                    const value = record[key];
                    if (value !== undefined && value !== null) {
                        return value as T;
                    }
                }
                return undefined;
            };

            const persistedId = (() => {
                const raw = pick<string | number>(["id", "enquiryId", "enquiry_id"]);
                if (raw !== undefined && raw !== null) return String(raw);
                if (fallback?.id) return String(fallback.id);
                return undefined;
            })();

            const savedClient = pick<unknown>(["client"]);
            let normalisedClient: EstimateDto["client"] | undefined;
            if (savedClient && typeof savedClient === "object") {
                const clientRecord = savedClient as { id?: string | number; name?: string };
                if (clientRecord.id || clientRecord.name) {
                    normalisedClient = clientRecord.name;
                }
            } else if (typeof savedClient === "string") {
                normalisedClient = savedClient;
            }

            if (!normalisedClient) {
                if (fallback?.clientId && fallback?.clientName) {
                    normalisedClient = fallback.clientName;
                } else if (fallback?.clientName) {
                    normalisedClient = fallback.clientName;
                }
            }

            const toNumber = (value: unknown): number | undefined => {
                if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
                if (typeof value === "string" && value.trim() !== "") {
                    const parsed = Number(value);
                    return Number.isFinite(parsed) ? parsed : undefined;
                }
                return undefined;
            };

            const rawItems = pick<Record<string, unknown>>(["items"]);
            const cleanedItems =
                rawItems && typeof rawItems === "object"
                    ? Object.entries(rawItems as Record<string, unknown>).reduce<
                          Record<string, EstimateItem[]>
                      >((acc, [category, entries]) => {
                          if (!Array.isArray(entries)) return acc;
                          acc[category] = entries.map((item, index) => {
                              const content = item as Record<string, unknown>;
                              const identifier = content.id ?? `${category}-${index}`;
                              const description =
                                  typeof content.description === "string"
                                      ? content.description
                                      : typeof content.item === "string"
                                        ? content.item
                                        : "Line item";
                              const specification =
                                  typeof content.specification === "string"
                                      ? content.specification
                                      : undefined;
                              const rawDays =
                                  toNumber(content.days) ?? toNumber(content.duration) ?? 1;
                              const rawSqft =
                                  toNumber(content.sqft) ?? toNumber(content.quantity) ?? 1;
                              const rawRate =
                                  toNumber(content.rate) ?? toNumber(content.unitCost) ?? 0;
                              const rawQuantity = toNumber(content.quantity) ?? rawSqft ?? 1;
                              const rawUnitCost = toNumber(content.unitCost) ?? rawRate ?? 0;
                              const rawTotal = toNumber(content.total);

                              const safeDays =
                                  typeof rawDays === "number" &&
                                  Number.isFinite(rawDays) &&
                                  rawDays > 0
                                      ? rawDays
                                      : 1;
                              const safeSqft =
                                  typeof rawSqft === "number" &&
                                  Number.isFinite(rawSqft) &&
                                  rawSqft > 0
                                      ? rawSqft
                                      : 1;
                              const safeRate =
                                  typeof rawRate === "number" && Number.isFinite(rawRate)
                                      ? rawRate
                                      : 0;
                              const safeQuantity =
                                  typeof rawQuantity === "number" &&
                                  Number.isFinite(rawQuantity) &&
                                  rawQuantity > 0
                                      ? rawQuantity
                                      : safeSqft;
                              const safeUnitCost =
                                  typeof rawUnitCost === "number" && Number.isFinite(rawUnitCost)
                                      ? rawUnitCost
                                      : safeRate;
                              const safeTotal =
                                  typeof rawTotal === "number" && Number.isFinite(rawTotal)
                                      ? Number(rawTotal.toFixed(2))
                                      : Number((safeDays * safeSqft * safeRate).toFixed(2));

                              return {
                                  id: String(identifier),
                                  description,
                                  specification,
                                  days: safeDays,
                                  sqft: safeSqft,
                                  rate: safeRate,
                                  quantity: safeQuantity,
                                  unitCost: safeUnitCost,
                                  total: safeTotal,
                              };
                          });
                          return acc;
                      }, {})
                    : undefined;

            const rawStatus = pick<string>(["status", "enquiryStatus"]);
            const allowedStatuses: EstimateStatus[] = [
                "CHECKLIST_COMPLETED",
                "PROJECT_POSTONED",
                "PROJECT_COMPLETED",
                "ESTIMATE_UNDER_REVIEW",
                "PROJECT_SETTLEMENT_IN_PROGRESS",
                "PROJECT_INPROGRESS",
                "ESTIMATE_INPROGRESS",
                "ENQUIRY_CREATED",
                "ESTIMATE_APPROVED",
            ];
            const normalisedStatus = rawStatus ? rawStatus.toUpperCase() : undefined;
            const status =
                normalisedStatus && allowedStatuses.includes(normalisedStatus as EstimateStatus)
                    ? (normalisedStatus as EstimateStatus)
                    : "ENQUIRY_CREATED";

            return {
                enquiryId: persistedId,
                title:
                    pick<string>(["title", "eventName", "summary", "name", "eventTitle"]) ??
                    fallback?.title,
                highlvelRequirement:
                    pick<string>(["highlvelRequirement", "summary", "title", "description"]) ?? "",
                enquiryDate: pick<string>([
                    "enquiryDate",
                    "createdAt",
                    "created_date",
                    "createdDate",
                ]),
                fromDate: pick<string>(["fromDate", "eventStart", "startDate"]),
                toDate: pick<string>(["toDate", "eventEnd", "endDate"]),
                status,
                location: pick<string>(["location", "eventLocation", "city"]),
                venue: pick<string>(["venue", "eventVenue"]) ?? "",
                clientPoC: pick<string>(["clientPoC", "clientPoc", "clientPocName"]) ?? "",
                pocContactNumber:
                    pick<string>([
                        "enquiryPoCNumber",
                        "pocContactNumber",
                        "clientPhone",
                        "clientPocPhone",
                    ]) ?? "",
                enquiryPoC: pick<string>(["eventPoC", "enquiryPoC", "assignee", "owner"]),
                client: normalisedClient,
                items: cleanedItems,
            };
        },
        [],
    );

    const loadEnquiryForSelection = useCallback(
        async (enquiryId: string) => {
            if (!enquiryId) return;

            const cacheKey = composeSelectionKey(enquiryId, "");
            const cached = enquiryPrefillCache.current.get(cacheKey);
            if (cached?.prefill) {
                setPrefillData(cached.prefill);
                setSelectedEnquiryId(cached.prefill.enquiryId ?? cached.id);
                return;
            }

            requestRef.current += 1;
            const requestId = requestRef.current;
            setIsFetchingEnquiry(true);

            try {
                const response = await apiRequest(API_ENDPOINTS.enquiries.detail(enquiryId ?? ""));
                if (!response.ok) {
                    throw new Error(`Unable to load selected enquiry. (${response.status})`);
                }

                const contentType = response.headers.get("content-type") ?? "";
                const text = await response.text();
                let parsed: Record<string, unknown> | null = null;
                if (contentType.includes("application/json")) {
                    parsed = text ? JSON.parse(text) : null;
                } else {
                    try {
                        parsed = text ? JSON.parse(text) : null;
                    } catch {
                        parsed = null;
                    }
                }

                if (!parsed) {
                    throw new Error("No matching enquiry data returned for this selection.");
                }

                const fallbackId = (() => {
                    const coerce = (value: unknown): string | undefined => {
                        if (typeof value === "string" && value.trim() !== "") return value.trim();
                        if (typeof value === "number") return String(value);
                        if (value && typeof value === "object" && "$oid" in value) {
                            const oid = (value as { $oid?: unknown }).$oid;
                            if (typeof oid === "string" && oid.trim() !== "") return oid.trim();
                        }
                        return undefined;
                    };

                    const directKeys = ["id", "enquiryId", "enquiry_id", "identifier", "_id"];
                    for (const key of directKeys) {
                        if (parsed && key in parsed) {
                            const resolved = coerce((parsed as Record<string, unknown>)[key]);
                            if (resolved) return resolved;
                        }
                    }

                    if (parsed && typeof parsed === "object") {
                        const nested = coerce((parsed as Record<string, unknown>).id);
                        if (nested) return nested;
                    }

                    return undefined;
                })();

                const nextPrefill = mapEnquiryToPrefill(parsed, {
                    id: fallbackId,
                    clientId: selectedClientId,
                });
                if (!nextPrefill) {
                    throw new Error("Enquiry response did not contain usable details.");
                }

                const currentSelection = selectionRef.current;
                if (!currentSelection || requestRef.current !== requestId) {
                    return;
                }

                const resolvedId = nextPrefill.enquiryId ?? fallbackId;
                if (!resolvedId) {
                    throw new Error(
                        "The selected enquiry did not include an identifier. Please try another enquiry or refresh.",
                    );
                }
                enquiryPrefillCache.current.set(cacheKey, { prefill: nextPrefill, id: resolvedId });
                setPrefillData(nextPrefill);
                setSelectedEnquiryId(resolvedId);
                toast.success("Enquiry applied", {
                    description: `Loaded details from selected enquiry.`,
                });
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : "Failed to load enquiry details.";
                console.error("Failed to prefill estimate from enquiry selection", error);
                const currentSelection = selectionRef.current;
                if (currentSelection && requestRef.current === requestId) {
                    setPrefillData(undefined);
                    setSelectedEnquiryId(undefined);
                }
                toast.error("Unable to use enquiry", {
                    description: message,
                });
            } finally {
                if (requestRef.current === requestId) {
                    setIsFetchingEnquiry(false);
                }
            }
        },
        [mapEnquiryToPrefill, selectedClientId],
    );

    useEffect(() => {
        if (!isOpen) return;
        const fromItems: EstimateLine[] = [];
        if (!isAdditionalEstimate && prefillData?.items) {
            Object.entries(prefillData.items).forEach(([category, items]) => {
                items.forEach((item, index) => {
                    const derivedId =
                        typeof item.id === "string" || typeof item.id === "number"
                            ? String(item.id)
                            : `${category}-${index}-${generateId()}`;
                    const itemName = typeof item.item === "string" ? item.item : "Line item";
                    const specification =
                        typeof item.description === "string" ? item.description : "";
                    const rawQuantity =
                        typeof item.quantity === "number"
                            ? item.quantity
                            : Number(item.quantity ?? 1);
                    const rawUnitCost =
                        typeof item.pricePerItem === "number"
                            ? item.pricePerItem
                            : Number(item.pricePerItem ?? 0);
                    const rawDays =
                        typeof item.days === "number" ? item.days : Number(item.days ?? 1);
                    const rawSqft =
                        typeof item.sqft === "number"
                            ? item.sqft
                            : Number(item.sqft ?? rawQuantity ?? 1);
                    const rawRate =
                        typeof item.rate === "number"
                            ? item.rate
                            : Number(item.rate ?? rawUnitCost ?? 0);

                    const days = Number.isFinite(rawDays) && rawDays > 0 ? rawDays : 1;
                    const sqft =
                        Number.isFinite(rawSqft) && rawSqft > 0
                            ? rawSqft
                            : Number.isFinite(rawQuantity)
                              ? rawQuantity
                              : 1;
                    const rate = Number.isFinite(rawRate) ? rawRate : rawUnitCost;
                    const vendor = typeof item.vendor === "string" ? item.vendor : "";

                    const subCategory =
                        typeof item.subCategory === "string" ? item.subCategory : "";

                    const unit =
                        typeof item.unit === "string" && item.unit.trim() ? item.unit : "nos";

                    fromItems.push({
                        id: derivedId,
                        category,
                        subCategory,
                        item: itemName,
                        specification,
                        days,
                        sqft,
                        rate,
                        vendor,
                        unit,
                    });
                });
            });
        }
        setLines(fromItems);
    }, [isOpen, prefillData, isAdditionalEstimate]);

    useEffect(() => {
        if (!isOpen || !isAdditionalEstimate || !prefillData?.eventID) {
            setExistingEventItems([]);
            setEventItemsError(null);
            return;
        }

        let cancelled = false;
        const loadEventItems = async () => {
            setIsFetchingEventItems(true);
            setEventItemsError(null);
            try {
                const eventRes = await apiRequest(
                    API_ENDPOINTS.events.detail(prefillData.eventID ?? ""),
                );
                if (!eventRes.ok) {
                    throw new Error(`Failed to fetch event items (${eventRes.status})`);
                }
                const eventData = (await eventRes.json()) as { items?: EventItem[] };
                if (!cancelled) {
                    setExistingEventItems(eventData.items ?? []);
                }
            } catch (error) {
                if (!cancelled) {
                    setEventItemsError(
                        error instanceof Error
                            ? error.message
                            : "Failed to load existing event items.",
                    );
                    setExistingEventItems([]);
                }
            } finally {
                if (!cancelled) {
                    setIsFetchingEventItems(false);
                }
            }
        };

        void loadEventItems();

        return () => {
            cancelled = true;
        };
    }, [isOpen, isAdditionalEstimate, prefillData?.eventID]);

    const initialForm = useMemo(
        () => ({
            title: prefillData?.title ?? "",
            highlvelRequirement: prefillData?.highlvelRequirement ?? "",
            enquiryDate: normalizeDate(prefillData?.enquiryDate ?? null),
            fromDate: normalizeDate(prefillData?.fromDate ?? null),
            toDate: normalizeDate(prefillData?.toDate ?? null),
            status: (prefillData?.status as EstimateStatus | undefined) ?? "ENQUIRY_CREATED",
            location: prefillData?.location ?? "",
            venue: prefillData?.venue ?? "",
            clientPoC: prefillData?.clientPoC ?? prefillData?.client ?? "",
            pocContactNumber: prefillData?.pocContactNumber ?? "",
            enquiryPoC: prefillData?.enquiryPoC ?? "",
            serviceCharge: prefillData?.serviceCharge ?? 0,
            gst: prefillData?.gst ?? 0,
            gstType: prefillData?.gstType ?? "NONE",
            discountAmount: prefillData?.discounts ?? 0,
            billingAddress: prefillData?.billingAddress ?? "",
        }),
        [prefillData],
    );

    const totalAmount = useMemo(
        () => lines.reduce((sum, line) => sum + line.days * line.sqft * line.rate, 0),
        [lines],
    );

    const titlesForSelectedClient = useMemo(() => {
        if (!selectedClientId) return [];
        const match = clientSummaries.find(summary => summary.clientName === selectedClientId);
        return match?.enquiries ?? [];
    }, [clientSummaries, selectedClientId]);

    const currentPrefillLabel = useMemo(() => {
        const clientName = prefillData?.client;
        const title = prefillData?.title;
        if (clientName && title) return `${clientName} • ${title}`;
        if (title) return title;
        if (clientName && (prefillData?.enquiryId ?? selectedEnquiryId)) {
            return `${clientName} • ${prefillData?.enquiryId ?? selectedEnquiryId}`;
        }
        return undefined;
    }, [prefillData?.client, prefillData?.enquiryId, prefillData?.title, selectedEnquiryId]);

    const enquiryStatusMessage = useMemo(() => {
        if (summaryError) return `Couldn't load enquiries. ${summaryError}`;
        if (summaryLoading) return "Loading available enquiries…";
        if (!clientSummaries.length) return "No enquiries available yet.";
        if (!selectedClientId) return "Pick a client to see their enquiries.";
        if (selectedClientId && titlesForSelectedClient.length === 0)
            return "No enquiries found for this client yet.";
        if (isFetchingEnquiry) return "Loading enquiry details…";
        if (prefillData?.enquiryId || selectedEnquiryId) {
            return currentPrefillLabel
                ? `Prefilled from ${currentPrefillLabel}.`
                : "Prefilling from the selected enquiry.";
        }
        return "Select an enquiry title to prefill the estimate fields.";
    }, [
        currentPrefillLabel,
        clientSummaries.length,
        isFetchingEnquiry,
        prefillData?.enquiryId,
        selectedClientId,
        selectedEnquiryId,
        summaryError,
        summaryLoading,
        titlesForSelectedClient.length,
    ]);

    const clearEnquirySelection = useCallback(
        (isModalClose?: boolean) => {
            if (!prefillData && !selectedEnquiryId) {
                selectionRef.current = selectedClientId
                    ? {
                          clientName: clientSummaries.find(c => c.clientId === selectedClientId)
                              ?.clientName,
                      }
                    : null;
                return;
            }

            requestRef.current += 1;
            setSelectedEnquiryId(undefined);
            setPrefillData(undefined);
            setIsFetchingEnquiry(false);
            selectionRef.current = selectedClientId
                ? {
                      clientName: clientSummaries.find(c => c.clientId === selectedClientId)
                          ?.clientName,
                  }
                : null;
            if (!isModalClose) {
                toast.info("Selection cleared", {
                    description: "You can pick another enquiry to prefill the estimate.",
                });
            }
        },
        [prefillData, selectedClientId, selectedEnquiryId, clientSummaries],
    );

    const handleClientChange = useCallback(
        (event: React.ChangeEvent<HTMLSelectElement>) => {
            const nextClientId = event.target.value;
            const clientName = clientSummaries.find(c => c.clientId === nextClientId)?.clientName;

            requestRef.current += 1;
            setSelectedClientId(clientName ?? "");
            setSelectedEnquiryId(undefined);
            setPrefillData(undefined);
            setIsFetchingEnquiry(false);
            selectionRef.current = nextClientId ? { clientName } : null;
        },
        [clientSummaries],
    );

    const handleEnquiryTitleChange = useCallback(
        (event: React.ChangeEvent<HTMLSelectElement>) => {
            const nextEnquiryId = event.target.value;
            if (!nextEnquiryId) {
                clearEnquirySelection();
                return;
            }

            if (!selectedClientId) {
                toast.error("Select a client first", {
                    description: "Pick a client before choosing an enquiry title.",
                });
                setSelectedEnquiryId(undefined);
                return;
            }

            const selectedEnquiry = titlesForSelectedClient.find(
                e => e.enquiryId === nextEnquiryId,
            );

            if (!selectedEnquiry) return;

            setSelectedEnquiryId(nextEnquiryId);
            setPrefillData(undefined);
            selectionRef.current = {
                clientName: selectedClientId,
                title: selectedEnquiry.title,
            };
            void loadEnquiryForSelection(nextEnquiryId);
        },
        [
            clearEnquirySelection,
            loadEnquiryForSelection,
            selectedClientId,
            titlesForSelectedClient,
            clientSummaries,
        ],
    );

    const handleSubmit = async (
        values: typeof initialForm,
        helpers: FormikHelpers<typeof initialForm>,
    ) => {
        setIsSaving(true);
        helpers.setStatus(null);

        // Check if we're editing an existing estimate.
        // Additional estimates are always new records — the source estimate's
        // `id` is only used as `lastEstimateID`, so it must not be treated as
        // editing that estimate.
        const isEditing = !isAdditionalEstimate && prefillData?.id ? true : false;

        try {
            const activeEnquiryId = selectedEnquiryId ?? prefillData?.enquiryId;
            if (!activeEnquiryId || !prefillData) {
                helpers.setStatus("Select an enquiry to prefill before saving the estimate.");
                toast.error("Enquiry required", {
                    description:
                        "Choose an enquiry from the list so we can prefill the estimate details.",
                });
                setIsSaving(false);
                return;
            }

            const resolvedClientId = prefillData.client ?? selectedClientId;
            if (!resolvedClientId) {
                helpers.setStatus(
                    "The selected enquiry is missing a client id. Please refresh and try again.",
                );
                toast.error("Client id unavailable", {
                    description: "We couldn't find the client reference for this enquiry.",
                });
                setIsSaving(false);
                return;
            }

            // Validate artifacts items
            const persistableLines = lines.filter(isPersistableArtifactLine);
            const invalidItems = persistableLines.filter(line => {
                const hasEmptyItem = !line.item || line.item.trim() === "";
                const hasEmptyRate = !Number.isFinite(line.rate) || Number(line.rate) === 0;
                const hasInvalidQty = !Number.isFinite(line.sqft) || Number(line.sqft) < 1;
                const hasInvalidDays = !Number.isFinite(line.days) || Number(line.days) < 1;
                return hasEmptyItem || hasEmptyRate || hasInvalidQty || hasInvalidDays;
            });

            if (invalidItems.length > 0) {
                const invalidIds = new Set(invalidItems.map(line => line.id));
                setInvalidLineIds(invalidIds);
                toast.error("Invalid artifacts", {
                    description:
                        "Each artifact requires an item name, days, quantity, and rate greater than 0.",
                });
                setIsSaving(false);
                return;
            } else {
                setInvalidLineIds(new Set());
            }

            const serialCounters = new Map<string, number>();
            const requestItems = persistableLines.reduce<Record<string, EstimateLineItemPayload[]>>(
                (acc, line) => {
                    const category = line.category?.trim() || "General";
                    const currentSerial = (serialCounters.get(category) ?? 0) + 1;
                    serialCounters.set(category, currentSerial);

                    const count =
                        Number.isFinite(line.sqft) && line.sqft > 0 ? Number(line.sqft) : 1;
                    const pricePerItem = Number.isFinite(line.rate) ? line.rate : 0;
                    const days = Number.isFinite(line.days) && line.days > 0 ? line.days : 1;

                    const entry: EstimateLineItemPayload = {
                        item: line.item || "Item",
                        serialNumber: currentSerial,
                        quantity: count,
                        pricePerItem,
                        finalAmt: Number((count * pricePerItem * days).toFixed(2)),
                        description:
                            line.specification && line.specification.trim()
                                ? line.specification
                                : line.item,
                        vendor: line.vendor || "",
                        checkList: "",
                        days,
                        category: line.category || "General",
                        subCategory: line.subCategory || "",
                        unit: line.unit || "nos",
                    };

                    const bucket = acc[category] ?? [];
                    bucket.push(entry);
                    acc[category] = bucket;
                    return acc;
                },
                {},
            );
            const uiItemsForFallback = persistableLines.reduce<Record<string, EstimateItem[]>>(
                (acc, line) => {
                    const category = line.category || "General";
                    const bucket = acc[category] ?? [];
                    const total = Number((line.days * line.sqft * line.rate).toFixed(2));

                    bucket.push({
                        id: line.id,
                        description: line.item,
                        specification: line.specification,
                        days: line.days,
                        sqft: line.sqft,
                        rate: line.rate,
                        quantity: line.sqft,
                        unitCost: line.rate,
                        total,
                        vendor: line.vendor || "",
                        subCategory: line.subCategory || "",
                        unit: line.unit || "nos",
                    });
                    acc[category] = bucket;
                    return acc;
                },
                {},
            );

            const fallbackClientId = clientSummaries.find(
                c => c.clientName === prefillData.client,
            )?.clientId;

            // Build invoiceSummary from the same Cost Summary calculations shown
            // in the modal footer (calculateEstimateSummary).
            const discountAmount = Number(values.discountAmount) || 0;
            const submitSummary = calculateEstimateSummary({
                totalAmount,
                gst: Number(values.gst) || 0,
                serviceCharge: Number(values.serviceCharge) || 0,
                discounts: discountAmount,
            });
            const invoiceSummary: InvoiceSummary = {
                discountAmount,
                serviceChargeAmt: Number(submitSummary.serviceChargeAmount.toFixed(2)),
                additionalCostAmt: 0,
                expensesTotal: Number(totalAmount.toFixed(2)),
                gstAmount: Number(submitSummary.gstAmount.toFixed(2)),
                netTotal: Number(submitSummary.totalWithGST.toFixed(2)),
            };

            const payload: CreateEstimatePayload = {
                title: values.title,
                highlvelRequirement: values.highlvelRequirement,
                enquiryDate: formatDateOutput(values.enquiryDate ?? null),
                fromDate: formatDateOutput(values.fromDate ?? null),
                toDate: formatDateOutput(values.toDate ?? null),
                status: values.status as EstimateStatus,
                location: values.location,
                venue: values.venue,
                clientPoC: values.clientPoC,
                pocContactNumber: values.pocContactNumber,
                enquiryPoC: values.enquiryPoC,
                client: prefillData.client ?? "",
                clientID: prefillData.clientID ?? fallbackClientId,
                items: requestItems,
                enquiryId: activeEnquiryId,
                eventName: values.title ?? "",
                eventID: prefillData.eventID ?? "",
                gst: values.gst,
                gstType: values.gstType,
                serviceCharge: values.serviceCharge,
                discounts: values.discountAmount,
                billingAddress: values.billingAddress,
                estimateStatus: "DRAFT",
                invoiceSummary,
                additionalEstimate: isAdditionalEstimate || undefined,
                lastEstimateID: isAdditionalEstimate ? prefillData.lastEstimateID : undefined,
            };

            // Additional estimates are always created as new records using the
            // source estimate only as prefill (lastEstimateID). The source estimate's
            // `id`/`version` must NOT be sent as the new record's id.
            const body = isAdditionalEstimate
                ? payload
                : prefillData.id
                  ? { ...payload, id: prefillData.id, version: prefillData.version }
                  : payload;

            if (isAdditionalEstimate) {
                setPendingAdditionalEstimate({
                    payload: body,
                    uiItemsForFallback,
                    lines: persistableLines as ArtifactLine[],
                });
                setIsAdditionalConfirmationOpen(true);
                setIsSaving(false);
                return;
            }

            const res = await apiRequest(API_ENDPOINTS.estimates.list, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            let saved: EstimateDto | null = null;
            if (res.ok) {
                const data = await res.text();
                try {
                    saved = JSON.parse(data) as EstimateDto;
                } catch (parseErr) {
                    console.warn("Failed to parse estimate response, using fallback", parseErr);
                }
            }

            const fallback: EstimateDto = saved ?? {
                id: `tmp-${Date.now()}`,
                title: payload.title,
                highlvelRequirement: payload.highlvelRequirement,
                enquiryDate: payload.enquiryDate,
                fromDate: payload.fromDate,
                toDate: payload.toDate,
                status: payload.status,
                location: payload.location,
                venue: payload.venue,
                clientPoC: payload.clientPoC,
                pocContactNumber: payload.pocContactNumber,
                enquiryPoC: payload.enquiryPoC,
                client: payload.client,
                clientID: payload.clientID,
                items: uiItemsForFallback,
                gst: payload.gst,
                gstType: payload.gstType,
                serviceCharge: payload.serviceCharge,
                discounts: payload.discounts,
                billingAddress: payload.billingAddress,
                enquiryId: payload.enquiryId,
                eventName: payload.eventName,
                eventID: payload.eventID,
                invoiceSummary: payload.invoiceSummary,
            };

            toast.success(
                isEditing ? "Estimate updated successfully" : "Estimate created successfully",
            );
            onSaved(fallback);
            onClose();
        } catch (error) {
            console.error("Failed to save estimate", error);
            helpers.setStatus("Failed to save estimate. Please try again.");
            toast.error(isEditing ? "Failed to update estimate" : "Failed to create estimate");
        } finally {
            setIsSaving(false);
        }
    };

    const handleConfirmAdditionalEstimate = async () => {
        if (!pendingAdditionalEstimate) return;

        setIsAdditionalConfirmationOpen(false);
        setIsSaving(true);

        try {
            const res = await apiRequest(API_ENDPOINTS.estimates.list, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(pendingAdditionalEstimate.payload),
            });

            let saved: EstimateDto | null = null;
            if (res.ok) {
                const data = await res.text();
                try {
                    saved = JSON.parse(data) as EstimateDto;
                } catch (parseErr) {
                    console.warn("Failed to parse estimate response, using fallback", parseErr);
                }
            }

            const fallback: EstimateDto = saved ?? {
                id: `tmp-${Date.now()}`,
                title: pendingAdditionalEstimate.payload.title,
                highlvelRequirement: pendingAdditionalEstimate.payload.highlvelRequirement,
                enquiryDate: pendingAdditionalEstimate.payload.enquiryDate,
                fromDate: pendingAdditionalEstimate.payload.fromDate,
                toDate: pendingAdditionalEstimate.payload.toDate,
                status: pendingAdditionalEstimate.payload.status,
                location: pendingAdditionalEstimate.payload.location,
                venue: pendingAdditionalEstimate.payload.venue,
                clientPoC: pendingAdditionalEstimate.payload.clientPoC,
                pocContactNumber: pendingAdditionalEstimate.payload.pocContactNumber,
                enquiryPoC: pendingAdditionalEstimate.payload.enquiryPoC,
                client: pendingAdditionalEstimate.payload.client,
                clientID: pendingAdditionalEstimate.payload.clientID,
                items: pendingAdditionalEstimate.uiItemsForFallback,
                gst: pendingAdditionalEstimate.payload.gst,
                gstType: pendingAdditionalEstimate.payload.gstType,
                serviceCharge: pendingAdditionalEstimate.payload.serviceCharge,
                discounts: pendingAdditionalEstimate.payload.discounts,
                billingAddress: pendingAdditionalEstimate.payload.billingAddress,
                enquiryId: pendingAdditionalEstimate.payload.enquiryId,
                eventName: pendingAdditionalEstimate.payload.eventName,
                eventID: pendingAdditionalEstimate.payload.eventID,
                invoiceSummary: pendingAdditionalEstimate.payload.invoiceSummary,
                // additionalEstimate: true,
                lastEstimateID: pendingAdditionalEstimate.payload.lastEstimateID,
            };

            toast.success("Estimate created successfully");
            onSaved(fallback);
            onClose();
        } catch (error) {
            console.error("Failed to save additional estimate", error);
            toast.error("Failed to create additional estimate");
        } finally {
            setPendingAdditionalEstimate(null);
            setIsSaving(false);
        }
    };

    const existingEventItemGroups = useMemo(
        () => groupEventItemsByCategory(existingEventItems),
        [existingEventItems],
    );

    const newEstimateItemGroups = useMemo(
        () =>
            pendingAdditionalEstimate
                ? groupLinesByCategory(pendingAdditionalEstimate.lines as ArtifactLine[])
                : [],
        [pendingAdditionalEstimate],
    );

    if (!isOpen) return null;

    return (
        <>
            <AdditionalEstimateConfirmationModal
                open={isAdditionalConfirmationOpen}
                onClose={() => {
                    setIsAdditionalConfirmationOpen(false);
                    setPendingAdditionalEstimate(null);
                }}
                onConfirm={handleConfirmAdditionalEstimate}
                existingEventItems={existingEventItemGroups}
                newEstimateItems={newEstimateItemGroups}
                loading={isFetchingEventItems}
                error={eventItemsError}
            />
            <Modal
                open={isOpen}
                onClose={() => !isSaving && onClose()}
                size="xxl"
                title={
                    isAdditionalEstimate
                        ? "Create Additional Estimate"
                        : initialData?.id
                          ? "Edit Estimate"
                          : "Create Estimate"
                }
                description={
                    isAdditionalEstimate
                        ? "Add a new estimate on top of the existing finalized event items."
                        : initialData?.id
                          ? "Update estimate details below."
                          : "Choose an enquiry to instantly prefill the estimate details."
                }
            >
                <Formik
                    initialValues={initialForm}
                    enableReinitialize
                    validationSchema={validationSchema}
                    onSubmit={handleSubmit}
                >
                    {({ status, values, setFieldValue }) => {
                        const summary = calculateEstimateSummary({
                            totalAmount,
                            gst: Number(values.gst) || 0,
                            serviceCharge: Number(values.serviceCharge) || 0,
                            discounts: Number(values.discountAmount) || 0,
                        });
                        const gstLabel = GST_LABEL_BY_TYPE[values.gstType] ?? "GST";
                        const gstDisabled = values.gstType === "NONE" || !prefillData?.enquiryId;

                        return (
                            <Form>
                                <ModalBody className="flex flex-col gap-4">
                                    {status && (
                                        <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
                                            {status}
                                        </div>
                                    )}
                                    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                            <div className="w-full md:max-w-md">
                                                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                                    Source enquiry
                                                </Label>
                                                <div className="mt-1 flex flex-col gap-2 lg:flex-row lg:items-center">
                                                    <Select
                                                        options={[
                                                            ...clientSummaries.map(summary => ({
                                                                label: summary.clientName,
                                                                value: summary.clientId,
                                                            })),
                                                        ]}
                                                        value={
                                                            selectedClientId
                                                                ? {
                                                                      label:
                                                                          clientSummaries.find(
                                                                              c =>
                                                                                  c.clientId ===
                                                                                  selectedClientId,
                                                                          )?.clientName ||
                                                                          selectedClientId,
                                                                      value: selectedClientId,
                                                                  }
                                                                : null
                                                        }
                                                        isDisabled={
                                                            Boolean(initialData) ||
                                                            summaryLoading ||
                                                            isFetchingEnquiry
                                                        }
                                                        onChange={option => {
                                                            if (option) {
                                                                const event = {
                                                                    target: { value: option.value },
                                                                } as React.ChangeEvent<HTMLSelectElement>;
                                                                handleClientChange(event);
                                                            }
                                                        }}
                                                        className="flex-1"
                                                        placeholder={
                                                            summaryLoading
                                                                ? "Loading clients…"
                                                                : "Select client"
                                                        }
                                                    />
                                                    <div className="flex w-full gap-2 lg:w-auto lg:flex-1">
                                                        <Select
                                                            options={[
                                                                ...titlesForSelectedClient.map(
                                                                    enquiry => ({
                                                                        label: enquiry.title,
                                                                        value: enquiry.enquiryId,
                                                                    }),
                                                                ),
                                                            ]}
                                                            value={
                                                                selectedEnquiryId
                                                                    ? {
                                                                          label:
                                                                              titlesForSelectedClient.find(
                                                                                  e =>
                                                                                      e.enquiryId ===
                                                                                      selectedEnquiryId,
                                                                              )?.title ||
                                                                              selectedEnquiryId,
                                                                          value: selectedEnquiryId,
                                                                      }
                                                                    : null
                                                            }
                                                            isDisabled={
                                                                Boolean(initialData) ||
                                                                !selectedClientId ||
                                                                summaryLoading ||
                                                                isFetchingEnquiry ||
                                                                titlesForSelectedClient.length === 0
                                                            }
                                                            onChange={option => {
                                                                if (option) {
                                                                    const event = {
                                                                        target: {
                                                                            value: option.value,
                                                                        },
                                                                    } as React.ChangeEvent<HTMLSelectElement>;
                                                                    handleEnquiryTitleChange(event);
                                                                } else {
                                                                    clearEnquirySelection();
                                                                }
                                                            }}
                                                            className="flex-1"
                                                            placeholder="Select enquiry"
                                                        />
                                                        {selectedEnquiryId && (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                disabled={isFetchingEnquiry}
                                                                onClick={() =>
                                                                    clearEnquirySelection()
                                                                }
                                                            >
                                                                Clear
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="mt-2 text-xs text-muted-foreground">
                                                    {enquiryStatusMessage}
                                                </p>
                                            </div>
                                        </div>
                                        <FormikFieldInput
                                            name="title"
                                            label="Event title"
                                            placeholder="e.g. Birthday party"
                                            wrapperClassName="mt-4"
                                            disabled={!prefillData?.enquiryId}
                                        />
                                        <FormikFieldTextArea
                                            name="highlvelRequirement"
                                            label="Project summary"
                                            rows={3}
                                            placeholder="Describe the goal of this estimate"
                                            wrapperClassName="mt-4"
                                            disabled={!prefillData?.enquiryId}
                                        />
                                    </section>

                                    <section className="grid gap-4 md:grid-cols-2">
                                        <div className="rounded-xl border border-gray-200 bg-slate-50 p-4">
                                            <h4 className="text-sm font-semibold text-gray-700">
                                                Event schedule
                                            </h4>
                                            <div className="mt-3 grid gap-3">
                                                <FormikFieldDatePicker
                                                    name="enquiryDate"
                                                    label="Enquiry Date"
                                                    placeholderText="Pick enquiry date"
                                                    disabled={!prefillData?.enquiryId}
                                                />
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <FormikFieldDatePicker
                                                        name="fromDate"
                                                        label="Event Start"
                                                        placeholderText="Pick start"
                                                        disabled={!prefillData?.enquiryId}
                                                    />
                                                    <FormikFieldDatePicker
                                                        name="toDate"
                                                        label="Event End"
                                                        placeholderText="Pick end"
                                                        disabled={!prefillData?.enquiryId}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                                            <h4 className="text-sm font-semibold text-gray-700">
                                                Logistics
                                            </h4>
                                            <div className="mt-3 grid gap-3">
                                                <FormikFieldSelect
                                                    name="status"
                                                    label="Status"
                                                    options={eventStatus.map(s => ({
                                                        label: s.label,
                                                        value: s.value,
                                                    }))}
                                                    isDisabled={!prefillData?.enquiryId}
                                                />
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <FormikFieldInput
                                                        name="venue"
                                                        label="Venue"
                                                        placeholder="Enter venue"
                                                        disabled={!prefillData?.enquiryId}
                                                    />
                                                    <FormikFieldInput
                                                        name="location"
                                                        label="Location"
                                                        placeholder="Enter event location"
                                                        disabled={!prefillData?.enquiryId}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </section>
                                    {/* Hide Client Details for temporary */}
                                    {/* <section className="rounded-xl border border-gray-200 bg-white p-4">
                                    <h4 className="text-sm font-semibold text-gray-700">
                                        Key contacts
                                    </h4>
                                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                                        <FormikFieldInput
                                            name="clientPoC"
                                            label="Client POC"
                                            placeholder="Client point of contact"
                                            disabled={!prefillData?.enquiryId}
                                        />
                                        <FormikFieldInput
                                            name="pocContactNumber"
                                            label="POC Contact Number"
                                            placeholder="1234567890"
                                            maxLength={10}
                                            disabled={!prefillData?.enquiryId}
                                        />
                                        <FormikFieldInput
                                            name="enquiryPoC"
                                            label="Enquiry POC"
                                            placeholder="Internal assignee"
                                            disabled={!prefillData?.enquiryId}
                                        />
                                    </div>
                                </section> */}

                                    <section className="rounded-xl border border-gray-200 bg-white p-4">
                                        <h4 className="text-sm font-semibold text-gray-700">
                                            Billing Details
                                        </h4>
                                        <div className="mt-3 grid gap-3">
                                            <div className="grid gap-3 md:grid-cols-4">
                                                <FormikFieldInput
                                                    name="serviceCharge"
                                                    label="Service Charge  (%)"
                                                    type="number"
                                                    placeholder="%"
                                                    disabled={!prefillData?.enquiryId}
                                                />
                                                <FormikFieldSelect
                                                    name="gstType"
                                                    label="Tax Type"
                                                    options={GST_TYPE_OPTIONS}
                                                    isDisabled={!prefillData?.enquiryId}
                                                    onChange={() => {
                                                        // Reset the GST percentage to its default
                                                        // whenever the tax type changes so the
                                                        // cost summary breakups recalculate cleanly.
                                                        setFieldValue("gst", 0);
                                                    }}
                                                />
                                                <FormikFieldInput
                                                    name="gst"
                                                    label={`${gstLabel} (%)`}
                                                    type="number"
                                                    placeholder="%"
                                                    disabled={gstDisabled}
                                                />
                                                <FormikFieldInput
                                                    name="discountAmount"
                                                    label="Discount Amount"
                                                    type="number"
                                                    placeholder="0"
                                                    disabled={!prefillData?.enquiryId}
                                                />
                                            </div>
                                            <FormikFieldInput
                                                name="billingAddress"
                                                label="Billing Address"
                                                placeholder="Enter billing address"
                                                disabled={!prefillData?.enquiryId}
                                            />
                                        </div>
                                    </section>

                                    <section className="space-y-4">
                                        <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                                            <div className="mb-3">
                                                <h3 className="text-base font-semibold text-gray-900">
                                                    Elements required
                                                </h3>
                                                <p className="text-xs text-muted-foreground">
                                                    List the services, equipment, and resources
                                                    needed for this estimate.
                                                </p>
                                            </div>

                                            <ArtifactsSection
                                                lines={lines as unknown as ArtifactLine[]}
                                                onLinesChange={newLines =>
                                                    setLines(newLines as EstimateLine[])
                                                }
                                                disabled={!prefillData?.enquiryId}
                                                errorLineIds={invalidLineIds}
                                            />
                                        </div>
                                    </section>
                                </ModalBody>
                                <ModalFooter className="relative justify-between py-2">
                                    <CostSummary
                                        title="Cost Summary"
                                        subtitle="Final estimate total"
                                        amount={summary.totalWithGST}
                                        breakdownTitle="Cost Breakdown"
                                        items={[
                                            {
                                                label: "Total",
                                                amount: totalAmount,
                                            },
                                            ...((values.serviceCharge || 0) > 0
                                                ? [
                                                      {
                                                          label: `Service Charge (${values.serviceCharge}%)`,
                                                          amount: summary.serviceChargeAmount,
                                                      },
                                                  ]
                                                : []),
                                            ...((values.discountAmount || 0) > 0
                                                ? [
                                                      {
                                                          label: "Discount Amount",
                                                          amount: values.discountAmount || 0,
                                                          tone: "negative" as const,
                                                          prefix: "-",
                                                      },
                                                  ]
                                                : []),
                                            ...((values.gst || 0) > 0
                                                ? [
                                                      {
                                                          label: `GST (${values.gst}%)`,
                                                          amount: summary.gstAmount,
                                                          tone: "positive" as const,
                                                          prefix: "+",
                                                      },
                                                  ]
                                                : []),
                                        ]}
                                        totalItem={{
                                            label: "Final Total",
                                            amount: summary.totalWithGST,
                                        }}
                                    />
                                    <div className="flex items-center gap-3">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => {
                                                clearEnquirySelection(true);
                                                setSelectedClientId("");
                                                onClose();
                                            }}
                                            disabled={isSaving}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            type="submit"
                                            disabled={isSaving || isFetchingEnquiry}
                                        >
                                            {isSaving
                                                ? initialData?.id && !isAdditionalEstimate
                                                    ? "Updating..."
                                                    : "Saving..."
                                                : isFetchingEnquiry
                                                  ? "Loading enquiry..."
                                                  : initialData?.id && !isAdditionalEstimate
                                                    ? "Update Estimate"
                                                    : "Save Estimate"}
                                        </Button>
                                    </div>
                                </ModalFooter>
                            </Form>
                        );
                    }}
                </Formik>
            </Modal>
        </>
    );
}
