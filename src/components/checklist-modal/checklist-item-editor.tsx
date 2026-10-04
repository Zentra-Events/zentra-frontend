"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils/cn";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, DatePickerField, Switch, InlineUnitSelect } from "@/components/ui";
import { VendorDropdown } from "@/components/vendor-dropdown";
import { QUANTITY_UNITS } from "@/lib/utils/artifact-utils";
import { ChecklistBreadcrumb } from "./checklist-breadcrumb";
import { statusOptions } from "./types";
import type { ChecklistItem } from "./types";
import type { ChecklistItemValidation } from "./validation";
import type { Vendor } from "@/types/vendor";
import type { Inventory } from "@/types/inventory";

// react-select is client-only; lazy-load it (SSG/SSR safe), mirroring
// `vendor-dropdown.tsx` and the legacy checklist modal.
const CreatableSelectField = dynamic(
    () =>
        import("@/components/ui").then(mod => ({
            default: mod.CreatableSelectField,
        })),
    { ssr: false },
);

export interface ChecklistItemEditorProps {
    item: ChecklistItem;
    vendorList: Vendor[];
    inventoryList: Inventory[];
    loadingVendors?: boolean;
    loadingInventory?: boolean;
    onUpdate: (field: keyof ChecklistItem, value: string | number) => void;
    onCheckboxChange: (value: boolean) => void;
    /** Inline field validation errors for the currently selected item. */
    errors?: ChecklistItemValidation;
    /** When this matches the selected item's uid, the Item Name field is focused. */
    focusTarget?: string | null;
    onFocused?: () => void;
}

function SectionHeader({ children }: { children: React.ReactNode }) {
    return (
        <h4 className="mb-1.5 border-b border-border/40 pb-1.5 text-xs font-bold uppercase tracking-widest text-primary">
            {children}
        </h4>
    );
}

/**
 * Right-hand editor panel grouped into themed sections, updating only the
 * currently selected item. `Rate` and a `Sub Category` selector are not
 * rendered (the parent Category / Sub Category is shown via the breadcrumb).
 */
export function ChecklistItemEditor({
    item,
    vendorList,
    inventoryList,
    loadingVendors = false,
    loadingInventory = false,
    onUpdate,
    onCheckboxChange,
    errors = {},
    focusTarget,
    onFocused,
}: ChecklistItemEditorProps) {
    const nameInputRef = useRef<HTMLInputElement>(null);

    // Place the cursor in the Item Name field when this item is the focus
    // target (e.g. after "Convert to Sub Category" created a new child item).
    useEffect(() => {
        if (focusTarget && focusTarget === item._uid) {
            nameInputRef.current?.focus();
            onFocused?.();
        }
    }, [focusTarget, item._uid, onFocused]);

    return (
        <div className="flex h-full flex-col">
            {/* Breadcrumb — hierarchy path above the editor */}
            <div className="px-6 pb-3">
                <ChecklistBreadcrumb selectedItem={item} />
            </div>

            <div className="flex-1 overflow-y-auto px-6">
                <div className="max-w-4xl pt-2">
                    <div className="space-y-8">
                        {/* Basic Info */}
                        <section className="mb-4">
                            <SectionHeader>Basic Info</SectionHeader>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                <div className="md:col-span-2">
                                    <Input
                                        ref={nameInputRef}
                                        value={item.item}
                                        onChange={e => onUpdate("item", e.target.value)}
                                        label="Item Name"
                                        placeholder="Enter item name"
                                        smallLabel
                                        error={errors.item}
                                        id="checklist-item-name"
                                    />
                                </div>
                                <div>
                                    <Select
                                        value={
                                            statusOptions.find(opt => opt.value === item.status) ||
                                            null
                                        }
                                        onChange={e => onUpdate("status", e?.value ?? "")}
                                        options={statusOptions}
                                        label="Status"
                                        smallLabel
                                        placeholder="Select status"
                                        error={errors.status}
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Execution Details */}
                        <section className="mb-4">
                            <SectionHeader>Execution Details</SectionHeader>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                                {/* Left column — Description + Details row */}
                                <div className="md:col-span-2">
                                    <div className="space-y-5">
                                        <div>
                                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                                Description details &amp; specs
                                            </label>
                                            <Textarea
                                                value={item.description || ""}
                                                onChange={e =>
                                                    onUpdate("description", e.target.value)
                                                }
                                                placeholder="Add notes, specifics, lengths, details..."
                                                rows={3}
                                                smallLabel
                                                error={errors.description}
                                                id="checklist-item-description"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Right column — Inventory */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/50 px-4 py-2.5 mt-6">
                                        <span className="text-sm font-semibold text-muted-foreground">
                                            Use Inventory
                                        </span>
                                        <Switch
                                            checked={item.isInventoryItem || false}
                                            onCheckedChange={onCheckboxChange}
                                        />
                                    </div>
                                    {item.isInventoryItem && (
                                        <div>
                                            <CreatableSelectField
                                                smallLabel
                                                // label="Inventory Item"
                                                options={inventoryList.map(inv => ({
                                                    value: String(inv.id || ""),
                                                    label: inv.itemName as string,
                                                }))}
                                                value={
                                                    item.inventoryID
                                                        ? {
                                                              value: String(item.inventoryID),
                                                              label:
                                                                  inventoryList.find(
                                                                      inv =>
                                                                          String(inv.id) ===
                                                                          String(item.inventoryID),
                                                                  )?.itemName ||
                                                                  String(item.inventoryID),
                                                          }
                                                        : null
                                                }
                                                onChange={selectedValue =>
                                                    onUpdate("inventoryID", selectedValue)
                                                }
                                                placeholder={
                                                    loadingInventory
                                                        ? "Loading..."
                                                        : "Select inventory item"
                                                }
                                                isClearable
                                                errorMessage={errors.inventoryID}
                                                showError={!!errors.inventoryID}
                                            />
                                        </div>
                                    )}
                                </div>
                                {/* Days / Quantity / Unit / Vendor row.
                                    Vendor uses a wider 1.53fr track so it visually matches
                                    the Inventory dropdown (a single 1/3-col in the parent
                                    md:grid-cols-3 layout) directly above it. */}
                                <div className="grid grid-cols-2 gap-3 md:grid-cols-[1fr_1fr_1fr_1.53fr] col-span-3">
                                    <div>
                                        <Input
                                            label="Days"
                                            type="number"
                                            smallLabel
                                            value={(item.days ?? 0) || ""}
                                            onChange={e =>
                                                onUpdate("days", parseInt(e.target.value) || 0)
                                            }
                                            error={errors.days}
                                            id="checklist-item-days"
                                        />
                                    </div>
                                    <div>
                                        <Input
                                            label="Quantity"
                                            smallLabel
                                            type="number"
                                            value={item.quantity || ""}
                                            onChange={e =>
                                                onUpdate("quantity", parseInt(e.target.value) || 0)
                                            }
                                            error={errors.quantity}
                                            id="checklist-item-quantity"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            Unit
                                        </label>
                                        <div
                                            className={cn(
                                                "flex h-10 w-full items-center rounded-md border border-input bg-surface px-2 transition-colors",
                                                errors.unit &&
                                                    "border-error focus-within:border-error",
                                            )}
                                        >
                                            <InlineUnitSelect
                                                value={item.unit || "nos"}
                                                onSave={val => onUpdate("unit", val)}
                                                options={QUANTITY_UNITS}
                                                data-field="unit"
                                                className="w-full"
                                            />
                                        </div>
                                        {errors.unit && (
                                            <p className="mt-1 text-xs text-error">{errors.unit}</p>
                                        )}
                                    </div>
                                    <div>
                                        <VendorDropdown
                                            value={item.vendor}
                                            onChange={vendorId => onUpdate("vendor", vendorId)}
                                            vendorList={vendorList}
                                            loadingVendors={loadingVendors}
                                            smallLabel
                                            isClearable
                                            isDisabled={item.isInventoryItem}
                                            error={errors.vendor}
                                        />
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Timeline */}
                        <section className="mb-4">
                            <SectionHeader>Timeline</SectionHeader>
                            <div className="grid grid-cols-1 gap-3 rounded-md border border-border/40 bg-muted/50 p-2 sm:grid-cols-3">
                                <DatePickerField
                                    value={
                                        item.startDate
                                            ? new Date(item.startDate + "T00:00:00")
                                            : null
                                    }
                                    onChange={date => {
                                        const value = date ? date.toISOString().split("T")[0] : "";
                                        onUpdate("startDate", value);
                                    }}
                                    placeholderText="Select"
                                    dateFormat="MMM d, yyyy"
                                    showTimeSelect={false}
                                    smallLabel
                                    label="Start Date"
                                />
                                <DatePickerField
                                    value={
                                        item.endDate ? new Date(item.endDate + "T00:00:00") : null
                                    }
                                    onChange={date => {
                                        const value = date ? date.toISOString().split("T")[0] : "";
                                        onUpdate("endDate", value);
                                    }}
                                    placeholderText="Select"
                                    dateFormat="MMM d, yyyy"
                                    showTimeSelect={false}
                                    smallLabel
                                    label="End Date"
                                />
                                <DatePickerField
                                    value={
                                        item.deadlineDate
                                            ? new Date(item.deadlineDate + "T00:00:00")
                                            : null
                                    }
                                    onChange={date => {
                                        const value = date ? date.toISOString().split("T")[0] : "";
                                        onUpdate("deadlineDate", value);
                                    }}
                                    placeholderText="Select"
                                    dateFormat="MMM d, yyyy"
                                    showTimeSelect={false}
                                    smallLabel
                                    label="Deadline"
                                />
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
}
