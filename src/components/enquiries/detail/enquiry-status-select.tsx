"use client";

import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
    ENQUIRY_STATUS_OPTIONS,
    getEnquiryStatusLabel,
    getEnquiryStatusVariant,
} from "@/constants/enquiry";

interface EnquiryStatusSelectProps {
    value?: string | null;
    onChange: (value: string) => Promise<boolean>;
    disabled?: boolean;
    compact?: boolean;
}

/**
 * Enquiry-specific status control: badge-styled trigger + react-select menu,
 * reusing the shared Select + Badge tokens. Options come from the single
 * ENQUIRY_STATUS_OPTIONS constant (OPEN/IN_PROGRESS/CLOSED — the only values
 * the list filter + backend query support).
 */
export function EnquiryStatusSelect({ value, onChange, disabled, compact }: EnquiryStatusSelectProps) {
    const current = (value || "OPEN").toUpperCase();
    const options = ENQUIRY_STATUS_OPTIONS.map(o => ({ label: o.label, value: o.value }));
    const selected = options.find(o => o.value === current) ?? null;

    return (
        <Select
            aria-label="Enquiry status"
            options={options}
            value={selected}
            isDisabled={disabled}
            isSearchable={false}
            placeholder="Status"
            onChange={(opt: unknown) => {
                const next = (opt as { value?: string } | null)?.value;
                if (next && next !== current) void onChange(next);
            }}
            styles={{
                control: base => ({
                    ...base,
                    minHeight: compact ? 30 : 34,
                    borderRadius: 999,
                    borderWidth: 0,
                    backgroundColor: "transparent",
                    boxShadow: "none",
                    cursor: disabled ? "not-allowed" : "pointer",
                    paddingLeft: 2,
                }),
                valueContainer: base => ({ ...base, padding: 0 }),
                singleValue: base => ({ ...base, margin: 0 }),
            }}
            formatOptionLabel={(opt: unknown) => {
                const o = opt as { value: string; label: string };
                return (
                    <Badge variant={getEnquiryStatusVariant(o.value)}>
                        {getEnquiryStatusLabel(o.value)}
                    </Badge>
                );
            }}
        />
    );
}
