"use client";

import {
    useCallback,
    useState,
    type ChangeEvent,
    type ClipboardEvent,
    type KeyboardEvent,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const SEPARATORS = /[,;]/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmails(value: string): string[] {
    return value
        .split(SEPARATORS)
        .map(e => e.trim().replace(/^mailto:/i, ""))
        .filter(e => e.length > 0);
}

interface EmailTagInputProps {
    label: string;
    value: string[];
    onChange: (emails: string[]) => void;
    error?: string;
    disabled?: boolean;
    required?: boolean;
    placeholder?: string;
}

export function EmailTagInput({
    label,
    value,
    onChange,
    error,
    disabled = false,
    required = false,
    placeholder = "email@example.com",
}: EmailTagInputProps) {
    const [draft, setDraft] = useState("");

    const addDraft = useCallback(() => {
        const next = parseEmails(draft).filter(e => !value.includes(e));
        if (next.length === 0) {
            setDraft("");
            return;
        }
        onChange([...value, ...next]);
        setDraft("");
    }, [draft, value, onChange]);

    const removeEmail = useCallback(
        (email: string) => {
            onChange(value.filter(e => e !== email));
        },
        [value, onChange],
    );

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value);

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addDraft();
        }
    };

    const handleBlur = () => {
        addDraft();
    };

    const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const next = parseEmails(e.clipboardData.getData("text"));
        if (next.length > 0) {
            onChange([...value, ...next]);
        }
    };

    const invalidEmails = new Set(value.filter(e => !EMAIL_REGEX.test(e)));

    return (
        <div className="flex flex-col gap-1.5">
            <label className="flex min-h-5 flex-wrap items-center gap-1.5 font-medium text-foreground text-sm">
                {label}
                {required && <span className="text-error">*</span>}
            </label>
            <div
                role="textbox"
                tabIndex={0}
                aria-invalid={!!error || invalidEmails.size > 0}
                aria-required={required}
                onBlur={handleBlur}
                className={cn(
                    "flex flex-wrap gap-1.5 min-h-[44px] rounded-md border bg-surface px-3 py-2 text-sm text-foreground transition-colors",
                    "focus:border-accent focus:outline-none focus:ring-2 focus:ring-input-ring",
                    disabled && "disabled:cursor-not-allowed disabled:opacity-50",
                    error && "border-error focus:border-error focus:ring-[var(--input-error-ring)]",
                )}
            >
                {value.map(email => (
                    <span
                        key={email}
                        className={cn(
                            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
                            invalidEmails.has(email)
                                ? "border-error bg-error-light text-error"
                                : "border-border-hover bg-muted/50 text-muted-foreground hover:bg-muted",
                        )}
                    >
                        {email}
                        <button
                            type="button"
                            aria-label={`Remove ${email}`}
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => removeEmail(email)}
                            disabled={disabled}
                            className={cn(
                                "rounded-md p-1 transition-colors",
                                invalidEmails.has(email)
                                    ? "text-error hover:bg-error/10"
                                    : "text-muted-foreground hover:bg-muted",
                            )}
                        >
                            <X size={12} />
                        </button>
                    </span>
                ))}
                <input
                    id={`tags-${label.toLowerCase().replace(/\s+/g, "-")}`}
                    value={draft}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onPaste={handlePaste}
                    onBlur={handleBlur}
                    disabled={disabled}
                    placeholder={value.length === 0 ? placeholder : undefined}
                    className="flex-1 min-w-[80px] bg-transparent border-none outline-none px-0 py-1 text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                />
                {draft.length > 0 && !disabled && (
                    <button
                        type="button"
                        onClick={() => setDraft("")}
                        aria-label="Clear input"
                        className="rounded-md p-1 transition-colors text-muted-foreground hover:bg-muted hover:text-accent"
                    >
                        <X size={12} />
                    </button>
                )}
            </div>
            {error && <p className="text-xs text-error">{error}</p>}
        </div>
    );
}
