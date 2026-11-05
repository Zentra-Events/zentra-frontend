"use client";

import { useEffect, useRef, useState } from "react";
import { Formik, Form, FormikProps } from "formik";
import * as Yup from "yup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Table, type Column } from "@/components/ui/table";
import { FormikFieldInput } from "@/components/ui/formik-field-input";
import { FormikFieldSelect } from "@/components/ui/formik-field-select";
import { FormikFieldTextArea } from "@/components/ui/formik-field-textarea";
import { TrashIcon, PlusIcon } from "@/components/ui/icons";
import { apiRequest } from "@/lib/api/api-client";

type EstimateLine = {
    id: string;
    category: string;
    item: string;
    specification: string;
    days: number;
    sqft: number;
    rate: number;
};

type Props = {
    open: boolean;
    onClose: () => void;
    onSave: (row: {
        eventName: string;
        enquiryDate: string;
        clientPoc: string;
        status: "In Progress" | "Not Started" | "Completed";
        gst?: string;
        items?: EstimateLine[];
    }) => void;
};

const validationSchema = Yup.object({
    eventName: Yup.string().required("Event name is required"),
    dateFrom: Yup.string().required("Start date is required"),
});

export default function CreateChecklistModal({ open, onClose, onSave }: Props) {
    const [events, setEvents] = useState<
        Array<{ eventName: string; id: string; clientId?: string; clientName?: string }>
    >([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [loadingEstimate, setLoadingEstimate] = useState(false);
    // selectedEventId not needed for now
    const [lines, setLines] = useState<EstimateLine[]>([]);
    const formikRef = useRef<FormikProps<FormValues> | null>(null);

    const generateId = () => {
        return `id-${Math.random().toString(36).slice(2, 10)}`;
    };

    type FormValues = {
        eventId: string;
        eventName: string;
        clientId: string;
        clientName: string;
        clientPoc: string;
        dateFrom: string;
        dateTo: string;
        fromDateTime: string;
        toDateTime: string;
        venue: string;
        description: string;
        gst: string;
    };

    // Helper to format a date string to YYYY-MM-DDTHH:mm for datetime-local inputs
    const formatDateForInput = (dateStr?: string) => {
        if (!dateStr) return "";
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return "";
            const iso = d.toISOString();
            return iso.slice(0, 16); // YYYY-MM-DDTHH:mm
        } catch {
            return "";
        }
    };

    useEffect(() => {
        if (!open) return;
        // fetch events once when modal opens
        const fetchEvents = async () => {
            try {
                setLoadingEvents(true);
                const res = await apiRequest("/api/events/names");
                if (!res.ok) throw new Error("Failed to fetch events");
                const data = await res.json();
                // Expecting [{ eventName, id, clientId, clientName }, ...]
                if (Array.isArray(data)) {
                    const payload = data as unknown;
                    if (Array.isArray(payload)) {
                        const mapped = payload.map(d => {
                            const rec = d as Record<string, unknown>;
                            const eventName = String(
                                rec["eventName"] ?? rec["title"] ?? rec["name"] ?? "",
                            );
                            const id = String(rec["id"] ?? "");
                            const clientId = String(
                                rec["clientId"] ??
                                    (rec["client"] &&
                                        (rec["client"] as Record<string, unknown>)["id"]) ??
                                    "",
                            );
                            const clientName = String(
                                rec["clientName"] ??
                                    (rec["client"] &&
                                        (rec["client"] as Record<string, unknown>)["name"]) ??
                                    "",
                            );
                            return { eventName, id, clientId, clientName };
                        });
                        setEvents(mapped);
                    } else {
                        setEvents([]);
                    }
                } else {
                    setEvents([]);
                }
            } catch (err) {
                console.error("Failed to load events", err);
                setEvents([]);
            } finally {
                setLoadingEvents(false);
            }
        };
        fetchEvents();
        // reset lines
        setLines([
            {
                id: generateId(),
                category: "General",
                item: "New item",
                specification: "",
                days: 1,
                sqft: 1,
                rate: 0,
            },
        ]);
    }, [open]);

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Create Checklist"
            description="Select an event & client to prefill checklist. Other fields will be locked."
            size="xxl"
        >
            {loadingEstimate && (
                <div className="absolute inset-0 bg-black/10 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="h-6 w-6 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
                        <div className="text-sm text-gray-700">Loading estimate…</div>
                    </div>
                </div>
            )}
            <Formik<FormValues>
                innerRef={formikRef}
                initialValues={{
                    eventId: "",
                    eventName: "",
                    clientId: "",
                    clientName: "",
                    clientPoc: "",
                    dateFrom: "",
                    dateTo: "",
                    fromDateTime: "",
                    toDateTime: "",
                    venue: "",
                    description: "",
                    gst: "",
                }}
                validationSchema={validationSchema}
                onSubmit={async (values, { setSubmitting }) => {
                    setSubmitting(true);
                    try {
                        const v = values as FormValues;
                        // build items payload grouped by category
                        const itemsPayload: Record<string, Array<Record<string, unknown>>> = {};
                        lines.forEach((ln, idx) => {
                            const cat = ln.category || "General";
                            if (!itemsPayload[cat]) itemsPayload[cat] = [];
                            const count =
                                Number.isFinite(Number(ln.days)) && Number.isFinite(Number(ln.sqft))
                                    ? Math.max(1, ln.days * ln.sqft)
                                    : ln.days || 1;
                            itemsPayload[cat].push({
                                item: ln.item || "Item",
                                serialNumber: idx + 1,
                                count,
                                pricePerItem: ln.rate || 0,
                                description: ln.specification || undefined,
                                days: ln.days || undefined,
                            });
                        });

                        const payload = {
                            highlvelRequirement: v.description || "",
                            enquiryDate: v.fromDateTime || v.dateFrom || undefined,
                            fromDate: v.fromDateTime || v.dateFrom || undefined,
                            toDate: v.toDateTime || v.dateTo || undefined,
                            status: "OPEN",
                            venue: v.venue || "",
                            clientPoC: v.clientPoc || "",
                            pocContactNumber: "",
                            enquiryPoC: undefined,
                            client: { id: v.clientId || "" },
                            items: itemsPayload,
                            enquiryId: v.eventId || "",
                            title: v.eventName || undefined,
                        };

                        // send to backend via API proxy
                        const res = await apiRequest("/api/estimates", {
                            method: "POST",
                            body: JSON.stringify(payload),
                        });
                        if (!res.ok) {
                            const txt = await res.text();
                            console.error("Failed to save estimate", res.status, txt);
                            // still call onSave locally so UI shows the checklist
                            onSave({
                                eventName: v.eventName,
                                enquiryDate: v.fromDateTime || v.dateFrom || "-",
                                clientPoc: v.clientPoc || v.clientName || "-",
                                status: "Not Started",
                                gst: v.gst || undefined,
                                items: lines,
                            });
                            setSubmitting(false);
                            return;
                        }

                        // Call onSave to update client-side listing and close modal
                        onSave({
                            eventName: v.eventName,
                            enquiryDate: v.fromDateTime || v.dateFrom || "-",
                            clientPoc: v.clientPoc || v.clientName || "-",
                            status: "Not Started",
                            gst: v.gst || undefined,
                            items: lines,
                        });
                        // close modal on success
                        onClose();
                    } catch (err) {
                        console.error("Error saving estimate", err);
                    } finally {
                        setSubmitting(false);
                    }
                }}
            >
                {({ isSubmitting, setFieldValue, _values }) => (
                    <Form>
                        <ModalBody className="max-h-[60vh] overflow-y-auto px-0">
                            <div className="pt-2 space-y-4">
                                <div>
                                    <FormikFieldSelect
                                        name="eventId"
                                        label="Event (Client — Event)"
                                        options={[
                                            { label: "-- Select event --", value: "" },
                                            ...(loadingEvents
                                                ? [{ label: "Loading...", value: "" }]
                                                : events.map(ev => {
                                                      const clientName =
                                                          typeof ev.clientName === "string"
                                                              ? ev.clientName
                                                              : "";
                                                      const label = `${
                                                          clientName ? clientName + " · " : ""
                                                      }${ev.eventName || "Untitled"}`;
                                                      return {
                                                          label,
                                                          value: String(ev.id),
                                                      };
                                                  })),
                                        ]}
                                        placeholder="Select an event"
                                        isDisabled={loadingEvents}
                                        selectClassName="mt-1"
                                        onChange={async e => {
                                            const id = e.target.value;
                                            setFieldValue("eventId", id);
                                            if (formikRef.current)
                                                formikRef.current.setFieldValue("eventId", id);
                                            const ev = events.find(
                                                x => String(x.id) === String(id),
                                            );
                                            if (ev) {
                                                setFieldValue("eventName", ev.eventName || "");
                                                setFieldValue("clientId", ev.clientId || "");
                                                setFieldValue("clientName", ev.clientName || "");
                                                if (formikRef.current) {
                                                    formikRef.current.setFieldValue(
                                                        "eventName",
                                                        ev.eventName || "",
                                                    );
                                                    formikRef.current.setFieldValue(
                                                        "clientId",
                                                        ev.clientId || "",
                                                    );
                                                    formikRef.current.setFieldValue(
                                                        "clientName",
                                                        ev.clientName || "",
                                                    );
                                                }
                                            }

                                            if (!id) return;

                                            setFieldValue("dateFrom", "");
                                            setFieldValue("dateTo", "");
                                            setFieldValue("fromDateTime", "");
                                            setFieldValue("toDateTime", "");
                                            setFieldValue("venue", "");
                                            setFieldValue("description", "");
                                            setFieldValue("clientPoc", "");
                                            if (formikRef.current) {
                                                formikRef.current.setFieldValue("dateFrom", "");
                                                formikRef.current.setFieldValue("dateTo", "");
                                                formikRef.current.setFieldValue("fromDateTime", "");
                                                formikRef.current.setFieldValue("toDateTime", "");
                                                formikRef.current.setFieldValue("venue", "");
                                                formikRef.current.setFieldValue("description", "");
                                                formikRef.current.setFieldValue("clientPoc", "");
                                            }
                                            setLines([
                                                {
                                                    id: generateId(),
                                                    category: "General",
                                                    item: "Loading...",
                                                    specification: "",
                                                    days: 0,
                                                    sqft: 0,
                                                    rate: 0,
                                                },
                                            ]);

                                            setLoadingEstimate(true);
                                            try {
                                                const res = await apiRequest(
                                                    `/api/events/${encodeURIComponent(id)}/estimate`,
                                                );
                                                if (!res.ok) {
                                                    console.warn(
                                                        "Estimate fetch failed",
                                                        res.status,
                                                    );
                                                    return;
                                                }
                                                const data = await res.json();

                                                // Prefill date/venue/description/client POC and datetime fields
                                                const from = String(
                                                    data.fromDate ?? data.enquiryDate ?? "",
                                                );
                                                const to = String(data.toDate ?? data.to ?? "");
                                                // date inputs expect YYYY-MM-DD — extract date part if ISO datetime provided
                                                const extractDateOnly = (s: string) => {
                                                    if (!s) return "";
                                                    // if contains T, take left side
                                                    if (s.includes("T")) return s.split("T")[0];
                                                    // if ISO with timezone Z or offset, try to parse
                                                    try {
                                                        const d = new Date(s);
                                                        if (!isNaN(d.getTime()))
                                                            return d.toISOString().slice(0, 10);
                                                    } catch {}
                                                    return s;
                                                };
                                                // extract date-only (unused variable removed)
                                                extractDateOnly(from);
                                                extractDateOnly(to);
                                                // set datetime-local formatted values for dateFrom/dateTo
                                                const dtFrom = formatDateForInput(from);
                                                const dtTo = formatDateForInput(to);
                                                setFieldValue("dateFrom", dtFrom);
                                                setFieldValue("dateTo", dtTo);
                                                // keep full datetime in the datetime fields as ISO
                                                setFieldValue("fromDateTime", from);
                                                setFieldValue("toDateTime", to);
                                                if (formikRef.current) {
                                                    formikRef.current.setFieldValue(
                                                        "dateFrom",
                                                        dtFrom,
                                                    );
                                                    formikRef.current.setFieldValue("dateTo", dtTo);
                                                    formikRef.current.setFieldValue(
                                                        "fromDateTime",
                                                        from,
                                                    );
                                                    formikRef.current.setFieldValue(
                                                        "toDateTime",
                                                        to,
                                                    );
                                                }
                                                setFieldValue("venue", String(data.venue ?? ""));
                                                setFieldValue(
                                                    "description",
                                                    String(
                                                        data.highlvelRequirement ??
                                                            data.description ??
                                                            "",
                                                    ),
                                                );
                                                setFieldValue(
                                                    "clientPoc",
                                                    String(data.clientPoC ?? data.enquiryPoC ?? ""),
                                                );
                                                // formikRef was already updated above with the correct formatted values;
                                                // avoid overwriting datetime-local fields with raw ISO strings which
                                                // do not display in datetime-local inputs.

                                                // Build lines from data.items (object of category arrays)
                                                const itemsObj = data.items || {};
                                                const newLines: typeof lines = [];
                                                Object.entries(itemsObj).forEach(
                                                    ([category, arr]) => {
                                                        if (!Array.isArray(arr)) return;
                                                        arr.forEach(raw => {
                                                            const it = raw as Record<
                                                                string,
                                                                unknown
                                                            >;
                                                            const name = String(
                                                                it["name"] ?? it["item"] ?? "",
                                                            );
                                                            const qty =
                                                                Number(
                                                                    it["quantity"] ??
                                                                        it["qty"] ??
                                                                        it["days"] ??
                                                                        1,
                                                                ) || 1;
                                                            const rate =
                                                                Number(
                                                                    it["rate"] ?? it["price"] ?? 0,
                                                                ) || 0;
                                                            const sqft =
                                                                Number(it["sqft"] ?? 1) || 1;
                                                            newLines.push({
                                                                id: generateId(),
                                                                category: category || "General",
                                                                item: name,
                                                                specification: String(
                                                                    it["specification"] ?? "",
                                                                ),
                                                                days: qty,
                                                                sqft,
                                                                rate,
                                                            });
                                                        });
                                                    },
                                                );

                                                if (newLines.length > 0) setLines(newLines);
                                            } catch (err) {
                                                console.error(
                                                    "Failed to fetch estimate for event",
                                                    id,
                                                    err,
                                                );
                                            } finally {
                                                setLoadingEstimate(false);
                                            }
                                        }}
                                    />
                                </div>

                                {/* Prefilled, read-only fields (show skeleton while estimate is loading) */}
                                {loadingEstimate ? (
                                    <div className="space-y-4 animate-pulse">
                                        <div className="h-6 bg-gray-200 rounded w-1/3" />
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="h-10 bg-gray-200 rounded" />
                                            <div className="h-10 bg-gray-200 rounded" />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="h-10 bg-gray-200 rounded" />
                                            <div className="h-10 bg-gray-200 rounded" />
                                        </div>
                                        <div className="h-10 bg-gray-200 rounded" />
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormikFieldInput
                                                name="eventName"
                                                label="Event Name"
                                                placeholder="Event name"
                                                inputClassName="mt-1"
                                                disabled
                                            />
                                            <FormikFieldInput
                                                name="clientName"
                                                label="Client"
                                                placeholder="Client"
                                                inputClassName="mt-1"
                                                disabled
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormikFieldInput
                                                name="dateFrom"
                                                label="From (date & time)"
                                                type="datetime-local"
                                                inputClassName="mt-1"
                                                disabled
                                            />
                                            <FormikFieldInput
                                                name="dateTo"
                                                label="To (date & time)"
                                                type="datetime-local"
                                                inputClassName="mt-1"
                                                disabled
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormikFieldInput
                                                name="fromDateTime"
                                                label="From (date & time)"
                                                placeholder="From date time"
                                                inputClassName="mt-1"
                                                disabled
                                            />
                                            <FormikFieldInput
                                                name="toDateTime"
                                                label="To (date & time)"
                                                placeholder="To date time"
                                                inputClassName="mt-1"
                                                disabled
                                            />
                                        </div>

                                        <FormikFieldInput
                                            name="clientPoc"
                                            label="Client POC"
                                            placeholder="Client POC"
                                            inputClassName="mt-1"
                                            disabled
                                        />

                                        <FormikFieldInput
                                            name="venue"
                                            label="Venue"
                                            placeholder="Venue"
                                            inputClassName="mt-1"
                                            disabled
                                        />

                                        <FormikFieldTextArea
                                            name="description"
                                            label="Description"
                                            placeholder="Description"
                                            textareaClassName="mt-1 h-24"
                                            disabled
                                        />

                                        <FormikFieldInput
                                            name="gst"
                                            label="GST"
                                            placeholder="GST number"
                                            inputClassName="mt-1"
                                        />
                                    </>
                                )}

                                {/* Artifacts required section (editable) */}
                                <section className="border-t border-border pt-3 mt-2">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between mb-3">
                                        <div>
                                            <h3 className="text-base font-semibold text-gray-900">
                                                Elements required
                                            </h3>
                                            <p className="text-xs text-muted-foreground">
                                                List the services, equipment, and resources needed.
                                            </p>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setLines(prev => [
                                                    ...prev,
                                                    {
                                                        id: generateId(),
                                                        category:
                                                            prev.length > 0
                                                                ? prev[prev.length - 1].category
                                                                : "General",
                                                        item: "",
                                                        specification: "",
                                                        days: 1,
                                                        sqft: 1,
                                                        rate: 0,
                                                    },
                                                ])
                                            }
                                        >
                                            <PlusIcon size={16} className="mr-1" />
                                            Add Item
                                        </Button>
                                    </div>

                                    <div className="overflow-x-auto">
                                        <Table
                                            data={lines}
                                            showRowNumbers
                                            emptyMessage='No items added yet. Click "Add Item" to get started.'
                                            columns={
                                                [
                                                    {
                                                        key: "category",
                                                        header: "Category",
                                                        render: (_, index) => (
                                                            <Input
                                                                value={lines[index]?.category || ""}
                                                                onChange={e =>
                                                                    setLines(prev =>
                                                                        prev.map((l, idx) =>
                                                                            idx === index
                                                                                ? {
                                                                                      ...l,
                                                                                      category:
                                                                                          e.target
                                                                                              .value,
                                                                                  }
                                                                                : l,
                                                                        ),
                                                                    )
                                                                }
                                                                placeholder="Category"
                                                            />
                                                        ),
                                                    },
                                                    {
                                                        key: "item",
                                                        header: "Item",
                                                        render: (_, index) => (
                                                            <Input
                                                                value={lines[index]?.item || ""}
                                                                onChange={e =>
                                                                    setLines(prev =>
                                                                        prev.map((l, idx) =>
                                                                            idx === index
                                                                                ? {
                                                                                      ...l,
                                                                                      item: e.target
                                                                                          .value,
                                                                                  }
                                                                                : l,
                                                                        ),
                                                                    )
                                                                }
                                                                placeholder="Item name"
                                                            />
                                                        ),
                                                    },
                                                    {
                                                        key: "specification",
                                                        header: "Specification",
                                                        cellClassName: "w-48",
                                                        render: (_, index) => (
                                                            <Input
                                                                value={
                                                                    lines[index]?.specification ||
                                                                    ""
                                                                }
                                                                onChange={e =>
                                                                    setLines(prev =>
                                                                        prev.map((l, idx) =>
                                                                            idx === index
                                                                                ? {
                                                                                      ...l,
                                                                                      specification:
                                                                                          e.target
                                                                                              .value,
                                                                                  }
                                                                                : l,
                                                                        ),
                                                                    )
                                                                }
                                                                placeholder="Item specification (optional)"
                                                                className="text-center"
                                                            />
                                                        ),
                                                    },
                                                    {
                                                        key: "days",
                                                        header: "Days",
                                                        align: "center",
                                                        cellClassName: "w-20",
                                                        render: (_, index) => (
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                value={lines[index]?.days || 1}
                                                                onChange={e => {
                                                                    const v = Number(
                                                                        e.target.value,
                                                                    );
                                                                    setLines(prev =>
                                                                        prev.map((l, idx) =>
                                                                            idx === index
                                                                                ? {
                                                                                      ...l,
                                                                                      days: Number.isNaN(
                                                                                          v,
                                                                                      )
                                                                                          ? 1
                                                                                          : v,
                                                                                  }
                                                                                : l,
                                                                        ),
                                                                    );
                                                                }}
                                                                className="text-center"
                                                            />
                                                        ),
                                                    },
                                                    {
                                                        key: "sqft",
                                                        header: "SqFt",
                                                        align: "center",
                                                        cellClassName: "w-20",
                                                        render: (_, index) => (
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                value={lines[index]?.sqft || 1}
                                                                onChange={e => {
                                                                    const v = Number(
                                                                        e.target.value,
                                                                    );
                                                                    setLines(prev =>
                                                                        prev.map((l, idx) =>
                                                                            idx === index
                                                                                ? {
                                                                                      ...l,
                                                                                      sqft: Number.isNaN(
                                                                                          v,
                                                                                      )
                                                                                          ? 1
                                                                                          : v,
                                                                                  }
                                                                                : l,
                                                                        ),
                                                                    );
                                                                }}
                                                                className="text-center"
                                                            />
                                                        ),
                                                    },
                                                    {
                                                        key: "rate",
                                                        header: "Rate",
                                                        align: "right",
                                                        cellClassName: "w-24",
                                                        render: (_, index) => (
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={lines[index]?.rate || 0}
                                                                onChange={e => {
                                                                    const v = Number(
                                                                        e.target.value,
                                                                    );
                                                                    setLines(prev =>
                                                                        prev.map((l, idx) =>
                                                                            idx === index
                                                                                ? {
                                                                                      ...l,
                                                                                      rate: Number.isNaN(
                                                                                          v,
                                                                                      )
                                                                                          ? 0
                                                                                          : v,
                                                                                  }
                                                                                : l,
                                                                        ),
                                                                    );
                                                                }}
                                                                className="text-right"
                                                            />
                                                        ),
                                                    },
                                                    {
                                                        key: "total",
                                                        header: "Total",
                                                        align: "right",
                                                        cellClassName: "w-28 font-semibold",
                                                        render: (_, index) => (
                                                            <span className="text-sm">
                                                                ₹
                                                                {(
                                                                    lines[index]?.days *
                                                                    lines[index]?.sqft *
                                                                    lines[index]?.rate
                                                                ).toFixed(2)}
                                                            </span>
                                                        ),
                                                    },
                                                    {
                                                        key: "actions",
                                                        header: "",
                                                        align: "right",
                                                        cellClassName: "text-right w-16",
                                                        render: (_, index) => (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                                                                onClick={() =>
                                                                    setLines(prev =>
                                                                        prev.filter(
                                                                            (_, idx) =>
                                                                                idx !== index,
                                                                        ),
                                                                    )
                                                                }
                                                            >
                                                                <TrashIcon size={16} />
                                                            </Button>
                                                        ),
                                                    },
                                                ] as Column<EstimateLine>[]
                                            }
                                        />
                                    </div>
                                </section>
                            </div>
                        </ModalBody>
                        <ModalFooter>
                            <Button
                                variant="outline"
                                onClick={onClose}
                                type="button"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting || loadingEstimate || loadingEvents}
                            >
                                {isSubmitting
                                    ? "Saving..."
                                    : loadingEstimate || loadingEvents
                                      ? "Working..."
                                      : "Save"}
                            </Button>
                        </ModalFooter>
                    </Form>
                )}
            </Formik>
        </Modal>
    );
}
