"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { useAuth } from "@/context/auth";
import type { FollowUpNote } from "@/components/shared/follow-up-note-item";
import { FollowUpNoteComposer } from "@/components/shared/follow-up-note-composer";
import { FollowUpTimeline } from "@/components/shared/follow-up-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const NOTES_PAGE_SIZE = 5;

function extractNotes(payload: unknown): FollowUpNote[] {
    const pick = (o: Record<string, unknown>): FollowUpNote | null => {
        const body = [o.body, o.note, o.text, o.content, o.message].find(v => typeof v === "string" && v.trim());
        if (!body) return null;
        const author =
            [o.authorName, o.author, o.createdBy, o.userName, o.name].find(v => typeof v === "string" && v.trim()) ?? "Team member";
        const created =
            [o.createdAt, o.created_at, o.timestamp, o.date].find(v => typeof v === "string" && v) ?? new Date().toISOString();
        const id = [o.id, o._id].find(v => v !== undefined && v !== null) ?? `${author}-${created}-${String(body).slice(0, 12)}`;
        return { id: String(id), body: String(body), authorName: String(author), createdAt: String(created) };
    };
    if (Array.isArray(payload)) return payload.map(p => (p && typeof p === "object" ? pick(p as Record<string, unknown>) : null)).filter((n): n is FollowUpNote => !!n);
    if (payload && typeof payload === "object") {
        const o = payload as Record<string, unknown>;
        for (const k of ["notes", "comments", "followUps", "followups", "data", "content", "items"]) {
            if (Array.isArray(o[k])) return extractNotes(o[k]);
        }
        const single = pick(o);
        if (single) return [single];
    }
    return [];
}

interface FollowUpSectionProps {
    enquiryId: string;
    canWrite: boolean;
}

export function FollowUpSection({ enquiryId, canWrite }: FollowUpSectionProps) {
    const { user } = useAuth();
    const authorName = user?.name || "You";
    const [notes, setNotes] = useState<FollowUpNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [visible, setVisible] = useState(NOTES_PAGE_SIZE);
    const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);

    useEffect(() => {
        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await apiRequest(API_ENDPOINTS.enquiries.notes(enquiryId), { method: "GET" });
                if (res.status === 404) {
                    // Backend has no notes resource — surface an honest empty
                    // state (no fake persistence) with the backend spec.
                    if (!cancelled) {
                        setBackendAvailable(false);
                        setNotes([]);
                    }
                    return;
                }
                if (!res.ok) throw new Error(`Failed to load notes (${res.status})`);
                const body = await res.json().catch(() => null);
                if (!cancelled) {
                    setBackendAvailable(true);
                    setNotes(extractNotes(body));
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load notes");
                    setNotes([]);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [enquiryId]);

    const sorted = [...notes].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const shown = sorted.slice(0, visible);

    const handleSubmit = async (body: string): Promise<boolean> => {
        if (submitting) return false;
        setSubmitting(true);
        try {
            const res = await apiRequest(API_ENDPOINTS.enquiries.notes(enquiryId), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ body }),
            });
            if (!res.ok) throw new Error(`Save failed (${res.status})`);
            const saved = await res.json().catch(() => null);
            const parsed = extractNotes(saved);
            const note: FollowUpNote =
                parsed[0] ?? {
                    id: `note-${Date.now()}`,
                    body,
                    authorName,
                    createdAt: new Date().toISOString(),
                };
            setNotes(prev => [note, ...prev]);
            setVisible(v => Math.max(v, 1));
            toast.success("Follow-up note added");
            return true;
        } catch {
            toast.error("Failed to save note. Please try again.");
            return false;
        } finally {
            setSubmitting(false);
        }
    };

    const backendMissing = backendAvailable === false;
    const emptyMessage = backendMissing
        ? "Follow-up notes need a backend endpoint (GET/POST /enquiries/{id}/notes) — see the notes section below the report. No notes are stored until then."
        : "No follow-up notes yet. Add the first note above.";

    return (
        <Card variant="bordered">
            <CardHeader className="flex flex-row flex-wrap items-center gap-2 px-4 py-2.5 sm:px-5">
                <h3 className="text-sm font-semibold text-foreground">Follow-up Notes</h3>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Internal · {notes.length}
                </span>
                <span className="w-full text-xs text-muted-foreground">Visible to your team only — never shared with the client.</span>
            </CardHeader>
            <CardContent className="space-y-4 px-4 py-3 sm:px-5">
                {canWrite && !backendMissing ? (
                    <FollowUpNoteComposer authorName={authorName} submitting={submitting} onSubmit={handleSubmit} />
                ) : (
                    <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                        {!canWrite
                            ? "You have read-only access to enquiries, so you cannot add notes."
                            : "Note creation is disabled until the backend adds GET/POST /enquiries/{id}/notes."}
                    </p>
                )}
                <FollowUpTimeline
                    notes={shown}
                    loading={loading}
                    error={error}
                    onRetry={() => setVisible(NOTES_PAGE_SIZE)}
                    emptyMessage={emptyMessage}
                    footer={
                        sorted.length > visible ? (
                            <div className="pt-1 text-center">
                                <Button type="button" variant="outline" size="sm" onClick={() => setVisible(v => v + NOTES_PAGE_SIZE)}>
                                    Show more ({sorted.length - visible} remaining)
                                </Button>
                            </div>
                        ) : undefined
                    }
                />
            </CardContent>
        </Card>
    );
}
