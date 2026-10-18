"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { SelectOption } from "./select-option";

export interface CreatableSelectProps {
    label?: React.ReactNode;
    wrapperClassName?: string;
    selectClassName?: string;
    id?: string;
    onChange?: (value: string) => void;
    onCreateOption?: (value: string) => void;
    options?: SelectOption[];
    placeholder?: string;
    isDisabled?: boolean;
    isClearable?: boolean;
    value?: SelectOption | null;
    errorMessage?: string;
    showError?: boolean;
    smallLabel?: boolean;
    /** Controlled search text. Leave undefined for uncontrolled behaviour. */
    inputValue?: string;
    /** Fires on every keystroke in the search input. */
    onInputChange?: (newValue: string, actionMeta: { action: string }) => void;
    onBlur?: (event: React.FocusEvent<HTMLElement>) => void;
    onFocus?: (event: React.FocusEvent<HTMLElement>) => void;
    isLoading?: boolean;
}

/**
 * Standalone CreatableSelect component with theme styling.
 * Allows creating new options when none match.
 * Can be used with or without Formik.
 */
export function CreatableSelectField({
    label,
    wrapperClassName,
    selectClassName,
    id,
    onChange,
    onCreateOption,
    options = [],
    placeholder,
    isDisabled,
    isClearable,
    value,
    errorMessage,
    showError: externalShowError,
    smallLabel,
    inputValue,
    onInputChange,
    onBlur,
    onFocus,
    isLoading,
}: CreatableSelectProps) {
    const selectId = id ?? "creatable-select";
    const listId = `${selectId}-listbox`;
    const showError = externalShowError || !!errorMessage;
    const [internalInput, setInternalInput] = useState("");
    const [open, setOpen] = useState(false);
    const [focused, setFocused] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const isControlled = inputValue !== undefined;
    const inputText = isControlled ? (inputValue as string) : internalInput;

    // Keep the visible text in sync with the committed value when idle.
    useEffect(() => {
        if (!focused && !isControlled) {
            setInternalInput(value?.label ?? "");
        }
    }, [value, focused, isControlled]);

    useEffect(() => {
        return () => {
            if (blurTimer.current) clearTimeout(blurTimer.current);
        };
    }, []);

    const query = inputText.trim().toLowerCase();
    const filtered = useMemo(() => {
        if (!query) return options;
        return options.filter(opt => opt.label.toLowerCase().includes(query));
    }, [options, query]);

    const exactMatch = useMemo(() => {
        if (!query) return true;
        return options.some(opt => opt.label.toLowerCase() === query);
    }, [options, query]);

    const showCreateRow = !!onCreateOption && query.length > 0 && !exactMatch && !isDisabled;

    const setText = (next: string) => {
        if (!isControlled) setInternalInput(next);
        onInputChange?.(next, { action: "input-change" });
    };

    const commitSelect = (opt: SelectOption) => {
        if (!isControlled) setInternalInput(opt.label);
        onInputChange?.(opt.label, { action: "select-option" });
        onChange?.(opt.value);
        setOpen(false);
        setHighlight(0);
    };

    const commitCreate = () => {
        const trimmed = inputText.trim();
        if (!trimmed) return;
        onCreateOption?.(trimmed);
        // Also treat creation as a selection so Formik state updates even if
        // the caller only listens to onChange.
        onChange?.(trimmed);
        setOpen(false);
        setHighlight(0);
    };

    const handleClear = () => {
        setText("");
        onChange?.("");
        setOpen(false);
    };

    const totalRows = filtered.length + (showCreateRow ? 1 : 0);

    return (
        <div className={cn("flex flex-col gap-1.5", wrapperClassName)}>
            {label && (
                <label
                    htmlFor={selectId}
                    className={cn(
                        "flex min-h-5 flex-wrap items-center gap-1.5 font-medium text-foreground",
                        smallLabel ? "text-xs font-semibold text-muted-foreground" : "text-sm",
                    )}
                >
                    {typeof label === "string" && smallLabel ? label.toUpperCase() : label}
                </label>
            )}
            <div className="relative">
                <input
                    id={selectId}
                    type="text"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    autoComplete="off"
                    disabled={isDisabled}
                    value={inputText}
                    placeholder={isLoading ? "Loading..." : placeholder}
                    onChange={e => {
                        setText(e.target.value);
                        setOpen(true);
                        setHighlight(0);
                    }}
                    onFocus={e => {
                        setFocused(true);
                        setOpen(true);
                        onFocus?.(e as unknown as React.FocusEvent<HTMLElement>);
                    }}
                    onBlur={e => {
                        // Delay closing so option clicks register first.
                        if (blurTimer.current) clearTimeout(blurTimer.current);
                        blurTimer.current = setTimeout(() => {
                            setFocused(false);
                            setOpen(false);
                            onBlur?.(e as unknown as React.FocusEvent<HTMLElement>);
                        }, 120);
                    }}
                    onKeyDown={e => {
                        if (e.key === "ArrowDown") {
                            e.preventDefault();
                            setOpen(true);
                            setHighlight(h => Math.min(h + 1, Math.max(totalRows - 1, 0)));
                        } else if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setHighlight(h => Math.max(h - 1, 0));
                        } else if (e.key === "Enter") {
                            if (open && totalRows > 0) {
                                e.preventDefault();
                                if (highlight < filtered.length) {
                                    commitSelect(filtered[highlight]);
                                } else {
                                    commitCreate();
                                }
                            }
                        } else if (e.key === "Escape") {
                            setOpen(false);
                        }
                    }}
                    aria-invalid={showError}
                    className={cn(
                        "flex h-10 w-full rounded-md border border-input bg-surface py-2 pl-3 pr-9 text-sm text-foreground transition-colors",
                        "placeholder:text-muted-foreground",
                        "focus:border-accent focus:outline-none focus:ring-2 focus:ring-input-ring",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        showError &&
                            "border-error focus:border-error focus:ring-[var(--input-error-ring)]",
                        selectClassName,
                    )}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground">
                    {isLoading ? (
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                        <ChevronDown size={16} aria-hidden="true" />
                    )}
                </span>
                {isClearable && !isDisabled && inputText && (
                    <button
                        type="button"
                        aria-label="Clear selection"
                        onClick={handleClear}
                        className="absolute inset-y-0 right-8 flex items-center rounded px-1 text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <X size={14} aria-hidden="true" />
                    </button>
                )}
                {open && !isDisabled && (
                    <ul
                        id={listId}
                        role="listbox"
                        className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-surface-elevated p-1 shadow-lg"
                    >
                        {filtered.map((opt, idx) => (
                            <li
                                key={`${opt.value}-${idx}`}
                                role="option"
                                aria-selected={value?.value === opt.value}
                            >
                                <button
                                    type="button"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => commitSelect(opt)}
                                    onMouseEnter={() => setHighlight(idx)}
                                    className={cn(
                                        "flex w-full items-center rounded px-2.5 py-2 text-left text-sm text-foreground transition-colors",
                                        highlight === idx
                                            ? "bg-muted"
                                            : value?.value === opt.value
                                              ? "bg-primary-light"
                                              : "bg-transparent hover:bg-muted",
                                    )}
                                >
                                    {opt.label}
                                </button>
                            </li>
                        ))}
                        {showCreateRow && (
                            <li role="option" aria-selected={false}>
                                <button
                                    type="button"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={commitCreate}
                                    onMouseEnter={() => setHighlight(filtered.length)}
                                    className={cn(
                                        "flex w-full items-center rounded px-2.5 py-2 text-left text-sm font-medium text-primary transition-colors",
                                        highlight === filtered.length
                                            ? "bg-primary-light"
                                            : "bg-transparent hover:bg-primary-light",
                                    )}
                                >
                                    Create &quot;{inputText.trim()}&quot;
                                </button>
                            </li>
                        )}
                        {filtered.length === 0 && !showCreateRow && (
                            <li className="px-2.5 py-2 text-sm text-muted-foreground">
                                {isLoading ? "Loading..." : "No options found"}
                            </li>
                        )}
                    </ul>
                )}
            </div>
            {showError && errorMessage && <p className="text-xs text-error">{errorMessage}</p>}
        </div>
    );
}
