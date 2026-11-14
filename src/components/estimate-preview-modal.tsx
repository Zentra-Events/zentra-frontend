"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { FileSpreadsheet, FileText } from "lucide-react";
import type { EstimateDto } from "@/types/estimate";
import { Button, Modal, ModalBody, ModalFooter, Textarea } from "./ui";
import {
    buildEstimateDocumentModel,
    formatExportCurrency,
    getItemAmount,
    getItemDetails,
    getItemName,
    getItemRate,
    type EstimateExportRow,
} from "@/lib/estimate-export/estimate-document";
import { downloadEstimateExcel } from "@/lib/estimate-export/estimate-excel";
import { downloadEstimatePdf } from "@/lib/estimate-export/estimate-pdf";
import { toast } from "sonner";

const DEFAULT_TERMS =
    "1. Payment Terms: 50% advance payment is required to confirm the booking. The remaining 50% to be paid on or before the day of the event.\n\n2. Cancellation Policy: In case of cancellation, the advance payment shall be non-refundable. Any changes to the event date must be communicated at least 7 days prior.\n\n3. Liability: The event management team shall not be held liable for any delays or damages caused by force majeure events including but not limited to natural disasters, government restrictions, or acts of God.\n\n4. Additional Charges: Any additional items or services requested after the finalization of the estimate will be charged extra at prevailing rates.\n\n5. Setup & Breakdown: The client shall provide adequate space and access for setup and breakdown of equipment. Any damages to venue property caused by our equipment shall be assessed and charged separately.";

interface EstimatePreviewModalProps {
    estimate: EstimateDto;
    eventName?: string;
    onClose: () => void;
}

const previewStyles = {
    titleBg: "bg-[#e6e0f8]",
    headerBg: "bg-[#e6e0f8]",
    categoryBg: "bg-[#d9ead3]",
    subCategoryBg: "bg-[#eef5ea]",
    totalBg: "bg-[#b4c6e7]",
    subTotalBg: "bg-[#fff2cc]",
    summaryBg: "bg-[#e6e0f8]",
} as const;

function summaryRowClass(variant: Extract<EstimateExportRow, { type: "summary" }>["variant"]) {
    if (variant === "total" || variant === "service") return previewStyles.totalBg;
    if (variant === "subtotal") return previewStyles.subTotalBg;
    return previewStyles.summaryBg;
}

function EstimatePreviewTable({ rows }: { rows: EstimateExportRow[] }) {
    const tableRows = rows.filter(
        r =>
            r.type === "category" ||
            r.type === "subCategory" ||
            r.type === "item" ||
            r.type === "summary" ||
            r.type === "table-header",
    );

    if (!tableRows.some(r => r.type === "table-header")) return null;

    return (
        <table className="w-full border-collapse text-xs border border-black">
            <thead>
                <tr className={previewStyles.headerBg}>
                    {["Sl. No", "Elements", "Details", "nos", "Rate", "Amount"].map(header => (
                        <th
                            key={header}
                            className="border border-black px-2 py-2 text-center font-bold"
                        >
                            {header}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {tableRows
                    .filter(r => r.type !== "table-header")
                    .map((row, index) => {
                        if (row.type === "category") {
                            return (
                                <tr key={`cat-${index}`} className={previewStyles.categoryBg}>
                                    <td className="border border-black px-2 py-2 text-center font-medium">
                                        {row.serial}
                                    </td>
                                    <td
                                        colSpan={5}
                                        className="border border-black px-2 py-2 font-bold"
                                    >
                                        {row.name}
                                    </td>
                                </tr>
                            );
                        }
                        if (row.type === "subCategory") {
                            return (
                                <tr key={`sub-${index}`} className={previewStyles.subCategoryBg}>
                                    <td className="border border-black px-2 py-2" />
                                    <td
                                        colSpan={5}
                                        className="border border-black px-2 py-2 font-semibold"
                                    >
                                        Sub Category: {row.name}
                                    </td>
                                </tr>
                            );
                        }
                        if (row.type === "item") {
                            const item = row.item;
                            return (
                                <tr key={`item-${index}`}>
                                    <td className="border border-black px-2 py-2 text-center align-top">
                                        {row.serial}
                                    </td>
                                    <td className="border border-black px-2 py-2 align-top">
                                        {getItemName(item)}
                                    </td>
                                    <td className="border border-black px-2 py-2 align-top whitespace-pre-wrap">
                                        {getItemDetails(item)}
                                    </td>
                                    <td className="border border-black px-2 py-2 text-right align-top">
                                        {item.quantity ?? 0}
                                    </td>
                                    <td className="border border-black px-2 py-2 text-right align-top">
                                        {formatExportCurrency(getItemRate(item))}
                                    </td>
                                    <td className="border border-black px-2 py-2 text-right align-top">
                                        {formatExportCurrency(getItemAmount(item))}
                                    </td>
                                </tr>
                            );
                        }
                        if (row.type === "summary") {
                            const bold = row.variant === "subtotal" || row.variant === "grand";
                            return (
                                <tr key={`sum-${index}`} className={summaryRowClass(row.variant)}>
                                    <td className="border border-black px-2 py-2" />
                                    <td
                                        colSpan={4}
                                        className={`border border-black px-2 py-2 ${bold ? "font-bold" : ""}`}
                                    >
                                        {row.label}
                                    </td>
                                    <td
                                        className={`border border-black px-2 py-2 text-right ${bold ? "font-bold" : ""}`}
                                    >
                                        {formatExportCurrency(row.value)}
                                    </td>
                                </tr>
                            );
                        }
                        return null;
                    })}
            </tbody>
        </table>
    );
}

function EstimateHeaderSection({ rows }: { rows: EstimateExportRow[] }) {
    const titleRow = rows.find(
        (r): r is Extract<EstimateExportRow, { type: "title" }> => r.type === "title",
    );
    const metaRows = rows.filter(
        (r): r is Extract<EstimateExportRow, { type: "meta" }> => r.type === "meta",
    );

    if (!titleRow && metaRows.length === 0) return null;

    return (
        <div className="mb-4">
            {titleRow && (
                <div
                    className={`${previewStyles.titleBg} py-3 text-center font-bold text-base rounded-t`}
                >
                    {titleRow.text}
                </div>
            )}
            {metaRows.length > 0 && (
                <div className="flex gap-6 pt-2 items-stretch">
                    <div className="flex-1 space-y-1 min-w-0">
                        {metaRows.map((row, index) => (
                            <div
                                key={`${row.label}-${index}`}
                                className="grid grid-cols-[minmax(140px,auto)_1fr] gap-x-2"
                            >
                                <span className="font-semibold shrink-0">{row.label} :</span>
                                <span>{row.value}</span>
                            </div>
                        ))}
                    </div>
                    <div className="w-[120px] shrink-0 flex items-center justify-center">
                        <Image
                            src="/logo.svg"
                            alt="Company logo"
                            width={100}
                            height={48}
                            className="object-contain max-h-20 w-auto"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

function EstimatePreviewContent({ rows }: { rows: EstimateExportRow[] }) {
    const blocks = useMemo(() => {
        const result: { type: "table" | "section"; rows: EstimateExportRow[] }[] = [];
        let currentTable: EstimateExportRow[] = [];

        rows.forEach(row => {
            if (row.type === "title" || row.type === "meta") {
                return;
            }
            if (row.type === "section-title") {
                if (currentTable.length > 0) {
                    result.push({ type: "table", rows: currentTable });
                    currentTable = [];
                }
                result.push({ type: "section", rows: [row] });
            } else if (
                row.type === "table-header" ||
                row.type === "category" ||
                row.type === "subCategory" ||
                row.type === "item" ||
                row.type === "summary"
            ) {
                currentTable.push(row);
            }
        });

        if (currentTable.length > 0) {
            result.push({ type: "table", rows: currentTable });
        }

        return result;
    }, [rows]);

    return (
        <div className="space-y-3 font-sans text-sm text-gray-900">
            <EstimateHeaderSection rows={rows} />
            {blocks.map((block, blockIndex) => {
                if (block.type === "section") {
                    const row = block.rows[0];
                    if (row.type === "section-title") {
                        return (
                            <p key={blockIndex} className="font-bold mt-4">
                                {row.text}
                            </p>
                        );
                    }
                }
                return <EstimatePreviewTable key={blockIndex} rows={block.rows} />;
            })}
        </div>
    );
}

export function EstimatePreviewModal({ estimate, eventName, onClose }: EstimatePreviewModalProps) {
    const [downloading, setDownloading] = useState<"pdf" | "excel" | null>(null);
    const [terms, setTerms] = useState(DEFAULT_TERMS);
    const [termsError, setTermsError] = useState<string | null>(null);
    const model = useMemo(
        () => buildEstimateDocumentModel(estimate, eventName),
        [estimate, eventName],
    );

    const validateTerms = (): boolean => {
        if (!terms.trim()) {
            setTermsError("Terms & Conditions are required");
            return false;
        }
        setTermsError(null);
        return true;
    };

    const handleDownloadPdf = async () => {
        if (!validateTerms()) return;
        try {
            setDownloading("pdf");
            await downloadEstimatePdf(estimate, eventName, terms);
            toast.success("PDF downloaded");
        } catch (error) {
            console.error(error);
            toast.error("Failed to download PDF");
        } finally {
            setDownloading(null);
        }
    };

    const handleDownloadExcel = async () => {
        if (!validateTerms()) return;
        try {
            setDownloading("excel");
            await downloadEstimateExcel(estimate, eventName, terms);
            toast.success("Excel downloaded");
        } catch (error) {
            console.error(error);
            toast.error("Failed to download Excel");
        } finally {
            setDownloading(null);
        }
    };

    const handleTermsChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setTerms(e.target.value);
        if (termsError && e.target.value.trim()) {
            setTermsError(null);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            size="xxl"
            title="Estimate Preview"
            description={`${estimate.version || ""} — ${model.title}`}
            showCloseIcon
            className="max-w-5xl"
        >
            <ModalBody className="bg-white">
                <div
                    id="estimate-export-preview"
                    className="overflow-x-auto rounded border border-gray-200 p-4 bg-white"
                >
                    <EstimatePreviewContent rows={model.rows} />
                </div>
                <div className="mt-4 border-t border-gray-200 pt-4">
                    <Textarea
                        label={
                            <span>
                                Terms & Conditions <span className="text-error">*</span>
                            </span>
                        }
                        placeholder="Enter terms and conditions..."
                        value={terms}
                        onChange={handleTermsChange}
                        error={termsError ?? undefined}
                        rows={8}
                        className="min-h-[160px]"
                    />
                </div>
            </ModalBody>
            <ModalFooter>
                <Button variant="outline" onClick={onClose}>
                    Close
                </Button>
                <Button
                    onClick={handleDownloadPdf}
                    disabled={downloading !== null}
                    className="flex items-center gap-2"
                    icon={<FileText size={16} />}
                >
                    {downloading === "pdf" ? "Downloading…" : "Download PDF"}
                </Button>
                <Button
                    onClick={handleDownloadExcel}
                    disabled={downloading !== null}
                    className="flex items-center gap-2"
                    icon={<FileSpreadsheet size={16} />}
                >
                    {downloading === "excel" ? "Downloading…" : "Download Excel"}
                </Button>
            </ModalFooter>
        </Modal>
    );
}
