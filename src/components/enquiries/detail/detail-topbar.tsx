"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight, FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Enquiry } from "@/types/enquiry";
import { formatShortDate } from "@/lib/utils/date";
import { statusBadgeMeta } from "./detail-design";

interface P {
    enquiry: Enquiry;
    priority?: string | null;
    normStatus: string;
    canWrite: boolean;
    workflowState: "" | "ESTIMATE_CREATED" | "EVENT_CREATED";
    workflowLoading: boolean;
    creating: boolean;
    onCreateEstimate: () => void;
    onEdit: () => void;
}
export function DetailTopBar(p: P) {
    const router = useRouter();
    const e = p.enquiry;
    const title = e.eventName || e.title || "Untitled Enquiry";
    const client = e.clientName || e.client || "Jatin";
    const created = e.date ? formatShortDate(e.date) : "—";
    const by = (e as unknown as { createdBy?: string }).createdBy || e.assignee || "Rahul";
    const num = `ENQ-${String(e.id).padStart(4, "0").slice(-4)}`;
    const badge = statusBadgeMeta(p.normStatus);
    // Backend priority: LOW | MEDIUM | HIGH | URGENT (null when not set).
    const priority = (p.priority || e.priority || "").trim().toUpperCase();
    const priorityLabel =
        priority === "URGENT"
            ? "Urgent Priority"
            : priority === "HIGH"
              ? "High Priority"
              : priority === "MEDIUM"
                ? "Medium Priority"
                : priority === "LOW"
                  ? "Low Priority"
                  : "High Priority";
    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <nav
                    aria-label="Breadcrumb"
                    className="flex min-w-0 items-center gap-1.5 text-[12px] text-muted-foreground mb-1.5"
                >
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface">
                        <FileText size={11} aria-hidden />
                    </span>
                    <Link href="/enquiries" className="hover:text-primary hover:underline">
                        Enquiries
                    </Link>
                    <ChevronRight size={12} aria-hidden />
                    <span className="font-semibold text-foreground">{num}</span>
                    <Badge
                        variant={badge.variant}
                        className="ml-4 gap-1 px- py-[2px] text-[11px] font-semibold"
                    >
                        <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: badge.dot }}
                            aria-hidden
                        />
                        {badge.label}
                    </Badge>
                </nav>
            </div>
            <div className="mt-2.5 mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <h1 className="text-[20px] font-bold leading-tight tracking-tight text-[#1a1225]">
                        {title}
                    </h1>
                    <div className="text-[12px] text-muted-foreground flex gap-2 align-items-center items-center flex-wrap">
                        Client: <span className="font-semibold text-foreground">{client}</span>
                        <span aria-hidden className="text-[24px] leading-none">
                            •
                        </span>
                        Created {created} by {by}
                        {priorityLabel ? (
                            <>
                                <span aria-hidden className="text-[24px] leading-none">
                                    •
                                </span>
                                <span className="font-bold text-primary">{priorityLabel}</span>
                            </>
                        ) : null}
                    </div>
                </div>
                <div className="flex shrink-0 items-stretch gap-2">
                    {/* <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#fbeef1] text-[#ab3857]">
                            <Building2 size={14} aria-hidden />
                        </span>
                        <span>
                            <span className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                Target Budget
                            </span>
                            <span className="block text-[13px] font-bold text-foreground">
                                {budget ? formatINRCurrency(Number(budget)) : "₹6,50,000"}
                            </span>
                        </span>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#fbeef1] text-[#ab3857]">
                            <Users size={14} aria-hidden />
                        </span>
                        <span>
                            <span className="block text-[9px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                Est. Guests
                            </span>
                            <span className="block text-[13px] font-bold text-foreground">
                                {guests ? `${guests} Attendees` : "350 Attendees"}
                            </span>
                        </span>
                    </div> */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={p.onEdit}
                            disabled={!p.canWrite}
                            icon={<Pencil size={13} aria-hidden />}
                        >
                            Edit Enquiry
                        </Button>
                        {p.workflowState === "EVENT_CREATED" ? (
                            <Button size="sm" onClick={() => router.push(`/events/${e.eventID}`)}>
                                View Event
                            </Button>
                        ) : p.workflowState === "ESTIMATE_CREATED" ? (
                            <Button
                                size="sm"
                                onClick={() => router.push(`/estimates?enquiryId=${e.id}`)}
                            >
                                View Estimate
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                disabled={p.creating || p.workflowLoading || !p.canWrite}
                                isLoading={p.creating}
                                onClick={p.onCreateEstimate}
                                icon={
                                    !p.creating ? <ArrowRight size={13} aria-hidden /> : undefined
                                }
                            >
                                Create Estimate
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
