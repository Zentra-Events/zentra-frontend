"use client";
import { Copy, Printer } from "lucide-react";
import { toast } from "sonner";
import { Enquiry } from "@/types/enquiry";
import { formatShortDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import { CopyIcon, TrashIcon } from "@/components/ui/icons";
interface P {
    e: Enquiry;
    canWrite: boolean;
    cloning: boolean;
    onClone: () => void;
    onDelete: () => void;
    onPDF: () => void;
}
export function DetailSideBottom(p: P) {
    const e = p.e;
    // const phone = e.enquiryPoCNumber || (e as unknown as { poc?: string }).poc || "1234567899";
    // const pocName = e.clientPoC || e.clientName || e.client || "Jatin";
    // const num = `ENQ-${String(e.id).padStart(4, "0").slice(-4)}`;
    // const title = e.eventName || e.title || "Event";
    const created = e.date ? formatShortDate(e.date) : "—";
    const by = (e as unknown as { createdBy?: string }).createdBy || e.assignee || "Rahul";
    const cp = (t: string, m: string) => {
        void navigator.clipboard?.writeText(t).then(
            () => toast.success(m),
            () => toast.error("Copy failed"),
        );
    };
    return (
        <>
            <div className="border-t border-border/70 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    System References
                </p>
                <div className="mt-1.5 space-y-1.5">
                    <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Enquiry UID
                        </p>
                        <p className="flex items-center gap-1 font-mono text-[11px] font-semibold text-foreground">
                            <span className="truncate">{e.id}</span>
                            <button
                                type="button"
                                aria-label="Copy enquiry UID"
                                onClick={() => cp(String(e.id), "Enquiry ID copied")}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <Copy size={12} aria-hidden />
                            </button>
                        </p>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Event Code
                        </p>
                        <p className="flex items-center gap-1 font-mono text-[11px] font-semibold text-foreground">
                            <span className="truncate">{e.eventID}</span>
                            <button
                                type="button"
                                aria-label="Copy event code"
                                onClick={() => cp(String(e.eventID), "Event code copied")}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <Copy size={12} aria-hidden />
                            </button>
                        </p>
                    </div>
                </div>
            </div>
            <div className="border-t border-border/70 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    Metadata
                </p>
                <dl className="mt-1.5 space-y-1.5 text-[12px]">
                    <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Created</dt>
                        <dd className="font-medium text-foreground">
                            {created} by {by}
                        </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Last Updated</dt>
                        <dd className="font-medium text-foreground">2 hours ago</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                        <dt className="text-muted-foreground">Channel</dt>
                        <dd className="font-medium text-foreground">Direct Referral</dd>
                    </div>
                </dl>
            </div>
            <div className="space-y-2 border-t border-border/70 pt-3">
                <button
                    type="button"
                    onClick={p.onPDF}
                    className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#f1f5f9] text-[12px] font-semibold text-[#334155] hover:bg-[#e2e8f0]"
                >
                    <Printer size={13} aria-hidden /> Generate Enquiry PDF
                </button>
                {/* <a
                    href={`mailto:?subject=${encodeURIComponent(`Enquiry ${num} — ${title}`)}`}
                    className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#f1f5f9] text-[12px] font-semibold text-[#334155] hover:bg-[#e2e8f0]"
                >
                    <Mail size={13} aria-hidden /> Send Quick Email
                </a>
                <a
                    href={`https://wa.me/${String(phone).replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${pocName}, following up on your enquiry ${num} — ${title}.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg bg-[#f1f5f9] text-[12px] font-semibold text-[#334155] hover:bg-[#e2e8f0]"
                >
                    <MessageCircle size={13} aria-hidden className="text-[#16a34a]" /> WhatsApp
                    Reminder
                </a> */}
            </div>
            {p.canWrite && (
                <div className="space-y-2 border-t border-border/70 pt-2.5">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 w-full text-[12px] font-semibold"
                        icon={p.cloning ? undefined : <CopyIcon size={14} />}
                        onClick={p.onClone}
                        isLoading={p.cloning}
                    >
                        {p.cloning ? "Cloning…" : "Clone enquiry"}
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-8 w-full text-[12px] font-semibold"
                        icon={<TrashIcon size={14} />}
                        onClick={p.onDelete}
                    >
                        Delete
                    </Button>
                </div>
            )}
        </>
    );
}
