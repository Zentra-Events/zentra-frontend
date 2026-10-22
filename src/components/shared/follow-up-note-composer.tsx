"use client";

import { useState } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface FollowUpNoteComposerProps {
    authorName: string;
    submitting?: boolean;
    submitError?: string | null;
    onSubmit: (body: string) => Promise<boolean>;
    disabled?: boolean;
}

/** Note input — controlled by parent for persistence; guards double-submit. */
export function FollowUpNoteComposer({
    authorName,
    submitting = false,
    submitError,
    onSubmit,
    disabled = false,
}: FollowUpNoteComposerProps) {
    const [body, setBody] = useState("");
    const [localError, setLocalError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!body.trim() || submitting || disabled) return;
        setLocalError(null);
        const ok = await onSubmit(body.trim());
        if (ok) {
            setBody("");
        } else {
            setLocalError("Failed to save note. Please try again.");
        }
    };

    return (
        <div className="flex gap-3">
            <Avatar name={authorName || "You"} useDefaultColor />
            <div className="min-w-0 flex-1">
                <Textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Add an internal follow-up note… (visible to your team only)"
                    rows={3}
                    disabled={submitting || disabled}
                    aria-label="Add a follow-up note"
                    className="min-h-[76px] text-sm"
                />
                {(localError || submitError) && (
                    <p className="mt-1 text-xs text-error" role="alert">
                        {localError || submitError}
                    </p>
                )}
                <div className="mt-2 flex justify-end">
                    <Button
                        type="button"
                        size="sm"
                        disabled={!body.trim() || submitting || disabled}
                        isLoading={submitting}
                        onClick={handleSubmit}
                    >
                        Add note
                    </Button>
                </div>
            </div>
        </div>
    );
}
