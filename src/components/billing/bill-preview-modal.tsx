"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";

import { Modal, ModalBody, ModalFooter } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { BillItemsTable, type BillItemRow } from "./bill-items-table";
import { BillTotalsCard } from "./bill-totals-card";
import { downloadBillPdf } from "@/lib/billing-export/bill-pdf";
import {
    buildBillDocumentModel,
    type BillDocumentConfig,
} from "@/lib/billing-export/bill-document";
import { formatExportCurrency } from "@/lib/utils";

interface BillPreviewModalProps {
    open: boolean;
    onClose: () => void;
    /** The document model rendered by the preview and by the PDF export. */
    config: BillDocumentConfig;
    title: string;
    description?: string;
    items: BillItemRow[];
}

/**
 * Preview of a bill.
 *
 * The preview and the PDF export share the same document configuration, so
 * what is shown here is exactly what the downloaded document contains.
 */
export function BillPreviewModal({
    open,
    onClose,
    config,
    title,
    description,
    items,
}: BillPreviewModalProps) {
    const [downloading, setDownloading] = useState(false);

    // The document model is the single source of truth for the preview and
    // for the exported PDF.
    const model = useMemo(() => buildBillDocumentModel(config), [config]);

    const handleDownload = async () => {
        if (downloading) return;
        setDownloading(true);
        try {
            await downloadBillPdf(config);
            toast.success("Bill PDF downloaded");
        } catch (error) {
            console.error("Failed to download bill PDF:", error);
            toast.error("Failed to download the bill PDF. Please try again.");
        } finally {
            setDownloading(false);
        }
    };

    return (
        <Modal
            open={open}
            onClose={onClose}
            size="xxl"
            title={title}
            description={description}
            showCloseIcon
            closeOnEscape
        >
            <ModalBody className="space-y-5">
                <div className="rounded-lg border border-border bg-surface p-4">
                    <div className="border-b border-border pb-3 text-center">
                        <h3 className="text-base font-semibold text-foreground">{model.title}</h3>
                        {model.subtitle && (
                            <p className="text-xs text-muted-foreground mt-0.5">{model.subtitle}</p>
                        )}
                        {(model.billNumber || model.billDate) && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                                {model.billNumber && <>Bill No: {model.billNumber}</>}
                                {model.billNumber && model.billDate && " • "}
                                {model.billDate && <>Date: {model.billDate}</>}
                            </p>
                        )}
                    </div>

                    <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                        {model.meta.map(entry => (
                            <div key={entry.label} className="flex gap-2 text-xs">
                                <dt className="font-semibold text-foreground shrink-0">
                                    {entry.label} :
                                </dt>
                                <dd className="text-muted-foreground break-words">
                                    {entry.value || "—"}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>

                <BillItemsTable items={items} emptyMessage="This bill has no line items." />

                <BillTotalsCard
                    title="Bill Summary"
                    rows={model.summary.map(row => ({
                        label: row.label,
                        value: row.value,
                        emphasis:
                            row.variant === "total" || row.variant === "outstanding"
                                ? "total"
                                : undefined,
                        deduction: row.variant === "deduction" ? true : undefined,
                    }))}
                    footer={
                        <span>
                            Amount in words:{" "}
                            <span className="font-medium text-foreground">
                                {model.amountInWords}
                            </span>
                        </span>
                    }
                />

                {model.summary.length > 0 && (
                    <p className="text-[11px] text-muted-foreground">
                        Total bill value:{" "}
                        {formatExportCurrency(
                            model.summary.find(row => row.variant === "total")?.value ?? 0,
                        )}
                    </p>
                )}
            </ModalBody>

            <ModalFooter className="flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[11px] text-muted-foreground">
                    Generated from the current event data. Review before issuing.
                </p>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={onClose}>
                        Close
                    </Button>
                    <Button
                        size="sm"
                        icon={<Download size={14} />}
                        isLoading={downloading}
                        disabled={downloading}
                        onClick={handleDownload}
                    >
                        Download PDF
                    </Button>
                </div>
            </ModalFooter>
        </Modal>
    );
}
