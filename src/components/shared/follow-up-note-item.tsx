"use client";

import { Avatar } from "@/components/ui/avatar";
import { formatDisplayTime, formatShortDateTime } from "@/lib/utils/date";

export interface FollowUpNote {
    id: string;
    body: string;
    authorName: string;
    createdAt: string;
}

interface FollowUpNoteItemProps {
    note: FollowUpNote;
}

/** Single note row — domain-agnostic, reusable on any record timeline. */
export function FollowUpNoteItem({ note }: FollowUpNoteItemProps) {
    return (
        <li className="flex gap-3">
            <Avatar name={note.authorName || "Unknown"} />
            <div className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3.5 py-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-semibold text-foreground">
                        {note.authorName || "Unknown"}
                    </span>
                    <span
                        className="text-xs text-muted-foreground"
                        title={formatShortDateTime(note.createdAt)}
                    >
                        {formatDisplayTime(note.createdAt)}
                    </span>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed break-words whitespace-pre-wrap text-foreground">
                    {note.body}
                </p>
            </div>
        </li>
    );
}
