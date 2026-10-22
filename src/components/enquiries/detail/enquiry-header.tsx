"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Enquiry } from "@/types/enquiry";
import { getEnquiryStatusLabel, getEventTypeVariant } from "@/constants/enquiry";
import { EnquiryStatusSelect } from "@/components/enquiries/detail/enquiry-status-select";
import { PrioritySelect } from "@/components/enquiries/detail/priority-select";
import type { EnquiryPriorityValue } from "@/constants/enquiry";
import { EnquiryWorkflowActions } from "@/components/enquiries/detail/enquiry-workflow-actions";

interface EnquiryHeaderProps {
    enquiry: Enquiry;
    priority: EnquiryPriorityValue;
    onPriorityChange: (p: EnquiryPriorityValue) => void;
    onStatusChange: (status: string) => Promise<boolean>;
    statusSaving: boolean;
    workflowState: "" | "ESTIMATE_CREATED" | "EVENT_CREATED";
    workflowLoading: boolean;
    onEdit: () => void;
    onDeleted: () => void;
    canWrite: boolean;
}

/** Compact record header: breadcrumb, title, badges, quick-edits, actions. */
export function EnquiryHeader(props: EnquiryHeaderProps) {
    const { enquiry, priority, onPriorityChange, onStatusChange } = props;
    const { statusSaving, workflowState } = props;
    const title = enquiry.eventName || enquiry.title || "Untitled Enquiry";
    const clientDisplay = enquiry.clientName || enquiry.client || "";

    return (
        <div className="rounded-lg border border-border bg-surface px-4 py-4 shadow-sm sm:rounded-lg sm:px-6">
            <nav
                aria-label="Breadcrumb"
                className="mb-2 flex items-center gap-1 text-xs text-muted-foreground"
            >
                <Link href="/enquiries" className="transition-colors hover:text-primary">
                    Enquiries
                </Link>
                <ChevronRight size={13} aria-hidden />
                <span
                    aria-current="page"
                    className="max-w-[40vw] truncate font-medium text-foreground"
                >
                    {title}
                </span>
            </nav>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                    <h1 className="text-xl font-bold tracking-tight break-words text-foreground sm:text-2xl">
                        {title}
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {clientDisplay && <span className="font-medium">{clientDisplay}</span>}
                        {clientDisplay && <span aria-hidden> · </span>}
                        <span className="text-xs">#{String(enquiry.id)}</span>
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                        {enquiry.eventType && (
                            <Badge variant={getEventTypeVariant(enquiry.eventType)}>
                                {enquiry.eventType}
                            </Badge>
                        )}
                        <EnquiryStatusSelect
                            value={enquiry.status}
                            onChange={onStatusChange}
                            disabled={!props.canWrite || statusSaving}
                            compact
                        />
                        <PrioritySelect
                            value={priority}
                            onChange={onPriorityChange}
                            disabled={statusSaving}
                            compact
                        />
                        {workflowState === "EVENT_CREATED" && (
                            <Badge variant="success">Event created</Badge>
                        )}
                        {workflowState === "ESTIMATE_CREATED" && (
                            <Badge variant="warning">Estimate created</Badge>
                        )}
                    </div>
                </div>
                <EnquiryWorkflowActions {...props} />
            </div>
            <span className="sr-only" role="status">
                {getEnquiryStatusLabel(enquiry.status)} · Priority {priority}
            </span>
        </div>
    );
}
