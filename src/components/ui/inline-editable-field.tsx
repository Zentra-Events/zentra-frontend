"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Pencil, X } from "lucide-react";

import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

interface InlineEditableFieldProps {
    /** Current committed value (displayed in read mode). */
    value: ReactNode;
    /** Raw string value used to seed the editor. */
    editValue?: string;
    /** Render the editor; receives draft + setter + commit helpers. */
    renderEditor: (props: {
        draft: string;
        setDraft: (v: string) => void;
        save: () => void;
        cancel: () => void;
        saving: boolean;
        error: string | null;
        inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
    }) => ReactNode;
    /** Validate + persist. Return null on success or an error message. */
    onSave: (draft: string) => Promise<string | null | void>;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    ariaLabel?: string;
}

/**
 * Generic read/edit inline field primitive (Jira-style click-to-edit).
 * Domain-agnostic — intended for reuse on any record-detail page.
 * Existing `InlineEdit` is preserved untouched for the category editor.
 */
export function InlineEditableField({
    value,
    editValue,
    renderEditor,
    onSave,
    placeholder = "—",
    disabled = false,
    className,
    ariaLabel,
}: InlineEditableFieldProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(editValue ?? "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

    useEffect(() => {
        if (!editing) setDraft(editValue ?? "");
    }, [editValue, editing]);

    useEffect(() => {
        if (editing) {
            const t = setTimeout(() => inputRef.current?.focus(), 30);
            return () => clearTimeout(t);
        }
    }, [editing]);

    const cancel = () => {
        setDraft(editValue ?? "");
        setError(null);
        setEditing(false);
    };

    const save = async () => {
        setSaving(true);
        setError(null);
        try {
            const err = await onSave(draft.trim());
            if (err) {
                setError(err);
            } else {
                setEditing(false);
            }
        } catch {
            setError("Failed to save. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (!editing) {
        return (
            <span
                className={cn(
                    "group/inline inline-flex min-h-[1.75rem] min-w-[2rem] items-center gap-1 rounded px-1 py-0.5 text-sm transition-colors",
                    !disabled && "cursor-pointer hover:bg-primary-light",
                    className,
                )}
                onClick={() => !disabled && setEditing(true)}
                onKeyDown={e => {
                    if (!disabled && (e.key === "Enter" || e.key === " ")) {
                        e.preventDefault();
                        setEditing(true);
                    }
                }}
                role={!disabled ? "button" : undefined}
                tabIndex={!disabled ? 0 : undefined}
                title={!disabled ? "Click to edit" : undefined}
                aria-label={ariaLabel ?? "Edit field"}
            >
                <span className="min-w-0 flex-1 font-medium break-words text-foreground">
                    {value ?? <span className="text-muted-foreground italic">{placeholder}</span>}
                </span>
                {!disabled && (
                    <Pencil
                        size={12}
                        aria-hidden
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/inline:opacity-100"
                    />
                )}
            </span>
        );
    }

    return (
        <span className={cn("block min-w-0", className)}>
            {renderEditor({ draft, setDraft, save, cancel, saving, error, inputRef })}
            {error && (
                <span className="mt-1 block text-xs text-error" role="alert">
                    {error}
                </span>
            )}
            <span className="mt-1.5 flex items-center gap-1.5">
                <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2.5 text-xs"
                    isLoading={saving}
                    onClick={save}
                    icon={!saving ? <Check size={13} aria-hidden /> : undefined}
                    aria-label="Save"
                >
                    Save
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2.5 text-xs"
                    disabled={saving}
                    onClick={cancel}
                    icon={<X size={13} aria-hidden />}
                    aria-label="Cancel"
                >
                    Cancel
                </Button>
            </span>
        </span>
    );
}
