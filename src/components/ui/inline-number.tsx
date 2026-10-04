"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

interface InlineNumberProps {
    value: number;
    onSave: (value: number) => void;
    className?: string;
    disabled?: boolean;
    min?: number;
    step?: number;
    focusSignal?: number;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    refCb?: (el: HTMLElement | null) => void;
    "data-field"?: string;
}

export function InlineNumber({
    value,
    onSave,
    className = "",
    disabled = false,
    min = 0,
    step = 1,
    focusSignal = 0,
    onKeyDown,
    refCb,
    "data-field": dataField,
}: InlineNumberProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(String(value));
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setEditValue(String(value));
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    useEffect(() => {
        if (focusSignal > 0) {
            setIsEditing(true);
        }
    }, [focusSignal]);

    const handleSave = useCallback(() => {
        setIsEditing(false);
        const parsed = Number(editValue);
        if (!Number.isNaN(parsed) && parsed !== value) {
            onSave(parsed);
        }
    }, [editValue, onSave, value]);

    const rootRef = useCallback(
        (el: HTMLElement | null) => {
            refCb?.(el);
        },
        [refCb],
    );

    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            onKeyDown?.(e);
            if (e.key === "Enter") {
                handleSave();
            } else if (e.key === "Escape") {
                setEditValue(String(value));
                setIsEditing(false);
            }
        },
        [handleSave, onKeyDown, value],
    );

    if (disabled) {
        return <span className={cn("text-sm text-gray-500", className)}>{value}</span>;
    }

    if (isEditing) {
        return (
            <input
                ref={el => {
                    inputRef.current = el;
                    rootRef(el);
                }}
                data-field={dataField}
                type="number"
                min={min}
                step={step}
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={cn(
                    "w-16 border-b-2 border-primary bg-transparent px-1 py-0.5 text-right text-sm outline-none transition-colors",
                    className,
                )}
            />
        );
    }

    return (
        <span
            ref={rootRef}
            data-field={dataField}
            className={cn(
                "inline-flex cursor-pointer items-center justify-end gap-0.5 rounded px-1.5 py-0.5 text-sm tabular-nums transition-colors hover:bg-primary-light hover:text-primary",
                className,
            )}
            onClick={() => setIsEditing(true)}
            title="Click to edit"
        >
            {value}
        </span>
    );
}
