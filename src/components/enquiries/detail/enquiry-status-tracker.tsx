"use client";

import { useCallback, useMemo, useState } from "react";
import {
    Ban,
    Check,
    CircleCheck,
    FileText,
    Flame,
    RotateCcw,
    UserMinus,
    UserRound,
    XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import {
    EXCEPTIONAL_STATUSES,
    PRIMARY_STATUSES,
    STAGE_GROUPS,
    getTrackerProgress,
    statusLabel,
    type EnquiryExceptionalStatus,
    type EnquiryOutcomeTone,
    type EnquiryStageGroupId,
    type EnquiryStageStatus,
    type TrackerNodeState,
} from "@/lib/utils/enquiry-status";

export interface EnquiryStatusTrackerProps {
    /** Raw status as stored by the backend. */
    status?: string | null;
    /** Whether the current user is allowed to change the status. */
    canWrite?: boolean;
    /** Disables every interaction while another mutation is running. */
    busy?: boolean;
    /** Persists a new status. Resolves to `true` when the update succeeded. */
    onStatusChange: (status: string) => Promise<boolean>;
    className?: string;
}

interface PendingChange {
    value: string;
    title: string;
    description: string;
    confirmText: string;
    variant: "destructive" | "primary";
}

const GROUP_ICONS: Record<EnquiryStageGroupId, typeof UserRound> = {
    LEAD: UserRound,
    ENGAGEMENT: Flame,
    ESTIMATE: FileText,
    CLOSED: CircleCheck,
};

const OUTCOME_ICONS: Record<string, typeof UserRound> = {
    DNP: UserMinus,
    LOST: XCircle,
    CANCELLED: Ban,
};

const OUTCOME_TONE_BANNER: Record<EnquiryOutcomeTone, string> = {
    warning: "bg-warning-light text-warning",
    danger: "bg-error-light text-error",
    muted: "bg-muted text-muted-foreground",
};

const OUTCOME_TONE_BUTTON: Record<EnquiryOutcomeTone, string> = {
    warning:
        "border-warning/50 text-warning hover:border-warning hover:bg-warning-light hover:text-warning",
    danger: "border-error/50 text-error hover:border-error hover:bg-error-light hover:text-error",
    muted: "border-border text-muted-foreground hover:border-border-hover hover:bg-muted hover:text-muted-foreground",
};

const OUTCOME_TONE_ACTIVE: Record<EnquiryOutcomeTone, string> = {
    warning:
        "border-warning bg-warning text-white hover:border-warning hover:bg-warning hover:text-white",
    danger: "border-error bg-error text-white hover:border-error hover:bg-error hover:text-white",
    muted: "border-muted-foreground bg-muted-foreground text-white hover:border-muted-foreground hover:bg-muted-foreground hover:text-white",
};

const gridTemplate = `repeat(${PRIMARY_STATUSES.length}, minmax(0, 1fr))`;

export function EnquiryStatusTracker({
    status = "CANCELLED",
    canWrite = false,
    busy = false,
    onStatusChange,
    className,
}: EnquiryStatusTrackerProps) {
    const progress = useMemo(() => getTrackerProgress(status), [status]);
    const [pending, setPending] = useState<PendingChange | null>(null);
    const [saving, setSaving] = useState(false);

    const locked = busy || saving;

    const runChange = useCallback(
        async (next: string): Promise<boolean> => {
            setSaving(true);
            let ok = false;
            try {
                ok = await onStatusChange(next);
            } finally {
                setSaving(false);
            }
            if (ok) toast.success(`Status updated to ${statusLabel(next)}`);
            else toast.error(`Could not update status to ${statusLabel(next)}`);
            return ok;
        },
        [onStatusChange],
    );

    const selectPrimary = useCallback(
        (value: string) => {
            if (!canWrite || locked) return;
            if (value === progress.status) return;
            void runChange(value);
        },
        [canWrite, locked, progress.status, runChange],
    );

    const requestOutcome = useCallback(
        (outcome: EnquiryExceptionalStatus) => {
            if (!canWrite || locked) return;
            if (outcome.value === progress.status) return;
            setPending({
                value: outcome.value,
                title: outcome.confirmTitle,
                description: outcome.confirmDescription,
                confirmText: outcome.confirmText,
                variant: outcome.tone === "warning" ? "primary" : "destructive",
            });
        },
        [canWrite, locked, progress.status],
    );

    const requestReopen = useCallback(() => {
        const outcome = progress.outcome;
        if (!canWrite || locked) return;
        if (!outcome?.reopenable || !outcome.reopenTo) return;
        setPending({
            value: outcome.reopenTo,
            title: `Reopen enquiry as ${statusLabel(outcome.reopenTo)}`,
            description: `This enquiry will be moved back into the pipeline at the ${statusLabel(
                outcome.reopenTo,
            )} stage.`,
            confirmText: "Reopen enquiry",
            variant: "primary",
        });
    }, [canWrite, locked, progress.outcome]);

    const confirmPending = useCallback(async () => {
        if (!pending) return;
        const ok = await runChange(pending.value);
        if (ok) setPending(null);
    }, [pending, runChange]);

    const outcome = progress.outcome;

    return (
        <section
            aria-label="Enquiry status tracker"
            className={cn("mt-3 rounded-lg border border-border bg-white px-4 py-2", className)}
        >
            {/* Current outcome banner (exceptional statuses only) */}
            {outcome && (
                <div
                    className={cn(
                        "mt-3 flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-[12px]",
                        OUTCOME_TONE_BANNER[outcome.tone],
                    )}
                >
                    {(() => {
                        const Icon = OUTCOME_ICONS[outcome.value] ?? Ban;
                        return <Icon size={14} aria-hidden className="shrink-0" />;
                    })()}
                    <span className="font-bold">{outcome.label}</span>
                    <span className="opacity-90">{outcome.description}</span>
                    {outcome.reopenable ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={requestReopen}
                            disabled={!canWrite || locked}
                            title="Move this enquiry back into the pipeline"
                            className="ml-auto h-7   border-current bg-white/70 px-2.5 text-[11px] font-semibold text-current hover:border-current hover:bg-white hover:text-current"
                            icon={<RotateCcw size={12} aria-hidden />}
                        >
                            Reopen
                        </Button>
                    ) : (
                        <span className="ml-auto text-[11px] opacity-80">
                            {outcome.value === "LOST"
                                ? "Lost enquiries cannot be reopened"
                                : "Cancelled enquiries cannot be reopened"}
                        </span>
                    )}
                </div>
            )}

            {/* Tablet / desktop timeline */}
            <div className="mt-4 hidden overflow-x-auto pb-1 md:block">
                <div className="min-w-[640px]">
                    <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
                        {STAGE_GROUPS.map(g => {
                            const start = PRIMARY_STATUSES.findIndex(s => s.group === g.id) + 1;
                            const Icon = GROUP_ICONS[g.id];
                            return (
                                <div
                                    key={g.id}
                                    style={{ gridColumn: `${start} / span ${g.statuses.length}` }}
                                    className={cn(
                                        "flex items-center gap-1.5 px-1 pb-2",
                                        g.statuses.length === 1 && "justify-center",
                                    )}
                                >
                                    <Icon size={12} aria-hidden className="shrink-0 text-primary" />
                                    <span className="truncate text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                                        {g.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
                        {PRIMARY_STATUSES.map((s, i) => (
                            <TimelineNode
                                key={s.value}
                                status={s}
                                index={i}
                                state={progress.states[i]}
                                last={i === PRIMARY_STATUSES.length - 1}
                                leftDone={i > 0 && progress.states[i] !== "upcoming"}
                                rightDone={
                                    i < PRIMARY_STATUSES.length - 1 &&
                                    progress.states[i + 1] !== "upcoming"
                                }
                                canWrite={canWrite}
                                locked={locked}
                                isCurrent={progress.status === s.value}
                                onSelect={selectPrimary}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Mobile stepper */}
            <ol className="mt-3 space-y-0 md:hidden">
                {PRIMARY_STATUSES.map((s, i) => (
                    <MobileStep
                        key={s.value}
                        status={s}
                        index={i}
                        state={progress.states[i]}
                        last={i === PRIMARY_STATUSES.length - 1}
                        nextDone={
                            i < PRIMARY_STATUSES.length - 1 && progress.states[i + 1] !== "upcoming"
                        }
                        canWrite={canWrite}
                        locked={locked}
                        isCurrent={progress.status === s.value}
                        onSelect={selectPrimary}
                    />
                ))}
            </ol>

            {/* Exceptional outcomes */}
            <div className="mt-4 border-t border-border/70 pt-2">
                <div className="flex flex-wrap items-center gap-2 justify-end">
                    {EXCEPTIONAL_STATUSES.map(e => {
                        const Icon = OUTCOME_ICONS[e.value] ?? Ban;
                        const active = progress.status === e.value;
                        return (
                            <Button
                                key={e.value}
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={!canWrite || locked || active}
                                onClick={() => requestOutcome(e)}
                                title={
                                    active
                                        ? `${e.label} is the current outcome`
                                        : `Move this enquiry to ${e.label}`
                                }
                                className={cn(
                                    "h-8 px-3 text-[11px] font-semibold",
                                    active
                                        ? OUTCOME_TONE_ACTIVE[e.tone]
                                        : OUTCOME_TONE_BUTTON[e.tone],
                                )}
                                icon={<Icon size={12} aria-hidden />}
                            >
                                {e.label}
                            </Button>
                        );
                    })}
                </div>
            </div>

            <ConfirmationModal
                open={!!pending}
                onClose={() => setPending(null)}
                onConfirm={() => void confirmPending()}
                title={pending?.title ?? ""}
                description={pending?.description}
                confirmText={pending?.confirmText}
                variant={pending?.variant ?? "destructive"}
                isLoading={saving}
            />
        </section>
    );
}

/* ------------------------------------------------------------------ */
/*  Nodes                                                               */
/* ------------------------------------------------------------------ */

interface NodeProps {
    status: EnquiryStageStatus;
    index: number;
    state: TrackerNodeState;
    last: boolean;
    canWrite: boolean;
    locked: boolean;
    isCurrent: boolean;
    onSelect: (value: string) => void;
}

interface TimelineNodeProps extends NodeProps {
    leftDone: boolean;
    rightDone: boolean;
}

function nodeClasses(state: TrackerNodeState, isTerminal: boolean): string {
    if (state === "completed") return "bg-primary text-primary-foreground border-primary";
    if (state === "current") {
        return isTerminal
            ? "bg-success text-white border-success ring-4 ring-success/20"
            : "bg-primary text-primary-foreground border-primary ring-4 ring-primary/20";
    }
    return "bg-surface text-muted-foreground border-border";
}

function NodeDot({
    status,
    index,
    state,
    isCurrent,
    canWrite,
    locked,
    onSelect,
}: Pick<
    NodeProps,
    "status" | "index" | "state" | "isCurrent" | "canWrite" | "locked" | "onSelect"
>) {
    const isTerminal = status.value === "EVENT_APPROVED";
    const disabled = !canWrite || locked || isCurrent;
    return (
        <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(status.value)}
            aria-current={isCurrent ? "step" : undefined}
            aria-label={`Move to ${status.label}`}
            title={`Move to ${status.label}`}
            className={cn(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                nodeClasses(state, isTerminal),
                disabled && !isCurrent && "opacity-70",
            )}
        >
            {state === "upcoming" ? index + 1 : <Check size={14} aria-hidden strokeWidth={3} />}
        </button>
    );
}

function TimelineNode({
    status,
    index,
    state,
    last,
    leftDone,
    rightDone,
    canWrite,
    locked,
    isCurrent,
    onSelect,
}: TimelineNodeProps) {
    return (
        <div className="flex flex-col items-center">
            <div className="flex w-full items-center">
                <div className="flex flex-1 items-center justify-end pr-2">
                    {index > 0 && (
                        <span
                            aria-hidden
                            className={cn(
                                "h-0.5 w-full rounded-full transition-colors duration-300",
                                leftDone ? "bg-primary" : "bg-border",
                            )}
                        />
                    )}
                </div>
                <NodeDot
                    status={status}
                    index={index}
                    state={state}
                    isCurrent={isCurrent}
                    canWrite={canWrite}
                    locked={locked}
                    onSelect={onSelect}
                />
                <div className="flex flex-1 items-center pl-2">
                    {!last && (
                        <span
                            aria-hidden
                            className={cn(
                                "h-0.5 w-full rounded-full transition-colors duration-300",
                                rightDone ? "bg-primary" : "bg-border",
                            )}
                        />
                    )}
                </div>
            </div>
            <div className="mt-2 px-1 text-center">
                <span
                    className={cn(
                        "block text-[11px] font-medium leading-tight",
                        isCurrent
                            ? "font-bold text-primary"
                            : state === "completed"
                              ? "text-foreground"
                              : "text-muted-foreground",
                    )}
                >
                    {status.label}
                </span>
                {isCurrent && (
                    <span className="mt-1 inline-flex items-center rounded-full bg-primary-light px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-primary">
                        Current
                    </span>
                )}
            </div>
        </div>
    );
}

function MobileStep({
    status,
    index,
    state,
    last,
    nextDone,
    canWrite,
    locked,
    isCurrent,
    onSelect,
}: NodeProps & { nextDone: boolean }) {
    const group = STAGE_GROUPS.find(g => g.id === status.group);
    const GroupIcon = group ? GROUP_ICONS[group.id] : UserRound;

    return (
        <li className="flex gap-3">
            <div className="flex flex-col items-center">
                <NodeDot
                    status={status}
                    index={index}
                    state={state}
                    isCurrent={isCurrent}
                    canWrite={canWrite}
                    locked={locked}
                    onSelect={onSelect}
                />
                {!last && (
                    <span
                        aria-hidden
                        className={cn(
                            "my-1 h-6 w-0.5 shrink-0 rounded-full transition-colors duration-300",
                            nextDone ? "bg-primary" : "bg-border",
                        )}
                    />
                )}
            </div>
            <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-3")}>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                        <GroupIcon size={11} aria-hidden className="text-primary" />
                        {group?.label}
                    </span>
                    <span
                        className={cn(
                            "text-[13px] font-semibold",
                            isCurrent ? "text-primary" : "text-foreground",
                        )}
                    >
                        {status.label}
                    </span>
                    {isCurrent && (
                        <span className="inline-flex items-center rounded-full bg-primary-light px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-primary">
                            Current
                        </span>
                    )}
                </div>
            </div>
        </li>
    );
}
