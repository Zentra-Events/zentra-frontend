"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { MoreVerticalIcon, TrashIcon, FileTextIcon } from "@/components/ui/icons";
import { Button, MenuList, PageHeader, DataTable, type Column, Badge } from "@/components/ui";
import { MobileCardList } from "@/components/shared/mobile-card-list";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import CreateEstimateModal from "@/components/create-estimate-modal";
import { EstimateVersionsView } from "@/components/estimate-versions-view";
import { EstimateDto, EstimateItem } from "@/types/estimate";
import { useEstimatePrefill } from "@/context/estimate-prefill";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { apiRequest } from "@/lib/api/api-client";
import { AccessButton } from "@/components/shared/access-button";
import { MenuItem } from "@/types";
import { Download, FilePlus2Icon } from "lucide-react";

type EstimateRecord = EstimateDto & {
    clientName?: string;
    enquiryId?: string;
    assignee?: string;
};

type StatusTab = "open" | "cancelled" | "closed";

const statusLabelMap: Record<StatusTab, string> = {
    open: "Open",
    cancelled: "Cancelled",
    closed: "Closed",
};

const getStatusVariant = (
    status?: string,
): "default" | "success" | "warning" | "danger" | "info" => {
    const normalized = (status ?? "").toLowerCase();
    if (normalized === "in_progress" || normalized === "open" || normalized === "in progress")
        return "warning";
    if (normalized === "closed" || normalized === "approved" || normalized === "final")
        return "success";
    if (normalized === "cancelled" || normalized === "canceled") return "danger";
    return "default";
};

const normaliseEstimate = (raw: Record<string, unknown>): EstimateRecord => {
    const get = <T,>(paths: string[], fallback: T): T => {
        for (const key of paths) {
            if (key in raw && raw[key] !== undefined && raw[key] !== null) {
                return raw[key] as T;
            }
        }
        return fallback;
    };

    const clientRaw = get<unknown>(["client", "customer", "clientInfo"], null);
    let clientName: string | undefined;
    let clientId: string | undefined;
    if (typeof clientRaw === "string" && !clientRaw.startsWith("{")) {
        clientName = clientRaw;
    } else if (clientRaw && typeof clientRaw === "object") {
        const c = clientRaw as { name?: string; id?: string };
        clientName = c.name;
        clientId = c.id;
    }

    const status = get<string | undefined>(["status", "estimateStatus", "state"], undefined);

    const itemsRaw = get<Record<string, unknown> | undefined>(["items"], undefined);
    const items =
        itemsRaw && typeof itemsRaw === "object"
            ? Object.entries(itemsRaw as Record<string, unknown>).reduce<
                  Record<string, EstimateItem[]>
              >((acc, [category, value]) => {
                  if (!Array.isArray(value)) return acc;
                  acc[category] = value.map((item, index) => {
                      const entry = item as Record<string, unknown>;
                      const quantity =
                          typeof entry.quantity === "number"
                              ? entry.quantity
                              : Number(entry.quantity ?? 0);
                      const unitCost =
                          typeof entry.unitCost === "number"
                              ? entry.unitCost
                              : Number(entry.unitCost ?? 0);
                      return {
                          id: String(entry.id ?? `${category}-${index}`),
                          description: String(entry.description ?? "Line item"),
                          quantity: Number.isFinite(quantity) ? quantity : 0,
                          unitCost: Number.isFinite(unitCost) ? unitCost : 0,
                          total: Number.isFinite(quantity * unitCost)
                              ? Number((quantity * unitCost).toFixed(2))
                              : 0,
                      };
                  });
                  return acc;
              }, {})
            : undefined;

    return {
        id: get<string | undefined>(["id", "estimateId"], undefined),
        enquiryId: get<string | undefined>(["enquiryId", "enquiry_id"], undefined),
        title: get<string | undefined>(["title", "eventName", "eventTitle"], undefined),
        highlvelRequirement: get<string>(["highlvelRequirement", "summary", "title"], ""),
        eventName: get<string | undefined>(["eventName", "title"], undefined),
        enquiryDate: get<string | undefined>(["enquiryDate", "createdAt"], undefined),
        fromDate: get<string | undefined>(["fromDate", "eventStart"], undefined),
        toDate: get<string | undefined>(["toDate", "eventEnd"], undefined),
        status: status ? (status.toUpperCase() as EstimateDto["status"]) : undefined,
        location: get<string | undefined>(["location", "eventLocation", "city"], undefined),
        venue: get<string>(["venue", "location"], ""),
        clientPoC: get<string>(["clientPoC", "clientContact"], ""),
        pocContactNumber: get<string>(["pocContactNumber", "clientPhone", "contactNumber"], ""),
        enquiryPoC: get<string | undefined>(["enquiryPoC", "internalPoC"], undefined),
        clientName: clientName ?? String(get<string | undefined>(["clientName"], clientId ?? "")),
        assignee: get<string | undefined>(["assignee", "owner", "assignedTo"], undefined),
        version: get<string | undefined>(["version"], undefined),
        estimateStatus: get<"DRAFT" | "UNDER_CLIENT_REVIEW" | "FINAL" | undefined>(
            ["estimateStatus"],
            undefined,
        ),
        clonedFromEstimateId: get<string | null | undefined>(["clonedFromEstimateId"], undefined),
        createdAt: get<string | undefined>(["createdAt"], undefined),
        updatedAt: get<string | undefined>(["updatedAt"], undefined),
        items,
        gst: get<number>(["gst"], 0),
        serviceCharge: get<number>(["serviceCharge"], 0),
        discounts: get<number>(["discounts"], 0),
        eventID: get<string | undefined>(["eventID", "eventId"], undefined),
        versionTitle: get<string | undefined>(["versionTitle"], undefined),
    };
};

export default function EstimatesPage() {
    const { prefill: contextPrefill, clearPrefill } = useEstimatePrefill();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [tab, setTab] = useState<StatusTab>("open");
    const [estimates, setEstimates] = useState<EstimateRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [prefill, setPrefill] = useState<
        (Partial<EstimateDto> & { enquiryId?: string }) | undefined
    >(undefined);
    const [versionsViewEnquiryId, setVersionsViewEnquiryId] = useState<string | null>(null);
    const [returnToVersionsEnquiryId, setReturnToVersionsEnquiryId] = useState<string | null>(null);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [estimateToDelete, setEstimateToDelete] = useState<EstimateRecord | null>(null);

    const refreshEstimates = useCallback(async () => {
        setLoading(true);
        try {
            const res = await apiRequest(API_ENDPOINTS.estimates.list, {
                cache: "no-store",
            });
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            const data = await res.json();
            const list = Array.isArray(data)
                ? data
                : Array.isArray(data?.items)
                  ? data.items
                  : Array.isArray(data?.content)
                    ? data.content
                    : [];
            const normalised = (list as Record<string, unknown>[]).map(normaliseEstimate);

            setEstimates(normalised);
        } catch (_err) {
            setEstimates([
                normaliseEstimate({
                    id: "draft-1",
                    enquiryId: "ENQ-101",
                    highlvelRequirement: "Product Team Workshop",
                    enquiryDate: "2025-06-25T09:00:00Z",
                    clientPoC: "Invoice Creation",
                    location: "Downtown",
                    status: "IN_PROGRESS",
                    venue: "Downtown Convention Center",
                    client: { name: "Acme Corp" },
                    assignee: "Arjun PS",
                }),
                normaliseEstimate({
                    id: "draft-2",
                    enquiryId: "ENQ-093",
                    highlvelRequirement: "Annual Gala Dinner",
                    enquiryDate: "2025-06-25T10:00:00Z",
                    clientPoC: "Invoice Creation",
                    location: "City Center",
                    status: "NOT_STARTED",
                    venue: "Grand Ballroom",
                    client: { name: "Gala Events" },
                    assignee: "Athel Mathew",
                }),
            ]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshEstimates();
    }, [refreshEstimates]);

    useEffect(() => {
        if (contextPrefill) {
            setPrefill(contextPrefill);
            setIsModalOpen(true);
            clearPrefill();
        }
    }, [contextPrefill, clearPrefill]);

    // Handle opening estimate version view modal from URL query parameter
    useEffect(() => {
        const enquiryIdFromQuery = searchParams.get("enquiryId");
        if (enquiryIdFromQuery) {
            // Validate that the enquiryId is not empty
            if (enquiryIdFromQuery.trim()) {
                setVersionsViewEnquiryId(enquiryIdFromQuery);
                // Clean up the query parameter from the URL
                router.replace("/estimates");
            }
        }
    }, [searchParams, router]);

    const counts = useMemo(() => {
        const counter: Record<StatusTab, number> = {
            open: 0,
            cancelled: 0,
            closed: 0,
        };
        for (const est of estimates) {
            const status = (est.status ?? "").toLowerCase();
            if (status === "cancelled") counter.cancelled += 1;
            else if (status === "closed" || status === "approved") counter.closed += 1;
            else counter.open += 1;
        }
        return counter;
    }, [estimates]);

    const filtered = useMemo(() => {
        return estimates.filter(est => {
            const status = (est.status ?? "").toLowerCase();
            if (tab === "cancelled") return status === "cancelled";
            if (tab === "closed") return status === "closed" || status === "approved";
            return status !== "cancelled" && status !== "closed" && status !== "approved";
        });
    }, [estimates, tab]);

    const groupedEstimates = useMemo(() => {
        const groups = new Map<string, EstimateRecord[]>();

        for (const est of filtered) {
            const enquiryId = est.enquiryId || est.id || "unknown";
            if (!groups.has(enquiryId)) {
                groups.set(enquiryId, []);
            }
            groups.get(enquiryId)!.push(est);
        }

        const representatives: EstimateRecord[] = [];
        for (const [, versions] of groups.entries()) {
            const sorted = versions.sort((a, b) => {
                const versionA = parseInt(a.version?.replace("v", "") || "0");
                const versionB = parseInt(b.version?.replace("v", "") || "0");
                return versionB - versionA;
            });

            const finalVersion = sorted.find(v => v.estimateStatus === "FINAL");
            const representative = finalVersion || sorted[0];

            representatives.push({
                ...representative,
                _versionsCount: versions.length,
                _hasFinal: !!finalVersion,
            } as EstimateRecord & { _versionsCount: number; _hasFinal: boolean });
        }

        return representatives;
    }, [filtered]);

    const handleSavedEstimate = async () => {
        setIsModalOpen(false);
        setPrefill(undefined);
        await refreshEstimates().catch(err =>
            console.warn("Failed to refresh estimates after save", err),
        );
        if (returnToVersionsEnquiryId) {
            setVersionsViewEnquiryId(returnToVersionsEnquiryId);
            setReturnToVersionsEnquiryId(null);
        }
        toast.success("Estimate saved successfully");
    };

    const handleDeleteClick = (estimate: EstimateRecord) => {
        setEstimateToDelete(estimate);
        setDeleteModalOpen(true);
    };

    const handleDeleteConfirm = async () => {
        if (!estimateToDelete?.id) {
            toast.error("Cannot delete estimate without an ID");
            return;
        }

        const id = estimateToDelete.id;
        try {
            const res = await apiRequest(`/api/estimates/${encodeURIComponent(String(id))}`, {
                method: "DELETE",
            });
            if (!res.ok) {
                const txt = await res.text().catch(() => "");
                throw new Error(`Delete failed: ${res.status} ${txt}`);
            }
            setEstimates(prev => prev.filter(e => String(e.id) !== String(id)));
            toast.success("Estimate deleted successfully");
        } catch (err) {
            console.error("Failed to delete estimate", err);
            toast.error("Failed to delete estimate");
        } finally {
            setDeleteModalOpen(false);
            setEstimateToDelete(null);
        }
    };

    const handleDeleteCancel = () => {
        setDeleteModalOpen(false);
        setEstimateToDelete(null);
    };

    const columns = useMemo<Column<EstimateRecord>[]>(
        () => [
            {
                key: "title",
                header: "Event Name",
                render: row => (
                    <div
                        className="font-medium cursor-pointer hover:text-blue-600"
                        onClick={() => row.enquiryId && setVersionsViewEnquiryId(row.enquiryId)}
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-primary hover:underline">
                                {row.eventName || row.highlvelRequirement || "Untitled Estimate"}
                            </span>
                            {row.versionTitle && (
                                <span className="text-xs font-mono bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                                    {row.versionTitle}
                                </span>
                            )}
                            {(row as EstimateRecord & { _versionsCount?: number })._versionsCount &&
                                (row as EstimateRecord & { _versionsCount?: number })
                                    ._versionsCount! > 1 && (
                                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                        {
                                            (row as EstimateRecord & { _versionsCount?: number })
                                                ._versionsCount
                                        }{" "}
                                        versions
                                    </span>
                                )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {row.clientName ?? row.client ?? "Unknown client"}
                        </div>
                    </div>
                ),
            },
            {
                key: "enquiryDate",
                header: "Enquiry Date",
                render: row => (
                    <div
                        className="cursor-pointer hover:text-blue-600"
                        onClick={() => row.enquiryId && setVersionsViewEnquiryId(row.enquiryId)}
                    >
                        {row.enquiryDate
                            ? new Date(row.enquiryDate).toLocaleDateString(undefined, {
                                  month: "long",
                                  day: "numeric",
                                  year: "numeric",
                              })
                            : "—"}
                    </div>
                ),
            },
            {
                key: "clientPoC",
                header: "Client POC",
                render: row => (
                    <div
                        className="cursor-pointer hover:text-blue-600"
                        onClick={() => row.enquiryId && setVersionsViewEnquiryId(row.enquiryId)}
                    >
                        {row.clientPoC || "—"}
                    </div>
                ),
            },
            {
                key: "status",
                header: "Status",
                render: row => (
                    <div
                        className="flex flex-col gap-1 cursor-pointer"
                        onClick={() => row.enquiryId && setVersionsViewEnquiryId(row.enquiryId)}
                    >
                        <Badge variant={getStatusVariant(row.status)}>
                            {(row.status ?? "Draft").replace(/_/g, " ")}
                        </Badge>
                        {row.estimateStatus && (
                            <Badge
                                variant={
                                    row.estimateStatus === "FINAL"
                                        ? "success"
                                        : row.estimateStatus === "UNDER_CLIENT_REVIEW"
                                          ? "info"
                                          : "default"
                                }
                            >
                                {row.estimateStatus.replace(/_/g, " ")}
                            </Badge>
                        )}
                    </div>
                ),
            },
            {
                key: "assignee",
                header: "Assignee",
                render: row => (
                    <div
                        className="cursor-pointer hover:text-blue-600"
                        onClick={() => row.enquiryId && setVersionsViewEnquiryId(row.enquiryId)}
                    >
                        {row.assignee ?? "Unassigned"}
                    </div>
                ),
            },
            {
                key: "actions",
                header: "",
                className: "text-right",
                render: row => {
                    const items: MenuItem[] = [
                        {
                            key: "versions",
                            label: "View Versions",
                            icon: <FileTextIcon size={16} />,
                            onClick: () => row.enquiryId && setVersionsViewEnquiryId(row.enquiryId),
                            disabled: !row.enquiryId,
                        },
                        {
                            key: "delete",
                            label: "Delete",
                            icon: <TrashIcon size={16} />,
                            onClick: () => handleDeleteClick(row),
                            className: "text-destructive focus:text-destructive",
                            scopes: ["w:estimates"],
                        },
                    ];

                    return (
                        <div className="flex justify-center">
                            <MenuList
                                align="end"
                                items={items}
                                trigger={
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                        <MoreVerticalIcon size={16} />
                                    </Button>
                                }
                            />
                        </div>
                    );
                },
            },
        ],
        [],
    );

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            <PageHeader
                title="Estimate Management"
                description={`Manage all estimates. You have ${counts.open} open ${counts.open === 1 ? "estimate" : "estimates"}`}
                actions={
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
                        <Button
                            variant="ghost"
                            className="w-full sm:w-auto"
                            // onClick={handleExport}
                            icon={<Download size={16} />}
                        >
                            Export
                        </Button>
                        <AccessButton
                            scope={["w:estimates"]}
                            className="w-full sm:w-auto"
                            onClick={() => setIsModalOpen(true)}
                            icon={<FilePlus2Icon size={16} />}
                        >
                            Create Estimate
                        </AccessButton>
                    </div>
                }
            />

            <div className="flex flex-col gap-4 sm:gap-1">
                <nav className="flex gap-6">
                    {(Object.keys(statusLabelMap) as StatusTab[]).map(key => {
                        const disabled = counts[key] === 0;
                        return (
                            <button
                                key={key}
                                onClick={() => !disabled && setTab(key)}
                                aria-disabled={disabled}
                                title={
                                    disabled ? `No ${statusLabelMap[key]} estimates yet` : undefined
                                }
                                className={`pb-2 text-sm font-medium ${
                                    tab === key
                                        ? "border-b-3 border-primary"
                                        : "text-muted-foreground"
                                } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                            >
                                {statusLabelMap[key]}
                            </button>
                        );
                    })}
                </nav>

                <div className="rounded-lg bg-surface p-4 sm:p-6 shadow-sm hidden md:block">
                    <DataTable
                        columns={columns}
                        data={groupedEstimates}
                        rowKey={row => String(row.id ?? row.highlvelRequirement)}
                        emptyMessage="No estimates found."
                        hoverable
                        isLoading={loading}
                    />
                </div>

                <MobileCardList
                    className="flex flex-col gap-4 md:hidden"
                    items={groupedEstimates.map(est => ({ id: String(est.id ?? ""), data: est }))}
                    renderHeader={est => (
                        <div className="flex items-center justify-between">
                            <div className="font-bold text-lg">
                                {est.highlvelRequirement || "Untitled Estimate"}
                            </div>
                            <Badge variant={getStatusVariant(est.status)}>
                                {(est.status ?? "Draft").replace(/_/g, " ")}
                            </Badge>
                        </div>
                    )}
                    renderContent={est => (
                        <>
                            <div className="mb-1">
                                Client:{" "}
                                <span className="font-medium">
                                    {est.clientName ?? est.client ?? "Unknown"}
                                </span>
                            </div>
                            <div className="mb-1">
                                Enquiry Date:{" "}
                                <span className="font-medium">
                                    {est.enquiryDate
                                        ? new Date(est.enquiryDate).toLocaleDateString()
                                        : "N/A"}
                                </span>
                            </div>
                            <div className="mb-1">
                                Client POC:{" "}
                                <span className="font-medium">{est.clientPoC || "N/A"}</span>
                            </div>
                            {est.assignee && (
                                <div className="mb-1">
                                    Assignee: <span className="font-medium">{est.assignee}</span>
                                </div>
                            )}
                            {est.version && (
                                <div className="mb-1">
                                    Version:{" "}
                                    <span className="font-medium text-purple-600">
                                        {est.version}
                                    </span>
                                </div>
                            )}
                            {(est as EstimateRecord & { _versionsCount?: number })._versionsCount &&
                                (est as EstimateRecord & { _versionsCount?: number })
                                    ._versionsCount! > 1 && (
                                    <div className="mb-1">
                                        Versions:{" "}
                                        <span className="font-medium text-blue-600">
                                            {
                                                (
                                                    est as EstimateRecord & {
                                                        _versionsCount?: number;
                                                    }
                                                )._versionsCount
                                            }
                                        </span>
                                    </div>
                                )}
                        </>
                    )}
                    renderActions={est => (
                        <div className="flex gap-2 justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setPrefill(est);
                                    setIsModalOpen(true);
                                }}
                            >
                                Edit
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    est.enquiryId && setVersionsViewEnquiryId(est.enquiryId)
                                }
                                disabled={!est.enquiryId}
                            >
                                Versions
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteClick(est)}
                            >
                                Delete
                            </Button>
                        </div>
                    )}
                    emptyMessage="No estimates found."
                    isLoading={loading}
                />
            </div>

            <CreateEstimateModal
                isOpen={isModalOpen}
                onClose={async () => {
                    setIsModalOpen(false);
                    setPrefill(undefined);
                    clearPrefill();
                    await refreshEstimates().catch(err =>
                        console.warn("Failed to refresh estimates on close", err),
                    );
                    if (returnToVersionsEnquiryId) {
                        setVersionsViewEnquiryId(returnToVersionsEnquiryId);
                        setReturnToVersionsEnquiryId(null);
                    }
                }}
                initialData={prefill}
                onSaved={handleSavedEstimate}
            />

            {versionsViewEnquiryId && (
                <EstimateVersionsView
                    enquiryId={versionsViewEnquiryId}
                    onVersionSelect={estimate => {
                        setPrefill(estimate);
                        setIsModalOpen(true);
                        setVersionsViewEnquiryId(null);
                        setReturnToVersionsEnquiryId(estimate.enquiryId ?? null);
                    }}
                    onClose={() => {
                        setVersionsViewEnquiryId(null);
                    }}
                />
            )}

            <ConfirmationModal
                open={deleteModalOpen}
                onClose={handleDeleteCancel}
                onConfirm={handleDeleteConfirm}
                title="Delete Estimate"
                description={
                    estimateToDelete
                        ? `Are you sure you want to delete "${estimateToDelete.highlvelRequirement || "this estimate"}"? This action cannot be undone.`
                        : undefined
                }
                confirmText="Delete"
                cancelText="Cancel"
            />
        </div>
    );
}
