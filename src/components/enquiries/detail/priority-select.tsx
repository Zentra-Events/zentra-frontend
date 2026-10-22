"use client";

import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { ENQUIRY_PRIORITY_OPTIONS, getPriorityVariant, type EnquiryPriorityValue } from "@/constants/enquiry";

interface PrioritySelectProps {
    value?: string | null;
    /** Persist callback. Priority has no backend column yet — parent decides. */
    onChange: (value: EnquiryPriorityValue) => void;
    disabled?: boolean;
    compact?: boolean;
}

/**
 * Priority control (LOW/MEDIUM/HIGH/URGENT, Jira-style label+colour).
 * Presentation-only: the Enquiry model has no priority column, so persistence
 * is delegated to the parent (currently local state until backend confirms).
 */
export function PrioritySelect({ value, onChange, disabled, compact }: PrioritySelectProps) {
    const current = (value || "MEDIUM").toUpperCase();
    const options = ENQUIRY_PRIORITY_OPTIONS.map(o => ({ label: o.label, value: o.value }));
    const selected = options.find(o => o.value === current) ?? null;

    return (
        <Tooltip content="Priority is kept on this device until the backend adds a priority field">
            <span className="inline-flex">
                <Select
                    aria-label="Enquiry priority"
                    options={options}
                    value={selected}
                    isDisabled={disabled}
                    isSearchable={false}
                    placeholder="Priority"
                    onChange={(opt: unknown) => {
                        const next = (opt as { value?: EnquiryPriorityValue } | null)?.value;
                        if (next && next !== current) onChange(next);
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
                        return <Badge variant={getPriorityVariant(o.value)}>{o.label}</Badge>;
                    }}
                />
            </span>
        </Tooltip>
    );
}
