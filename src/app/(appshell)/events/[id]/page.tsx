"use client";

import React, { useEffect, useState } from "react";
import { ProjectPlanningModal } from "@/components/project-planning-modal";
import { EstimateVersionsView } from "@/components/estimate-versions-view";
import { ExpensesModal } from "@/components/expenses-modal";
import { BillingExpenseModal } from "@/components/billing-expense-modal";
import { ChecklistModal } from "@/components/checklist-modal";
import { ChecklistPreviewModal } from "@/components/checklist-preview-modal";
import { ClientDetailView } from "@/components/client-detail-view";
import { CreatePurchaseOrderModal } from "@/components/create-purchase-order-modal";
import { PurchaseOrderPreviewModal } from "@/components/purchase-order-preview-modal";
import { InventoryListModal } from "@/components/inventory-list-modal";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { apiRequest } from "@/lib/api/api-client";
import { EventResponse } from "@/types/event";
import type { Vendor } from "@/types/vendor";
import type { Inventory } from "@/types/inventory";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/constants/event";
import {
    CalendarDays,
    MapPin,
    User,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    Wallet,
    Package,
    History,
    Receipt,
    ClipboardCheck,
    ChevronDown,
    ArrowRight,
    Edit3,
    CheckCircle2,
    FileText,
} from "lucide-react";
import { Button } from "@/components/ui";

export default function EventDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = React.use(params);
    const [eventTitle, setEventTitle] = useState<string>("Event Details");
    const [eventData, setEventData] = useState<EventResponse | null>(null);
    const [isProjectPlanningModalOpen, setIsProjectPlanningModalOpen] = useState(false);
    const [isEstimateHistoryModalOpen, setIsEstimateHistoryModalOpen] = useState(false);
    const [isExpensesModalOpen, setIsExpensesModalOpen] = useState(false);
    const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
    const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
    const [isChecklistPreviewModalOpen, setIsChecklistPreviewModalOpen] = useState(false);
    const [isInventoryListModalOpen, setIsInventoryListModalOpen] = useState(false);
    const [isAddPurchaseOrderModalOpen, setIsAddPurchaseOrderModalOpen] = useState(false);
    const [isPurchaseOrderPreviewOpen, setIsPurchaseOrderPreviewOpen] = useState(false);
    const [expandedSection, setExpandedSection] = useState<string>("client");
    const [vendorList, setVendorList] = useState<Vendor[]>([]);
    const [inventoryList, setInventoryList] = useState<Inventory[]>([]);
    const [loadingVendors, setLoadingVendors] = useState(false);
    const [loadingInventory, setLoadingInventory] = useState(false);
    const fetchPromiseRef = React.useRef<Promise<EventResponse | null> | null>(null);

    const fetchEventData = React.useCallback(async () => {
        try {
            fetchPromiseRef.current = null;

            const queryParam = String(id).includes("_") ? id : id;
            fetchPromiseRef.current = (async () => {
                const res = await apiRequest(
                    API_ENDPOINTS.events.detail(encodeURIComponent(String(queryParam))),
                );
                if (!res.ok) return null;
                return (await res.json()) as EventResponse;
            })();

            const data = await fetchPromiseRef.current;
            if (!data) return;

            setEventData(data);

            const title = data.title ?? `Event ${data.eventID || id}`;
            setEventTitle(String(title));
        } catch {
            // ignore
        }
    }, [id]);

    useEffect(() => {
        fetchEventData();
    }, [fetchEventData]);

    const fetchVendorsOnly = React.useCallback(async () => {
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
    }, []);

    const fetchChecklistData = React.useCallback(async () => {
        const fetchInventory = async () => {
            setLoadingInventory(true);
            try {
                const res = await apiRequest(API_ENDPOINTS.inventory.list);
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

        await Promise.all([fetchVendorsOnly(), fetchInventory()]);
    }, [fetchVendorsOnly]);

    useEffect(() => {
        if (isChecklistPreviewModalOpen) {
            fetchChecklistData();
        }
    }, [isChecklistPreviewModalOpen, fetchChecklistData]);

    useEffect(() => {
        if (isChecklistModalOpen) {
            fetchChecklistData();
        }
    }, [isChecklistModalOpen, fetchChecklistData]);

    // Calculate totals from categorySummary (provided by backend)
    let totalEstimatedCost = 0;
    const totalExpense = 0;
    const totalIncome = 0;
    let totalPendingAmount = 0;

    if (Array.isArray(eventData?.categorySummary)) {
        eventData?.categorySummary.forEach(cat => {
            totalEstimatedCost += cat.totalAmount || 0;
            totalPendingAmount += cat.advanceAmount || 0;
        });
    }

    const formatCurrency = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

    // Format event date for display
    const formattedEventDate = eventData?.eventStartDate
        ? new Date(eventData.eventStartDate).toLocaleDateString("en-IN", {
              year: "numeric",
              month: "long",
              day: "numeric",
          })
        : "";

    // Format location/venue
    const displayLocation = eventData?.location ?? eventData?.venue ?? "";

    const toggleSection = (section: string) => {
        setExpandedSection(prev => (prev === section ? "" : section));
    };

    const getBadgeVariant = (
        status: string,
    ): "default" | "success" | "warning" | "danger" | "info" => {
        switch (status) {
            case "ESTIMATE_APPROVED":
            case "PROJECT_COMPLETED":
                return "success";
            case "ESTIMATE_INPROGRESS":
            case "ESTIMATE_UNDER_REVIEW":
            case "PROJECT_SETTLEMENT_IN_PROGRESS":
                return "warning";
            case "ENQUIRY_CREATED":
            case "PROJECT_INPROGRESS":
                return "info";
            default:
                return "default";
        }
    };

    interface ActionCard {
        id: string;
        icon: React.ComponentType<{ className?: string }>;
        title: string;
        description: string;
        linkLabel: string;
        onClick: () => void;
    }

    const actionCards: ActionCard[] = [
        {
            id: "history",
            icon: History,
            title: "Estimate History",
            description: "Review previous versions and approval timelines.",
            linkLabel: "View History",
            onClick: () => setIsEstimateHistoryModalOpen(true),
        },
        {
            id: "checklist",
            icon: ClipboardCheck,
            title: "Event Checklist",
            description: "Assign tasks and track execution milestones.",
            linkLabel: "Open Checklist",
            onClick: () => setIsChecklistPreviewModalOpen(true),
        },
        {
            id: "inventory",
            icon: Package,
            title: "Inventory List",
            description: "Manage stock and vendor allocations for this event.",
            linkLabel: "View List",
            onClick: () => setIsInventoryListModalOpen(true),
        },
        {
            id: "purchaseOrder",
            icon: FileText,
            title: "Purchase Order",
            description: "Create and manage purchase orders for vendors.",
            linkLabel: "Create Order",
            onClick: () => {
                setIsAddPurchaseOrderModalOpen(true);
                fetchVendorsOnly();
            },
        },
        {
            id: "expenses",
            icon: Receipt,
            title: "Expenses",
            description: "Track invoices, vendor payments, and overheads.",
            linkLabel: "Manage Expenses",
            onClick: () => setIsExpensesModalOpen(true),
        },
        {
            id: "billing",
            icon: Receipt,
            title: "Billing & Tax",
            description: "Manage ledger and tax billing info.",
            linkLabel: "Manage Billing",
            onClick: () => setIsBillingModalOpen(true),
        },
    ];

    return (
        <div className="w-full min-h-screen bg-background">
            {/* Hero Header Section */}
            <section className="py-6 border-b border-border/20">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                            {eventData?.status && (
                                <Badge variant={getBadgeVariant(eventData.status)}>
                                    {STATUS_LABELS[eventData.status] ?? eventData.status}
                                </Badge>
                            )}
                            {formattedEventDate && (
                                <span className="text-muted-foreground text-xs font-medium flex items-center gap-1">
                                    <CalendarDays className="w-3.5 h-3.5" />
                                    {formattedEventDate}
                                </span>
                            )}
                        </div>
                        <h2 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tighter">
                            {eventTitle}
                        </h2>
                        {displayLocation && (
                            <p className="text-muted-foreground text-sm flex items-center gap-1.5">
                                <MapPin className="w-4 h-4" />
                                {displayLocation}
                            </p>
                        )}
                    </div>
                    <div className="flex gap-3 flex-shrink-0">
                        <Button
                            onClick={() => setIsProjectPlanningModalOpen(true)}
                            icon={<Edit3 size={16} />}
                            variant="ghost"
                        >
                            Edit Project
                        </Button>
                        <Button icon={<CheckCircle2 size={16} />}>Approve Event</Button>
                    </div>
                </div>
            </section>

            {/* Stats Overview Grid */}
            <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 py-6">
                <div className="bg-surface p-5 rounded-xl border border-border/20">
                    <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5" />
                        Estimated Cost
                    </p>
                    <p className="text-2xl font-bold text-primary tracking-tight">
                        {formatCurrency(totalEstimatedCost)}
                    </p>
                </div>
                <div className="bg-surface p-5 rounded-xl border border-border/20">
                    <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <TrendingDown className="w-3.5 h-3.5" />
                        Total Income
                    </p>
                    <p className="text-2xl font-bold text-success tracking-tight">
                        {formatCurrency(totalIncome)}
                    </p>
                </div>
                <div className="bg-surface p-5 rounded-xl border border-border/20">
                    <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Total Expense
                    </p>
                    <p className="text-2xl font-bold text-destructive tracking-tight">
                        {formatCurrency(totalExpense)}
                    </p>
                </div>
                <div className="bg-surface p-5 rounded-xl border border-border/20">
                    <p className="text-muted-foreground text-[11px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Wallet className="w-3.5 h-3.5" />
                        Pending
                    </p>
                    <p className="text-2xl font-bold text-foreground tracking-tight">
                        {formatCurrency(totalPendingAmount)}
                    </p>
                </div>
                <div className="bg-gradient-to-br from-primary to-primary-hover p-5 rounded-xl text-white shadow-lg col-span-2 md:col-span-1">
                    <p className="text-primary-foreground text-[11px] font-bold uppercase tracking-wider mb-2">
                        Current Balance
                    </p>
                    <p className="text-2xl font-bold tracking-tight">
                        {formatCurrency(Math.max(0, totalIncome - totalEstimatedCost))}
                    </p>
                </div>
            </section>

            {/* Main Layout: Client Details & Action Cards */}
            <div className="pb-12">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4">
                    {/* Left Column: Client Details & Sections */}
                    <div className="lg:col-span-8 space-y-4">
                        {/* Client Details Section */}
                        {eventData?.client && (
                            <div className="bg-surface rounded-xl border border-border/20 overflow-hidden">
                                <button
                                    onClick={() => toggleSection("client")}
                                    className="w-full flex items-center justify-between p-5 hover:bg-muted/50 transition-colors group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            <User className="w-5 h-5" />
                                        </div>
                                        <div className="text-left">
                                            <h3 className="text-sm font-bold text-foreground">
                                                Client Details
                                            </h3>
                                            <p className="text-[11px] text-muted-foreground">
                                                Primary contact and billing info
                                            </p>
                                        </div>
                                    </div>
                                    <ChevronDown
                                        className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
                                            expandedSection === "client" ? "rotate-180" : ""
                                        }`}
                                    />
                                </button>
                                {expandedSection === "client" && (
                                    <div className="px-5 pb-5 pt-0 border-t border-border/10 mt-2 pt-5">
                                        <ClientDetailView
                                            clientId={eventData.clientID}
                                            clientName={eventData?.client}
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Event Details Section */}
                        <div className="bg-surface rounded-xl border border-border/20 overflow-hidden">
                            <button
                                onClick={() => toggleSection("details")}
                                className="w-full flex items-center justify-between p-5 hover:bg-muted/50 transition-colors group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground">
                                        <CalendarDays className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-sm font-bold text-foreground">
                                            Event Details
                                        </h3>
                                        <p className="text-[11px] text-muted-foreground">
                                            Timeline and venue information
                                        </p>
                                    </div>
                                </div>
                                <ChevronDown
                                    className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
                                        expandedSection === "details" ? "rotate-180" : ""
                                    }`}
                                />
                            </button>
                            {expandedSection === "details" && (
                                <div className="px-5 pb-5 pt-0 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-border/10 mt-2 pt-5">
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase">
                                            Start Date
                                        </p>
                                        <p className="text-sm font-medium text-foreground">
                                            {eventData?.eventStartDate
                                                ? new Date(
                                                      eventData.eventStartDate,
                                                  ).toLocaleDateString("en-IN", {
                                                      year: "numeric",
                                                      month: "short",
                                                      day: "numeric",
                                                      hour: "2-digit",
                                                      minute: "2-digit",
                                                  })
                                                : "-"}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase">
                                            End Date
                                        </p>
                                        <p className="text-sm font-medium text-foreground">
                                            {eventData?.eventEndDate
                                                ? new Date(
                                                      eventData.eventEndDate,
                                                  ).toLocaleDateString("en-IN", {
                                                      year: "numeric",
                                                      month: "short",
                                                      day: "numeric",
                                                      hour: "2-digit",
                                                      minute: "2-digit",
                                                  })
                                                : "-"}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase">
                                            Event ID
                                        </p>
                                        <p className="text-sm font-medium text-foreground">
                                            {eventData?.eventID ?? "-"}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Project Stats Section */}
                        <div className="bg-surface rounded-xl border border-border/20 overflow-hidden">
                            <button
                                onClick={() => toggleSection("stats")}
                                className="w-full flex items-center justify-between p-5 hover:bg-muted/50 transition-colors group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground">
                                        <TrendingUp className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-sm font-bold text-foreground">
                                            Project Stats
                                        </h3>
                                        <p className="text-[11px] text-muted-foreground">
                                            Engagement and timeline metrics
                                        </p>
                                    </div>
                                </div>
                                <ChevronDown
                                    className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
                                        expandedSection === "stats" ? "rotate-180" : ""
                                    }`}
                                />
                            </button>
                            {expandedSection === "stats" && (
                                <div className="px-5 pb-5 pt-0 border-t border-border/10 mt-2 pt-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase">
                                                Status
                                            </p>
                                            <div className="mt-1">
                                                <Badge
                                                    variant={getBadgeVariant(
                                                        eventData?.status ?? "",
                                                    )}
                                                >
                                                    {STATUS_LABELS[eventData?.status ?? ""] ??
                                                        eventData?.status ??
                                                        "—"}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Financial Overview Section */}
                        <div className="bg-surface rounded-xl border border-border/20 overflow-hidden">
                            <button
                                onClick={() => toggleSection("financial")}
                                className="w-full flex items-center justify-between p-5 hover:bg-muted/50 transition-colors group"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                        <Wallet className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-sm font-bold text-foreground">
                                            Financial Overview
                                        </h3>
                                        <p className="text-[11px] text-muted-foreground">
                                            Breakdown of deposits and pending dues
                                        </p>
                                    </div>
                                </div>
                                <ChevronDown
                                    className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
                                        expandedSection === "financial" ? "rotate-180" : ""
                                    }`}
                                />
                            </button>
                            {expandedSection === "financial" && (
                                <div className="px-5 pb-5 pt-0 border-t border-border/10 mt-2 pt-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase">
                                                Estimated Cost
                                            </p>
                                            <p className="text-lg font-semibold text-primary">
                                                {formatCurrency(totalEstimatedCost)}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-muted-foreground font-bold uppercase">
                                                Pending Amount
                                            </p>
                                            <p className="text-lg font-semibold text-foreground">
                                                {formatCurrency(totalPendingAmount)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Action Cards */}
                    <div className="lg:col-span-4 space-y-4">
                        {actionCards.map(card => {
                            const Icon = card.icon;
                            return (
                                <div
                                    key={card.id}
                                    className={`bg-surface p-6 rounded-xl border border-border/20 group transition-all ${
                                        false
                                            ? "opacity-60 saturate-50"
                                            : "hover:bg-primary/5 cursor-pointer"
                                    }`}
                                    onClick={card.onClick}
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
                                            <Icon className="w-5 h-5" />
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                    <h4 className="font-bold text-foreground mb-1">{card.title}</h4>
                                    <p className="text-xs text-muted-foreground mb-4">
                                        {card.description}
                                    </p>
                                    <span className="text-primary font-bold text-xs flex items-center gap-1">
                                        {card.linkLabel} <ArrowRight className="w-3.5 h-3.5" />
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Modals */}
            <ProjectPlanningModal
                isOpen={isProjectPlanningModalOpen}
                onClose={() => setIsProjectPlanningModalOpen(false)}
                eventData={eventData || {}}
                onSave={() => {
                    setIsProjectPlanningModalOpen(false);
                    fetchEventData();
                }}
            />

            {isEstimateHistoryModalOpen && (
                <EstimateVersionsView
                    enquiryId={eventData?.enquiryId ?? ""}
                    onClose={() => setIsEstimateHistoryModalOpen(false)}
                    isViewOnlyMode={true}
                />
            )}

            <ExpensesModal
                isOpen={isExpensesModalOpen}
                onClose={() => setIsExpensesModalOpen(false)}
                eventData={eventData || {}}
                onSave={() => {
                    setIsExpensesModalOpen(false);
                    fetchEventData();
                }}
            />

            <BillingExpenseModal
                isOpen={isBillingModalOpen}
                onClose={() => setIsBillingModalOpen(false)}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                eventData={(eventData as any) || {}}
                onSave={() => {
                    setIsBillingModalOpen(false);
                    fetchEventData();
                }}
            />

            <ChecklistModal
                isOpen={isChecklistModalOpen}
                onClose={() => setIsChecklistModalOpen(false)}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                eventData={(eventData as any) || {}}
                onSave={() => {
                    setIsChecklistModalOpen(false);
                    fetchEventData();
                    // Reopen preview modal with updated data
                    setIsChecklistPreviewModalOpen(true);
                }}
                onCancel={() => {
                    setIsChecklistModalOpen(false);
                    setIsChecklistPreviewModalOpen(true);
                }}
                vendorList={vendorList}
                inventoryList={inventoryList}
                loadingVendors={loadingVendors}
                loadingInventory={loadingInventory}
            />

            {isChecklistPreviewModalOpen && eventData && (
                <ChecklistPreviewModal
                    isOpen={isChecklistPreviewModalOpen}
                    onClose={() => setIsChecklistPreviewModalOpen(false)}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    checklistData={(eventData as any)?.items || (eventData as any)?.checklist || []}
                    vendorList={vendorList}
                    inventoryList={inventoryList}
                    exportContext={{
                        eventName: eventData.title,
                        clientName: eventData.client,
                        eventStartDate: eventData.eventStartDate,
                        eventEndDate: eventData.eventEndDate,
                        venue: eventData.venue,
                    }}
                    onUpdate={() => {
                        setIsChecklistPreviewModalOpen(false);
                        setIsChecklistModalOpen(true);
                    }}
                />
            )}

            {eventData && (
                <CreatePurchaseOrderModal
                    isOpen={isAddPurchaseOrderModalOpen}
                    onClose={() => setIsAddPurchaseOrderModalOpen(false)}
                    onSave={fetchEventData}
                    onViewPurchaseOrder={() => {
                        setIsAddPurchaseOrderModalOpen(false);
                        setIsPurchaseOrderPreviewOpen(true);
                    }}
                    vendorList={vendorList}
                    eventData={eventData}
                />
            )}

            {isPurchaseOrderPreviewOpen && eventData && (
                <PurchaseOrderPreviewModal
                    eventData={eventData}
                    eventName={eventData.title}
                    vendorList={vendorList}
                    inventoryList={inventoryList.map(inv => ({
                        id: inv.id,
                        name: inv.itemName,
                    }))}
                    onClose={() => setIsPurchaseOrderPreviewOpen(false)}
                    totalEstimatedCost={totalEstimatedCost}
                />
            )}

            {isInventoryListModalOpen && eventData && (
                <InventoryListModal
                    isOpen={isInventoryListModalOpen}
                    onClose={() => setIsInventoryListModalOpen(false)}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    checklistData={(eventData as any)?.items || (eventData as any)?.checklist || []}
                    inventoryList={inventoryList}
                />
            )}
        </div>
    );
}
