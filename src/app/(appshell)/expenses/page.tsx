"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, RefreshCw, Search } from "lucide-react";

import { usePagination } from "@/hooks/usePagination";
import { useExpenses, EXPENSE_TYPE_LABELS, EXPENSE_STATUS_META } from "@/hooks/useExpenses";
import { DEFAULT_PAGE_SIZE } from "@/constants";
import { apiRequest } from "@/lib/api/api-client";
import { API_ENDPOINTS } from "@/lib/api/endpoint";
import { downloadCSV } from "@/lib/utils/file";
import { formatShortDate } from "@/lib/utils/date";
import { pickFirst, toList } from "@/lib/utils";

import { Button, Input, PageHeader, Pagination, Select } from "@/components/ui";
import { Loading } from "@/components/ui/loading";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { ExpensesTable } from "@/components/expenses-table";
import { ExpensesModal } from "@/components/expenses-modal";
import { ConfirmationModal } from "@/components/shared/confirmation-modal";
import { AccessButton } from "@/components/shared/access-button";
import { UserPlusIcon } from "@/components/ui/icons";

import type { Column } from "@/components/ui/table";
import type { Event } from "@/types/event";
import type { Expense } from "@/types/expense";

const PAGE_SIZE = DEFAULT_PAGE_SIZE;

export default function ExpensesPage() {
    /* ------------------------------------------------------------------ */
    /*  Data                                                               */
    /* ------------------------------------------------------------------ */

    const {
        expenses,
        loading,
        error,
        refetch,
        openForm,
        closeForm,
        formOpen,
        editingExpense,
        selectForDelete,
        cancelDelete,
        confirmDelete,
        deleteTarget,
        deleting,
        handleFormSaved,
    } = useExpenses();

    // Events are fetched to resolve readable event names for the "Event"
    // column and to drive event selection when creating an expense from this
    // global page (the backend requires an eventID for every expense).
    const [events, setEvents] = useState<Event[]>([]);
    const [eventsLoading, setEventsLoading] = useState(false);

    // The backend may identify an event by `eventID` or by its Mongo `id`.
    // Expenses reference one of the two, so we index every alias of an event
    // to resolve names and to match the event filter reliably.
    const eventAliases = useMemo(() => {
        const map = new Map<string, string>();
        for (const event of events) {
            const canonical = String(event.eventID ?? event.id ?? "");
            if (!canonical) continue;
            for (const alias of [event.eventID, event.id]) {
                if (alias) map.set(String(alias), canonical);
            }
        }
        return map;
    }, [events]);

    /** Maps every known event id alias to the event's display title. */
    const eventNameMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const event of events) {
            const canonical = String(event.eventID ?? event.id ?? "");
            if (!canonical) continue;
            const title = event.title || canonical;
            for (const alias of [event.eventID, event.id]) {
                if (alias) map.set(String(alias), title);
            }
        }
        return map;
    }, [events]);

    const fetchEvents = useCallback(async () => {
        setEventsLoading(true);
        try {
            const res = await apiRequest(API_ENDPOINTS.events.list, { method: "GET" });
            if (res.ok) {
                const data = (await res.json()) as unknown;
                // The events endpoint may return the array directly or wrapped
                // in an envelope, so normalize before using it.
                const list = toList<Event>(data, ["events"]);
                setEvents(
                    list.map(event => {
                        const id = pickFirst<string>(event, ["eventID", "id"]);
                        const title =
                            pickFirst<string>(event, ["title", "eventName", "name"]) ??
                            (id ? String(id) : "");
                        return { ...event, id, title };
                    }),
                );
            }
        } catch (err) {
            console.error("Failed to load events:", err);
        } finally {
            setEventsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEvents();
    }, [fetchEvents]);

    /* ------------------------------------------------------------------ */
    /*  Filtering & pagination                                             */
    /* ------------------------------------------------------------------ */

    const [search, setSearch] = useState("");
    /** Event used to filter the table. */
    const [filterEventID, setFilterEventID] = useState("");
    /** Event chosen in the create-expense picker. */
    const [pickerEventID, setPickerEventID] = useState("");
    const [eventPickerOpen, setEventPickerOpen] = useState(false);

    const eventOptions = useMemo(() => {
        return [
            { label: "All Events", value: "" },
            ...events.map(event => {
                const value = String(event.eventID ?? event.id ?? "");
                return { label: event.title || value, value };
            }),
        ];
    }, [events]);

    const filterEventOption = eventOptions.find(option => option.value === filterEventID);
    const pickerEventOption = eventOptions.find(option => option.value === pickerEventID);

    const filteredExpenses = useMemo(() => {
        const q = search.trim().toLowerCase();
        return expenses.filter(expense => {
            const rawEventID = expense.eventID ? String(expense.eventID) : "";
            const eventName = (rawEventID && eventNameMap.get(rawEventID)) || "";
            const matchesSearch =
                !q ||
                [expense.itemName, expense.comments, expense.poc, rawEventID, eventName]
                    .filter(Boolean)
                    .some(value => String(value).toLowerCase().includes(q));
            // Compare canonical event ids so filtering works whether the
            // expense references the event by `eventID` or by its Mongo `id`.
            const canonical = rawEventID ? eventAliases.get(rawEventID) ?? rawEventID : "";
            const matchesEvent = !filterEventID || canonical === filterEventID;
            return matchesSearch && matchesEvent;
        });
    }, [expenses, search, filterEventID, eventNameMap, eventAliases]);

    const totalElements = filteredExpenses.length;
    const totalPages = Math.max(1, Math.ceil(totalElements / PAGE_SIZE));
    const { currentPage, handlePageChange, pagination, setCurrentPage } = usePagination({
        totalPages,
        pageSize: PAGE_SIZE,
        totalElements,
        itemName: "expense",
    });

    // Keep the current page valid when filtering shrinks the list.
    useEffect(() => {
        if (currentPage > totalPages) setCurrentPage(totalPages);
    }, [currentPage, totalPages, setCurrentPage]);

    const pagedExpenses = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredExpenses.slice(start, start + PAGE_SIZE);
    }, [filteredExpenses, currentPage]);

    const handleResetFilters = useCallback(() => {
        setSearch("");
        setFilterEventID("");
        setCurrentPage(1);
    }, [setCurrentPage]);

    /* ------------------------------------------------------------------ */
    /*  Handlers                                                          */
    /* ------------------------------------------------------------------ */

    const handleExport = () => {
        const exportData = filteredExpenses.map(expense => ({
            "Item Name": expense.itemName,
            Event:
                eventNameMap.get(String(expense.eventID ?? "")) || expense.eventID || "",
            Amount:
                typeof expense.amount === "number" ? expense.amount : Number(expense.amount) || 0,
            Description:
                EXPENSE_TYPE_LABELS[expense.expenseDescription ?? ""] ||
                expense.expenseDescription ||
                "",
            Comments: expense.comments || "",
            POC: expense.poc || "",
            "Expense Status":
                EXPENSE_STATUS_META[String(expense.expenseStatus ?? "")]?.label ||
                expense.expenseStatus ||
                "",
            "Created Date": expense.createdDate ? formatShortDate(expense.createdDate) : "",
        }));
        downloadCSV(exportData, "expenses-export.csv");
    };

    /**
     * The backend requires an eventID for every expense, so a global create
     * needs an event to be chosen first. We surface that in a dedicated
     * selection modal rather than silently defaulting to an arbitrary event.
     */
    const handleCreateClick = () => {
        // Start from a clean selection so the user always confirms the event.
        setPickerEventID("");
        setEventPickerOpen(true);
    };

    /** Confirm the event selection and open the create form. */
    const handleEventConfirm = () => {
        if (!pickerEventID) {
            toast.error("Please select an event to add an expense to.");
            return;
        }
        setEventPickerOpen(false);
        openForm();
    };

    /** The event the form will attach the new expense to. */
    const formEventID = editingExpense?.eventID || pickerEventID;
    /* ------------------------------------------------------------------ */
    /*  Table                                                             */
    /* ------------------------------------------------------------------ */

    /** Extra column showing the event each expense belongs to. */
    const eventColumn = useMemo<Column<Expense>[]>(
        () => [
            {
                key: "event",
                header: "Event",
                render: item => {
                    const eventName =
                        eventNameMap.get(String(item.eventID ?? "")) || item.eventID || "—";
                    return (
                        <span className="block max-w-[160px] truncate" title={String(eventName)}>
                            {eventName}
                        </span>
                    );
                },
            },
        ],
        [eventNameMap],
    );

    return (
        <div className="flex flex-col gap-6 sm:gap-8">
            <PageHeader
                title="Expense Management"
                description="View and manage expenses across all events"
                actions={
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
                        <Button
                            variant="ghost"
                            onClick={handleExport}
                            icon={<Download size={16} />}
                            className="w-full sm:w-auto"
                            disabled={loading || filteredExpenses.length === 0}
                        >
                            Export
                        </Button>
                        <AccessButton
                            scope={["w:expenses"]}
                            className="w-full sm:w-auto"
                            onClick={handleCreateClick}
                            icon={<UserPlusIcon size={16} />}
                        >
                            Add Expense
                        </AccessButton>
                    </div>
                }
            />
            <div className="flex flex-col gap-4 sm:gap-1">
                <div className="rounded-lg bg-surface p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                type="text"
                                placeholder="Search by item, POC, comments or event..."
                                value={search}
                                onChange={event => {
                                    setSearch(event.target.value);
                                    setCurrentPage(1);
                                }}
                                className="h-10 pl-9"
                            />
                        </div>
                        <div className="sm:w-[240px]">
                            <Select
                                options={eventOptions}
                                value={filterEventOption ?? null}
                                placeholder="All Events"
                                isClearable={false}
                                isDisabled={eventsLoading}
                                onChange={option => {
                                    setFilterEventID(option?.value ?? "");
                                    setCurrentPage(1);
                                }}
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleResetFilters}
                            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                            title="Reset Filters"
                            disabled={loading}
                        >
                            <RefreshCw className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <div className="rounded-lg bg-surface p-4 sm:p-6 shadow-sm">
                    {loading ? (
                        <div className="flex min-h-[200px] items-center justify-center">
                            <Loading />
                        </div>
                    ) : error ? (
                        <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
                            <p className="text-sm text-muted-foreground">{error}</p>
                            <Button
                                variant="ghost"
                                onClick={() => refetch()}
                                icon={<RefreshCw size={16} />}
                            >
                                Try Again
                            </Button>
                        </div>
                    ) : (
                        <>
                            <ExpensesTable
                                data={pagedExpenses}
                                extraColumns={eventColumn}
                                onEdit={openForm}
                                onDelete={selectForDelete}
                                emptyMessage={
                                    expenses.length === 0
                                        ? "No expenses found."
                                        : "No expenses match your search."
                                }
                            />
                            {totalElements > 0 && (
                                <div className="mt-4">
                                    <Pagination
                                        pagination={pagination}
                                        onPageChange={handlePageChange}
                                    />
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Event picker: the backend requires an eventID for every expense. */}
            <Modal
                open={eventPickerOpen}
                onClose={() => setEventPickerOpen(false)}
                title="Select Event"
                description="Every expense must belong to an event. Choose the event to add this expense to."
                size="md"
            >
                <ModalBody>
                    <div className="flex flex-col gap-2">
                        <label
                            htmlFor="expense-event-select"
                            className="text-sm font-medium text-foreground"
                        >
                            Event <span className="text-error">*</span>
                        </label>
                        <Select
                            inputId="expense-event-select"
                            options={eventOptions.filter(option => option.value !== "")}
                            value={pickerEventOption?.value ? pickerEventOption : null}
                            placeholder="Select an event"
                            isSearchable
                            isDisabled={eventsLoading || events.length === 0}
                            onChange={option => setPickerEventID(option?.value ?? "")}
                        />
                        {events.length === 0 && !eventsLoading && (
                            <p className="text-xs text-muted-foreground">
                                No events available. Create an event before adding an expense.
                            </p>
                        )}
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button variant="ghost" onClick={() => setEventPickerOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleEventConfirm}
                        disabled={!pickerEventID}
                        icon={<UserPlusIcon size={16} />}
                    >
                        Continue
                    </Button>
                </ModalFooter>
            </Modal>

            <ExpensesModal
                key={editingExpense ? (editingExpense.id ?? "edit") : "create"}
                isOpen={formOpen}
                onClose={closeForm}
                eventData={{ id: formEventID }}
                eventID={formEventID || undefined}
                onSave={handleFormSaved}
                editingExpense={editingExpense}
            />

            <ConfirmationModal
                open={!!deleteTarget}
                onClose={cancelDelete}
                onConfirm={confirmDelete}
                title="Delete Expense"
                description={
                    deleteTarget
                        ? `Are you sure you want to delete "${
                              deleteTarget.itemName || "this expense"
                          }"? This action cannot be undone.`
                        : undefined
                }
                confirmText={deleting ? "Deleting..." : "Delete"}
                cancelText="Cancel"
                variant="destructive"
                isLoading={deleting}
            />
        </div>
    );
}
