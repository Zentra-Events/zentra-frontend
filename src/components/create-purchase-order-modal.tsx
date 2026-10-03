"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Modal, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, type Column } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { InlineNumber } from "@/components/ui/inline-number";
import { InlineUnitSelect } from "@/components/ui/inline-unit-select";
import { QUANTITY_UNITS } from "@/lib/utils/artifact-utils";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import { CostSummary } from "@/components/cost-summary";
import {
    PurchaseOrderClientDetails,
    ClientFinancials,
    GST_TYPE_OPTIONS,
    GST_LABEL_BY_TYPE,
    type EstimateExpensesRow,
} from "@/components/purchase-order-client-details";
import { cn } from "@/lib/utils/cn";
import type { EventResponse, VendorSummary } from "@/types/event";
import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Pencil, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { calculateEstimateSummary } from "@/lib/utils/estimate";

/* ------------------------------------------------------------------ */
/*  Raw API item type – matches EventResponse.items shape              */
/* ------------------------------------------------------------------ */

interface RawEventItem {
    item?: string;
    description?: string;
    quantity?: number;
    pricePerItem?: number;
    vendor?: string;
    days?: number;
    serialNumber?: number;
    category?: string;
    subCategory?: string;
    unit?: string;
}

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface LineItem {
    id: string;
    itemName: string;
    description: string;
    qty: number;
    rate: number;
    days: number;
    unit?: string;
    /** Flat index into the editable items array, used to write edits back. */
    srcIndex: number;
    subCategory?: string;
}

interface SubCategoryGroup {
    id: string;
    name: string;
    items: LineItem[];
}

interface CategorySection {
    id: string;
    title: string;
    description: string;
    /** Flat list of all items in the category (direct items then sub-category items). */
    items: LineItem[];
    /** Items without a sub-category. */
    directItems: LineItem[];
    /** Items grouped under their respective sub-category headers. */
    subCategories: SubCategoryGroup[];
}

interface Financials {
    subtotal: number;
    gstType: string;
    gstPercent: number;
    tdsPercent: number;
    advance: number;
    note: string;
}

/* ------------------------------------------------------------------ */
/*  Props                                                             */
/* ------------------------------------------------------------------ */

interface CreatePurchaseOrderModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave?: () => void;
    onViewPurchaseOrder?: () => void;
    vendorList?: Array<{ id?: string; name: string }>;
    eventData: EventResponse;
    /**
     * Pre-tax estimate base used by the Cost Summary (= sum of the filtered
     * estimates' expensesTotal). Service charge, discount, GST and TDS are
     * applied on top of this value, so it must NOT already include them
     * (pass the expensesTotal sum, not the netTotal sum).
     */
    totalClientEstimatedAmount: number;
    /**
     * Filtered estimate versions (status EVENT_CREATED / EVENT_MERGED) surfaced
     * in the Estimate section of the Client Details view.
     */
    estimates?: EstimateExpensesRow[];
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Convert a RawEventItem into a LineItem for display in the table. */
function toLineItem(item: RawEventItem, index: number, srcIndex: number): LineItem {
    return {
        id: `item-${index}`,
        itemName: item.item ?? "",
        description: item.description ?? "",
        qty: item.quantity ?? 1,
        rate: item.pricePerItem ?? 0,
        days: item.days ?? 1,
        unit: item.unit && item.unit.trim() ? item.unit.trim() : "nos",
        srcIndex,
    };
}

/**
 * Group items from `items` by category for a given vendor ID.
 * Returns an array of CategorySection suitable for display.
 * Each produced LineItem carries `srcIndex` so qty/rate edits can be
 * written back to the flat editable items array used by the table editors.
 */
function groupItemsByCategory(
    items: RawEventItem[],
    vendorId: string | undefined,
): CategorySection[] {
    // Filter to items belonging to this vendor, remembering each flat index.
    const vendorItems: { eventItem: RawEventItem; srcIndex: number }[] = [];
    items.forEach((eventItem, srcIndex) => {
        const eventVendor = eventItem.vendor;
        let matches = false;
        if (vendorId === "SELF") {
            // For SELF (inventory) items, match items with no vendor or vendor "SELF"
            matches = !eventVendor || eventVendor === "SELF";
        } else if (eventVendor) {
            matches = vendorId ? eventVendor === vendorId : true;
        }
        if (matches) {
            vendorItems.push({ eventItem, srcIndex });
        }
    });

    // Group remaining items by category
    const grouped = new Map<string, { eventItem: RawEventItem; srcIndex: number }[]>();
    vendorItems.forEach(({ eventItem, srcIndex }) => {
        const category = eventItem.category ?? "Uncategorized";
        if (!grouped.has(category)) {
            grouped.set(category, []);
        }
        grouped.get(category)!.push({ eventItem, srcIndex });
    });

    // Convert each group to a CategorySection with optional subcategory grouping
    return Array.from(grouped.entries()).map(([category, categoryItems], idx) => {
        // Partition the category's items into direct items (no sub-category) and
        // items grouped under their respective sub-category headers.
        const directItems: LineItem[] = [];
        const subMap = new Map<string, LineItem[]>();
        const subOrder: string[] = [];

        categoryItems.forEach(({ eventItem, srcIndex }, i) => {
            const lineItem = toLineItem(eventItem, i, srcIndex);
            const sub = eventItem.subCategory?.trim();
            if (sub) {
                if (!subMap.has(sub)) {
                    subMap.set(sub, []);
                    subOrder.push(sub);
                }
                subMap.get(sub)!.push(lineItem);
            } else {
                directItems.push(lineItem);
            }
        });

        const subCategories: SubCategoryGroup[] = subOrder.map((name, subIdx) => ({
            id: `sub-${idx}-${subIdx}`,
            name,
            items: subMap.get(name)!,
        }));

        // Flat list preserving order: direct items first, then each sub-category's items.
        const items = [...directItems, ...subCategories.flatMap(sub => sub.items)];

        return {
            id: `category-${idx}`,
            title: category,
            description: `Procurement for ${category}`,
            items,
            directItems,
            subCategories,
        };
    });
}

/** Determine the set of vendors that appear in the item list. */
function getItemVendorIds(items: RawEventItem[] | undefined): Set<string> {
    const ids = new Set<string>();
    if (!items) return ids;
    let hasSelfItems = false;
    for (const item of items) {
        if (item.vendor) {
            ids.add(item.vendor);
        } else {
            hasSelfItems = true;
        }
    }
    // If any items have no vendor (inventory/self), add "SELF" entry
    if (hasSelfItems) {
        ids.add("SELF");
    }
    return ids;
}

/** Build the default financials object for a vendor summary. */
function buildFinancialsFromSummary(
    vs: VendorSummary | undefined,
    computedSubtotal: number,
): Financials {
    if (vs) {
        return {
            subtotal: vs.totalAmount ?? computedSubtotal,
            gstType: vs.gstType ?? "NONE",
            gstPercent: vs.gst ?? 0,
            tdsPercent: vs.tds ?? 0,
            advance: vs.advanceAmount ?? 0,
            note: vs.changeSummary ?? "",
        };
    }
    return {
        subtotal: computedSubtotal,
        gstType: "NONE",
        gstPercent: 0,
        tdsPercent: 0,
        advance: 0,
        note: "",
    };
}

/**
 * Instructional microcopy surfaced by the info tooltip beside each category
 * section header. Kept in a tooltip (rather than an always-on banner) so it
 * explains the editable fields without permanently consuming modal space.
 */
const EDITABLE_FIELDS_HINT =
    "Click any Qty, Unit or Rate value to edit it. Changes update the event checklist when you save the purchase order.";

/**
 * Table column header that flags the column's cells as inline-editable.
 * Renders a small pencil glyph next to the label so users can tell at a glance
 * which fields accept input, without having to hover every cell first.
 */
function EditableHeader({ label }: { label: string }) {
    return (
        <span className="inline-flex items-center gap-1">
            {label}
            <Pencil size={11} className="text-primary/70" aria-hidden="true" />
        </span>
    );
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function CreatePurchaseOrderModal({
    isOpen,
    onClose,
    onSave,
    onViewPurchaseOrder,
    vendorList,
    eventData,
    totalClientEstimatedAmount = 0,
    estimates = [],
}: CreatePurchaseOrderModalProps) {
    const itemList = eventData?.items ?? [];
    const vendorSummary = eventData?.vendorSummary ?? [];
    // Client / event display info, populated from the existing event/estimate data.
    const clientName = eventData?.client || "—";
    const eventName = eventData?.title || "—";
    const eventDescription =
        (eventData?.highlvelRequirement as string) ||
        eventData?.venue ||
        eventData?.location ||
        "—";
    // Determine which vendors to show in the sidebar: all vendors from vendorList
    // that have items in itemList
    const activeVendorIds = useMemo(() => getItemVendorIds(itemList), [itemList]);

    const vendors = useMemo(() => {
        const result: { id: string; name: string; status: string }[] = [];

        // Add regular vendors that have items
        if (vendorList && vendorList.length > 0) {
            for (const v of vendorList) {
                if (v.id && activeVendorIds.has(v.id)) {
                    result.push({
                        id: v.id,
                        name: v.name,
                        status: "Active Selection",
                    });
                }
            }
        }

        // Add SELF (inventory) entry if there are items with no vendor
        if (activeVendorIds.has("SELF")) {
            result.push({
                id: "SELF",
                name: "Inventory (Self)",
                status: "Own Inventory",
            });
        }

        return result;
    }, [vendorList, activeVendorIds]);

    const [activeVendorId, setActiveVendorId] = useState<string>("");
    const [showBreakdown, setShowBreakdown] = useState(false);
    // Which sidebar tab is active: "client" renders the Client Details section,
    // "vendor" renders the selected vendor's items & financials. Client Details
    // is the initial standalone selection, independent of any vendor.
    const [activeView, setActiveView] = useState<"client" | "vendor">("client");

    /* ---------- Client / estimate financials ----------
     * Editable client billing details, pre-populated from the approved/final
     * estimate (eventData). These are purely client-side and never feed the
     * vendor financial calculation below. */
    const [clientFinancials, setClientFinancials] = useState<ClientFinancials>({
        serviceCharge: 0,
        gstType: "NONE",
        gst: 0,
        discount: 0,
        billingAddress: "",
        tds: 0,
        receivedAmount: 0,
    });

    useEffect(() => {
        if (!isOpen) return;
        setClientFinancials({
            serviceCharge: eventData?.serviceCharge ?? 0,
            gstType: eventData?.gstType ?? "NONE",
            gst: eventData?.gst ?? 0,
            discount: eventData?.discounts ?? 0,
            billingAddress: eventData?.billingAddress ?? "",
            tds: eventData?.tds ?? 0,
            // Amount already received from the client. Defaults to the
            // recorded client advance when available.
            receivedAmount: eventData?.advanceAmt ?? 0,
        });
    }, [isOpen]);

    /* ---------- Save / checklist-update confirmation ---------- */
    const [isSaving, setIsSaving] = useState(false);
    const [showChecklistConfirmation, setShowChecklistConfirmation] = useState(false);

    /* ---------- Editable working copy of line items ----------
     * Initialised from the event items each time the modal opens, and then
     * mutated in place by the inline qty/rate/unit editors. This is the source
     * of truth for both the table and the payload saved back to the API. */
    const [editableItems, setEditableItems] = useState<RawEventItem[]>([]);
    // Snapshot of the working copy taken when the modal opens; used to detect
    // whether the user changed any editable line-item value before saving.
    const [originalItems, setOriginalItems] = useState<RawEventItem[]>([]);

    useEffect(() => {
        if (isOpen) {
            const init = itemList.map(it => ({ ...it }));
            setEditableItems(init);
            setOriginalItems(init.map(it => ({ ...it })));
        }
    }, [isOpen]);

    // Reset active vendor when vendors change
    useEffect(() => {
        if (vendors.length > 0) {
            if (!activeVendorId || !vendors.some(v => v.id === activeVendorId)) {
                setActiveVendorId(vendors[0].id);
            }
        } else {
            setActiveVendorId("");
        }
    }, [vendors]);

    /* ---------- Derive categories for active vendor ---------- */
    const categories: CategorySection[] = useMemo(() => {
        if (!editableItems || !activeVendorId) return [];
        return groupItemsByCategory(editableItems, activeVendorId);
    }, [editableItems, activeVendorId]);

    /* ---------- Computed subtotal from items ---------- */
    const computedSubtotal = useMemo(() => {
        return categories.reduce(
            (sum, section) => sum + section.items.reduce((s, item) => s + item.qty * item.rate, 0),
            0,
        );
    }, [categories]);

    /* ---------- Detect whether any editable line-item value changed ---------- */
    // Compares the working copy of line items against the snapshot taken when
    // the modal opened. When any qty / rate / unit differs, saving will require
    // a confirmation because the change will propagate to the event checklist.
    const editableItemsChanged = useMemo(() => {
        if (editableItems.length !== originalItems.length) return true;
        return originalItems.some((orig, i) => {
            const cur = editableItems[i];
            if (!cur) return true;
            const origUnit = orig.unit?.trim() || "nos";
            const curUnit = cur.unit?.trim() || "nos";
            return (
                (orig.quantity ?? 1) !== (cur.quantity ?? 1) ||
                (orig.pricePerItem ?? 0) !== (cur.pricePerItem ?? 0) ||
                origUnit !== curUnit
            );
        });
    }, [editableItems, originalItems]);

    /* ---------- Per‑vendor financials state so edits survive vendor switches ---------- */
    const [financialsByVendor, setFinancialsByVendor] = useState<Record<string, Financials>>({});
    /**
     * Tracks vendors whose TDS (%) was explicitly edited in the vendor
     * financials form. Client Details TDS (`clientFinancials.tds`) must only
     * update the root-level `tds` — it must never overwrite per-vendor
     * `vendorSummary[].tds`. So on save, vendors NOT in this set keep their
     * original `vendorSummary.tds` value verbatim.
     */
    const [tdsEditedVendorIds, setTdsEditedVendorIds] = useState<Record<string, boolean>>({});

    // Reset per-open edit tracking so TDS edits from a previous
    // event/modal session never leak into the next save.
    useEffect(() => {
        if (isOpen) {
            setTdsEditedVendorIds({});
        }
    }, [isOpen]);

    // Initialise financials for each vendor on mount / data change
    useEffect(() => {
        if (vendors.length === 0) return;

        setFinancialsByVendor(prev => {
            const next = { ...prev };
            for (const v of vendors) {
                if (!next[v.id]) {
                    const vs = vendorSummary?.find(s => {
                        if (v.id === "SELF") {
                            // SELF items may have vendor "" or "SELF" in vendorSummary
                            return !s.vendor || s.vendor === "SELF";
                        }
                        return s.vendor === v.id;
                    });
                    const itemsForVendor = groupItemsByCategory(itemList, v.id);
                    const sub = itemsForVendor.reduce(
                        (sum, section) =>
                            sum + section.items.reduce((s, item) => s + item.qty * item.rate, 0),
                        0,
                    );
                    next[v.id] = buildFinancialsFromSummary(vs, sub);
                }
            }
            return next;
        });
    }, [vendors, vendorSummary, itemList]);

    /* ---------- Keep subtotal in sync with computed value for the active vendor ---------- */
    useEffect(() => {
        setFinancialsByVendor(prev => {
            const current = prev[activeVendorId];
            if (!current) return prev;
            return {
                ...prev,
                [activeVendorId]: { ...current, subtotal: computedSubtotal },
            };
        });
    }, [computedSubtotal, activeVendorId]);

    /* ---------- Get financials for active vendor ---------- */
    const financials: Financials = useMemo(() => {
        return (
            financialsByVendor[activeVendorId] ?? {
                subtotal: computedSubtotal,
                gstType: "NONE",
                gstPercent: 0,
                tdsPercent: 0,
                advance: 0,
                note: "",
            }
        );
    }, [financialsByVendor, activeVendorId, computedSubtotal]);

    /* ---------- Computed net total (subtotal + gst - tds) ---------- */
    const computedNetTotal = useMemo(() => {
        const gstAmount = financials.subtotal * (financials.gstPercent / 100);
        const tdsAmount = financials.subtotal * (financials.tdsPercent / 100);
        return financials.subtotal + gstAmount - tdsAmount;
    }, [financials.subtotal, financials.gstPercent, financials.tdsPercent]);

    /* ---------- Subtotal mismatch warning ---------- */
    const hasSubtotalMismatch = useMemo(() => {
        if (vendors.length === 0) return false;
        // Check if any vendor has a subtotal mismatch
        return vendors.some(v => {
            const f = financialsByVendor[v.id];
            if (!f) return false;
            const cats = groupItemsByCategory(editableItems, v.id);
            const computed = cats.reduce(
                (sum, section) =>
                    sum + section.items.reduce((s, item) => s + item.qty * item.rate, 0),
                0,
            );
            return Math.abs(f.subtotal - computed) > 0.01;
        });
    }, [vendors, financialsByVendor, editableItems]);

    /* ---------- Client billing field handlers ---------- */
    const updateClientFinancial = (field: keyof ClientFinancials, value: string) => {
        setClientFinancials(prev => {
            if (field === "gstType" || field === "billingAddress") {
                return { ...prev, [field]: value };
            }
            if (value === "") return { ...prev, [field]: 0 };
            const parsed = parseFloat(value);
            if (Number.isNaN(parsed)) return prev;
            return { ...prev, [field]: parsed };
        });
    };

    const clientSummary = useMemo(() => {
        return calculateEstimateSummary({
            totalAmount: totalClientEstimatedAmount,
            gst: clientFinancials.gst,
            serviceCharge: clientFinancials.serviceCharge,
            discounts: clientFinancials.discount,
        });
    }, [
        totalClientEstimatedAmount,
        clientFinancials.gst,
        clientFinancials.serviceCharge,
        clientFinancials.discount,
    ]);

    // TDS is applied on the same base used for GST (total after service charge
    // and discount adjustments), mirroring the vendor-side net total convention
    // without mixing the two calculations.
    const clientTdsAmount = useMemo(() => {
        const base =
            totalClientEstimatedAmount +
            clientSummary.serviceChargeAmount -
            clientFinancials.discount;
        return base * (clientFinancials.tds / 100);
    }, [
        totalClientEstimatedAmount,
        clientSummary.serviceChargeAmount,
        clientFinancials.discount,
        clientFinancials.tds,
    ]);

    const clientTotal = clientSummary.totalWithGST - clientTdsAmount;
    const clientOutstanding = clientTotal - clientFinancials.receivedAmount;

    /* ---------- Balance calculation ---------- */
    const balance = useCallback(() => {
        const { subtotal, gstPercent, tdsPercent, advance } = financials;
        const gstAmount = subtotal * (gstPercent / 100);
        const tdsAmount = subtotal * (tdsPercent / 100);
        const total = subtotal + gstAmount - tdsAmount;
        return total - advance;
    }, [financials]);

    /* ---------- Breakdown details ---------- */
    const breakdownDetails = useMemo(() => {
        const { subtotal, gstPercent, tdsPercent, advance } = financials;
        const gstAmount = subtotal * (gstPercent / 100);
        const tdsAmount = subtotal * (tdsPercent / 100);
        const netTotal = subtotal + gstAmount - tdsAmount;
        const bal = netTotal - advance;
        return {
            subtotal,
            gstAmount,
            gstPercent,
            tdsAmount,
            tdsPercent,
            netTotal,
            advance,
            balance: bal,
        };
    }, [financials]);

    /* ---------- Financial field handlers ---------- */
    const updateFinancial = (field: keyof Financials, value: string) => {
        // Editing a vendor's own TDS field is the ONLY way its
        // `vendorSummary[].tds` may change. Record it so save can
        // preserve original vendor TDS values for untouched vendors.
        if (field === "tdsPercent") {
            setTdsEditedVendorIds(prev =>
                prev[activeVendorId] ? prev : { ...prev, [activeVendorId]: true },
            );
        }
        setFinancialsByVendor(prev => {
            const current = prev[activeVendorId];
            if (!current) return prev;
            let updated: Financials;
            if (field === "note" || field === "gstType") {
                updated = { ...current, [field]: value };
            } else if (value === "") {
                updated = { ...current, [field]: value };
            } else {
                const parsed = parseFloat(value);
                if (isNaN(parsed)) return prev;
                updated = { ...current, [field]: parsed };
            }
            return { ...prev, [activeVendorId]: updated };
        });
    };

    /* ---------- Inline edit handler for line items ---------- */
    // Writes a qty/rate/unit edit back into the editable items working copy.
    // Recomputing `categories`/`computedSubtotal` from `editableItems` then
    // automatically propagates the new subtotal to balances/breakdown.
    const updateLineItem = useCallback(
        (srcIndex: number, field: "qty" | "rate" | "unit", value: number | string) => {
            setEditableItems(prev => {
                if (srcIndex < 0 || srcIndex >= prev.length) return prev;
                const next = [...prev];
                const current = next[srcIndex];
                if (field === "qty") {
                    next[srcIndex] = { ...current, quantity: value as number };
                } else if (field === "rate") {
                    next[srcIndex] = { ...current, pricePerItem: value as number };
                } else if (field === "unit") {
                    next[srcIndex] = { ...current, unit: value as string };
                }
                return next;
            });
        },
        [],
    );

    /* ---------- Line item columns (display-only) ---------- */
    const lineItemColumns: Column<LineItem>[] = [
        {
            key: "itemName",
            header: "Item Name",
            render: (item: LineItem) => (
                <span className="text-sm font-medium text-foreground">{item.itemName}</span>
            ),
        },
        {
            key: "description",
            header: "Description",
            cellClassName: "max-w-[180px]",
            render: (item: LineItem) => {
                const truncated =
                    item.description.length > 12
                        ? `${item.description.slice(0, 12)}...`
                        : item.description;
                const needsTooltip = item.description.length > 12;
                const content = (
                    <span className="text-sm text-muted-foreground block">{truncated}</span>
                );
                return needsTooltip ? (
                    <Tooltip content={item.description}>{content}</Tooltip>
                ) : (
                    content
                );
            },
        },
        {
            key: "days",
            header: "Days",
            align: "center",
            cellClassName: "w-16",
            render: (item: LineItem) => <span className="text-sm">{item.days}</span>,
        },
        {
            key: "qty",
            header: <EditableHeader label="Qty" />,
            align: "center",
            cellClassName: "w-16",
            render: (item: LineItem) => (
                <InlineNumber
                    value={item.qty}
                    min={1}
                    step={1}
                    className="text-xs"
                    data-field="qty"
                    onSave={val => updateLineItem(item.srcIndex, "qty", val)}
                />
            ),
        },
        {
            key: "unit",
            header: <EditableHeader label="Unit" />,
            align: "center",
            cellClassName: "w-16",
            render: (item: LineItem) => (
                <InlineUnitSelect
                    value={item.unit || "nos"}
                    options={QUANTITY_UNITS}
                    className="text-xs text-center"
                    data-field="unit"
                    onSave={val => updateLineItem(item.srcIndex, "unit", val || "nos")}
                />
            ),
        },

        {
            key: "rate",
            header: <EditableHeader label="Rate" />,
            align: "right",
            cellClassName: "w-28",
            render: (item: LineItem) => (
                <InlineNumber
                    value={item.rate}
                    min={0}
                    step={0.01}
                    className="text-xs"
                    data-field="rate"
                    onSave={val => updateLineItem(item.srcIndex, "rate", val)}
                />
            ),
        },
        {
            key: "total",
            header: "Total",
            align: "right",
            cellClassName: "w-28",
            render: (item: LineItem) => (
                <span className="text-sm font-bold text-foreground">
                    {formatCurrency(item.qty * item.rate)}
                </span>
            ),
        },
    ];

    /* ---------- Save order ---------- */
    const handleSave = async () => {
        setIsSaving(true);
        try {
            // Validation: Warn if any vendor's subtotal doesn't match the computed total from line items
            if (hasSubtotalMismatch) {
                const proceed = window.confirm(
                    "The entered Subtotal value does not match the calculated total from the listed items for one or more vendors. " +
                        "Click OK to save with the manual subtotal value, or Cancel to review before saving.",
                );
                if (!proceed) return;
            }

            // Build updated vendorSummary by merging original vendorSummary
            // with user-edited financials for each vendor.
            // IMPORTANT: Client Details TDS (`clientFinancials.tds`) only
            // updates the root-level `tds`. A vendor's `vendorSummary[].tds`
            // changes ONLY when that vendor's own TDS (%) field was edited
            // (tracked in `tdsEditedVendorIds`). Otherwise the original
            // `vendorSummary[].tds` is preserved verbatim.
            const updatedVendorSummary: VendorSummary[] = vendors
                .filter(v => financialsByVendor[v.id])
                .map(v => {
                    const f = financialsByVendor[v.id];
                    const originalVs = (vendorSummary ?? []).find(s => {
                        if (v.id === "SELF") {
                            return !s.vendor || s.vendor === "SELF";
                        }
                        return s.vendor === v.id;
                    });
                    // Keep the stored vendor TDS unless this vendor's TDS
                    // field was explicitly edited in this session.
                    const tdsPercentToSave = tdsEditedVendorIds[v.id]
                        ? f.tdsPercent
                        : (originalVs?.tds ?? f.tdsPercent);
                    const gstAmount = f.subtotal * (f.gstPercent / 100);
                    const tdsAmount = f.subtotal * (tdsPercentToSave / 100);
                    const netTotal = f.subtotal + gstAmount - tdsAmount;
                    const bal = netTotal - f.advance;
                    return {
                        vendor: v.id,
                        totalAmount: f.subtotal,
                        advanceAmount: f.advance,
                        gst: f.gstPercent,
                        gstType: f.gstType ?? "NONE",
                        tds: tdsPercentToSave,
                        adjustedAmt: netTotal,
                        balance: bal,
                        changeSummary: f.note,
                    };
                });

            // Preserve vendorSummary entries for vendors that are NOT in the
            // current vendors list (e.g. hidden / non-item vendors).
            const otherSummaries = (vendorSummary ?? []).filter(
                vs => !vendors.some(v => v.id === vs.vendor),
            );

            // Persist the editable line items (with updated qty/rate) so the
            // updated values reach the backend together with the financials.
            // The editable client billing details are merged in as well so the
            // approved/final estimate billing info stays in sync. Vendor TDS /
            // advance remain untouched (they live in `vendorSummary`).
            const updatedEvent = {
                ...eventData,
                items: editableItems.length > 0 ? editableItems : eventData.items,
                vendorSummary: [...updatedVendorSummary, ...otherSummaries],
                gst: clientFinancials.gst,
                gstType: clientFinancials.gstType,
                tds: clientFinancials.tds,
                serviceCharge: clientFinancials.serviceCharge,
                discounts: clientFinancials.discount,
                billingAddress: clientFinancials.billingAddress,
                receivedAmount: clientFinancials.receivedAmount,
            };

            // Use POST to create the event – requires the event id
            const eventId = eventData.id ?? eventData.eventID;
            if (!eventId) {
                toast.error("Event ID is missing");
                return;
            }

            const res = await apiRequest(API_ENDPOINTS.events.list, {
                method: "POST",
                body: JSON.stringify(updatedEvent),
            });

            if (res.ok) {
                toast.success("Purchase order saved successfully");
                onSave?.();
                onClose();
            } else {
                const errBody = await res.text().catch(() => "Unknown error");
                console.error("Save purchase order failed:", errBody);
                toast.error("Failed to save purchase order");
            }
        } catch (err) {
            console.error("Error saving purchase order:", err);
            toast.error("Error saving purchase order");
        } finally {
            setIsSaving(false);
        }
    };

    /* ---------- Save click: confirm when line-item values changed ---------- */
    // If any editable qty / rate / unit value differs from the previously
    // saved value, prompt the user before proceeding, since the change will
    // trigger a checklist update. Otherwise save directly.
    const handleSaveClick = () => {
        if (editableItemsChanged) {
            setShowChecklistConfirmation(true);
        } else {
            void handleSave();
        }
    };

    return (
        <Modal
            open={isOpen}
            onClose={onClose}
            size="xxl"
            title="Create Purchase Order"
            description="Finalize financial records for vendor procurement."
        >
            {/* Two-column layout */}
            <div className="flex max-h-[calc(100vh-200px)]">
                {/* Left: Client + Vendor Sidebar */}
                <aside className="w-72 border-r border-border bg-surface-container-low/30 overflow-y-auto shrink-0">
                    <nav className="p-2 space-y-5">
                        {/* Client Detail section */}
                        <div>
                            <p className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Client Detail
                            </p>
                            <button
                                type="button"
                                onClick={() => setActiveView("client")}
                                className={cn(
                                    "w-full flex flex-col items-start gap-1 p-3 rounded-xl transition-all text-left cursor-pointer",
                                    activeView === "client"
                                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                        : "hover:bg-surface-container-high",
                                )}
                            >
                                <span
                                    className={cn(
                                        "text-sm font-bold truncate",
                                        activeView === "client"
                                            ? "text-inherit"
                                            : "text-foreground",
                                    )}
                                >
                                    Billing & settlement
                                </span>
                                {/* <span
                                    className={cn(
                                        "text-xs italic",
                                        activeView === "client"
                                            ? "opacity-80"
                                            : "text-muted-foreground",
                                    )}
                                >
                                    Billing & settlement
                                </span> */}
                            </button>
                        </div>

                        {/* Vendor Detail section */}
                        <div className="border-t border-border pt-3">
                            <p className="px-3 pt-1 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                                Vendor Detail
                            </p>
                            <div className="space-y-2">
                                {vendors.map(v => {
                                    const isActive =
                                        activeView === "vendor" && v.id === activeVendorId;
                                    return (
                                        <button
                                            key={v.id}
                                            onClick={() => {
                                                setActiveView("vendor");
                                                setActiveVendorId(v.id);
                                            }}
                                            className={cn(
                                                "w-full flex flex-col items-start gap-1 p-3 rounded-xl transition-all text-left cursor-pointer",
                                                isActive
                                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                                    : "hover:bg-surface-container-high",
                                            )}
                                        >
                                            <span
                                                className={cn(
                                                    "text-sm font-bold truncate",
                                                    isActive ? "text-inherit" : "text-foreground",
                                                )}
                                            >
                                                {v.name}
                                            </span>
                                            <span
                                                className={cn(
                                                    "text-xs italic",
                                                    isActive
                                                        ? "opacity-80"
                                                        : "text-muted-foreground",
                                                )}
                                            >
                                                {v.status}
                                            </span>
                                        </button>
                                    );
                                })}
                                {vendors.length === 0 && (
                                    <p className="px-3 text-xs italic text-muted-foreground">
                                        No vendors assigned
                                    </p>
                                )}
                            </div>
                        </div>
                    </nav>
                </aside>

                {/* Right: Main Content */}
                <main className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-4xl mx-auto space-y-8">
                        {activeView === "client" ? (
                            <PurchaseOrderClientDetails
                                clientName={clientName}
                                eventName={eventName}
                                eventDescription={eventDescription}
                                clientFinancials={clientFinancials}
                                onFinancialChange={updateClientFinancial}
                                estimates={estimates}
                            />
                        ) : categories.length === 0 ? (
                            <div className="text-center py-12">
                                <p className="text-sm text-muted-foreground">
                                    {vendors.length === 0
                                        ? "No vendors available with items."
                                        : "No items found for the selected vendor."}
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Category Sections – line items with inline-editable
                                    Qty / Unit / Rate and read-only Days / Total. The ⓘ beside
                                    each section header explains what can be edited. */}
                                {categories.map(section => (
                                    <section key={section.id} className="space-y-4">
                                        {/* Section header */}
                                        <div className="flex items-center justify-between border-l-4 border-primary pl-4 py-1">
                                            <div>
                                                <h3 className="text-sm font-bold uppercase tracking-widest text-primary">
                                                    {section.title}
                                                </h3>
                                                <p className="text-xs text-muted-foreground">
                                                    {section.description}
                                                </p>
                                            </div>
                                            <Tooltip content={EDITABLE_FIELDS_HINT}>
                                                <span className="inline-flex cursor-help items-center text-muted-foreground transition-colors hover:text-primary">
                                                    <Info size={14} aria-hidden="true" />
                                                </span>
                                            </Tooltip>
                                        </div>

                                        {/* Direct items (no sub-category) */}
                                        {section.directItems.length > 0 && (
                                            <div className="border border-border rounded-lg overflow-hidden">
                                                <Table
                                                    data={section.directItems}
                                                    columns={lineItemColumns}
                                                    getKey={(item: LineItem) => item.id}
                                                />
                                            </div>
                                        )}

                                        {/* Sub-category groups */}
                                        {section.subCategories.map(sub => (
                                            <div key={sub.id} className="space-y-2">
                                                <div className="flex items-center gap-2 px-1">
                                                    <span className="inline-block w-2 h-2 rounded-full bg-primary/50" />
                                                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                                        Sub Category: {sub.name}
                                                    </p>
                                                </div>
                                                <div className="border border-border rounded-lg overflow-hidden">
                                                    <Table
                                                        data={sub.items}
                                                        columns={lineItemColumns}
                                                        getKey={(item: LineItem) => item.id}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </section>
                                ))}

                                {/* Financial Summary */}
                                <section className="pt-6 border-t border-border">
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-primary mb-4">
                                        Consolidated Financials
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        <Input
                                            id="financial-subtotal"
                                            label="Subtotal"
                                            type="number"
                                            value={financials.subtotal ?? ""}
                                            onChange={e =>
                                                updateFinancial("subtotal", e.target.value)
                                            }
                                            smallLabel
                                            error={
                                                hasSubtotalMismatch
                                                    ? "Subtotal does not match item total"
                                                    : undefined
                                            }
                                            disabled={!hasSubtotalMismatch}
                                        />
                                        <Select
                                            id="financial-gst-type"
                                            label="Tax Type"
                                            options={GST_TYPE_OPTIONS}
                                            value={
                                                GST_TYPE_OPTIONS.find(
                                                    o => o.value === (financials.gstType ?? "NONE"),
                                                ) ?? GST_TYPE_OPTIONS[0]
                                            }
                                            onChange={option =>
                                                updateFinancial(
                                                    "gstType",
                                                    option && option.value ? option.value : "NONE",
                                                )
                                            }
                                            smallLabel
                                        />
                                        <Input
                                            id="financial-gst"
                                            label={`${
                                                GST_LABEL_BY_TYPE[financials.gstType] ?? "GST"
                                            } (%)`}
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={financials.gstPercent ?? ""}
                                            onChange={e =>
                                                updateFinancial("gstPercent", e.target.value)
                                            }
                                            smallLabel
                                            disabled={financials.gstType === "NONE"}
                                        />
                                        <Input
                                            id="financial-tds"
                                            label="TDS (%)"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.01"
                                            value={financials.tdsPercent ?? ""}
                                            onChange={e =>
                                                updateFinancial("tdsPercent", e.target.value)
                                            }
                                            smallLabel
                                        />
                                        <Input
                                            id="financial-adjustment"
                                            label="Net Total"
                                            type="number"
                                            value={computedNetTotal}
                                            smallLabel
                                            disabled
                                        />
                                        <Input
                                            id="financial-advance"
                                            label="Advance Paid"
                                            type="number"
                                            value={financials.advance ?? ""}
                                            onChange={e =>
                                                updateFinancial("advance", e.target.value)
                                            }
                                            smallLabel
                                            disabled={activeVendorId === "SELF"}
                                        />
                                        <Input
                                            id="financial-note"
                                            label="Note"
                                            type="text"
                                            value={financials.note}
                                            onChange={e => updateFinancial("note", e.target.value)}
                                            placeholder="Add a note..."
                                            smallLabel
                                        />
                                    </div>
                                    {hasSubtotalMismatch && (
                                        <div className="mt-3 p-3 rounded-lg bg-warning/10 border border-warning/30 text-xs text-warning-foreground">
                                            <strong>Subtotal Mismatch:</strong> The entered subtotal
                                            for one or more vendors does not match the calculated
                                            total from the listed items. The subtotal field is
                                            editable to allow manual correction if needed.
                                        </div>
                                    )}
                                </section>
                            </>
                        )}
                    </div>
                </main>
            </div>

            {/* Footer – Client view shows COST SUMMARY; vendor view shows OUTSTANDING BALANCE */}
            <ModalFooter className="relative justify-between flex-wrap">
                <div className="flex items-center gap-4 flex-wrap">
                    {activeView === "client" ? (
                        <>
                            {/* COST SUMMARY – client / estimate financial position.
                        Shown ONLY when the Client Details selection is active. */}
                            <CostSummary
                                title="Cost Summary"
                                subtitle="Client / estimate settlement"
                                amount={clientOutstanding}
                                breakdownTitle="Cost Breakdown"
                                items={[
                                    {
                                        label: "Estimate/Subtotal",
                                        amount: totalClientEstimatedAmount,
                                    },
                                    ...(clientSummary.serviceChargeAmount > 0
                                        ? [
                                              {
                                                  label: `Service Charge (${clientFinancials.serviceCharge}%)`,
                                                  amount: clientSummary.serviceChargeAmount,
                                              },
                                          ]
                                        : []),
                                    ...(clientFinancials.discount > 0
                                        ? [
                                              {
                                                  label: "Discount",
                                                  amount: clientFinancials.discount,
                                                  tone: "negative" as const,
                                                  prefix: "-",
                                              },
                                          ]
                                        : []),
                                    ...(clientSummary.gstAmount > 0
                                        ? [
                                              {
                                                  label: `GST (${clientFinancials.gst}%)`,
                                                  amount: clientSummary.gstAmount,
                                                  tone: "positive" as const,
                                                  prefix: "+",
                                              },
                                          ]
                                        : []),
                                    ...(clientTdsAmount > 0
                                        ? [
                                              {
                                                  label: `TDS (${clientFinancials.tds}%)`,
                                                  amount: clientTdsAmount,
                                                  tone: "negative" as const,
                                                  prefix: "-",
                                              },
                                          ]
                                        : []),
                                    ...(clientFinancials.receivedAmount > 0
                                        ? [
                                              {
                                                  label: "Received Amount",
                                                  amount: clientFinancials.receivedAmount,
                                                  tone: "negative" as const,
                                                  prefix: "-",
                                              },
                                          ]
                                        : []),
                                ]}
                                totalItem={{
                                    label: "Client Outstanding",
                                    amount: clientOutstanding,
                                }}
                            />
                        </>
                    ) : (
                        <>
                            {/* OUTSTANDING BALANCE – vendor settlement amount.
                        Shown ONLY when a vendor selection is active. */}
                            <div className="flex items-center gap-4 bg-primary/[0.04] rounded-xl px-5 py-3 border border-primary/10">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                                        Outstanding Balance
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Final vendor settlement
                                    </p>
                                </div>
                                <span className="text-xl font-extrabold text-primary tracking-tight">
                                    {formatCurrency(balance())}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setShowBreakdown(!showBreakdown)}
                                    className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                                    aria-label="Toggle balance breakdown"
                                >
                                    {showBreakdown ? (
                                        <ChevronUp className="w-4 h-4" />
                                    ) : (
                                        <ChevronDown className="w-4 h-4" />
                                    )}
                                </button>
                            </div>
                            {showBreakdown && (
                                <div className="absolute bottom-20 left-5 bg-surface border border-border rounded-xl shadow-xl p-4 z-50 w-72">
                                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                                        Balance Breakdown
                                    </p>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Subtotal</span>
                                            <span className="font-medium">
                                                {formatCurrency(breakdownDetails.subtotal)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                                GST ({breakdownDetails.gstPercent}%)
                                            </span>
                                            <span className="font-medium text-success">
                                                +{formatCurrency(breakdownDetails.gstAmount)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                                TDS ({breakdownDetails.tdsPercent}%)
                                            </span>
                                            <span className="font-medium text-destructive">
                                                -{formatCurrency(breakdownDetails.tdsAmount)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Net Total</span>
                                            <span className="font-medium">
                                                {formatCurrency(breakdownDetails.netTotal)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">
                                                Advance Paid
                                            </span>
                                            <span className="font-medium text-destructive">
                                                -{formatCurrency(breakdownDetails.advance)}
                                            </span>
                                        </div>
                                        <div className="border-t border-border pt-2 flex justify-between font-bold text-primary">
                                            <span>Outstanding Balance</span>
                                            <span>{formatCurrency(breakdownDetails.balance)}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="outline" onClick={onViewPurchaseOrder}>
                        Preview Order
                    </Button>
                    <Button className="shadow-lg shadow-primary/30" onClick={handleSaveClick}>
                        Save Purchase Order
                    </Button>
                </div>
            </ModalFooter>
            <ConfirmationModal
                open={showChecklistConfirmation}
                onClose={() => setShowChecklistConfirmation(false)}
                onConfirm={() => {
                    setShowChecklistConfirmation(false);
                    void handleSave();
                }}
                title="Confirm Checklist Update"
                description={
                    "The changes you have made to one or more line items (Qty, Rate, or Unit) " +
                    "will cause the checklist to update. Are you sure you want to continue with this action?"
                }
                confirmText="Continue"
                cancelText="Cancel"
                variant="primary"
                isLoading={isSaving}
            />
        </Modal>
    );
}
