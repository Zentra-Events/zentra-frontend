"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { ChevronDownIcon } from "./icons";

interface InlineUnitSelectProps {
    value: string;
    onSave: (value: string) => void;
    options?: readonly string[];
    className?: string;
    disabled?: boolean;
    focusSignal?: number;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    refCb?: (el: HTMLElement | null) => void;
    "data-field"?: string;
}

export function InlineUnitSelect({
    value,
    onSave,
    options = [],
    className = "",
    disabled = false,
    focusSignal = 0,
    onKeyDown,
    refCb,
    "data-field": dataField,
}: InlineUnitSelectProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [editValue, setEditValue] = useState(value);
    const [showDropdown, setShowDropdown] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setEditValue(value);
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
            setShowDropdown(false);
        }
    }, [focusSignal]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsEditing(false);
                setShowDropdown(false);
                const trimmed = editValue.trim();
                if (trimmed && trimmed !== value) {
                    onSave(trimmed);
                }
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [editValue, onSave, value]);

    // Close dropdown on scroll
    useEffect(() => {
        if (!showDropdown) return;
        const handleScroll = () => setShowDropdown(false);
        window.addEventListener("scroll", handleScroll, true);
        return () => window.removeEventListener("scroll", handleScroll, true);
    }, [showDropdown]);

    const openEditor = useCallback(() => {
        setIsEditing(true);
        setShowDropdown(true);
    }, []);

    const handleSelect = useCallback(
        (unit: string) => {
            setEditValue(unit);
            setShowDropdown(false);
            setIsEditing(false);
            if (unit !== value) {
                onSave(unit);
            }
        },
        [onSave, value],
    );

    const handleSave = useCallback(() => {
        const trimmed = editValue.trim();
        setIsEditing(false);
        setShowDropdown(false);
        if (trimmed && trimmed !== value) {
            onSave(trimmed);
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
                if (showDropdown) {
                    handleSave();
                } else {
                    openEditor();
                }
            } else if (e.key === "Escape") {
                setEditValue(value);
                setIsEditing(false);
                setShowDropdown(false);
            } else if (e.key === "ArrowDown") {
                e.preventDefault();
                setShowDropdown(true);
            }
        },
        [handleSave, onKeyDown, openEditor, value, showDropdown],
    );

    if (disabled) {
        return <span className={cn("text-sm text-gray-500", className)}>{value}</span>;
    }

    // If no options provided, just show inline edit
    if (options.length === 0) {
        return (
            <input
                value={editValue}
                onChange={e => {
                    setEditValue(e.target.value);
                    if (options.length > 0) {
                        setShowDropdown(false);
                    }
                }}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                className={cn(
                    "w-16 border-b-2 border-primary bg-transparent px-1 py-0.5 text-right text-xs outline-none transition-colors",
                    className,
                )}
            />
        );
    }

    if (isEditing) {
        return (
            <div ref={containerRef} className="relative inline-flex items-center">
                <input
                    ref={el => {
                        inputRef.current = el;
                        rootRef(el);
                    }}
                    data-field={dataField}
                    value={editValue}
                    onChange={e => {
                        setEditValue(e.target.value);
                        setShowDropdown(false);
                    }}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    className={cn(
                        "w-16 border-b-2 border-primary bg-transparent px-1 py-0.5 text-right text-xs outline-none transition-colors",
                        className,
                    )}
                />
                <button
                    type="button"
                    onClick={() => setShowDropdown(prev => !prev)}
                    className="ml-0.5 p-0.5 text-gray-400 hover:muted-foreground"
                    tabIndex={-1}
                >
                    <ChevronDownIcon size={12} />
                </button>
                {showDropdown && (
                    <div
                        className="fixed z-[9999] mt-1 w-fit min-w-[3.5rem] rounded-md border border-border bg-surface py-1 shadow-lg"
                        style={{
                            left: containerRef.current
                                ? containerRef.current.getBoundingClientRect().left
                                : 0,
                            top: containerRef.current
                                ? containerRef.current.getBoundingClientRect().bottom + 4
                                : 0,
                        }}
                    >
                        {options.map(unit => (
                            <button
                                key={unit}
                                type="button"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => handleSelect(unit)}
                                className={cn(
                                    "block w-full whitespace-nowrap px-2 py-1 text-left text-xs transition-colors hover:bg-primary-light",
                                    unit === editValue &&
                                        "bg-primary-light font-medium text-primary",
                                )}
                            >
                                {unit}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div ref={containerRef} className="relative inline-flex items-center">
            <span
                ref={rootRef}
                data-field={dataField}
                className={cn(
                    "inline-flex cursor-pointer items-center gap-0.5 rounded px-1 py-0.5 text-xs transition-colors hover:bg-primary-light hover:text-primary",
                    className,
                )}
                onClick={openEditor}
                onKeyDown={handleKeyDown}
                title="Click to edit unit"
                tabIndex={0}
            >
                {value}
            </span>
            <button
                type="button"
                onClick={() => setShowDropdown(prev => !prev)}
                className="ml-0.5 p-0.5 text-gray-400 hover:muted-foreground"
                tabIndex={-1}
            >
                <ChevronDownIcon size={12} />
            </button>
            {showDropdown && (
                <div
                    className="fixed z-[9999] mt-1 w-fit min-w-[3.5rem] rounded-md border border-border bg-surface py-1 shadow-lg"
                    style={{
                        left: containerRef.current
                            ? containerRef.current.getBoundingClientRect().left
                            : 0,
                        top: containerRef.current
                            ? containerRef.current.getBoundingClientRect().bottom + 4
                            : 0,
                    }}
                >
                    {options.map(unit => (
                        <button
                            key={unit}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => handleSelect(unit)}
                            className={cn(
                                "block w-full whitespace-nowrap px-2 py-1 text-left text-xs transition-colors hover:bg-primary-light",
                                unit === editValue && "bg-primary-light font-medium text-primary",
                            )}
                        >
                            {unit}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
