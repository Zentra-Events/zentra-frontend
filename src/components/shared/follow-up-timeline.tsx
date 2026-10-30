"use client";

import { ReactNode } from "react";
import { MessageSquareText } from "lucide-react";

import { Loading } from "@/components/ui/loading";
import { FollowUpNoteItem, type FollowUpNote } from "@/components/shared/follow-up-note-item";

interface FollowUpTimelineProps {
    notes: FollowUpNote[];
    loading?: boolean;
    error?: string | null;
    onRetry?: () => void;
    emptyMessage?: string;
    footer?: ReactNode;
}

/** Chronological (newest-first) note list with loading/empty/error states. */
export function FollowUpTimeline({
    notes,
    loading,
    error,
    onRetry,
    emptyMessage = "No follow-up notes yet. Add the first note above.",
    footer,
}: FollowUpTimelineProps) {
    if (loading) {
        return (
            <div className="py-8" role="status" aria-label="Loading notes">
                <Loading />
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="rounded-lg border border-error/30 bg-error-light/40 px-4 py-5 text-center"
                role="alert"
            >
                <p className="text-sm font-medium text-error">Failed to load notes</p>
                <p className="mt-1 text-xs text-muted-foreground">{error}</p>
                {onRetry && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="mt-2 text-xs font-semibold text-primary hover:underline"
                    >
                        Try again
                    </button>
                )}
            </div>
        );
    }

    if (notes.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-8 text-center">
                <MessageSquareText size={22} className="text-muted-foreground" aria-hidden />
                <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            </div>
        );
    }

    return (
        <>
            <ul className="space-y-3" aria-label="Follow-up notes">
                {notes.map(note => (
                    <FollowUpNoteItem key={note.id} note={note} />
                ))}
            </ul>
            {footer}
        </>
    );
}
