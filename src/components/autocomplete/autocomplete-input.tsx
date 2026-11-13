"use client";

import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from "react";
import { cn } from "@/lib/utils/cn";
import { useSuggestionHistory } from "@/hooks/use-suggestion-history";
export interface AutocompleteInputProps {
    /** Unique storage key for this field's history (e.g. "item-name-history"). */
    storageKey: string;
    /** Current input value (controlled). */
    value: string;
    /** Fired whenever the input value changes (typing or selection). */
    onChange: (value: string) => void;
    /** Optional label rendered above the input. */
    label?: string;
    /** Placeholder text. */
    placeholder?: string;
    /** Validation error message. */
    error?: string;
    /** Render a smaller label. */
    smallLabel?: boolean;
    /** Disable the input. */
    disabled?: boolean;
    /** Read-only input (no dropdown). */
    readOnly?: boolean;
    /** Maximum number of suggestions to display. */
    maxSuggestions?: number;
    /** Maximum history entries to persist (default 100). */
    maxHistorySize?: number;
    /** Minimum characters before suggestions appear (default 0). */
    minChars?: number;
    /** Custom filter: (suggestion, query) => boolean. */
    filter?: (suggestion: string, query: string) => boolean;
    /** DOM id for the input. */
    id?: string;
}

export interface AutocompleteInputHandle {
    /** Persist a single value to the suggestion history (call after successful save). */
    commit: (value: string) => void;
    /** Persist multiple values to the suggestion history (call after successful bulk save). */
    commitMany: (values: string[]) => void;
    /** Focus the underlying input. */
    focus: () => void;
}

const AutocompleteInput = forwardRef<AutocompleteInputHandle, AutocompleteInputProps>(
    function AutocompleteInput(props, ref) {
        const {
            storageKey,
            value,
            onChange,
            label,
            placeholder,
            error,
            smallLabel = false,
            disabled = false,
            readOnly = false,
            maxSuggestions,
            maxHistorySize = 100,
            minChars = 0,
            filter,
            id,
        } = props;

        const {
            suggestions: history,
            add: addToHistory,
            commitMany: commitManyToHistory,
            loaded,
        } = useSuggestionHistory(storageKey, { maxSize: maxHistorySize });

        const selectId = id ?? "autocomplete-input";
        const listId = `${selectId}-listbox`;

        const [open, setOpen] = useState(false);
        const [highlight, setHighlight] = useState(0);
        const inputRef = useRef<HTMLInputElement>(null);
        const wrapperRef = useRef<HTMLDivElement>(null);

        const normalizedQuery = value.trim().toLowerCase();

        const filtered = useMemo(() => {
            if (!loaded) return [];
            if (normalizedQuery.length < minChars) return [];
            let results = history.filter(suggestion => {
                if (filter) return filter(suggestion, value);
                return suggestion.toLowerCase().includes(normalizedQuery);
            });
            if (maxSuggestions != null) {
                results = results.slice(0, maxSuggestions);
            }
            return results;
        }, [history, normalizedQuery, minChars, maxSuggestions, filter, value, loaded]);

        const commit = useCallback(
            (val: string) => {
                addToHistory(val);
            },
            [addToHistory],
        );

        const commitMany = useCallback(
            (values: string[]) => {
                commitManyToHistory(values);
            },
            [commitManyToHistory],
        );

        useImperativeHandle(
            ref,
            () => ({
                commit,
                commitMany,
                focus: () => {
                    inputRef.current?.focus();
                },
            }),
            [commit, commitMany, inputRef],
        );

        const selectSuggestion = useCallback(
            (suggestion: string) => {
                onChange(suggestion);
                setOpen(false);
                setHighlight(0);
            },
            [onChange],
        );

        const handleInputChange = useCallback(
            (e: React.ChangeEvent<HTMLInputElement>) => {
                onChange(e.target.value);
                setOpen(!readOnly && !disabled);
            },
            [onChange, readOnly, disabled],
        );

        const handleFocus = useCallback(() => {
            if (!readOnly && !disabled) setOpen(true);
        }, [readOnly, disabled]);

        const handleBlur = useCallback(() => {
            setOpen(false);
        }, []);

        const handleKeyDown = useCallback(
            (e: React.KeyboardEvent<HTMLInputElement>) => {
                if (readOnly || disabled) return;
                if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setOpen(true);
                    setHighlight(h => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
                } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlight(h => Math.max(h - 1, 0));
                } else if (e.key === "Enter") {
                    if (open && filtered.length > 0 && highlight < filtered.length) {
                        e.preventDefault();
                        selectSuggestion(filtered[highlight]);
                    }
                } else if (e.key === "Escape") {
                    setOpen(false);
                }
            },
            [open, filtered, highlight, selectSuggestion, readOnly, disabled],
        );

        useEffect(() => {
            const handleMousedown = (event: MouseEvent) => {
                if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                    setOpen(false);
                }
            };
            document.addEventListener("mousedown", handleMousedown);
            return () => document.removeEventListener("mousedown", handleMousedown);
        }, []);

        const shouldShowDropdown = open && !readOnly && !disabled && filtered.length > 0;

        return (
            <div ref={wrapperRef} className="flex flex-col gap-1.5">
                {label && (
                    <label
                        htmlFor={selectId}
                        className={cn(
                            "flex min-h-5 flex-wrap items-center gap-1.5 font-medium text-foreground",
                            smallLabel
                                ? "text-xs font-semibold text-muted-foreground uppercase"
                                : "text-sm",
                        )}
                    >
                        {label}
                    </label>
                )}
                <div className="relative">
                    <input
                        ref={inputRef}
                        id={selectId}
                        type="text"
                        role="combobox"
                        aria-expanded={open}
                        aria-controls={listId}
                        aria-autocomplete="list"
                        autoComplete="off"
                        value={value}
                        placeholder={placeholder}
                        disabled={disabled}
                        readOnly={readOnly}
                        onChange={handleInputChange}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        className={cn(
                            "flex h-10 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-foreground transition-colors",
                            "placeholder:text-muted-foreground",
                            "focus:border-accent focus:outline-none focus:ring-2 focus:ring-input-ring",
                            "disabled:cursor-not-allowed disabled:opacity-50",
                            error &&
                                "border-error focus:border-error focus:ring-[var(--input-error-ring)]",
                        )}
                    />
                    {shouldShowDropdown && (
                        <ul
                            id={listId}
                            role="listbox"
                            aria-label={label ? `${label} suggestions` : undefined}
                            className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-surface-elevated p-1 shadow-lg"
                        >
                            {filtered.map((suggestion, idx) => (
                                <li key={suggestion} role="none" className="px-0.5 py-0.5">
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={value === suggestion}
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => selectSuggestion(suggestion)}
                                        onMouseEnter={() => setHighlight(idx)}
                                        className={cn(
                                            "flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors",
                                            value === suggestion
                                                ? "bg-primary text-primary-foreground"
                                                : highlight === idx
                                                  ? "bg-muted"
                                                  : "bg-surface-elevated hover:bg-muted",
                                        )}
                                    >
                                        {suggestion}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                {error && <p className="text-xs text-error">{error}</p>}
            </div>
        );
    },
);

AutocompleteInput.displayName = "AutocompleteInput";

export default AutocompleteInput;
export { AutocompleteInput };
