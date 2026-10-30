"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { Enquiry } from "@/types/enquiry";
import { ENQUIRY_PRIORITY_OPTIONS, type EnquiryPriorityValue } from "@/constants/enquiry";
import { Select } from "@/components/ui/select";
import { useUsers } from "@/hooks/useUsers";
import { getAssigneeName, normalizeStatus, PRIMARY_STATUSES, statusLabel } from "./detail-design";

interface P {
    e: Enquiry;
    canWrite: boolean;
    busy?: boolean;
    priority: EnquiryPriorityValue;
    onPriorityChange: (priority: EnquiryPriorityValue) => Promise<boolean>;
    status: string;
    onStatusChange: (status: string) => Promise<boolean>;
    onAssigneeChange: (assignee: string) => Promise<boolean>;
}

const FIELD_LABEL = "block text-[11px] font-semibold text-muted-foreground";

export function DetailSideTop(p: P) {
    const e = p.e;
    const { users, loading: usersLoading } = useUsers();
    const [assigneeSaving, setAssigneeSaving] = useState(false);
    const [prioritySaving, setPrioritySaving] = useState(false);
    const [statusSaving, setStatusSaving] = useState(false);
    const assignee = getAssigneeName(e);
    const client = e.clientName || e.client || "";
    const eventPoc = e.eventPoC || "";
    const phone = e.enquiryPoCNumber || (e as unknown as { poc?: string }).poc || "";
    const disabled = !p.canWrite || !!p.busy;

    const priorityOptions = useMemo(
        () => ENQUIRY_PRIORITY_OPTIONS.map(o => ({ label: o.label, value: o.value })),
        [],
    );
    // Pipeline statuses only — DNP / LOST / CANCELLED stay on the tracker.
    const statusOptions = useMemo(
        () => PRIMARY_STATUSES.map(s => ({ label: s.label, value: s.value })),
        [],
    );
    const assigneeOptions = useMemo(() => {
        const names = users.map(u => u.name?.trim() || "").filter(Boolean);
        if (assignee && !names.includes(assignee)) names.unshift(assignee);
        return Array.from(new Set(names)).map(name => ({ label: name, value: name }));
    }, [users, assignee]);

    const currentStatus = normalizeStatus(p.status);
    const selectedStatus =
        statusOptions.find(o => o.value === currentStatus) ??
        (currentStatus ? { value: currentStatus, label: statusLabel(currentStatus) } : null);
    const selectedPriority = priorityOptions.find(o => o.value === p.priority) ?? null;
    const selectedAssignee = assignee ? { value: assignee, label: assignee } : null;

    return (
        <>
            <div className="space-y-3 ">
                <div className="space-y-1.5">
                    <label className={FIELD_LABEL} htmlFor="enquiry-status-select">
                        Status
                    </label>
                    <Select
                        inputId="enquiry-status-select"
                        aria-label="Enquiry status"
                        options={statusOptions}
                        value={selectedStatus}
                        isDisabled={disabled || statusSaving}
                        isLoading={statusSaving}
                        isSearchable={false}
                        placeholder="Select status"
                        onChange={(opt: unknown) => {
                            const next = (opt as { value?: string } | null)?.value;
                            if (!next || next === currentStatus) return;
                            setStatusSaving(true);
                            void (async () => {
                                try {
                                    const ok = await p.onStatusChange(next);
                                    if (ok) toast.success(`Status updated to ${statusLabel(next)}`);
                                    else toast.error("Failed to update status");
                                } catch {
                                    toast.error("Failed to update status");
                                } finally {
                                    setStatusSaving(false);
                                }
                            })();
                        }}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className={FIELD_LABEL} htmlFor="enquiry-assignee-select">
                        Assignee
                    </label>
                    <Select
                        inputId="enquiry-assignee-select"
                        aria-label="Enquiry assignee"
                        options={assigneeOptions}
                        value={selectedAssignee}
                        isDisabled={disabled || assigneeSaving}
                        isLoading={assigneeSaving}
                        isSearchable={true}
                        placeholder={usersLoading ? "Loading users…" : "Select assignee"}
                        onChange={(opt: unknown) => {
                            const next = (opt as { value?: string } | null)?.value;
                            if (!next || next === assignee) return;
                            setAssigneeSaving(true);
                            void (async () => {
                                try {
                                    const ok = await p.onAssigneeChange(next);
                                    if (ok) toast.success(`Assignee updated to ${next}`);
                                    else toast.error("Failed to update assignee");
                                } catch {
                                    toast.error("Failed to update assignee");
                                } finally {
                                    setAssigneeSaving(false);
                                }
                            })();
                        }}
                    />
                </div>
                <div className="space-y-1.5">
                    <label className={FIELD_LABEL} htmlFor="enquiry-priority-select">
                        Priority
                    </label>
                    <Select
                        inputId="enquiry-priority-select"
                        aria-label="Enquiry priority"
                        options={priorityOptions}
                        value={selectedPriority}
                        isDisabled={disabled || prioritySaving}
                        isLoading={prioritySaving}
                        isSearchable={false}
                        placeholder="Select priority"
                        onChange={(opt: unknown) => {
                            const next = (opt as { value?: EnquiryPriorityValue } | null)?.value;
                            if (!next || next === p.priority) return;
                            setPrioritySaving(true);
                            void (async () => {
                                try {
                                    const ok = await p.onPriorityChange(next);
                                    if (ok) toast.success(`Priority updated to ${next}`);
                                    else toast.error("Failed to update priority");
                                } catch {
                                    toast.error("Failed to update priority");
                                } finally {
                                    setPrioritySaving(false);
                                }
                            })();
                        }}
                    />
                </div>
            </div>
            <div className="mt-3 border-t border-border/70 pt-3">
                <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    <Users size={11} aria-hidden /> Stakeholders
                </p>
                <dl className="mt-1.5 space-y-1.5 text-[12px]">
                    <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Client</dt>
                        <dd className="font-semibold text-foreground">{client}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Enquiry POC</dt>
                        <dd className="font-semibold text-foreground">
                            {e.enquiryPoC || "Unknown"}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Event POC</dt>
                        <dd className="font-semibold text-foreground">{eventPoc || "Unknown"}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">POC Phone</dt>
                        <dd className="font-semibold text-foreground">{phone || "Unknown"}</dd>
                    </div>
                </dl>
            </div>
        </>
    );
}
