"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { focusAndScrollIntoView } from "@/lib/category-editor/utils/focus";

interface InlineEditProps {
    value: string;
    onSave: (value: string) => void;
    placeholder?: string;
    className?: string;
    disabled?: boolean;
    focusSignal?: number;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    refCb?: (el: HTMLElement | null) => void;
    onEditingChange?: (editing: boolean) => void;
    "data-field"?: string;
}

export function InlineEdit({
    value,
    onSave,
    placeholder = "",
    className = "",
    disabled = false,
    focusSignal = 0,
    onKeyDown,
    refCb,
    onEditingChange,
    "data-field": dataField,
}: InlineEditProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setEditValue(value);
    }, [value]);
    
    useEffect(() => {
        if (isEditing && inputRef.current) {
            focusAndScrollIntoView(inputRef.current);
            inputRef.current.select();
        }
    }, [isEditing]);

    useEffect(() => {
        if (focusSignal > 0) {
            setIsEditing(true);
        }
        }, [focusSignal]);

    // Notify parent when editing state changes (e.g., to clear focus signals)
    useEffect(() => {
        onEditingChange?.(isEditing);
    }, [isEditing, onEditingChange]);

    const handleSave = useCallback(() => {
        setIsEditing(false);
        const trimmed = editValue.trim();
        if (trimmed !== value) {
            onSave(trimmed);
        }
    }, [editValue, onSave, value]);

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            onKeyDown?.(e);
            if (e.key === "Enter") {
                handleSave();
            } else if (e.key === "Escape") {
                setEditValue(value);
                setIsEditing(false);
            }
        },
        [handleSave, onKeyDown, value],
    );

    const rootRef = useCallback(
        (el: HTMLElement | null) => {
            refCb?.(el);
        },
        [refCb],
    );

    if (disabled) {
        return (
            <span className={cn("text-sm text-gray-500", className)}>{value || placeholder}</span>
        );
    }

    if (isEditing) {
        return (
            <input
                ref={el => {
                    inputRef.current = el;
                    rootRef(el);
                }}
                data-field={dataField}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={cn(
                    "w-full border-b-2 border-primary bg-transparent px-1 py-0.5 text-sm outline-none transition-colors",
                    className,
                )}
                placeholder={placeholder}
            />
        );
    }

    return (
        <span
            ref={rootRef}
            data-field={dataField}
            className={cn(
                "cursor-pointer rounded py-0.5 text-sm transition-colors hover:bg-primary-light hover:text-primary",
                !value && "italic text-gray-400",
                className,
            )}
            onClick={() => setIsEditing(true)}
            title="Click to edit"
        >
            {value || <span className="text-gray-400 italic">{placeholder}</span>}
        </span>
    );
}
