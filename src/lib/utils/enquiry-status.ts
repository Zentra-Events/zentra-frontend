/**
 * Canonical enquiry status catalogue.
 *
 * Single source of truth for the enquiry pipeline rendered by the enquiry
 * detail page. The catalogue mirrors the status values the backend is able to
 * store, while `normalizeStatus` keeps older / aliased backend values usable.
 */

/* ------------------------------------------------------------------ */
/*  Primary pipeline                                                    */
/* ------------------------------------------------------------------ */

export type EnquiryStageGroupId = "LEAD" | "ENGAGEMENT" | "ESTIMATE" | "CLOSED";

export interface EnquiryStageStatus {
    /** Status value persisted through the enquiry update endpoint. */
    value: string;
    /** Short label rendered under the tracker node. */
    label: string;
    /** Stage group this status belongs to. */
    group: EnquiryStageGroupId;
}

export interface EnquiryStageGroup {
    id: EnquiryStageGroupId;
    /** Stage label rendered above the tracker. */
    label: string;
    statuses: EnquiryStageStatus[];
}

/** The seven sequential statuses of the primary enquiry journey. */
export const STAGE_GROUPS: readonly EnquiryStageGroup[] = [
    {
        id: "LEAD",
        label: "Lead",
        statuses: [
            { value: "NEW_LEAD", label: "New Lead", group: "LEAD" },
            { value: "PROSPECT", label: "Prospect", group: "LEAD" },
        ],
    },
    {
        id: "ENGAGEMENT",
        label: "Engagement",
        statuses: [
            { value: "INTERESTED", label: "Interested", group: "ENGAGEMENT" },
            { value: "HOT_LEAD", label: "Hot Lead", group: "ENGAGEMENT" },
        ],
    },
    {
        id: "ESTIMATE",
        label: "Estimate",
        statuses: [
            { value: "AWAITING_ESTIMATE", label: "Awaiting Estimate", group: "ESTIMATE" },
            { value: "ESTIMATE_SENT", label: "Estimate Sent", group: "ESTIMATE" },
        ],
    },
    {
        id: "CLOSED",
        label: "Closed",
        statuses: [
            { value: "EVENT_APPROVED", label: "Event Approved", group: "CLOSED" },
        ],
    },
] as const;

/** Flat list of the primary statuses, in progression order. */
export const PRIMARY_STATUSES: readonly EnquiryStageStatus[] = STAGE_GROUPS.flatMap(
    (group) => group.statuses,
);

/* ------------------------------------------------------------------ */
/*  Exceptional outcomes                                                 */
/* ------------------------------------------------------------------ */

export type EnquiryOutcomeTone = "warning" | "danger" | "muted";

export interface EnquiryExceptionalStatus {
    /** Status value persisted through the enquiry update endpoint. */
    value: string;
    /** Short label rendered on the action button. */
    label: string;
    /** Longer description rendered next to the current outcome. */
    description: string;
    /** Visual treatment used for this outcome. */
    tone: EnquiryOutcomeTone;
    /** Whether the enquiry can be moved back into the pipeline. */
    reopenable: boolean;
    /** Status restored when a reopenable outcome is reopened. */
    reopenTo?: string;
    /** Copy used by the confirmation dialog. */
    confirmTitle: string;
    confirmDescription: string;
    confirmText: string;
}

/**
 * Statuses that live outside the primary progression. They are never rendered
 * as sequential nodes of the tracker.
 */
export const EXCEPTIONAL_STATUSES: readonly EnquiryExceptionalStatus[] = [
    {
        value: "DNP",
        label: "DNP",
        description: "Did Not Proceed",
        tone: "warning",
        reopenable: true,
        reopenTo: "PROSPECT",
        confirmTitle: "Mark enquiry as DNP",
        confirmDescription:
            "This enquiry will be marked as Did Not Proceed and taken out of the active pipeline. You can reopen it later.",
        confirmText: "Mark as DNP",
    },
    {
        value: "LOST",
        label: "Lost",
        description: "Enquiry Lost",
        tone: "danger",
        reopenable: false,
        confirmTitle: "Mark enquiry as Lost",
        confirmDescription:
            "This enquiry will be marked as Lost. Lost enquiries are closed for good and cannot be reopened.",
        confirmText: "Mark as Lost",
    },
    {
        value: "CANCELLED",
        label: "Cancelled",
        description: "Enquiry Cancelled",
        tone: "muted",
        reopenable: false,
        confirmTitle: "Cancel enquiry",
        confirmDescription:
            "This enquiry will be cancelled. Cancelled enquiries are closed for good and cannot be reopened.",
        confirmText: "Cancel enquiry",
    },
] as const;

/* ------------------------------------------------------------------ */
/*  Normalisation                                                       */
/* ------------------------------------------------------------------ */

/**
 * Maps a raw backend status onto a canonical status value.
 *
 * Unknown values are returned untouched (upper cased) so the UI can still
 * display them instead of silently pretending they are a known stage.
 */
export function normalizeStatus(raw?: string | null): string {
    const s = (raw || "").toUpperCase().trim();
    if (!s) return "NEW_LEAD";
    if (["NEW_LEAD", "NEW", "OPEN", "ENQUIRY_CREATED"].includes(s)) return "NEW_LEAD";
    if (s === "PROSPECT" || s === "PENDING") return "PROSPECT";
    if (["INTERESTED", "IN_PROGRESS"].includes(s)) return "INTERESTED";
    if (["HOT_LEAD", "HOTLEAD", "HOT"].includes(s)) return "HOT_LEAD";
    if (["AWAITING_ESTIMATE", "AWAITINGESTIMATE", "ESTIMATE_PENDING"].includes(s))
        return "AWAITING_ESTIMATE";
    if (["ESTIMATE_SENT", "ESTIMATESENT", "ESTIMATE_CREATED"].includes(s)) return "ESTIMATE_SENT";
    if (
        [
            "EVENT_APPROVED",
            "EVENTAPPROVED",
            "EVENT_CREATED",
            "CLOSED",
            "CONVERTED",
            "COMPLETED",
        ].includes(s)
    )
        return "EVENT_APPROVED";
    if (s === "DNP" || s === "DO_NOT_PURSUE") return "DNP";
    if (s === "LOST") return "LOST";
    if (["CANCELLED", "CANCELED", "REJECTED"].includes(s)) return "CANCELLED";
    return s;
}

/** Label of a status, falling back to a humanised version of the value. */
export function statusLabel(v: string): string {
    const primary = PRIMARY_STATUSES.find((s) => s.value === v);
    if (primary) return primary.label;
    const exceptional = EXCEPTIONAL_STATUSES.find((s) => s.value === v);
    if (exceptional) return exceptional.label;
    return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Longer description of a status, used for tooltips and secondary text. */
export function statusDescription(v: string): string {
    const exceptional = EXCEPTIONAL_STATUSES.find((s) => s.value === v);
    if (exceptional) return exceptional.description;
    return statusLabel(v);
}

/** Statuses that are still active / open in the pipeline. */
export const OPEN_STATUSES = [
    "NEW_LEAD",
    "PROSPECT",
    "INTERESTED",
    "HOT_LEAD",
    "AWAITING_ESTIMATE",
    "ESTIMATE_SENT",
] as const;

/** Whether a normalised status is an exceptional (non sequential) outcome. */
export function isExceptionalStatus(v: string): boolean {
    return EXCEPTIONAL_STATUSES.some((s) => s.value === v);
}

/** Returns the exceptional status definition for a normalised status. */
export function getExceptionalStatus(v: string): EnquiryExceptionalStatus | null {
    return EXCEPTIONAL_STATUSES.find((s) => s.value === v) ?? null;
}

/** Returns the stage group a primary status belongs to. */
export function getStageGroup(v: string): EnquiryStageGroup | null {
    return STAGE_GROUPS.find((group) => group.statuses.some((s) => s.value === v)) ?? null;
}

/* ------------------------------------------------------------------ */
/*  Badges                                                              */
/* ------------------------------------------------------------------ */

export type StatusBadgeVariant = "default" | "success" | "warning" | "danger" | "info";

export interface StatusBadgeMeta {
    /** Displayed badge text. */
    label: string;
    /** Badge colour variant. */
    variant: StatusBadgeVariant;
    /** Dot colour used next to the label. */
    dot: string;
}

/**
 * Maps a normalised enquiry status to the badge shown in the detail top bar.
 * - Open stages (new lead → estimate sent) → blue
 * - DNP → On Hold, amber
 * - Event approved → Won, green
 * - Lost / Cancelled → red
 */
export function statusBadgeMeta(v: string): StatusBadgeMeta {
    const status = normalizeStatus(v);
    if ((OPEN_STATUSES as readonly string[]).includes(status)) {
        return { label: "Open", variant: "info", dot: "#2563eb" };
    }
    if (status === "DNP") {
        return { label: "On Hold", variant: "warning", dot: "#d97706" };
    }
    if (status === "EVENT_APPROVED") {
        return { label: "Won", variant: "success", dot: "#16a34a" };
    }
    if (status === "LOST") {
        return { label: "Lost", variant: "danger", dot: "#dc2626" };
    }
    if (status === "CANCELLED") {
        return { label: "Cancelled", variant: "danger", dot: "#dc2626" };
    }
    return {
        label: statusLabel(status),
        variant: "default",
        dot: "currentColor",
    };
}

/* ------------------------------------------------------------------ */
/*  Tracker progress                                                    */
/* ------------------------------------------------------------------ */

export type TrackerNodeState = "completed" | "current" | "upcoming";

export interface EnquiryTrackerProgress {
    /** Normalised status the progress was derived from. */
    status: string;
    /** Index of the active status inside `PRIMARY_STATUSES`, -1 when outside it. */
    index: number;
    /** State of every primary status node. */
    states: TrackerNodeState[];
    /** Exceptional outcome currently applied, when any. */
    outcome: EnquiryExceptionalStatus | null;
    /** True when the status could not be mapped to a known status. */
    unknown: boolean;
}

/**
 * Derives the completed / current / upcoming state of every tracker node.
 *
 * Exceptional outcomes and unknown statuses keep the whole timeline
 * "upcoming" — they are never presented as completed pipeline steps.
 */
export function getTrackerProgress(raw?: string | null): EnquiryTrackerProgress {
    const status = normalizeStatus(raw);
    const outcome = getExceptionalStatus(status);

    if (outcome) {
        return {
            status,
            index: -1,
            states: PRIMARY_STATUSES.map((): TrackerNodeState => "upcoming"),
            outcome,
            unknown: false,
        };
    }

    const index = PRIMARY_STATUSES.findIndex((s) => s.value === status);
    if (index < 0) {
        return {
            status,
            index: -1,
            states: PRIMARY_STATUSES.map((): TrackerNodeState => "upcoming"),
            outcome: null,
            unknown: true,
        };
    }

    const states = PRIMARY_STATUSES.map((_, i): TrackerNodeState => {
        if (i < index) return "completed";
        if (i === index) return "current";
        return "upcoming";
    });

    return { status, index, states, outcome: null, unknown: false };
}
