"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui-old/button";
import { Input } from "@/components/ui-old/input";
import { Label } from "@/components/ui-old/label";
import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import type { Inventory } from "@/types/inventory";
import type { Vendor } from "@/types/vendor";

import dynamic from "next/dynamic";
import { useToast } from "./ui/toaster/use-toast";

const CreatableSelect = dynamic(() => import("react-select/creatable"), {
    ssr: false,
});
interface EventItemRow {
    category: string;
    subCategory?: string;
    inventoryType: "self" | "external";
    item: string;
    inventoryID?: string;
    vendor?: string;
    quantity: number;
    pricePerItem: number;
    days: number;
    startDate: string;
    endDate: string;
    deadlineDate: string;
    description: string;
    finalAmt?: number;
}

interface AdditionalCostRow {
    item: string;
    amount: number;
    remarks: string;
}

interface ProjectPlanningModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventData: {
        id?: string;
        title?: string;
        eventStartDate?: string;
        eventEndDate?: string;
        location?: string;
        venue?: string;
        items?: any[];
        additionalCostEstimate?: AdditionalCostRow[];
        [key: string]: unknown;
    };
    onSave: () => void;
}

export function ProjectPlanningModal({
    isOpen,
    onClose,
    eventData,
    onSave,
}: ProjectPlanningModalProps) {
    const [inventoryList, setInventoryList] = useState<Inventory[]>([]);
    const [vendorList, setVendorList] = useState<Vendor[]>([]);
    const [loadingInventory, setLoadingInventory] = useState(false);
    const [loadingVendors, setLoadingVendors] = useState(false);
    const [gst, setGst] = useState<number>(0);
    const [tds, setTds] = useState<number>(0);
    const { toast } = useToast();
    const [rows, setRows] = useState<EventItemRow[]>([
        {
            category: "",
            subCategory: "",
            inventoryType: "self",
            item: "",
            quantity: 1,
            pricePerItem: 0,
            days: 0,
            startDate: eventData?.eventStartDate || "",
            endDate: eventData?.eventEndDate || "",
            deadlineDate: "",
            description: "",
            finalAmt: 0,
        },
    ]);
    const [editIndex, setEditIndex] = useState<number | null>(null);
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
    const [additionalCosts, setAdditionalCosts] = useState<AdditionalCostRow[]>([]);
    const [isAdditionalCostsOpen, setIsAdditionalCostsOpen] = useState(true);
    const [isInventoryOpen, setIsInventoryOpen] = useState(true);
    const [showVersionPrompt, setShowVersionPrompt] = useState(false);
    const [versionDescription, setVersionDescription] = useState("");
    const [showPreview, setShowPreview] = useState(false);
    const [showEmailDraft, setShowEmailDraft] = useState(false);
    const [emailForm, setEmailForm] = useState({
        to: "",
        cc: "",
        subject: "",
        body: "",
    });
    const [sendingEmail, setSendingEmail] = useState(false);
    const [isDirty, setIsDirty] = useState(false);

    // Fetch inventory and vendors on mount - only once when modal opens
    useEffect(() => {
        if (!isOpen) return;

        // Reset steps
        setShowPreview(false);
        setShowEmailDraft(false);
        setSendingEmail(false);

        if (inventoryList.length === 0) {
            fetchInventory();
        }
        if (vendorList.length === 0) {
            fetchVendors();
        }

        // Load items from eventData if available
        if (Array.isArray(eventData?.items) && eventData.items.length > 0) {
            setRows(
                eventData.items.map((item: any) => ({
                    category: item.category || "",
                    subCategory: item.subCategory || "",
                    inventoryType: item.vendor && item.vendor !== "" ? "external" : "self",
                    item: item.item || "",
                    inventoryID: item.inventoryID || "",
                    vendor: item.vendor || "",
                    quantity: item.quantity || 1,
                    pricePerItem: item.pricePerItem || 0,
                    days: item.days || 0,
                    startDate: item.startDate || eventData?.eventStartDate || "",
                    endDate: item.endDate || eventData?.eventEndDate || "",
                    deadlineDate: item.deadlineDate || "",
                    description: item.description || "",
                    finalAmt: item.finalAmt || 0,
                }))
            );
        }

        // Load existing additional costs if available
        if (
            Array.isArray(eventData?.additionalCostEstimate) &&
            eventData.additionalCostEstimate.length > 0
        ) {
            setAdditionalCosts(eventData.additionalCostEstimate);
        } else {
            setAdditionalCosts([]);
        }

        // Load GST and TDS if available
        setGst(typeof eventData?.gst === "number" ? eventData.gst : 0);
        setTds(typeof eventData?.tds === "number" ? eventData.tds : 0);
    }, [isOpen, eventData]);

    const fetchInventory = async () => {
        setLoadingInventory(true);
        try {
            const res = await apiRequest(API_ENDPOINTS.inventory.dropdown);
            if (res.ok) {
                const data = await res.json();
                setInventoryList(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Failed to fetch inventory:", err);
        } finally {
            setLoadingInventory(false);
        }
    };

    const fetchVendors = async () => {
        setLoadingVendors(true);
        try {
            const res = await apiRequest(API_ENDPOINTS.vendors.list);
            if (res.ok) {
                const data = await res.json();
                setVendorList(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error("Failed to fetch vendors:", err);
        } finally {
            setLoadingVendors(false);
        }
    };

    const handleAddRow = () => {
        setRows([
            ...rows,
            {
                category: "",
                subCategory: "",
                inventoryType: "self",
                item: "",
                quantity: 1,
                pricePerItem: 0,
                days: 0,
                startDate: eventData?.eventStartDate || "",
                endDate: eventData?.eventEndDate || "",
                deadlineDate: "",
                description: "",
                finalAmt: 0,
            },
        ]);
        setIsDirty(true);
    };

    const handleDeleteRow = (index: number) => {
        const newRows = rows.filter((_, i) => i !== index);
        setRows(newRows);
        setIsDirty(true);
    };

    const handleRowChange = (index: number, field: keyof EventItemRow, value: string | number) => {
        const newRows = [...rows];
        newRows[index] = { ...newRows[index], [field]: value };

        // Auto-calculate final amount if price or days change
        if (field === "pricePerItem" || field === "days" || field === "quantity") {
            const price = field === "pricePerItem" ? Number(value) : newRows[index].pricePerItem;
            const days = field === "days" ? Number(value) : newRows[index].days;
            const quantity = field === "quantity" ? Number(value) : newRows[index].quantity;
            newRows[index].finalAmt = price * days * quantity;
        }

        setRows(newRows);
        setIsDirty(true);
    };

    const handleAddAdditionalCostRow = () => {
        setAdditionalCosts([...additionalCosts, { item: "", amount: 0, remarks: "" }]);
        setIsDirty(true);
    };

    const handleRemoveAdditionalCostRow = (index: number) => {
        setAdditionalCosts(additionalCosts.filter((_, i) => i !== index));
        setIsDirty(true);
    };

    const handleAdditionalCostRowChange = (
        index: number,
        field: keyof AdditionalCostRow,
        value: string | number
    ) => {
        const newAdditionalCosts = [...additionalCosts];
        newAdditionalCosts[index] = {
            ...newAdditionalCosts[index],
            [field]: value,
        };
        setAdditionalCosts(newAdditionalCosts);
        setIsDirty(true);
    };

    const handleSaveClick = () => {
        // Validation before showing prompt
        const completeRows = rows.filter(row => row.category && row.item);
        if (completeRows.length === 0) {
            toast.error("Please add at least one inventory item");
            return;
        }

        // Check if event is already under review
        // Assuming 'status' is available in eventData.
        // We cast to any to safely access status, or interface should be updated.
        const currentStatus = (eventData as any).status;

        if (currentStatus === "ESTIMATE_UNDER_REVIEW") {
            // Enforce new version workflow
            setShowVersionPrompt(true);
        } else {
            // Standard save
            executeSave(false);
        }
    };

    const executeSave = async (isNewVersion: boolean) => {
        try {
            // Filter out incomplete rows
            const completeRows = rows.filter(row => row.category && row.item);
            const completeAdditionalCosts = additionalCosts.filter(
                cost => cost.item && cost.amount > 0
            );

            // Map to backend EventItem model fields
            const itemsWithCalculations = completeRows.map(row => ({
                item: row.item,
                inventoryID: row.inventoryID || "",
                startDate: row.startDate,
                endDate: row.endDate,
                deadlineDate: row.deadlineDate || null,
                quantity: row.quantity,
                pricePerItem: row.pricePerItem,
                finalAmt: row.pricePerItem * row.days * row.quantity,
                category: row.category,
                subCategory: row.subCategory || "",
                description: row.description || "",
                vendor: row.vendor || "",
                days: row.days,
            }));

            const updatedEvent = {
                ...eventData,
                items: itemsWithCalculations,
                gst,
                tds,
                additionalCostEstimate: completeAdditionalCosts,
                isNewVersion: isNewVersion,
                versionDescription: isNewVersion ? versionDescription : undefined,
            };

            const res = await apiRequest(API_ENDPOINTS.events.list, {
                method: "POST",
                body: JSON.stringify(updatedEvent),
            });

            if (res.ok) {
                onSave();
                // Do NOT close modal, just update UI state to reflect saved status
                // onClose()
                setShowVersionPrompt(false);
                setVersionDescription("");
                setIsDirty(false); // Mark as saved
                toast.success("Estimate saved successfully");
            } else {
                toast.error("Failed to save estimate");
            }
        } catch (err) {
            console.error("Error saving event:", err);
            toast.error("Error saving event");
        }
    };

    const handleSendToClientClick = () => {
        // Show preview first
        setShowPreview(true);
    };

    const handleProceedToEmail = () => {
        const clientEmail = (eventData as any).client?.email || "";
        setEmailForm({
            to: clientEmail,
            cc: "",
            subject: `Project Plan: ${eventData.title || "Event"}`,
            body: `Dear Client,\n\nPlease find attached the project plan for your event ${eventData.title}.\n\nBest regards,\nZentra Team`,
        });
        setShowEmailDraft(true);
    };

    const handleSendEmail = async () => {
        if (!emailForm.to) {
            toast.error("Please enter a recipient email");
            return;
        }
        setSendingEmail(true);
        try {
            const formData = new FormData();
            // Split by comma or semicolon
            const toList = emailForm.to
                .split(/[,;]/)
                .map(e => e.trim())
                .filter(e => e);
            const ccList = emailForm.cc
                .split(/[,;]/)
                .map(e => e.trim())
                .filter(e => e);

            if (toList.length === 0) {
                toast.error("Please enter at least one valid email address");
                setSendingEmail(false);
                return;
            }

            console.log("Sending email to:", toList, "CC:", ccList);

            toList.forEach(email => formData.append("to", email));
            ccList.forEach(email => formData.append("cc", email));

            formData.append("subject", emailForm.subject);
            formData.append("body", emailForm.body);

            // Dummy PDF for now - In the future, this should be generated from the event details
            const pdfBlob = new Blob(["Placeholder PDF Content for Event Plan"], {
                type: "application/pdf",
            });
            formData.append("pdfFile", pdfBlob, `Project_Plan_${eventData.title || "Event"}.pdf`);

            const res = await apiRequest(API_ENDPOINTS.events.sendInvoice, {
                method: "POST",
                body: formData,
            });

            if (res.ok) {
                toast.success("Email sent successfully");
                setShowEmailDraft(false);
            } else {
                const text = await res.text();
                console.error("Failed to send email:", text);
                toast.error(`Failed to send email: ${text}`);
            }
        } catch (err) {
            console.error("Error sending email:", err);
            toast.error("Error sending email");
        } finally {
            setSendingEmail(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:!bg-gray-900 dark:border dark:border-gray-800 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] relative overflow-hidden flex flex-col">
                {/* Main Content Wrapper - Slides Left */}
                <div
                    className={`p-6 overflow-y-auto transition-all duration-300 ease-in-out h-full ${
                        showPreview || showEmailDraft
                            ? "-translate-x-full opacity-0"
                            : "translate-x-0 opacity-100"
                    }`}
                    style={{
                        transform:
                            showPreview || showEmailDraft ? "translateX(-100%)" : "translateX(0)",
                        visibility: showPreview || showEmailDraft ? "hidden" : "visible",
                    }}
                >
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
                        aria-label="Close modal"
                    >
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>

                    <div className="mb-6">
                        <h2 className="text-xl font-semibold text-gray-900">Estimate Builder</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Add items, costs, and set GST to generate an estimate.
                        </p>
                    </div>

                    {/* Inventory Items Section (Expandable) */}
                    <div className="mb-5">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    Project Items
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Inventory items grouped by category
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsInventoryOpen(!isInventoryOpen)}
                                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                            >
                                {isInventoryOpen ? "↑ Collapse" : "↓ Expand"}
                            </button>
                        </div>
                        {isInventoryOpen && (
                            <>
                                {Object.entries(
                                    rows.reduce((acc, row, idx) => {
                                        const cat = row.category || "Uncategorized";
                                        if (!acc[cat]) acc[cat] = [];
                                        acc[cat].push({ ...row, _idx: idx });
                                        return acc;
                                    }, {} as Record<string, (EventItemRow & { _idx: number })[]>)
                                ).map(([category, items]) => (
                                    <div
                                        key={category}
                                        className="mb-2 border border-gray-300 dark:border-gray-600 rounded-none overflow-hidden bg-white dark:!bg-gray-800 shadow-sm border-l-4 border-l-indigo-500 dark:border-l-indigo-400"
                                    >
                                        <div
                                            className="flex items-center justify-between bg-gray-100 dark:!bg-gray-700 px-4 py-3 cursor-pointer select-none hover:bg-gray-200 dark:hover:!bg-gray-600 transition-colors border-b border-gray-200 dark:border-gray-600"
                                            onClick={() =>
                                                setOpenCategories(prev => ({
                                                    ...prev,
                                                    [category]:
                                                        prev[category] === undefined
                                                            ? true
                                                            : !prev[category],
                                                }))
                                            }
                                        >
                                            <div className="flex items-center gap-2.5">
                                                <svg
                                                    className={`w-4 h-4 text-gray-500 dark:text-gray-300 transition-transform duration-200 ${
                                                        openCategories[category]
                                                            ? "rotate-90"
                                                            : "rotate-0"
                                                    }`}
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2.5"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M9 5l7 7-7 7"
                                                    />
                                                </svg>
                                                <span className="font-semibold text-sm text-gray-800 dark:text-gray-100">
                                                    {category}
                                                </span>
                                                <span className="text-xs font-medium bg-indigo-100 dark:!bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                                                    {items.length} item{items.length !== 1 && "s"}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-400">
                                                {openCategories[category] ? "Collapse" : "Expand"}
                                            </span>
                                        </div>
                                        {openCategories[category] && (
                                            <div className="p-4 space-y-4 bg-white dark:!bg-gray-800">
                                                {items.map(row => (
                                                    <div
                                                        key={row._idx}
                                                        className="border border-gray-200 dark:border-gray-600 rounded p-4 bg-gray-50 dark:!bg-[#2a2f3a] relative group transition-all hover:bg-white dark:hover:!bg-gray-600 hover:shadow-md"
                                                    >
                                                        <button
                                                            onClick={() =>
                                                                handleDeleteRow(row._idx)
                                                            }
                                                            className="absolute top-4 right-4 text-xs font-semibold text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-2 py-1 rounded shadow-sm border border-red-100"
                                                            title="Delete Item"
                                                            type="button"
                                                        >
                                                            &times; Remove
                                                        </button>
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3 pr-16">
                                                            <div className="flex-1">
                                                                <Label className="text-sm font-medium">
                                                                    Category *
                                                                </Label>
                                                                <CreatableSelect
                                                                    options={Array.from(
                                                                        new Set(
                                                                            inventoryList
                                                                                .map(
                                                                                    i => i.category
                                                                                )
                                                                                .filter(Boolean)
                                                                        )
                                                                    ).map(c => ({
                                                                        value: c,
                                                                        label: c as string,
                                                                    }))}
                                                                    value={
                                                                        row.category
                                                                            ? {
                                                                                  value: row.category,
                                                                                  label: row.category,
                                                                              }
                                                                            : null
                                                                    }
                                                                    onChange={(selected: any) =>
                                                                        handleRowChange(
                                                                            row._idx,
                                                                            "category",
                                                                            selected
                                                                                ? selected.value
                                                                                : ""
                                                                        )
                                                                    }
                                                                    placeholder="Select or Create..."
                                                                    className="text-sm mt-1"
                                                                    classNamePrefix="react-select"
                                                                    isClearable
                                                                />
                                                            </div>
                                                            <div className="flex-1">
                                                                <Label className="text-sm font-medium">
                                                                    Sub Category
                                                                </Label>
                                                                <CreatableSelect
                                                                    options={Array.from(
                                                                        new Set(
                                                                            inventoryList
                                                                                .map(
                                                                                    i =>
                                                                                        i.subCategory
                                                                                )
                                                                                .filter(Boolean)
                                                                        )
                                                                    ).map(c => ({
                                                                        value: c,
                                                                        label: c as string,
                                                                    }))}
                                                                    value={
                                                                        row.subCategory
                                                                            ? {
                                                                                  value: row.subCategory,
                                                                                  label: row.subCategory,
                                                                              }
                                                                            : null
                                                                    }
                                                                    onChange={(selected: any) =>
                                                                        handleRowChange(
                                                                            row._idx,
                                                                            "subCategory",
                                                                            selected
                                                                                ? selected.value
                                                                                : ""
                                                                        )
                                                                    }
                                                                    placeholder="Optional..."
                                                                    className="text-sm mt-1"
                                                                    classNamePrefix="react-select"
                                                                    isClearable
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label className="text-sm font-medium">
                                                                    Source
                                                                </Label>
                                                                <div className="flex gap-2 mt-2">
                                                                    <label className="flex items-center gap-1">
                                                                        <input
                                                                            type="radio"
                                                                            name={`inventoryType-${row._idx}`}
                                                                            value="self"
                                                                            checked={
                                                                                row.inventoryType ===
                                                                                "self"
                                                                            }
                                                                            onChange={() =>
                                                                                handleRowChange(
                                                                                    row._idx,
                                                                                    "inventoryType",
                                                                                    "self"
                                                                                )
                                                                            }
                                                                        />
                                                                        <span className="text-xs">
                                                                            Self
                                                                        </span>
                                                                    </label>
                                                                    <label className="flex items-center gap-1">
                                                                        <input
                                                                            type="radio"
                                                                            name={`inventoryType-${row._idx}`}
                                                                            value="external"
                                                                            checked={
                                                                                row.inventoryType ===
                                                                                "external"
                                                                            }
                                                                            onChange={() =>
                                                                                handleRowChange(
                                                                                    row._idx,
                                                                                    "inventoryType",
                                                                                    "external"
                                                                                )
                                                                            }
                                                                        />
                                                                        <span className="text-xs">
                                                                            Vendor
                                                                        </span>
                                                                    </label>
                                                                </div>
                                                            </div>
                                                            {row.inventoryType === "self" ? (
                                                                <div>
                                                                    <Label className="text-sm font-medium">
                                                                        Inventory Item
                                                                    </Label>
                                                                    <CreatableSelect
                                                                        options={inventoryList
                                                                            .filter(
                                                                                inv =>
                                                                                    !row.category ||
                                                                                    inv.category ===
                                                                                        row.category
                                                                            )
                                                                            .map(inv => ({
                                                                                value: String(
                                                                                    inv.id || ""
                                                                                ),
                                                                                label: `${
                                                                                    inv.itemName
                                                                                } ${
                                                                                    inv.category
                                                                                        ? `(${inv.category})`
                                                                                        : ""
                                                                                }`,
                                                                                data: inv,
                                                                            }))}
                                                                        value={
                                                                            row.inventoryID
                                                                                ? {
                                                                                      value: row.inventoryID,
                                                                                      label:
                                                                                          inventoryList.find(
                                                                                              i =>
                                                                                                  String(
                                                                                                      i.id
                                                                                                  ) ===
                                                                                                  row.inventoryID
                                                                                          )
                                                                                              ?.itemName ||
                                                                                          row.item,
                                                                                  }
                                                                                : row.item
                                                                                ? {
                                                                                      value: row.item,
                                                                                      label: row.item,
                                                                                  }
                                                                                : null
                                                                        }
                                                                        onChange={(
                                                                            selected: any
                                                                        ) => {
                                                                            const newRows = [
                                                                                ...rows,
                                                                            ];
                                                                            if (
                                                                                selected &&
                                                                                selected.__isNew__
                                                                            ) {
                                                                                newRows[row._idx] =
                                                                                    {
                                                                                        ...newRows[
                                                                                            row._idx
                                                                                        ],
                                                                                        inventoryID:
                                                                                            "",
                                                                                        item: selected.value,
                                                                                    };
                                                                            } else if (
                                                                                selected &&
                                                                                selected.data
                                                                            ) {
                                                                                newRows[row._idx] =
                                                                                    {
                                                                                        ...newRows[
                                                                                            row._idx
                                                                                        ],
                                                                                        inventoryID:
                                                                                            String(
                                                                                                selected
                                                                                                    .data
                                                                                                    .id ||
                                                                                                    ""
                                                                                            ),
                                                                                        item:
                                                                                            selected
                                                                                                .data
                                                                                                .itemName ||
                                                                                            "",
                                                                                        pricePerItem:
                                                                                            selected
                                                                                                .data
                                                                                                .price ||
                                                                                            0,
                                                                                    };
                                                                            } else {
                                                                                newRows[row._idx] =
                                                                                    {
                                                                                        ...newRows[
                                                                                            row._idx
                                                                                        ],
                                                                                        inventoryID:
                                                                                            "",
                                                                                        item: "",
                                                                                    };
                                                                            }
                                                                            setRows(newRows);
                                                                        }}
                                                                        placeholder={
                                                                            loadingInventory
                                                                                ? "Loading..."
                                                                                : "Select or Create..."
                                                                        }
                                                                        className="text-sm mt-1"
                                                                        classNamePrefix="react-select"
                                                                        isClearable
                                                                    />
                                                                </div>
                                                            ) : (
                                                                <div>
                                                                    <Label className="text-sm font-medium">
                                                                        Vendor
                                                                    </Label>
                                                                    <CreatableSelect
                                                                        options={vendorList.map(
                                                                            v => ({
                                                                                value: String(
                                                                                    v.id || ""
                                                                                ),
                                                                                label: v.name as string,
                                                                            })
                                                                        )}
                                                                        value={
                                                                            row.vendor
                                                                                ? {
                                                                                      value: row.vendor,
                                                                                      label:
                                                                                          vendorList.find(
                                                                                              v =>
                                                                                                  String(
                                                                                                      v.id
                                                                                                  ) ===
                                                                                                  row.vendor
                                                                                          )?.name ||
                                                                                          row.vendor,
                                                                                  }
                                                                                : null
                                                                        }
                                                                        onChange={(selected: any) =>
                                                                            handleRowChange(
                                                                                row._idx,
                                                                                "vendor",
                                                                                selected
                                                                                    ? selected.value
                                                                                    : ""
                                                                            )
                                                                        }
                                                                    placeholder={
                                                                        loadingVendors
                                                                            ? "Loading..."
                                                                            : "Select or Create..."
                                                                    }
                                                                    className="text-sm mt-1"
                                                                    classNamePrefix="react-select"
                                                                    filterOption={(option, inputValue) =>
                                                                        option.label.toLowerCase().includes(inputValue.toLowerCase())
                                                                    }
                                                                    isClearable
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                                                            <div>
                                                                <Label className="text-sm font-medium">
                                                                    Item Name *
                                                                </Label>
                                                                <Input
                                                                    type="text"
                                                                    value={row.item || ""}
                                                                    onChange={e =>
                                                                        handleRowChange(
                                                                            row._idx,
                                                                            "item",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    placeholder="Item name"
                                                                    className="text-sm mt-1"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label className="text-sm font-medium">
                                                                    Quantity
                                                                </Label>
                                                                <Input
                                                                    type="number"
                                                                    value={row.quantity || 1}
                                                                    onChange={e =>
                                                                        handleRowChange(
                                                                            row._idx,
                                                                            "quantity",
                                                                            parseInt(
                                                                                e.target.value
                                                                            ) || 0
                                                                        )
                                                                    }
                                                                    min="1"
                                                                    className="text-sm mt-1"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label className="text-sm font-medium">
                                                                    Price per Item
                                                                </Label>
                                                                <Input
                                                                    type="number"
                                                                    value={row.pricePerItem || 0}
                                                                    onChange={e =>
                                                                        handleRowChange(
                                                                            row._idx,
                                                                            "pricePerItem",
                                                                            parseFloat(
                                                                                e.target.value
                                                                            ) || 0
                                                                        )
                                                                    }
                                                                    min="0"
                                                                    step="0.01"
                                                                    className="text-sm mt-1"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label className="text-sm font-medium">
                                                                    Days/Hours
                                                                </Label>
                                                                <Input
                                                                    type="number"
                                                                    value={row.days || 0}
                                                                    onChange={e =>
                                                                        handleRowChange(
                                                                            row._idx,
                                                                            "days",
                                                                            parseFloat(
                                                                                e.target.value
                                                                            ) || 0
                                                                        )
                                                                    }
                                                                    min="0"
                                                                    step="0.5"
                                                                    className="text-sm mt-1"
                                                                />
                                                            </div>
                                                        </div>
                                                        <div
                                                            className={`grid grid-cols-1 ${
                                                                row.inventoryType === "external"
                                                                    ? "md:grid-cols-3"
                                                                    : "md:grid-cols-2"
                                                            } gap-4 mb-3`}
                                                        >
                                                            <div>
                                                                <Label className="text-sm font-medium">
                                                                    Start Date
                                                                </Label>
                                                                <Input
                                                                    type="datetime-local"
                                                                    value={row.startDate || ""}
                                                                    onChange={e =>
                                                                        handleRowChange(
                                                                            row._idx,
                                                                            "startDate",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className="text-sm mt-1"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label className="text-sm font-medium">
                                                                    End Date
                                                                </Label>
                                                                <Input
                                                                    type="datetime-local"
                                                                    value={row.endDate || ""}
                                                                    onChange={e =>
                                                                        handleRowChange(
                                                                            row._idx,
                                                                            "endDate",
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    className="text-sm mt-1"
                                                                />
                                                            </div>
                                                            {row.inventoryType === "external" && (
                                                                <div>
                                                                    <Label className="text-sm font-medium">
                                                                        Deadline Date
                                                                    </Label>
                                                                    <Input
                                                                        type="datetime-local"
                                                                        value={
                                                                            row.deadlineDate || ""
                                                                        }
                                                                        onChange={e =>
                                                                            handleRowChange(
                                                                                row._idx,
                                                                                "deadlineDate",
                                                                                e.target.value
                                                                            )
                                                                        }
                                                                        className="text-sm mt-1"
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="mb-1">
                                                            <Label className="text-sm font-medium">
                                                                Description
                                                            </Label>
                                                            <Input
                                                                type="text"
                                                                value={row.description || ""}
                                                                onChange={e =>
                                                                    handleRowChange(
                                                                        row._idx,
                                                                        "description",
                                                                        e.target.value
                                                                    )
                                                                }
                                                                placeholder="Description"
                                                                className="text-sm mt-1"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                                <button
                                    type="button"
                                    onClick={handleAddRow}
                                    className="mt-3 w-full border-2 border-dashed border-indigo-200 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 hover:border-indigo-400 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-sm font-medium py-2.5 rounded-xl transition-all"
                                >
                                    + Add Item
                                </button>
                            </>
                        )}
                    </div>

                    {/* Additional Costs Section */}
                    <div className="mb-5">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                                    Additional Costs
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Permits, security, logistics, etc.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsAdditionalCostsOpen(!isAdditionalCostsOpen)}
                                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/30"
                            >
                                {isAdditionalCostsOpen ? "↑ Collapse" : "↓ Expand"}
                            </button>
                        </div>
                        {isAdditionalCostsOpen && (
                            <>
                                <div className="space-y-3">
                                    {additionalCosts.map((cost, index) => (
                                        <div
                                            key={index}
                                            className="border dark:border-gray-600 rounded p-4 bg-gray-50 dark:!bg-[#2a2f3a]"
                                        >
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                                                <div>
                                                    <Label className="text-sm font-medium">
                                                        Item Name
                                                    </Label>
                                                    <Input
                                                        type="text"
                                                        value={cost.item}
                                                        onChange={e =>
                                                            handleAdditionalCostRowChange(
                                                                index,
                                                                "item",
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="e.g., Permits, Security"
                                                        className="text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-sm font-medium">
                                                        Amount
                                                    </Label>
                                                    <Input
                                                        type="number"
                                                        value={cost.amount}
                                                        onChange={e =>
                                                            handleAdditionalCostRowChange(
                                                                index,
                                                                "amount",
                                                                parseFloat(e.target.value) || 0
                                                            )
                                                        }
                                                        min="0"
                                                        step="0.01"
                                                        placeholder="Enter amount"
                                                        className="text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <Label className="text-sm font-medium">
                                                        Remarks
                                                    </Label>
                                                    <Input
                                                        type="text"
                                                        value={cost.remarks}
                                                        onChange={e =>
                                                            handleAdditionalCostRowChange(
                                                                index,
                                                                "remarks",
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Add any notes"
                                                        className="text-sm"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveAdditionalCostRow(index)}
                                                className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition-colors mt-1"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddAdditionalCostRow}
                                    className="mt-3 w-full border-2 border-dashed border-indigo-200 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 text-sm font-medium py-2.5 rounded-xl transition-all"
                                >
                                    + Add Cost Entry
                                </button>
                            </>
                        )}
                    </div>

                    {/* Total Cost Calculation Section */}
                    {(() => {
                        const totalItemsAmount = rows.reduce((sum, row) => {
                            if (!row.category || !row.item) return sum;
                            return sum + (row.pricePerItem * row.days * row.quantity || 0);
                        }, 0);
                        const totalAdditionalCosts = additionalCosts.reduce((sum, cost) => {
                            if (!cost.item) return sum;
                            return sum + (cost.amount || 0);
                        }, 0);
                        const totalBaseAmount = totalItemsAmount + totalAdditionalCosts;
                        const gstAmount = (totalBaseAmount * (gst || 0)) / 100;
                        const grandTotal = totalBaseAmount + gstAmount;

                        return (
                            <div className="mb-6 p-4 bg-gray-50 border rounded-lg shadow-sm">
                                <h3 className="text-lg font-semibold mb-4">Estimated Total</h3>
                                <div className="space-y-2 text-sm text-gray-700">
                                    <div className="flex justify-between items-center">
                                        <span>Total Items Cost:</span>
                                        <span className="font-medium">
                                            ₹{" "}
                                            {totalItemsAmount.toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>
                                    {additionalCosts.length > 0 && (
                                        <div className="flex justify-between items-center">
                                            <span>Total Additional Costs:</span>
                                            <span className="font-medium">
                                                ₹{" "}
                                                {totalAdditionalCosts.toLocaleString("en-IN", {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })}
                                            </span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center py-2 border-y mt-2">
                                        <span className="font-semibold">Subtotal:</span>
                                        <span className="font-semibold text-gray-900">
                                            ₹{" "}
                                            {totalBaseAmount.toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>

                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center pt-2 gap-2">
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor="gst-input" className="font-medium">
                                                GST (%)
                                            </Label>
                                            <Input
                                                id="gst-input"
                                                type="number"
                                                value={gst === 0 ? "" : gst}
                                                onChange={e => {
                                                    setGst(parseFloat(e.target.value) || 0);
                                                    setIsDirty(true);
                                                }}
                                                className="w-24 text-sm h-8"
                                                min="0"
                                                max="100"
                                                step="0.1"
                                                placeholder="e.g. 18"
                                            />
                                        </div>
                                        <span className="font-medium self-end sm:self-auto">
                                            ₹{" "}
                                            {gstAmount.toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center pt-3 mt-3 border-t-2 text-lg">
                                        <span className="font-bold text-gray-900">
                                            Grand Total:
                                        </span>
                                        <span className="font-bold text-blue-700">
                                            ₹{" "}
                                            {grandTotal.toLocaleString("en-IN", {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3 mt-6 border-t pt-4">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSendToClientClick}
                            disabled={isDirty}
                            className={`text-white ${
                                isDirty
                                    ? "bg-gray-400 cursor-not-allowed"
                                    : "bg-green-600 hover:bg-green-700"
                            }`}
                            title={isDirty ? "Please save changes first" : "Send to client"}
                        >
                            Send to client
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveClick}
                            className="bg-blue-600 text-white hover:bg-blue-700"
                        >
                            Save Estimate
                        </Button>
                    </div>

                    {/* Version Confirmation Overlay */}
                    {showVersionPrompt && (
                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
                            <div className="bg-white dark:!bg-gray-900 dark:border dark:border-gray-800 p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all scale-100 border border-gray-100">
                                <h3 className="text-xl font-bold mb-4">Save Configuration</h3>
                                <p className="mb-6 text-gray-600">
                                    Do you want to save this as a new version?
                                </p>

                                <div className="mb-4">
                                    <Label className="block mb-2 text-sm font-medium">
                                        Version Description (if new version)
                                    </Label>
                                    <Input
                                        type="text"
                                        placeholder="e.g., Added Sound adjustments"
                                        value={versionDescription}
                                        onChange={e => setVersionDescription(e.target.value)}
                                        className="w-full"
                                    />
                                </div>

                                {/* Only show Cancel and Save New Version. No overwrite option for this flow. */}
                                <div className="flex justify-end gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowVersionPrompt(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            if (!versionDescription.trim()) {
                                                toast.error("Please enter a version description");
                                                return;
                                            }
                                            executeSave(true);
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                        Yes, Save New Version
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Event Preview Slide-over */}
                <div
                    className={`absolute inset-0 bg-white dark:!bg-gray-900 z-20 flex flex-col transition-all duration-300 ease-in-out ${
                        showPreview ? "translate-x-0" : "translate-x-full"
                    }`}
                    style={{
                        transform: showPreview ? "translateX(0)" : "translateX(100%)",
                        visibility: showPreview ? "visible" : "hidden",
                    }}
                >
                    <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
                        <h2 className="text-xl font-bold">Estimate Preview</h2>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    const previewContent = document.getElementById(
                                        "estimate-preview-content"
                                    );
                                    if (!previewContent) return;
                                    const printWindow = window.open("", "_blank");
                                    if (!printWindow) return;
                                    printWindow.document.write(`
                                        <!DOCTYPE html>
                                        <html>
                                        <head>
                                            <title>Estimate - ${eventData.title || "Event"}</title>
                                            <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
                                            <style>
                                                @page { margin: 20mm; }
                                                body { 
                                                    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
                                                    padding: 0; 
                                                    color: #333; 
                                                    line-height: 1.6;
                                                }
                                                .header-section {
                                                    display: flex;
                                                    justify-content: space-between;
                                                    align-items: flex-start;
                                                    border-bottom: 2px solid #2563eb;
                                                    padding-bottom: 20px;
                                                    margin-bottom: 30px;
                                                }
                                                .header-info h1 {
                                                    margin: 0 0 5px 0;
                                                    font-size: 32px;
                                                    color: #1f2937;
                                                    text-transform: uppercase;
                                                    letter-spacing: 1px;
                                                }
                                                .header-info p {
                                                    margin: 0;
                                                    color: #4b5563;
                                                    font-size: 14px;
                                                }
                                                .logo-container img {
                                                    max-height: 80px;
                                                    object-fit: contain;
                                                }
                                                
                                                /* Reset tailwind classes to render nicely without Tailwind */
                                                .grid { display: flex; flex-wrap: wrap; gap: 20px; }
                                                .grid > div { flex: 1; min-width: 150px; }
                                                .bg-gray-50 { background-color: #f9fafb; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px; }
                                                .text-gray-500 { color: #6b7280; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; display: block; }
                                                .font-medium { font-weight: 500; color: #111827; font-size: 14px; }
                                                .border-b { border-bottom: 1px solid #e5e7eb; }
                                                .pb-2 { padding-bottom: 8px; }
                                                
                                                table { 
                                                    width: 100%; 
                                                    border-collapse: collapse; 
                                                    margin: 20px 0; 
                                                    font-size: 13px;
                                                    table-layout: fixed;
                                                }
                                                th, td { 
                                                    border: 1px solid #e5e7eb; 
                                                    padding: 10px 12px; 
                                                    text-align: left; 
                                                    word-wrap: break-word;
                                                }
                                                th { 
                                                    background-color: #f9fafb; 
                                                    font-weight: 600; 
                                                    color: #374151;
                                                    text-transform: uppercase;
                                                    font-size: 11px;
                                                    letter-spacing: 0.5px;
                                                }
                                                tr:nth-child(even) {
                                                    background-color: #fcfcfc;
                                                }
                                                .items-table th:nth-child(1), .items-table td:nth-child(1) { width: 35%; }
                                                .items-table th:nth-child(2), .items-table td:nth-child(2) { width: 10%; text-align: center; }
                                                .items-table th:nth-child(3), .items-table td:nth-child(3) { width: 20%; text-align: right; }
                                                .items-table th:nth-child(4), .items-table td:nth-child(4) { width: 15%; text-align: center; }
                                                .items-table th:nth-child(5), .items-table td:nth-child(5) { width: 20%; text-align: right; }
                                                
                                                .costs-table th:nth-child(1), .costs-table td:nth-child(1) { width: 40%; }
                                                .costs-table th:nth-child(2), .costs-table td:nth-child(2) { width: 40%; }
                                                .costs-table th:nth-child(3), .costs-table td:nth-child(3) { width: 20%; text-align: right; }
                                                h3 { 
                                                    margin: 30px 0 12px; 
                                                    font-size: 18px; 
                                                    color: #1f2937;
                                                    border-bottom: 2px solid #e5e7eb;
                                                    padding-bottom: 8px;
                                                }
                                                .summary-row { 
                                                    display: flex; 
                                                    justify-content: space-between; 
                                                    padding: 8px 0; 
                                                    font-size: 14px; 
                                                    border-bottom: 1px solid #f3f4f6;
                                                }
                                                .summary-row:last-child {
                                                    border-bottom: none;
                                                }
                                                .summary-row.total { 
                                                    font-weight: 700; 
                                                    font-size: 18px; 
                                                    border-top: 2px solid #1f2937; 
                                                    margin-top: 8px; 
                                                    padding-top: 12px; 
                                                    color: #111827;
                                                }
                                                .terms-section {
                                                    margin-top: 50px;
                                                    padding-top: 20px;
                                                    border-top: 1px solid #e5e7eb;
                                                    page-break-inside: avoid;
                                                }
                                                .terms-section h4 {
                                                    margin: 0 0 10px 0;
                                                    font-size: 14px;
                                                    color: #374151;
                                                    text-transform: uppercase;
                                                }
                                                .terms-section ul {
                                                    margin: 0;
                                                    padding-left: 20px;
                                                    font-size: 12px;
                                                    color: #6b7280;
                                                    line-height: 1.6;
                                                }
                                            </style>
                                        </head>
                                        <body>
                                            <div class="header-section">
                                                <div class="header-info">
                                                    <h1>ESTIMATE</h1>
                                                    <p><strong>Event:</strong> ${
                                                        eventData.title || "Untitled Event"
                                                    }</p>
                                                    <p><strong>Date Generated:</strong> ${new Date().toLocaleDateString(
                                                        "en-IN",
                                                        {
                                                            year: "numeric",
                                                            month: "long",
                                                            day: "numeric",
                                                        }
                                                    )}</p>
                                                </div>
                                                <div class="logo-container">
                                                    <img src="/BeGoodLogo.jpg" alt="BeGood Logo" />
                                                </div>
                                            </div>
                                            
                                            <div class="content-section">
                                                ${previewContent.innerHTML}
                                            </div>

                                            <div class="terms-section">
                                                <h4>Terms and Conditions</h4>
                                                <ul>
                                                    <li>This estimate is valid for 30 days from the date of issue.</li>
                                                    <li>A 50% advance payment is required to confirm the booking.</li>
                                                    <li>The final balance is due upon completion of the event.</li>
                                                    <li>Any additional requirements or scope changes during execution will be billed separately.</li>
                                                    <li>Cancellation policies apply as per standard terms.</li>
                                                </ul>
                                            </div>
                                        </body>
                                        </html>
                                    `);
                                    printWindow.document.close();
                                    printWindow.focus();
                                    setTimeout(() => {
                                        printWindow.print();
                                        printWindow.close();
                                    }, 750);
                                }}
                                className="flex items-center gap-1.5 text-sm"
                            >
                                <svg
                                    className="w-4 h-4"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                </svg>
                                Download PDF
                            </Button>
                            <Button variant="ghost" onClick={() => setShowPreview(false)}>
                                Back to Edit
                            </Button>
                        </div>
                    </div>

                    <div
                        id="estimate-preview-content"
                        className="flex-1 overflow-y-auto p-6 space-y-6"
                    >
                        {/* 1. Basic Details */}
                        <div className="bg-gray-50 p-4 rounded-lg border">
                            <h3 className="text-lg font-semibold mb-3 border-b pb-2">
                                Event Details
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <span className="block text-gray-500">Event Title</span>
                                    <span className="font-medium">{eventData.title || "-"}</span>
                                </div>
                                <div>
                                    <span className="block text-gray-500">Dates</span>
                                    <span className="font-medium">
                                        {eventData.eventStartDate
                                            ? new Date(
                                                  eventData.eventStartDate
                                              ).toLocaleDateString()
                                            : "-"}
                                        {" - "}
                                        {eventData.eventEndDate
                                            ? new Date(eventData.eventEndDate).toLocaleDateString()
                                            : "-"}
                                    </span>
                                </div>
                                <div>
                                    <span className="block text-gray-500">Venue</span>
                                    <span className="font-medium">{eventData.venue || "-"}</span>
                                </div>
                                <div>
                                    <span className="block text-gray-500">Location</span>
                                    <span className="font-medium">{eventData.location || "-"}</span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Item Details Segregated by Category */}
                        <div>
                            <h3 className="text-lg font-semibold mb-3">Event Items</h3>
                            {Object.entries(
                                rows.reduce((acc, row) => {
                                    if (!row.category || !row.item) return acc;
                                    if (!acc[row.category]) acc[row.category] = [];
                                    acc[row.category].push(row);
                                    return acc;
                                }, {} as Record<string, EventItemRow[]>)
                            ).map(([category, items]) => (
                                <div
                                    key={category}
                                    className="mb-4 border rounded-lg overflow-hidden"
                                >
                                    <div className="bg-gray-100 px-4 py-2 font-semibold text-sm border-b">
                                        {category}
                                    </div>
                                    <div className="p-0">
                                        <table className="w-full text-sm text-left items-table">
                                            <thead className="bg-gray-50 text-gray-500">
                                                <tr>
                                                    <th className="px-4 py-2 font-medium w-[35%]">
                                                        Item
                                                    </th>
                                                    <th className="px-4 py-2 font-medium w-[10%] text-center">
                                                        Qty
                                                    </th>
                                                    <th className="px-4 py-2 font-medium w-[20%] text-right">
                                                        Price
                                                    </th>
                                                    <th className="px-4 py-2 font-medium w-[15%] text-center">
                                                        Days
                                                    </th>
                                                    <th className="px-4 py-2 font-medium w-[20%] text-right">
                                                        Total
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {items.map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td className="px-4 py-2">{item.item}</td>
                                                        <td className="px-4 py-2 text-center">
                                                            {item.quantity}
                                                        </td>
                                                        <td className="px-4 py-2 text-right">
                                                            ₹{item.pricePerItem}
                                                        </td>
                                                        <td className="px-4 py-2 text-center">
                                                            {item.days}
                                                        </td>
                                                        <td className="px-4 py-2 font-medium text-right">
                                                            ₹
                                                            {(
                                                                item.quantity *
                                                                item.pricePerItem *
                                                                item.days
                                                            ).toFixed(2)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                            {rows.filter(r => r.category && r.item).length === 0 && (
                                <p className="text-gray-500 italic">No items added yet.</p>
                            )}
                        </div>

                        {/* 3. Additional Costs */}
                        <div>
                            <h3 className="text-lg font-semibold mb-3">Additional Costs</h3>
                            {additionalCosts.length > 0 ? (
                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left costs-table">
                                        <thead className="bg-gray-50 text-gray-500">
                                            <tr>
                                                <th className="px-4 py-2 font-medium w-[40%]">
                                                    Item
                                                </th>
                                                <th className="px-4 py-2 font-medium w-[40%]">
                                                    Remarks
                                                </th>
                                                <th className="px-4 py-2 font-medium w-[20%] text-right">
                                                    Amount
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {additionalCosts.map((cost, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-4 py-2">{cost.item}</td>
                                                    <td className="px-4 py-2">{cost.remarks}</td>
                                                    <td className="px-4 py-2 font-medium text-right">
                                                        ₹{cost.amount}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <p className="text-gray-500 italic">No additional costs.</p>
                            )}
                        </div>

                        {/* 4. Total Estimate */}
                        <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 mt-6">
                            <div className="flex justify-between items-center text-xl font-bold text-gray-900">
                                <span>Grand Total Estimate</span>
                                <span>
                                    ₹
                                    {(
                                        rows.reduce(
                                            (sum, item) =>
                                                sum +
                                                (Number(item.quantity) || 0) *
                                                    (Number(item.pricePerItem) || 0) *
                                                    (Number(item.days) || 0),
                                            0
                                        ) +
                                        additionalCosts.reduce(
                                            (sum, cost) => sum + Number(cost.amount || 0),
                                            0
                                        )
                                    ).toFixed(2)}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
                        <Button variant="outline" onClick={() => setShowPreview(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleProceedToEmail}
                            className="bg-blue-600 text-white hover:bg-blue-700"
                        >
                            Proceed to Email
                        </Button>
                    </div>
                </div>

                {/* Email Draft Slide-over (Gmail Style) - z-30 to stack ON TOP of preview */}
                <div
                    className={`absolute inset-0 bg-white dark:!bg-gray-900 z-30 flex flex-col transition-all duration-300 ease-in-out ${
                        showEmailDraft ? "translate-x-0" : "translate-x-full"
                    }`}
                    style={{
                        transform: showEmailDraft ? "translateX(0)" : "translateX(100%)",
                        visibility: showEmailDraft ? "visible" : "hidden",
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-gray-100 border-b shadow-sm shrink-0">
                        <h2 className="text-sm font-semibold text-gray-700">New Message</h2>
                        <button
                            onClick={() => setShowEmailDraft(false)}
                            className="text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded p-1"
                        >
                            <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                />
                            </svg>
                        </button>
                    </div>

                    {/* Compose Area */}
                    <div className="flex-1 flex flex-col overflow-y-auto">
                        <div className="px-4 pt-2">
                            <div className="flex items-center border-b border-gray-200 py-1">
                                <span className="text-gray-500 text-sm w-16 cursor-default">
                                    To
                                </span>
                                <input
                                    type="text"
                                    value={emailForm.to}
                                    onChange={e =>
                                        setEmailForm(prev => ({ ...prev, to: e.target.value }))
                                    }
                                    className="flex-1 py-1 text-sm outline-none text-gray-800 placeholder-gray-400 bg-transparent"
                                    placeholder="Recipients"
                                    autoFocus
                                />
                            </div>
                            <div className="flex items-center border-b border-gray-200 py-1">
                                <span className="text-gray-500 text-sm w-16 cursor-default">
                                    Cc
                                </span>
                                <input
                                    type="text"
                                    value={emailForm.cc}
                                    onChange={e =>
                                        setEmailForm(prev => ({ ...prev, cc: e.target.value }))
                                    }
                                    className="flex-1 py-1 text-sm outline-none text-gray-800 placeholder-gray-400 bg-transparent"
                                    placeholder="Cc"
                                />
                            </div>
                            <div className="flex items-center border-b border-gray-200 py-1">
                                <input
                                    type="text"
                                    value={emailForm.subject}
                                    onChange={e =>
                                        setEmailForm(prev => ({
                                            ...prev,
                                            subject: e.target.value,
                                        }))
                                    }
                                    className="flex-1 py-2 text-sm font-medium outline-none text-gray-800 placeholder-gray-400 bg-transparent"
                                    placeholder="Subject"
                                />
                            </div>
                        </div>

                        <textarea
                            value={emailForm.body}
                            onChange={e =>
                                setEmailForm(prev => ({ ...prev, body: e.target.value }))
                            }
                            className="flex-1 w-full p-4 resize-none outline-none text-sm text-gray-800 font-sans leading-relaxed"
                            placeholder="Message body..."
                        />
                    </div>

                    {/* Footer / Toolbar */}
                    <div className="px-4 py-3 border-t bg-gray-50 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleSendEmail}
                                disabled={sendingEmail}
                                className="bg-blue-600 text-white hover:bg-blue-700 px-6 rounded-full font-medium shadow-sm transition-all"
                            >
                                {sendingEmail ? "Sending..." : "Send"}
                            </Button>
                            <button
                                className="p-2 text-gray-500 hover:bg-gray-200 rounded-full"
                                title="Attach files (dummy)"
                            >
                                <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                                    />
                                </svg>
                            </button>
                            <button
                                className="p-2 text-gray-500 hover:bg-gray-200 rounded-full"
                                title="Formatting options (dummy)"
                            >
                                <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 6h16M4 12h16m-7 6h7"
                                    />
                                </svg>
                            </button>
                        </div>

                        <button
                            onClick={() => setShowEmailDraft(false)}
                            className="p-2 text-gray-500 hover:bg-gray-200 rounded-full hover:text-red-600 transition-colors"
                            title="Discard draft"
                        >
                            <svg
                                className="w-5 h-5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
