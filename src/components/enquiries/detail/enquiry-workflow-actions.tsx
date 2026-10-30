"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, ExternalLink, FilePlus2, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MenuList } from "@/components/ui/menu-list";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { useEstimatePrefill } from "@/context/estimate-prefill";
import { Enquiry } from "@/types/enquiry";

interface WorkflowActionsProps {
    enquiry: Enquiry;
    workflowState: "" | "ESTIMATE_CREATED" | "EVENT_CREATED";
    workflowLoading: boolean;
    onEdit: () => void;
    onDeleted: () => void;
    canWrite: boolean;
}

function getAssignee(enquiry: Enquiry): string {
    const a = enquiry.assignedTo?.trim() || "";
    if (a && a !== "Unassigned") return a;
    return enquiry.assignee?.trim() || "";
}

/** Primary workflow CTAs + overflow menu. Logic lifted from EnquiryViewModal. */
export function EnquiryWorkflowActions({
    enquiry,
    workflowState,
    workflowLoading,
    onEdit,
    onDeleted,
    canWrite,
}: WorkflowActionsProps) {
    const router = useRouter();
    const { setPrefill } = useEstimatePrefill();
    const [creating, setCreating] = useState(false);
    const [cloning, setCloning] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const busy = creating || cloning || deleting;
    const title = enquiry.eventName || enquiry.title || "Untitled Enquiry";
    const openEstimatePage = () => router.push(`/estimates?enquiryId=${enquiry.id}`);

    const handleCreateEstimate = async () => {
        setCreating(true);
        try {
            const res = await apiRequest(API_ENDPOINTS.estimates.list, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: enquiry.eventName || enquiry.title || "Event",
                    status: "ENQUIRY_CREATED",
                    enquiryDate: enquiry.date || new Date().toISOString(),
                    fromDate: enquiry.fromDate || enquiry.date || new Date().toISOString(),
                    toDate: enquiry.toDate || enquiry.date || new Date().toISOString(),
                    assignedTo: getAssignee(enquiry),
                    eventID: enquiry.eventID,
                    venue: enquiry.venue || "",
                    eventName: enquiry.eventName || enquiry.title || "Event",
                    location: enquiry.location || "",
                    client: enquiry.client,
                    enquiryId: String(enquiry.id ?? ""),
                    eventType: enquiry.eventType || "CORPORATE",
                    highlvelRequirement: enquiry.highlvelRequirement || "",
                    clientID: enquiry.clientID || "",
                }),
            });
            if (!res.ok) throw new Error(`Failed to create estimate (${res.status})`);
            const created = await res.json();
            toast.success("Estimate created from enquiry");
            setPrefill({ ...created, title: created.title || enquiry.eventName || "Event" });
            router.push("/estimates");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to create estimate");
        } finally {
            setCreating(false);
        }
    };
    const handleClone = async () => {
        setCloning(true);
        try {
            const detailRes = await apiRequest(API_ENDPOINTS.enquiries.detail(enquiry.id), {
                method: "GET",
            });
            if (!detailRes.ok) throw new Error("Failed to load enquiry for cloning");
            const full = await detailRes.json();
            const cloneRes = await apiRequest(API_ENDPOINTS.enquiries.clone, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(full),
            });
            if (!cloneRes.ok) throw new Error(`Clone failed (${cloneRes.status})`);
            toast.success("Enquiry cloned successfully");
            router.push("/enquiries");
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to clone enquiry");
        } finally {
            setCloning(false);
        }
    };

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await apiRequest(API_ENDPOINTS.enquiries.detail(enquiry.id), {
                method: "DELETE",
            });
            if (!res.ok) throw new Error(`Delete failed (${res.status})`);
            toast.success("Enquiry deleted successfully");
            setDeleteOpen(false);
            onDeleted();
        } catch {
            toast.error("Failed to delete enquiry. Please try again.");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
                {workflowState === "EVENT_CREATED" ? (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={workflowLoading || busy}
                        onClick={() => router.push(`/events/${enquiry.eventID}`)}
                        icon={<ExternalLink size={14} aria-hidden />}
                    >
                        View Event
                    </Button>
                ) : workflowState === "ESTIMATE_CREATED" ? (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={workflowLoading || busy}
                        onClick={openEstimatePage}
                        icon={<ExternalLink size={14} aria-hidden />}
                    >
                        View Estimate
                    </Button>
                ) : (
                    <Button
                        size="sm"
                        disabled={creating || workflowLoading || busy || !canWrite}
                        isLoading={creating}
                        onClick={handleCreateEstimate}
                        icon={!creating ? <FilePlus2 size={14} aria-hidden /> : undefined}
                    >
                        Create Estimate
                    </Button>
                )}
                {canWrite && (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={onEdit}
                        icon={<Pencil size={14} aria-hidden />}
                    >
                        Edit
                    </Button>
                )}
                <MenuList
                    align="end"
                    trigger={
                        <Button size="sm" variant="ghost" className="px-2.5" aria-label="More actions">
                            •••
                        </Button>
                    }
                    items={[
                        {
                            key: "clone",
                            label: cloning ? "Cloning…" : "Clone enquiry",
                            icon: <Copy size={14} aria-hidden />,
                            onClick: handleClone,
                            scopes: ["w:enquiries"],
                        },
                        {
                            key: "delete",
                            label: "Delete enquiry",
                            icon: <Trash2 size={14} aria-hidden />,
                            onClick: () => setDeleteOpen(true),
                            className: "text-destructive",
                            scopes: ["w:enquiries"],
                        },
                    ]}
                />
            </div>
            <ConfirmationModal
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={handleDelete}
                title="Delete Enquiry"
                description={`Are you sure you want to delete "${title}"? This action cannot be undone.`}
                confirmText={deleting ? "Deleting…" : "Delete"}
                isLoading={deleting}
            />
        </>
    );
}
