"use client";

import { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { PhoneLink } from "@/components/ui/phone-link";

interface EnquiryFieldProps {
    icon?: ReactNode;
    label: string;
    /** Read-mode display node. Empty values render the shared "Not Assigned" badge. */
    value?: string | number | ReactNode | null;
    copyValue?: string | number;
    isPhone?: boolean;
    spanFull?: boolean;
    /** Rendered in place of the value (e.g. an inline editor). */
    children?: ReactNode;
}

/**
 * Consistent label/value row for the detail page. Reuses Badge/CopyButton/
 * PhoneLink primitives so rows match EnquiryViewModal styling exactly.
 * Pass `children` to swap the value for an inline editor.
 */
export function EnquiryField({ icon, label, value, copyValue, isPhone, spanFull, children }: EnquiryFieldProps) {
    const isEmpty = value === undefined || value === null || value === "" || value === "-";

    return (
        <div
            className={`group flex items-start gap-2.5 py-2 first:pt-0 last:pb-0 ${spanFull ? "sm:col-span-2" : ""}`}
        >
            {icon && <div className="mt-0.5 shrink-0 text-muted-foreground">{icon}</div>}
            <div className="w-full min-w-0 max-w-full flex-1 break-words">
                <p className="mb-0.5 text-xs text-muted-foreground">{label}</p>
                {children ? (
                    children
                ) : isEmpty ? (
                    <Badge variant="default" className="px-2 py-0 text-[11px] font-normal italic">
                        Not Assigned
                    </Badge>
                ) : isPhone ? (
                    <PhoneLink number={String(value)} />
                ) : (
                    <span className="inline-flex w-full items-start text-sm font-medium text-foreground">
                        <span className="break-words whitespace-pre-wrap">{value}</span>
                        {copyValue && <CopyButton text={copyValue} label={label} />}
                    </span>
                )}
            </div>
        </div>
    );
}
