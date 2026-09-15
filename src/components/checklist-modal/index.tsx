"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils/cn";
import { generateId } from "@/lib/utils/id";
import { groupByCategory } from "@/lib/utils";
import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { ChecklistHierarchy, type ChecklistHierarchyActions } from "./checklist-hierarchy";
import { ChecklistItemEditor } from "./checklist-item-editor";
import { ChecklistFooter } from "./checklist-footer";
import { validateChecklistItem, hasVendorOrInventory, type ChecklistItemValidation } from "./validation";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import type { ChecklistItem, ChecklistModalProps, ChecklistSummary, EventItem } from "./types";

export type { ChecklistModalProps };

const DEFAULT_CATEGORY = "New Category";
const DEFAULT_SUB_CATEGORY = "New Sub Category";
const FALLBACK_CATEGORY = "Uncategorized";

export function ExecutionChecklistModal({
    isOpen,
    onClose,
    eventData,
    onSave,
    onCancel,
    vendorList,
    inventoryList,
    loadingVendors = false,
    loadingInventory = false,
}: ChecklistModalProps) {
    const [checklistData, setChecklistData] = useState<ChecklistItem[]>([]);
    const [saving, setSaving] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [expandedSubCategories, setExpandedSubCategories] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedUid, setSelectedUid] = useState<string | null>(null);
    const [focusTarget, setFocusTarget] = useState<string | null>(null);
    const [convertUid, setConvertUid] = useState<string | null>(null);
    const [validationModalOpen, setValidationModalOpen] = useState(false);
    // Non-blocking confirmation shown on Save listing items with no Vendor and
    // no Inventory. Vendor / Inventory are optional, so this never blocks saving.
    const [missingVendorModalOpen, setMissingVendorModalOpen] = useState(false);
    // Once the user clicks "Save Checklist" and validation fails, inline errors
    // and hierarchy highlights become visible and update live as values change.
    // Until then nothing is validated (friendly initial-load experience).
    const [validationTriggered, setValidationTriggered] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        // Fresh open: reset any prior validation so nothing is flagged on load.
        setValidationTriggered(false);
        setValidationModalOpen(false);
        setMissingVendorModalOpen(false);

        let rawItems: ChecklistItem[] = [];
        if (eventData.checklist && eventData.checklist.length > 0) {
            rawItems = (eventData.checklist as ChecklistItem[]).map(normalizeItem);
        } else if (eventData.items && eventData.items.length > 0) {
            rawItems = (eventData.items as EventItem[]).map(mapEventItemToChecklistItem);
        }

        const items: ChecklistItem[] = rawItems.map(it => ({
            ...it,
            _uid: it._uid || generateId(),
        }));
        setChecklistData(items);
        setSelectedUid(items.length ? (items[0]._uid ?? null) : null);

        const cats = new Set<string>();
        const subs = new Set<string>();
        items.forEach(it => {
            const cat = it.category || FALLBACK_CATEGORY;
            cats.add(cat);
            if (it.subCategory) subs.add(`${cat}::${it.subCategory}`);
        });
        setExpandedCategories(cats);
        setExpandedSubCategories(subs);
    }, [isOpen, eventData]);

    const filteredItems = useMemo(() => {
        if (!searchQuery.trim()) return checklistData;
        const q = searchQuery.toLowerCase();
        return checklistData.filter(
            it =>
                (it.item || "").toLowerCase().includes(q) ||
                (it.category || "").toLowerCase().includes(q) ||
                (it.subCategory || "").toLowerCase().includes(q),
        );
    }, [checklistData, searchQuery]);

    const groups = useMemo(() => groupByCategory(filteredItems), [filteredItems]);

    const searchExpandedCategories = useMemo(() => {
        if (!searchQuery.trim()) return new Set<string>();
        return new Set(filteredItems.map(it => it.category || FALLBACK_CATEGORY));
    }, [filteredItems, searchQuery]);

    const searchExpandedSubCategories = useMemo(() => {
        if (!searchQuery.trim()) return new Set<string>();
        return new Set(
            filteredItems
                .filter(it => it.subCategory)
                .map(it => `${it.category || FALLBACK_CATEGORY}::${it.subCategory}`),
        );
    }, [filteredItems, searchQuery]);

    const resolvedExpandedCategories = useMemo(() => {
        if (!searchQuery.trim()) return expandedCategories;
        const merged = new Set(expandedCategories);
        searchExpandedCategories.forEach(c => merged.add(c));
        return merged;
    }, [expandedCategories, searchExpandedCategories, searchQuery]);

    const resolvedExpandedSubCategories = useMemo(() => {
        if (!searchQuery.trim()) return expandedSubCategories;
        const merged = new Set(expandedSubCategories);
        searchExpandedSubCategories.forEach(s => merged.add(s));
        return merged;
    }, [expandedSubCategories, searchExpandedSubCategories, searchQuery]);

    const selectedItem = useMemo(
        () => checklistData.find(it => it._uid === selectedUid) ?? null,
        [checklistData, selectedUid],
    );

    const summary = useMemo<ChecklistSummary>(() => {
        const total = checklistData.length;
        const completed = checklistData.filter(i => i.status === "COMPLETED").length;
        return { total, completed, remaining: total - completed };
    }, [checklistData]);

    // Validation is derived from checklistData on every render so inline errors
    // and hierarchy highlighting update immediately as the user corrects values
    // (no need to click Save again to clear errors). Only items that would be
    // persisted are validated — blank placeholder rows (no name + no description)
    // are still dropped by the existing save filter, preserving current behavior.
    const persistableItems = useMemo(
        () =>
            checklistData.filter(
                item => (item.item || "").trim() !== "" || (item.description || "").trim() !== "",
            ),
        [checklistData],
    );

    const errorMap = useMemo(() => {
        const map: Record<string, ChecklistItemValidation> = {};
        persistableItems.forEach(it => {
            if (!it._uid) return;
            const errors = validateChecklistItem(it);
            if (Object.keys(errors).length > 0) map[it._uid] = errors;
        });
        return map;
    }, [persistableItems]);

    const invalidUids = useMemo(() => new Set<string>(Object.keys(errorMap)), [errorMap]);

    // Persistable items missing both a Vendor and an Inventory. Vendor / Inventory
    // are optional, so these never block saving — a non-blocking confirmation
    // lists them when the user clicks Save.
    const missingVendorItems = useMemo(
        () => persistableItems.filter(it => !hasVendorOrInventory(it)),
        [persistableItems],
    );

    const selectedItemErrors = useMemo<ChecklistItemValidation>(
        () => (selectedUid ? (errorMap[selectedUid] ?? {}) : {}),
        [errorMap, selectedUid],
    );

    const uniqueCategoryName = (base: string): string => {
        const existing = new Set(checklistData.map(i => i.category));
        let name = base;
        let n = 1;
        while (existing.has(name)) name = `${base} ${n++}`;
        return name;
    };
    const uniqueSubCategoryName = (category: string, base: string): string => {
        const existing = new Set(
            checklistData
                .filter(i => i.category === category)
                .map(i => i.subCategory)
                .filter(Boolean) as string[],
        );
        let name = base;
        let n = 1;
        while (existing.has(name)) name = `${base} ${n++}`;
        return name;
    };

    const newItemPrototype = (category: string, subCategory = ""): ChecklistItem => ({
        category,
        subCategory,
        item: "",
        description: "",
        quantity: 1,
        days: 1,
        unit: "nos",
        pricePerItem: 0,
        vendor: "",
        inventoryID: "",
        status: "PENDING",
        startDate: "",
        endDate: "",
        deadlineDate: "",
        isInventoryItem: false,
        _uid: generateId(),
    });

    const selectUid = (uid: string) => setSelectedUid(uid);

    const addAtEnd = (item: ChecklistItem, expandCategory: string, expandSub?: string) => {
        setChecklistData(prev => [...prev, item]);
        setSelectedUid(item._uid ?? null);
        setExpandedCategories(prev => new Set(prev).add(expandCategory));
        if (expandSub) {
            setExpandedSubCategories(prev => new Set(prev).add(`${expandCategory}::${expandSub}`));
        }
    };

    const handleAddCategory = () => {
        const category = uniqueCategoryName(DEFAULT_CATEGORY);
        addAtEnd(newItemPrototype(category), category);
        // Set focus target to the new category name (will be set after render)
        setTimeout(() => setFocusTarget(category), 0);
    };

    const handleAddItem = (category: string, subCategory = "") => {
        const newItem = newItemPrototype(category, subCategory);
        const uid = newItem._uid;
        addAtEnd(newItem, category, subCategory || undefined);
        // Set focus target to the new item uid (will be set after render)
        setTimeout(() => setFocusTarget(uid ?? null), 0);
    };

    const handleAddSubCategory = (category: string) => {
        const subCategory = uniqueSubCategoryName(category, DEFAULT_SUB_CATEGORY);
        addAtEnd(newItemPrototype(category, subCategory), category, subCategory);
        // Set focus target to the new sub category name (will be set after render)
        setTimeout(() => setFocusTarget(`sub:${subCategory}`), 0);
    };

    const handleUpdateItem = (field: keyof ChecklistItem, value: string | number) => {
        if (!selectedUid) return;
        setChecklistData(prev =>
            prev.map(it => (it._uid === selectedUid ? { ...it, [field]: value } : it)),
        );
    };

    const handleCheckboxChange = (value: boolean) => {
        if (!selectedUid) return;
        setChecklistData(prev =>
            prev.map(it =>
                it._uid === selectedUid
                    ? {
                          ...it,
                          isInventoryItem: value,
                          ...(value ? { vendor: "" } : { inventoryID: "" }),
                      }
                    : it,
            ),
        );
    };

    const handleFocused = () => {
        setFocusTarget(null);
    };

    const handleDeleteItem = (uid: string) => {
        setChecklistData(prev => prev.filter(it => it._uid !== uid));
        if (selectedUid === uid) {
            const remaining = checklistData.filter(it => it._uid !== uid);
            setSelectedUid(remaining.length ? (remaining[0]._uid ?? null) : null);
        }
    };

    const handleConvertClick = (uid: string) => {
        setConvertUid(uid);
    };

    /**
     * Convert an Item into a Sub Category.
     *
     * The data is item-centric: a "Sub Category" only exists because at least
     * one item carries that `subCategory` value. Converting therefore means
     * replacing the source item, in place, with a new child item that:
     *  - keeps the same parent Category,
     *  - carries the new Sub Category name sourced from the original item name,
     *  - copies every editable property except the Item Name (left empty),
     *  - gets a fresh uid so it can be selected/focused.
     *
     * REPLACING the source item in the same array position preserves the
     * original ordering (the "preserve position / sibling ordering" rule) for
     * BOTH cases: an Item directly under a Category and an Item already inside
     * a Sub Category both collapse onto the same flat-data transformation,
     * so there is no duplicated tree-walking or scenario-specific logic.
     */
    const handleConvertItem = () => {
        if (!convertUid) return;
        const source = checklistData.find(it => it._uid === convertUid);
        setConvertUid(null);
        if (!source) return;

        const category = source.category || FALLBACK_CATEGORY;
        const newSubName = uniqueSubCategoryName(category, source.item || DEFAULT_SUB_CATEGORY);

        // Copy all editable properties; only the Item Name is cleared and the
        // sub-category is reset to the newly created group. `_uid` is refreshed.
        const { _uid: _sourceUid, ...editable } = source;
        const newChild: ChecklistItem = {
            ...editable,
            category,
            subCategory: newSubName,
            item: "",
            _uid: generateId(),
        };

        setChecklistData(prev => prev.map(it => (it._uid === convertUid ? newChild : it)));

        setSelectedUid(newChild._uid ?? null);
        setExpandedCategories(prev => new Set(prev).add(category));
        setExpandedSubCategories(prev => new Set(prev).add(`${category}::${newSubName}`));
        // Focus the new child item (scroll + place cursor in the Item Name field)
        // once it has been mounted after the state update.
        setTimeout(() => setFocusTarget(newChild._uid ?? null), 0);
    };

    const handleDeleteCategory = (category: string) => {
        setChecklistData(prev =>
            prev.filter(it => (it.category || FALLBACK_CATEGORY) !== category),
        );
        if (selectedUid) {
            const stillThere = checklistData.find(it => it._uid === selectedUid);
            if (!stillThere) setSelectedUid(null);
        }
    };

    const handleRenameCategory = (oldName: string, newName: string) => {
        setChecklistData(prev =>
            prev.map(it =>
                (it.category || FALLBACK_CATEGORY) === oldName ? { ...it, category: newName } : it,
            ),
        );
    };

    const handleDeleteSubCategory = (category: string, subName: string) => {
        setChecklistData(prev =>
            prev.filter(
                it =>
                    !(
                        (it.category || FALLBACK_CATEGORY) === category &&
                        it.subCategory === subName
                    ),
            ),
        );
        if (selectedUid) {
            const stillThere = checklistData.find(it => it._uid === selectedUid);
            if (!stillThere) setSelectedUid(null);
        }
    };

    const handleRenameSubCategory = (category: string, oldName: string, newName: string) => {
        setChecklistData(prev =>
            prev.map(it =>
                (it.category || FALLBACK_CATEGORY) === category && it.subCategory === oldName
                    ? { ...it, subCategory: newName }
                    : it,
            ),
        );
    };

    const handleExpandAll = () => {
        const cats = new Set<string>();
        const subs = new Set<string>();
        checklistData.forEach(it => {
            const c = it.category || FALLBACK_CATEGORY;
            cats.add(c);
            if (it.subCategory) subs.add(`${c}::${it.subCategory}`);
        });
        setExpandedCategories(cats);
        setExpandedSubCategories(subs);
    };

    const handleCollapseAll = () => {
        setExpandedCategories(new Set());
        setExpandedSubCategories(new Set());
    };

    const actions: ChecklistHierarchyActions = {
        onAddCategory: handleAddCategory,
        onAddItem: handleAddItem,
        onAddSubCategory: handleAddSubCategory,
        onRenameCategory: handleRenameCategory,
        onDeleteCategory: handleDeleteCategory,
        onRenameSubCategory: handleRenameSubCategory,
        onDeleteSubCategory: handleDeleteSubCategory,
        onSelectUid: selectUid,
        onDeleteItem: handleDeleteItem,
        onConvertItem: handleConvertClick,
        onToggleCategory: name =>
            setExpandedCategories(prev => {
                const next = new Set(prev);
                if (next.has(name)) next.delete(name);
                else next.add(name);
                return next;
            }),
        onToggleSubCategory: (cat, sub) =>
            setExpandedSubCategories(prev => {
                const key = `${cat}::${sub}`;
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
            }),
        onExpandAll: handleExpandAll,
        onCollapseAll: handleCollapseAll,
    };

    const performSave = async () => {
        setSaving(true);
        try {
            const filteredData = persistableItems;

            const payload = filteredData.map(({ _uid, ...rest }) => rest);
            const updatedEvent = {
                ...eventData,
                checkListCompleted: true,
                items: payload,
            };

            const res = await apiRequest(API_ENDPOINTS.events.list, {
                method: "POST",
                body: JSON.stringify(updatedEvent),
            });

            if (res.ok) {
                toast.success("Checklist saved successfully");
                onSave();
                onClose();
            } else {
                toast.error("Failed to save checklist");
            }
        } catch (err) {
            console.error("Error saving checklist:", err);
            toast.error("Error saving checklist");
        } finally {
            setSaving(false);
        }
    };

    const handleMissingVendorConfirm = async () => {
        setMissingVendorModalOpen(false);
        await performSave();
    };

    const handleSave = async () => {
        // Guard: if any persisted item fails required-field validation, prevent
        // saving, reveal inline/hierarchy errors and show the warning modal.
        if (Object.keys(errorMap).length > 0) {
            setValidationTriggered(true);
            setValidationModalOpen(true);
            return;
        }

        // Vendor / Inventory are optional. If some items still lack either,
        // confirm before saving instead of throwing a blocking validation error.
        if (missingVendorItems.length > 0) {
            setMissingVendorModalOpen(true);
            return;
        }

        await performSave();
    };

    const handleCancel = () => {
        (onCancel || onClose)();
    };

    const modalContent = (
        <ModalBody className={cn("flex max-h-[calc(100vh-230px)] overflow-hidden")}>
            {/* Left panel: hierarchical tree */}
            <div className="w-80 shrink-0 overflow-hidden border-r border-border">
                <ChecklistHierarchy
                    groups={groups}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    expandedCategories={resolvedExpandedCategories}
                    expandedSubCategories={resolvedExpandedSubCategories}
                    selectedUid={selectedUid}
                    actions={actions}
                    disabled={saving}
                    invalidUids={validationTriggered ? invalidUids : undefined}
                    focusTarget={focusTarget}
                    onFocused={handleFocused}
                />
            </div>

            {/* Right panel: item editor */}
            <div className="flex-1 overflow-hidden">
                {selectedItem ? (
                    <ChecklistItemEditor
                        item={selectedItem}
                        vendorList={vendorList}
                        inventoryList={inventoryList}
                        loadingVendors={loadingVendors}
                        loadingInventory={loadingInventory}
                        onUpdate={handleUpdateItem}
                        onCheckboxChange={handleCheckboxChange}
                        errors={validationTriggered ? selectedItemErrors : undefined}
                        focusTarget={focusTarget}
                        onFocused={handleFocused}
                    />
                ) : (
                    <div className="flex h-full items-center justify-center">
                        <p className="max-w-xs text-center text-sm text-muted-foreground">
                            {checklistData.length === 0
                                ? "Add a category or item to get started."
                                : "Select an item to view and edit its details."}
                        </p>
                    </div>
                )}
            </div>
        </ModalBody>
    );

    return (
        <>
            <Modal
                open={isOpen}
                onClose={onClose}
                size="xxl"
                title="Execution Checklist"
                description={`Manage execution tasks for ${eventData.title || "this event"}`}
                showCloseIcon
            >
                {modalContent}
                <ChecklistFooter
                    summary={summary}
                    saving={saving}
                    onCancel={handleCancel}
                    onSave={handleSave}
                />
            </Modal>

            <Modal
                open={validationModalOpen}
                onClose={() => setValidationModalOpen(false)}
                size="sm"
                title="Checklist Validation Failed"
            >
                <ModalBody>
                    <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                        Some checklist items contain missing or invalid information. Please review
                        the highlighted items and correct the validation errors before saving the
                        checklist.
                    </p>
                </ModalBody>
                <ModalFooter>
                    <Button
                        type="button"
                        variant="primary"
                        onClick={() => setValidationModalOpen(false)}
                    >
                        OK
                    </Button>
                </ModalFooter>
            </Modal>

            <ConfirmationModal
                open={missingVendorModalOpen}
                onClose={() => setMissingVendorModalOpen(false)}
                onConfirm={handleMissingVendorConfirm}
                title="Save Without Vendor / Inventory?"
                description={`Some items do not have a Vendor or Inventory assigned yet.\n\nYou can still save the checklist and assign them later.\n\nThe following items are missing a Vendor / Inventory:\n${missingVendorItems
                    .map(it => `• ${it.item || "Unnamed Item"}`)
                    .join("\n")}`}
                confirmText="Save Checklist"
                cancelText="Go Back"
                variant="primary"
                isLoading={saving}
            />

            <ConfirmationModal
                open={!!convertUid}
                onClose={() => setConvertUid(null)}
                onConfirm={handleConvertItem}
                title="Convert Item to Sub Category?"
                description={`This action will reorganize the checklist hierarchy.

The current Item will be converted into a new Sub Category.
A new Item will be created as the first child of the new Sub Category.
All item details (description, days, quantity, vendor, inventory, dates, status, etc.) will be copied to the new child Item.
The new child Item Name will be left empty so you can enter a new name.
The original Item will be removed after the conversion.

This action cannot be undone.`}
                confirmText="Convert"
                cancelText="Cancel"
                variant="primary"
            />
        </>
    );
}

function normalizeItem(item: ChecklistItem): ChecklistItem {
    return {
        ...item,
        _uid: item._uid || undefined,
    };
}

function mapEventItemToChecklistItem(item: EventItem): ChecklistItem {
    return {
        category: item.category || FALLBACK_CATEGORY,
        subCategory: item.subCategory || "",
        item: item.item || "",
        description: item.description || "",
        quantity: Number(item.quantity) || Number(item.count) || 1,
        unit: item.unit || "nos",
        vendor: item.vendor || "",
        inventoryID: item.inventoryID != null ? String(item.inventoryID) : "",
        status: "PENDING",
        startDate:
            item.startDate || item.starDate
                ? String(item.startDate || item.starDate).split("T")[0]
                : "",
        endDate: item.endDate ? String(item.endDate).split("T")[0] : "",
        days: Number(item.days) || 1,
        pricePerItem: Number(item.pricePerItem) || 0,
        deadlineDate: String(item.deadlineDate || ""),
        isInventoryItem: Boolean(item.inventoryID) || false,
    };
}

export { ExecutionChecklistModal as ChecklistModal };
