"use client";

import React, { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api/api-client";
import type { Vendor } from "@/types/vendor";

const CreatableSelectField = dynamic(
    () =>
        import("@/components/ui").then(mod => ({
            default: mod.CreatableSelectField,
        })),
    { ssr: false },
);

export interface VendorDropdownProps {
    /** The currently selected vendor ID */
    value?: string;
    /** Callback when vendor selection changes */
    onChange: (vendorId: string) => void;
    /** List of vendors to display as options */
    vendorList: Vendor[];
    /** Whether vendors are still loading */
    loadingVendors?: boolean;
    /** Whether the field is disabled */
    isDisabled?: boolean;
    /** If true, show a smaller label style */
    smallLabel?: boolean;
    /** Custom label text */
    label?: string;
    /** Optional wrapper class name */
    wrapperClassName?: string;
    /** Whether the field can be cleared */
    isClearable?: boolean;
    /** Custom placeholder text */
    placeholder?: string;
    /** Optional inline validation error message (shown under the field). */
    error?: string;
}

/**
 * VendorDropdown - A reusable dropdown for selecting or creating a vendor.
 *
 * Uses CreatableSelectField to allow selection from existing vendors or
 * creating a new vendor via the API. Handles loading state, clearing, and
 * vendor option mapping.
 */
export function VendorDropdown({
    value,
    onChange,
    vendorList,
    loadingVendors = false,
    isDisabled = false,
    smallLabel = true,
    label = "Assigned Vendor",
    wrapperClassName,
    isClearable = true,
    placeholder,
    error,
}: VendorDropdownProps) {
    const [isCreating, setIsCreating] = useState(false);
    const pendingCreateRef = useRef(false);
    const createdVendorsRef = useRef<Record<string, string>>({});

    const resolvedPlaceholder = isCreating
        ? "Creating vendor..."
        : (placeholder ?? (loadingVendors ? "Loading..." : "Vendor"));

    const handleCreateVendor = useCallback(
        async (inputValue: string) => {
            // Prevent duplicate submissions
            if (pendingCreateRef.current) return;
            pendingCreateRef.current = true;
            setIsCreating(true);

            try {
                const res = await apiRequest("/api/vendors", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: inputValue }),
                });

                if (!res.ok) {
                    await res.text().catch(() => "");
                    throw new Error(`Failed to create vendor: ${res.status}`);
                }

                const data = await res.json();
                // Extract vendor ID from the response (supports both { id, ... } and { data: { id, ... } })
                const vendorId = data.id || data.data?.id;

                if (vendorId) {
                    createdVendorsRef.current[String(vendorId)] = inputValue;
                    onChange(String(vendorId));
                    toast.success(`Vendor "${inputValue}" created successfully`);
                } else {
                    throw new Error("No vendor ID returned from API");
                }
            } catch (err) {
                toast.error("Failed to create vendor");
                // Clear the input by passing empty string
                onChange("");
            } finally {
                setIsCreating(false);
                pendingCreateRef.current = false;
            }
        },
        [onChange],
    );

    return (
        <CreatableSelectField
            smallLabel={smallLabel}
            label={label}
            options={vendorList.map(v => ({
                value: String(v.id || ""),
                label: v.name as string,
            }))}
            value={
                value
                    ? {
                          value,
                          label:
                              vendorList.find(v => String(v.id) === value)?.name ||
                              createdVendorsRef.current[value] ||
                              value,
                      }
                    : null
            }
            onChange={selectedValue => {
                onChange(selectedValue);
            }}
            onCreateOption={handleCreateVendor}
            placeholder={resolvedPlaceholder}
            isClearable={isClearable}
            isDisabled={isDisabled || isCreating}
            wrapperClassName={wrapperClassName}
            errorMessage={error}
            showError={!!error}
        />
    );
}
