"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import CreateEnquiryModal from "@/components/create-enquiry-modal";
import { useEnquiryDetail } from "@/hooks/useEnquiryDetail";
import { hasPermission } from "@/lib/utils/permissions";
import { useAuth } from "@/context/auth";
import { Enquiry, EnquiryFormData } from "@/types/enquiry";
import {
    DEFAULT_ENQUIRY_STATUS,
    type EnquiryPriorityValue,
    normalizeEnquiryPriority,
} from "@/constants/enquiry";
import { DetailTopBar } from "@/components/enquiries/detail/detail-topbar";
import { EnquiryStatusTracker } from "@/components/enquiries/detail/enquiry-status-tracker";
import { DetailInfo } from "@/components/enquiries/detail/detail-info";
import { DetailContacts } from "@/components/enquiries/detail/detail-contacts";
import { DetailNotes } from "@/components/enquiries/detail/detail-timeline";
import { DetailSideTop } from "@/components/enquiries/detail/detail-side-top";
import { DetailSideBottom } from "@/components/enquiries/detail/detail-side-bottom";
import {
    extractDetailNotes,
    getAssigneeName,
    normalizeStatus,
    statusBadgeMeta,
} from "@/components/enquiries/detail/detail-design";
import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { useEstimatePrefill } from "@/context/estimate-prefill";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";

export default function EnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    const router = useRouter();
    const { user } = useAuth();
    const { setPrefill } = useEstimatePrefill();
    const canWrite = hasPermission(user, undefined, ["w:enquiries"]);
    const detail = useEnquiryDetail(id);
    const {
        enquiry,
        priority: backendPriority,
        loading,
        error,
        refresh,
        workflowState,
        workflowLoading,
    } = detail;
    const { updateFields, updating } = detail;
    // Follow-up notes are read straight from the enquiry payload.
    const notes = useMemo(() => extractDetailNotes(enquiry?.notes), [enquiry?.notes]);
    const [priority, setPriority] = useState<EnquiryPriorityValue>("MEDIUM");
    const [statusSaving, setStatusSaving] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [cloning, setCloning] = useState(false);
    const [creating, setCreating] = useState(false);
    const [noteBody, setNoteBody] = useState("");
    const [noteError, setNoteError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    // Backend priority wins; fall back to the locally stored value.
    useEffect(() => {
        if (backendPriority) {
            setPriority(backendPriority as EnquiryPriorityValue);
            return;
        }
        try {
            const raw = localStorage.getItem(`zentra:enquiry-priority:${id}`);
            if (raw === "LOW" || raw === "MEDIUM" || raw === "HIGH" || raw === "URGENT") {
                setPriority(raw);
            }
        } catch {
            // ignore
        }
    }, [id, backendPriority]);

    // Newly created enquiries start at the first stage of the pipeline. When the
    // backend has not stored `ennquiryStatus` yet (an enquiry created before the
    // field existed) the value is initialised once — and only for enquiries that
    // never progressed past the legacy "enquiry created" status.
    const initializedStatusRef = useRef<string | null>(null);
    useEffect(() => {
        if (!enquiry) return;
        const enquiryId = String(enquiry.id);
        if (initializedStatusRef.current === enquiryId) return;
        initializedStatusRef.current = enquiryId;
        if (enquiry.ennquiryStatus?.trim()) return;
        const legacy = (enquiry.status || "").trim().toUpperCase();
        const untouched =
            legacy === "" || legacy === "ENQUIRY_CREATED" || legacy === "NEW" || legacy === "NEW_LEAD";
        if (!untouched) return;
        void updateFields({ ennquiryStatus: DEFAULT_ENQUIRY_STATUS } as Partial<Enquiry>);
    }, [enquiry, updateFields]);

    const handlePriorityChange = useCallback(
        async (p: EnquiryPriorityValue): Promise<boolean> => {
            // Persist through the same POST used by the assignee update.
            const ok = await updateFields({ priority: p } as Partial<Enquiry>);
            if (!ok) return false;
            setPriority(p);
            try {
                localStorage.setItem(`zentra:enquiry-priority:${id}`, p);
            } catch {
                // ignore
            }
            return true;
        },
        [id, updateFields],
    );

    const handleStatusChange = useCallback(
        async (status: string): Promise<boolean> => {
            setStatusSaving(true);
            try {
                // The pipeline status lives in the new `ennquiryStatus` field.
                // The legacy `status` field is deliberately left untouched so the
                // estimate / event flows keep working as before.
                return await updateFields({ ennquiryStatus: status } as Partial<Enquiry>);
            } finally {
                setStatusSaving(false);
            }
        },
        [updateFields],
    );

    const handleAssigneeChange = useCallback(
        async (assignee: string): Promise<boolean> => {
            return await updateFields({ assignedTo: assignee, assignee } as Partial<Enquiry>);
        },
        [updateFields],
    );

    // Notes live on the enquiry itself: the full array (existing notes plus the
    // new one) is persisted through the enquiry update endpoint.
    const handlePostNote = async () => {
        const text = noteBody.trim();
        if (!text || submitting) return;
        setSubmitting(true);
        setNoteError(null);
        try {
            const existing = Array.isArray(enquiry?.notes) ? enquiry.notes : [];
            const newNote = {
                userName: user?.name || "You",
                note: text,
                // Timestamp of the request initiation, in the ISO format the API expects.
                createdDate: new Date().toISOString(),
            };
            const ok = await updateFields({ notes: [...existing, newNote] } as Partial<Enquiry>);
            if (!ok) {
                setNoteError("Failed to save note. Please try again.");
                toast.error("Failed to save follow-up note");
                return;
            }
            setNoteBody("");
            toast.success("Follow-up note added");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCreateEstimate = async () => {
        if (!enquiry) return;
        setCreating(true);
        try {
            const an = getAssigneeName(enquiry);
            const res = await apiRequest(API_ENDPOINTS.estimates.list, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: enquiry.eventName || enquiry.title || "Event",
                    status: "ENQUIRY_CREATED",
                    enquiryDate: enquiry.date || new Date().toISOString(),
                    fromDate: enquiry.fromDate || enquiry.date || new Date().toISOString(),
                    toDate: enquiry.toDate || enquiry.date || new Date().toISOString(),
                    assignedTo: an,
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
            if (!res.ok) throw new Error(`Failed (${res.status})`);
            const created = await res.json();
            toast.success("Estimate created from enquiry");
            setPrefill({ ...created, title: created.title || enquiry.eventName || "Event" });
            router.push("/estimates");
        } catch (e2) {
            toast.error(e2 instanceof Error ? e2.message : "Failed to create estimate");
        } finally {
            setCreating(false);
        }
    };

    const handleClone = async () => {
        if (!enquiry) return;
        setCloning(true);
        try {
            const res = await apiRequest(API_ENDPOINTS.enquiries.clone, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: enquiry.id }),
            });
            if (!res.ok) throw new Error(`Clone failed (${res.status})`);
            toast.success("Enquiry cloned");
            void refresh();
        } catch (e3) {
            toast.error(e3 instanceof Error ? e3.message : "Clone failed");
        } finally {
            setCloning(false);
        }
    };

    const handleDelete = async () => {
        if (!enquiry) return;
        setDeleting(true);
        try {
            const res = await apiRequest(API_ENDPOINTS.enquiries.detail(String(enquiry.id)), {
                method: "DELETE",
            });
            if (!res.ok) throw new Error(`Delete failed (${res.status})`);
            toast.success("Enquiry deleted");
            setDeleteOpen(false);
            router.push("/enquiries");
        } catch (e4) {
            toast.error(e4 instanceof Error ? e4.message : "Delete failed");
        } finally {
            setDeleting(false);
        }
    };
    if (loading) {
        return (
            <div className="py-16" role="status" aria-label="Loading enquiry">
                <Loading />
            </div>
        );
    }

    if (error || !enquiry) {
        const notFound = (error || "").toLowerCase().includes("not found");
        return (
            <div className="mx-auto max-w-lg py-16 text-center">
                <h1 className="text-xl font-bold text-foreground">
                    {notFound ? "Enquiry not found" : "Failed to load enquiry"}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                    {notFound ? "This enquiry may have been deleted." : error || "Try again."}
                </p>
                <div className="mt-5 flex justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => void refresh()}>
                        Try again
                    </Button>
                    <Link href="/enquiries">
                        <Button size="sm">Back to enquiries</Button>
                    </Link>
                </div>
            </div>
        );
    }
    // The new `ennquiryStatus` field drives the tracker and the status dropdown.
    // The legacy `status` field is only a fallback for enquiries created before
    // the field existed and is never written to from this page.
    const enquiryStatus =
        enquiry.ennquiryStatus?.trim() || enquiry.status?.trim() || DEFAULT_ENQUIRY_STATUS;
    const normStatus = normalizeStatus(enquiryStatus);
    const pageTitle = enquiry.eventName || enquiry.title || "Untitled Enquiry";
    const editData: EnquiryFormData = {
        id: enquiry.id,
        title: enquiry.eventName || enquiry.title || "",
        client: enquiry.clientID || enquiry.client || "",
        clientName: enquiry.clientName || enquiry.client || "",
        eventType: enquiry.eventType,
        venue: enquiry.venue || "",
        location: enquiry.location || "",
        fromDate: enquiry.fromDate,
        toDate: enquiry.toDate,
        highlvelRequirement: enquiry.highlvelRequirement || "",
        clientPoC: enquiry.clientPoC || "",
        enquiryPoC: enquiry.enquiryPoC || "",
        enquiryPoCNumber: enquiry.enquiryPoCNumber || "",
        eventPoC: enquiry.eventPoC || "",
        eventPoCNumber: enquiry.eventPoCNumber || "",
        assignedTo: getAssigneeName(enquiry),
        priority: normalizeEnquiryPriority(priority),
        // Both status fields are carried over so editing never drops them.
        status: enquiry.status,
        ennquiryStatus: enquiryStatus,
        // Existing notes are carried over so editing never drops them.
        notes: enquiry.notes ?? [],
    };

    return (
        <div className="mx-auto w-full max-w-[1180px] pb-10">
            <style>{`@media print { aside, header, nav { display: none !important; } }`}</style>
            <DetailTopBar
                enquiry={enquiry}
                priority={backendPriority}
                normStatus={normStatus}
                canWrite={canWrite}
                workflowState={workflowState}
                workflowLoading={workflowLoading}
                creating={creating}
                onCreateEstimate={() => void handleCreateEstimate()}
                onEdit={() => setEditOpen(true)}
            />
            <EnquiryStatusTracker
                status={enquiryStatus}
                canWrite={canWrite}
                busy={statusSaving || updating}
                onStatusChange={handleStatusChange}
            />
            <div className="mt-3 grid grid-cols-1 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-w-0 space-y-3">
                    <DetailInfo e={enquiry} />
                    <DetailContacts e={enquiry} />
                    <DetailNotes
                        notes={notes}
                        loading={false}
                        err={noteError}
                        canWrite={canWrite}
                        userName={user?.name || "You"}
                        body={noteBody}
                        setBody={setNoteBody}
                        submitting={submitting}
                        onPost={() => void handlePostNote()}
                    />
                </div>
                <aside className="min-w-0 rounded-lg border border-border bg-white">
                    <header className="border-b border-border/70 px-4 py-2.5">
                        <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#7d2844]">
                            Details & Status
                        </h2>
                    </header>
                    <div className="space-y-3 px-4 py-3">
                        <DetailSideTop
                            e={enquiry}
                            canWrite={canWrite}
                            busy={statusSaving || updating}
                            priority={priority}
                            onPriorityChange={handlePriorityChange}
                            status={enquiryStatus}
                            onStatusChange={handleStatusChange}
                            onAssigneeChange={handleAssigneeChange}
                        />
                        <DetailSideBottom
                            e={enquiry}
                            canWrite={canWrite}
                            cloning={cloning}
                            onClone={() => void handleClone()}
                            onDelete={() => setDeleteOpen(true)}
                            onPDF={() => window.print()}
                        />
                    </div>
                </aside>
            </div>
            <div className="mt-4">
                <Link
                    href="/enquiries"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary"
                >
                    <ArrowLeft size={13} aria-hidden /> Back to enquiries
                </Link>
            </div>
            <CreateEnquiryModal
                isOpen={editOpen}
                onClose={() => setEditOpen(false)}
                onSubmit={() => void refresh()}
                editData={editData}
                mode="edit"
                onSaveSuccess={() => {
                    setEditOpen(false);
                    void refresh();
                }}
            />
            <ConfirmationModal
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                onConfirm={() => void handleDelete()}
                title="Delete Enquiry"
                description={`Are you sure you want to delete "${pageTitle}"? This action cannot be undone.`}
                confirmText={deleting ? "Deleting…" : "Delete"}
                isLoading={deleting}
            />
            <span className="sr-only" role="status">
                {statusBadgeMeta(normStatus).label} · Priority {priority}
            </span>
        </div>
    );
}
