"use client";

import { Enquiry } from "@/types/enquiry";

/**
 * Status helpers live in a single, reusable module so the detail page and any
 * other enquiry view stay in sync.
 */
export {
    normalizeStatus,
    statusLabel,
    statusBadgeMeta,
    getStageGroup,
    getTrackerProgress,
    isExceptionalStatus,
    PRIMARY_STATUSES,
    STAGE_GROUPS,
    EXCEPTIONAL_STATUSES,
    type EnquiryExceptionalStatus,
    type EnquiryStageGroup,
    type EnquiryStageGroupId,
    type EnquiryStageStatus,
    type EnquiryTrackerProgress,
    type StatusBadgeMeta,
    type StatusBadgeVariant,
    type TrackerNodeState,
} from "@/lib/utils/enquiry-status";

export function getAssigneeName(e: Enquiry): string {
    const a = e.assignedTo?.trim() || "";
    if (a && a !== "Unassigned") return a;
    return e.assignee?.trim() || "";
}

export function initials(name: string): string {
    const p = name.trim().split(/\s+/).filter(Boolean);
    if (p.length === 0) return "—";
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export function avatarBg(name: string): string {
    const n = (name || "").toLowerCase();
    if (n.startsWith("j")) return "bg-[#f9a8d4] text-[#831843]";
    if (n.startsWith("a")) return "bg-[#fecdd3] text-[#9f1239]";
    if (n.startsWith("r")) return "bg-[#bbf7d0] text-[#14532d]";
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    const palettes = [
        "bg-[#fbcfe8] text-[#831843]",
        "bg-[#fecdd3] text-[#9f1239]",
        "bg-[#bbf7d0] text-[#14532d]",
        "bg-[#bfdbfe] text-[#1e3a8a]",
        "bg-[#fde68a] text-[#92400e]",
    ];
    return palettes[h % palettes.length];
}

export function formatINRCurrency(n: number): string {
    try {
        return "₹" + n.toLocaleString("en-IN");
    } catch {
        return `₹${n}`;
    }
}

export interface DetailNote {
    id: string;
    body: string;
    authorName: string;
    createdAt: string;
}

/**
 * Maps the API note payload (`{ userName, note, createdDate }`) onto the
 * shape used by the timeline. Unknown / missing values are tolerated so a
 * partial backend payload never breaks the list.
 */
export function extractDetailNotes(payload: unknown): DetailNote[] {
    const pick = (o: Record<string, unknown>): DetailNote | null => {
        const body = [o.note, o.body, o.text, o.content, o.message].find(
            v => typeof v === "string" && (v as string).trim(),
        );
        if (!body) return null;
        const author =
            [o.userName, o.authorName, o.author, o.createdBy, o.name].find(
                v => typeof v === "string" && (v as string).trim(),
            ) ?? "Team member";
        const created =
            [o.createdDate, o.createdAt, o.created_at, o.timestamp, o.date].find(
                v => typeof v === "string" && v,
            ) ?? new Date().toISOString();
        const id =
            [o.id, o._id].find(v => v !== undefined && v !== null) ??
            `${author}-${created}-${String(body).slice(0, 12)}`;
        return {
            id: String(id),
            body: String(body),
            authorName: String(author),
            createdAt: String(created),
        };
    };
    if (Array.isArray(payload))
        return payload
            .map(p => (p && typeof p === "object" ? pick(p as Record<string, unknown>) : null))
            .filter((n): n is DetailNote => !!n);
    if (payload && typeof payload === "object") {
        const o = payload as Record<string, unknown>;
        for (const k of [
            "notes",
            "comments",
            "followUps",
            "followups",
            "data",
            "content",
            "items",
        ]) {
            if (Array.isArray(o[k])) return extractDetailNotes(o[k]);
        }
        const single = pick(o);
        if (single) return [single];
    }
    return [];
}
