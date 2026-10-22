"use client";

import { Badge, MenuList } from "@/components/ui";
import { ChevronDownIcon } from "@/components/ui/icons";
import {
    BILL_STATUSES,
    getBillStatusLabel,
    getBillStatusVariant,
    normalizeBillStatus,
} from "@/lib/utils/bill-status";
import type { BillStatus } from "@/types/bill";
import type { MenuItem } from "@/types";

interface BillStatusBadgeProps {
    /** Status of the bill. */
    status: BillStatus | string | null | undefined;
    /** Called with the new status when the user picks another one. */
    onChange?: (status: BillStatus) => void;
    /** Whether the status may be changed by the user. */
    canEdit?: boolean;
    /** Disables the status editor. */
    disabled?: boolean;
    className?: string;
}

/**
 * Status of a bill.
 *
 * The status is shown as a badge. When the user is allowed to change it, the
 * badge opens a menu with every status of the bill lifecycle.
 */
export function BillStatusBadge({
    status,
    onChange,
    canEdit = true,
    disabled = false,
    className,
}: BillStatusBadgeProps) {
    const current = normalizeBillStatus(status);
    const label = current ? getBillStatusLabel(current) : getBillStatusLabel(status);
    const variant = getBillStatusVariant(current);

    if (!onChange || !canEdit || disabled) {
        return (
            <Badge variant={variant} className={className}>
                {label}
            </Badge>
        );
    }

    const items: MenuItem[] = BILL_STATUSES.map(option => ({
        key: option,
        label: getBillStatusLabel(option),
        onClick: () => onChange(option),
        className: option === current ? "font-medium text-primary" : undefined,
    }));

    return (
        <MenuList
            align="start"
            items={items}
            trigger={
                <span className="inline-flex items-center gap-1">
                    <Badge variant={variant}>{label}</Badge>
                    <ChevronDownIcon size={12} className="text-muted-foreground" />
                </span>
            }
        />
    );
}
