"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { EstimateDto, EstimateVersionStatus, EstimateItem } from "@/types/estimate";
import {
    Copy,
    Send,
    CheckCircle,
    Edit,
    ChevronDown,
    ChevronRight,
    Calendar,
    Eye,
    Merge,
} from "lucide-react";
import { apiRequest } from "@/lib/api/api-client";
import { toast } from "sonner";
import { Button, Modal, ModalBody, ModalFooter, Badge } from "./ui";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { useRouter } from "next/navigation";
import { AccessButton } from "./shared/access-button";
import { ConfirmationModal } from "./shared/confirmation-modal";
import { EstimatePreviewModal } from "./estimate-preview-modal";
import { EstimateEmailPreviewModal } from "./estimate-email-preview-modal";
import CreateEstimateModal from "./create-estimate-modal";

interface ClientData {
    email?: string;
}

function getClientEmail(estimate: EstimateDto): string {
    const estimateWithClient = estimate as EstimateDto & { client?: ClientData };
    return estimateWithClient.client?.email ?? "";
}

interface EstimateVersionsViewProps {
    enquiryId: string;
    onVersionSelect?: (estimate: EstimateDto) => void;
    onClose: () => void;
    isViewOnlyMode?: boolean;
}

export function EstimateVersionsView({
    enquiryId,
    onVersionSelect,
    onClose,
    isViewOnlyMode,
}: EstimateVersionsViewProps) {
    const router = useRouter();
    const [versions, setVersions] = useState<EstimateDto[]>([]);
    const [eventName, setEventName] = useState<string>("");
    const [loading, setLoading] = useState(true);
    const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
    const [previewVersion, setPreviewVersion] = useState<EstimateDto | null>(null);
    const [emailVersion, setEmailVersion] = useState<EstimateDto | null>(null);
    const [isCreateEstimateOpen, setIsCreateEstimateOpen] = useState(false);
    const [additionalEstimateData, setAdditionalEstimateData] = useState<
        (Partial<EstimateDto> & { enquiryId?: string }) | undefined
    >(undefined);
    const [mergeTargetVersion, setMergeTargetVersion] = useState<EstimateDto | null>(null);
    const [isMerging, setIsMerging] = useState(false);

    // Fetch versions on mount
    useEffect(() => {
        fetchVersions();
    }, []);

    const fetchVersions = async () => {
        try {
            setLoading(true);
            const response = await apiRequest(`/api/estimates/by-enquiry/${enquiryId}`);
            if (!response.ok) {
                throw new Error("Failed to fetch versions");
            }
            const data = (await response.json()) as { eventName: string; estimates: EstimateDto[] };
            setEventName(data.eventName || "");
            // Add eventName/title to each estimate for consistency
            const estimatesWithTitle = (data.estimates || []).map(est => ({
                ...est,
                title: est.title || data.eventName,
                eventID: est.eventID,
            }));
            setVersions(estimatesWithTitle);
        } catch (error) {
            console.error("Error fetching versions:", error);
            toast.error("Failed to load estimate versions");
        } finally {
            setLoading(false);
        }
    };

    const handleClone = async (estimateId: string) => {
        try {
            const response = await apiRequest(`/api/estimates/${estimateId}/clone`, {
                method: "POST",
            });
            if (!response.ok) {
                throw new Error("Failed to clone estimate");
            }
            const newVersion = (await response.json()) as EstimateDto;
            toast.success(`Created ${newVersion.version} successfully`);
            await fetchVersions();
        } catch (error) {
            console.error("Error cloning estimate:", error);
            toast.error("Failed to clone estimate");
        }
    };

    const handleStatusChange = async (estimateId: string, newStatus: EstimateVersionStatus) => {
        try {
            await apiRequest(`/api/estimates/${estimateId}/status?status=${newStatus}`, {
                method: "PATCH",
            });

            const statusLabels: Record<EstimateVersionStatus, string> = {
                DRAFT: "Draft",
                UNDER_CLIENT_REVIEW: "Under Client Review",
                FINAL: "Final",
                EVENT_CREATED: "Event Created",
                EVENT_MERGED: "Merged",
            };
            toast.success(`Status updated to ${statusLabels[newStatus]}`);
            await fetchVersions();
        } catch (error) {
            console.error("Error updating status:", error);
            toast.error("Failed to update status");
        }
    };

    const handleEmailSuccess = useCallback(async (estimateId: string) => {
        // Update the estimate status to UNDER_CLIENT_REVIEW after successful email send
        try {
            await apiRequest(`/api/estimates/${estimateId}/status?status=UNDER_CLIENT_REVIEW`, {
                method: "PATCH",
            });
            toast.success("Status updated to Under Client Review");
            await fetchVersions();
        } catch (error) {
            console.error("Error updating status:", error);
            toast.error("Failed to update status");
            throw error; // Re-throw so the email modal knows the operation failed
        }
    }, []);

    const handleAdditionalEstimate = useCallback(
        (version: EstimateDto) => {
            const { items: _items, ...prefill } = version;
            setAdditionalEstimateData({
                ...prefill,
                enquiryId: version.enquiryId || enquiryId,
                lastEstimateID: version.versionTitle,
            });
            setIsCreateEstimateOpen(true);
        },
        [enquiryId],
    );

    const toggleExpand = (versionId: string) => {
        const newExpanded = new Set(expandedVersions);
        if (newExpanded.has(versionId)) {
            newExpanded.delete(versionId);
        } else {
            newExpanded.add(versionId);
        }
        setExpandedVersions(newExpanded);
    };

    const getStatusBadgeVariant = (status?: EstimateVersionStatus) => {
        switch (status) {
            case "DRAFT":
                return "default" as const;
            case "UNDER_CLIENT_REVIEW":
                return "info" as const;
            case "FINAL":
                return "success" as const;
            case "EVENT_CREATED":
                return "success" as const;
            case "EVENT_CREATED":
                return "success" as const;
            case "EVENT_MERGED":
                return "warning" as const;
            default:
                return "default" as const;
        }
    };

    const getStatusLabel = (status?: EstimateVersionStatus) => {
        switch (status) {
            case "DRAFT":
                return "Draft";
            case "UNDER_CLIENT_REVIEW":
                return "Under Review";
            case "FINAL":
                return "Final";
            case "EVENT_CREATED":
                return "Event Created";
            case "EVENT_MERGED":
                return "Merged";
            default:
                return "Unknown";
        }
    };

    const eventCreatedVersion = useMemo(
        () => versions.find(v => v.estimateStatus === "EVENT_CREATED"),
        [versions],
    );

    const hasEventCreatedEstimate = useMemo(
        () => Boolean(eventCreatedVersion),
        [eventCreatedVersion],
    );

    const sortedVersions = useMemo(() => {
        const parseVersion = (v: string) => parseInt(v?.replace("v", ""), 10) || 0;

        return [...(versions || [])].sort((a, b) => {
            // 1. Priority: FINAL first
            if (a.estimateStatus !== b.estimateStatus) {
                return b.estimateStatus === "FINAL" ? 1 : -1;
            }

            // 2. Secondary: version sorting
            return parseVersion(a.version ?? "") - parseVersion(b.version ?? "");
        });
    }, [versions]);

    const handleCreateEvent = async (version: EstimateDto) => {
        if (!version) return;
        try {
            // Flatten items from nested structure to array
            const flattenedItems: EstimateItem[] = [];
            if (version.items && Object.keys(version.items).length > 0) {
                Object.entries(version.items).forEach(([category, itemList]) => {
                    (itemList || []).forEach(item => {
                        flattenedItems.push({
                            ...item,
                            category,
                        });
                    });
                });
            }

            const payload = {
                title: version.title || version.highlvelRequirement || "Event",
                eventStartDate: version.fromDate,
                eventEndDate: version.toDate,
                location: version.location,
                venue: version.venue,
                client: version.client,
                clientID: version.clientID,
                enquiryId: version.enquiryId,
                estimateId: version.id,
                eventID: version.eventID,
                versionTitle: version.versionTitle,
                status: version.status,
                billingAddress: version.billingAddress,
                discounts: version.discounts,
                serviceCharge: version.serviceCharge,
                gst: version.gst,
                gstType: version.gstType,
                enquiryDate: version.enquiryDate,
                items: flattenedItems,
                enquiryPoc: version.enquiryPoC,
                pocContactNumber: version.pocContactNumber,
                highlvelRequirement: version.highlvelRequirement,
                clientPoC: version.clientPoC,
            };

            const res = await apiRequest(API_ENDPOINTS.events.list, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errText = await res.text().catch(() => "");
                throw new Error(`Failed to create event: ${res.status} ${errText}`);
            }

            const createdEvent = await res.json();

            if (createdEvent) {
                onClose();
                toast.success("Event created from estimate");
                router.push(`/events/${createdEvent.eventID}`); // Navigate to the newly created event's page
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to create event";
            toast.error(message);
        }
    };

    const handleMerge = async (version: EstimateDto) => {
        if (!version) return;
        setIsMerging(true);
        try {
            const eventId = version.eventID || enquiryId;
            const estimateId = version.id;
            if (!eventId || !estimateId) {
                throw new Error("Missing event or estimate ID");
            }

            const res = await apiRequest(API_ENDPOINTS.events.mergeEstimate, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventId, estimateId }),
            });

            if (!res.ok) {
                const errText = await res.text().catch(() => "");
                throw new Error(`Failed to merge estimate: ${res.status} ${errText}`);
            }

            toast.success("Estimate merged into event successfully");
            setMergeTargetVersion(null);
            await fetchVersions();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to merge estimate";
            toast.error(message);
        } finally {
            setIsMerging(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white dark:!bg-gray-900 dark:border dark:border-gray-800 rounded-lg p-8">
                    <p>Loading versions...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {previewVersion && (
                <EstimatePreviewModal
                    estimate={previewVersion}
                    eventName={eventName}
                    onClose={() => setPreviewVersion(null)}
                />
            )}
            {emailVersion && (
                <EstimateEmailPreviewModal
                    estimate={emailVersion}
                    eventName={eventName}
                    clientEmail={getClientEmail(emailVersion)}
                    open={!!emailVersion}
                    onClose={() => setEmailVersion(null)}
                    onSuccess={() => handleEmailSuccess(emailVersion.id || "")}
                />
            )}
            <ConfirmationModal
                open={!!mergeTargetVersion}
                onClose={() => {
                    setMergeTargetVersion(null);
                }}
                onConfirm={() => {
                    if (mergeTargetVersion) {
                        return handleMerge(mergeTargetVersion);
                    }
                }}
                title="Merge Estimate"
                description="Are you sure you want to merge this finalized estimate into the existing event? This action will update the event with the estimate changes."
                confirmText="Merge"
                cancelText="Cancel"
                variant="primary"
                isLoading={isMerging}
            />
            <CreateEstimateModal
                isOpen={isCreateEstimateOpen}
                isAdditionalEstimate={true}
                onClose={() => {
                    setIsCreateEstimateOpen(false);
                    setAdditionalEstimateData(undefined);
                }}
                initialData={additionalEstimateData}
                onSaved={async () => {
                    setIsCreateEstimateOpen(false);
                    setAdditionalEstimateData(undefined);
                    await fetchVersions();
                }}
            />
            <Modal
                onClose={onClose}
                size="xxl"
                open
                title="Estimate Versions"
                description={eventName}
            >
                <ModalBody>
                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {sortedVersions.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">
                                No estimates found for this enquiry
                            </p>
                        ) : (
                            <div className="space-y-4">
                                {sortedVersions.map(version => {
                                    const isExpanded = expandedVersions.has(version.id || "");
                                    const isEventCreated =
                                        version.estimateStatus === "EVENT_CREATED";
                                    const isFinal = version.estimateStatus === "FINAL";

                                    return (
                                        <div
                                            key={version.id}
                                            className={`border rounded-lg p-4 ${
                                                isFinal || isEventCreated
                                                    ? "border-green-500 bg-green-50"
                                                    : "border-gray-200"
                                            }`}
                                        >
                                            {/* Version Header */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <button
                                                        onClick={() =>
                                                            toggleExpand(version.id || "")
                                                        }
                                                        className="text-gray-600 hover:text-gray-800 cursor-pointer"
                                                    >
                                                        {isExpanded ? (
                                                            <ChevronDown size={20} />
                                                        ) : (
                                                            <ChevronRight size={20} />
                                                        )}
                                                    </button>
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="text-md font-semibold">
                                                                {version.versionTitle ||
                                                                    "Untitled Version"}
                                                            </h3>
                                                            <Badge
                                                                variant={getStatusBadgeVariant(
                                                                    version.estimateStatus,
                                                                )}
                                                            >
                                                                {getStatusLabel(
                                                                    version.estimateStatus,
                                                                )}
                                                            </Badge>
                                                            {isFinal && (
                                                                <CheckCircle
                                                                    size={16}
                                                                    className="text-green-600"
                                                                />
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-gray-500 mt-1">
                                                            {version.venue}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Actions */}
                                                <div className="flex gap-2">
                                                    {!isViewOnlyMode && (
                                                        <>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() =>
                                                                    handleClone(version.id || "")
                                                                }
                                                                className="flex items-center gap-1"
                                                            >
                                                                <Copy size={14} />
                                                                Clone
                                                            </Button>
                                                            {version.estimateStatus === "DRAFT" && (
                                                                <>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() =>
                                                                            setEmailVersion(version)
                                                                        }
                                                                        className="flex items-center gap-1"
                                                                    >
                                                                        <Send size={14} />
                                                                        Send to Client
                                                                    </Button>
                                                                    <AccessButton
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() =>
                                                                            onVersionSelect?.(
                                                                                version,
                                                                            )
                                                                        }
                                                                        className="flex items-center gap-1"
                                                                        scope={["w:estimates"]}
                                                                    >
                                                                        <Edit size={14} />
                                                                        Edit
                                                                    </AccessButton>
                                                                </>
                                                            )}

                                                            {version.estimateStatus ===
                                                                "UNDER_CLIENT_REVIEW" && (
                                                                <>
                                                                    <AccessButton
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() =>
                                                                            handleStatusChange(
                                                                                version.id || "",
                                                                                "FINAL",
                                                                            )
                                                                        }
                                                                        className="flex items-center gap-1 text-green-600 border-green-600 hover:bg-green-50"
                                                                        scope={["w:estimates"]}
                                                                    >
                                                                        <CheckCircle size={14} />
                                                                        Mark as Final
                                                                    </AccessButton>
                                                                    <AccessButton
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={() =>
                                                                            handleStatusChange(
                                                                                version.id || "",
                                                                                "DRAFT",
                                                                            )
                                                                        }
                                                                        className="flex items-center gap-1"
                                                                        scope={["w:estimates"]}
                                                                    >
                                                                        Revert to Draft
                                                                    </AccessButton>
                                                                </>
                                                            )}

                                                            {version.estimateStatus === "FINAL" && (
                                                                <AccessButton
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() =>
                                                                        handleStatusChange(
                                                                            version.id || "",
                                                                            "DRAFT",
                                                                        )
                                                                    }
                                                                    className="flex items-center gap-1"
                                                                    scope={["w:estimates"]}
                                                                >
                                                                    Revert to Draft
                                                                </AccessButton>
                                                            )}
                                                        </>
                                                    )}

                                                    <AccessButton
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => setPreviewVersion(version)}
                                                        className="flex items-center gap-1"
                                                        scope={["w:estimates"]}
                                                    >
                                                        <Eye size={14} />
                                                        Preview
                                                    </AccessButton>
                                                    {version.estimateStatus === "FINAL" &&
                                                        hasEventCreatedEstimate &&
                                                        !isViewOnlyMode && (
                                                            <AccessButton
                                                                size="sm"
                                                                variant="primary"
                                                                className="flex items-center gap-1"
                                                                icon={<Merge size={14} />}
                                                                onClick={() =>
                                                                    setMergeTargetVersion(version)
                                                                }
                                                                scope={["w:estimates"]}
                                                            >
                                                                Merge
                                                            </AccessButton>
                                                        )}
                                                    {version.estimateStatus === "FINAL" &&
                                                        !hasEventCreatedEstimate &&
                                                        !isViewOnlyMode && (
                                                            <AccessButton
                                                                size="sm"
                                                                variant="primary"
                                                                className="flex items-center gap-1"
                                                                icon={<Calendar size={14} />}
                                                                onClick={() =>
                                                                    handleCreateEvent(version)
                                                                }
                                                                scope={["w:events"]}
                                                            >
                                                                Create Event
                                                            </AccessButton>
                                                        )}
                                                </div>
                                            </div>

                                            {/* Expanded Details */}
                                            {isExpanded && (
                                                <div className="mt-4 pl-8 space-y-2 text-sm">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div>
                                                            <span className="font-medium">
                                                                Requirement:
                                                            </span>
                                                            <p className="text-gray-600">
                                                                {version.highlvelRequirement}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <span className="font-medium">
                                                                Client PoC:
                                                            </span>
                                                            <p className="text-gray-600">
                                                                {version.clientPoC}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <span className="font-medium">
                                                                From Date:
                                                            </span>
                                                            <p className="text-gray-600">
                                                                {version.fromDate
                                                                    ? new Date(
                                                                          version.fromDate,
                                                                      ).toLocaleDateString()
                                                                    : "N/A"}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <span className="font-medium">
                                                                To Date:
                                                            </span>
                                                            <p className="text-gray-600">
                                                                {version.toDate
                                                                    ? new Date(
                                                                          version.toDate,
                                                                      ).toLocaleDateString()
                                                                    : "N/A"}
                                                            </p>
                                                        </div>
                                                        {version.clonedFromEstimateId && (
                                                            <div className="col-span-2">
                                                                <span className="font-medium">
                                                                    Cloned from:
                                                                </span>
                                                                <p className="text-gray-600">
                                                                    {versions.find(
                                                                        v =>
                                                                            v.id ===
                                                                            version.clonedFromEstimateId,
                                                                    )?.version || "Unknown"}
                                                                </p>
                                                            </div>
                                                        )}
                                                        <div className="col-span-2">
                                                            <span className="font-medium">
                                                                Created:
                                                            </span>
                                                            <p className="text-gray-600">
                                                                {version.createdAt
                                                                    ? new Date(
                                                                          version.createdAt,
                                                                      ).toLocaleString()
                                                                    : "N/A"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                    {!isViewOnlyMode && hasEventCreatedEstimate && eventCreatedVersion && (
                        <Button
                            variant="primary"
                            onClick={() => handleAdditionalEstimate(eventCreatedVersion)}
                        >
                            Additional Estimate
                        </Button>
                    )}
                </ModalFooter>
            </Modal>
        </>
    );
}
