"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

interface DropdownMenuItem {
    label: string;
    icon: string;
    action: () => void;
    variant?: "default" | "danger";
    disabled?: boolean;
}

interface DropdownMenuProps {
    items: DropdownMenuItem[];
    className?: string;
}

export default function DropdownMenu({ items, className = "" }: DropdownMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ top: 0, right: 0 });

    useEffect(() => {
        const _handleClickOutside = (_event: MouseEvent) => {
            // Since we use a portal, the menu is outside the ref.
            // But we have a backdrop div for clicking outside.
            // However, if we click the toggle button again, we need to handle it.
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                // This is handled by the backdrop, but good to have.
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setIsOpen(false);
            }
        };

        const handleScroll = () => {
            if (isOpen) setIsOpen(false);
        };

        if (isOpen) {
            document.addEventListener("keydown", handleEscape);
            window.addEventListener("scroll", handleScroll, true);
        }

        return () => {
            document.removeEventListener("keydown", handleEscape);
            window.removeEventListener("scroll", handleScroll, true);
        };
    }, [isOpen]);

    const handleItemClick = (item: DropdownMenuItem) => {
        item.action();
        setIsOpen(false);
    };

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isOpen && dropdownRef.current) {
            const rect = dropdownRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + 4,
                right: window.innerWidth - rect.right,
            });
        }
        setIsOpen(!isOpen);
    };

    return (
        <div className={`relative ${className}`} ref={dropdownRef}>
            <button
                onClick={handleToggle}
                className="p-1 rounded-md hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 transition-colors"
                aria-label="More options"
                aria-expanded={isOpen}
                aria-haspopup="true"
            >
                <svg
                    className="w-5 h-5 text-gray-400 hover:text-gray-600"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
                </svg>
            </button>

            {isOpen &&
                typeof document !== "undefined" &&
                createPortal(
                    <>
                        <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                        <div
                            className="fixed mt-1 w-48 glass border border-black/5 rounded-xl shadow-lg z-50 py-1 overflow-hidden"
                            style={{ top: position.top, right: position.right }}
                        >
                            {items.map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => !item.disabled && handleItemClick(item)}
                                    disabled={item.disabled}
                                    className={`w-full text-left px-4 py-2 text-sm flex items-center gap-3 transition-colors ${
                                        item.disabled
                                            ? "opacity-50 cursor-not-allowed"
                                            : item.variant === "danger"
                                            ? "text-red-500 hover:bg-black/5 hover:text-red-600"
                                            : "text-slate-700 hover:text-slate-900 hover:bg-black/5"
                                    }`}
                                >
                                    <span className="text-base flex-shrink-0 w-4 text-center">
                                        {item.icon}
                                    </span>
                                    <span className="flex-1">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </>,
                    document.body
                )}
        </div>
    );
}
