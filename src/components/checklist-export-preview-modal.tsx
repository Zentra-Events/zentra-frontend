"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { FileSpreadsheet, FileText } from "lucide-react";
import type { ChecklistItem } from "@/components/checklist-modal/types";
import { Button, Modal, ModalBody, ModalFooter } from "./ui";
import {
    buildChecklistDocumentModel,
    CHECKLIST_EXPORT_COLUMNS,
    getChecklistItemDetails,
    getChecklistItemName,
    getChecklistItemUnit,
    type ChecklistExportContext,
    type ChecklistExportRow,
} from "@/lib/checklist-export/checklist-document";
import { downloadChecklistExcel } from "@/lib/checklist-export/checklist-excel";
import { downloadChecklistPdf } from "@/lib/checklist-export/checklist-pdf";
import { toast } from "sonner";

const previewStyles = {
    titleBg: "bg-[#e6e0f8]",
    headerBg: "bg-[#e6e0f8]",
    categoryBg: "bg-[#d9ead3]",
    subCategoryBg: "bg-[#eef5ea]",
} as const;

interface ChecklistExportPreviewModalProps {
    checklistData: ChecklistItem[];
    vendorList: { id?: string | number; name?: string }[];
    inventoryList: { id?: string | number; itemName?: string }[];
    exportContext?: ChecklistExportContext;
    onClose: () => void;
}

const CATEGORY_COL_SPAN = CHECKLIST_EXPORT_COLUMNS.length - 1;

function ChecklistPreviewTable({ rows }: { rows: ChecklistExportRow[] }) {
    const tableRows = rows.filter(
        r =>
            r.type === "category" ||
            r.type === "subCategory" ||
            r.type === "item" ||
            r.type === "table-header",
    );

    if (!tableRows.some(r => r.type === "table-header")) return null;

    return (
        <table className="w-full border-collapse text-xs border border-black">
            <thead>
                <tr className={previewStyles.headerBg}>
                    {CHECKLIST_EXPORT_COLUMNS.map(header => (
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
                                        colSpan={CATEGORY_COL_SPAN}
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
                                        colSpan={CATEGORY_COL_SPAN}
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
                                        {getChecklistItemName(item)}
                                    </td>
                                    <td className="border border-black px-2 py-2 align-top whitespace-pre-wrap">
                                        {getChecklistItemDetails(item)}
                                    </td>
                                    <td className="border border-black px-2 py-2 text-right align-top">
                                        {item.quantity ?? 0}
                                    </td>
                                    <td className="border border-black px-2 py-2 text-center align-top">
                                        {getChecklistItemUnit(item)}
                                    </td>
                                    <td className="border border-black px-2 py-2 text-center align-top">
                                        {item.days ?? "—"}
                                    </td>
                                    <td className="border border-black px-2 py-2 align-top">
                                        {row.vendorDisplay}
                                    </td>
                                    <td className="border border-black px-2 py-2 text-center align-top">
                                        {item.status || "PENDING"}
                                    </td>
                                    <td className="border border-black px-2 py-2 text-center align-top">
                                        {item.deadlineDate || "—"}
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

function ChecklistHeaderSection({ rows }: { rows: ChecklistExportRow[] }) {
    const titleRow = rows.find(
        (r): r is Extract<ChecklistExportRow, { type: "title" }> => r.type === "title",
    );
    const metaRows = rows.filter(
        (r): r is Extract<ChecklistExportRow, { type: "meta" }> => r.type === "meta",
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

function ChecklistPreviewContent({ rows }: { rows: ChecklistExportRow[] }) {
    const tableRows = useMemo(
        () =>
            rows.filter(
                r =>
                    r.type === "table-header" ||
                    r.type === "category" ||
                    r.type === "subCategory" ||
                    r.type === "item",
            ),
        [rows],
    );

    return (
        <div className="space-y-3 font-sans text-sm text-gray-900">
            <ChecklistHeaderSection rows={rows} />
            <ChecklistPreviewTable rows={tableRows} />
        </div>
    );
}

export function ChecklistExportPreviewModal({
    checklistData,
    vendorList,
    inventoryList,
    exportContext = {},
    onClose,
}: ChecklistExportPreviewModalProps) {
    const [downloading, setDownloading] = useState<"pdf" | "excel" | null>(null);

    const model = useMemo(
        () => buildChecklistDocumentModel(checklistData, exportContext, vendorList, inventoryList),
        [checklistData, exportContext, vendorList, inventoryList],
    );

    const handleDownloadPdf = async () => {
        try {
            setDownloading("pdf");
            await downloadChecklistPdf(checklistData, exportContext, vendorList, inventoryList);
            toast.success("PDF downloaded");
        } catch (error) {
            console.error(error);
            toast.error("Failed to download PDF");
        } finally {
            setDownloading(null);
        }
    };

    const handleDownloadExcel = async () => {
        try {
            setDownloading("excel");
            await downloadChecklistExcel(checklistData, exportContext, vendorList, inventoryList);
            toast.success("Excel downloaded");
        } catch (error) {
            console.error(error);
            toast.error("Failed to download Excel");
        } finally {
            setDownloading(null);
        }
    };

    return (
        <Modal
            open
            onClose={onClose}
            size="xxl"
            title="Checklist Export Preview"
            description={model.title}
            showCloseIcon
            className="max-w-6xl"
        >
            <ModalBody className="bg-white max-h-[calc(100vh-220px)] overflow-y-auto">
                <div
                    id="checklist-export-preview"
                    className="overflow-x-auto rounded border border-gray-200 p-4 bg-white"
                >
                    <ChecklistPreviewContent rows={model.rows} />
                </div>
            </ModalBody>
            <ModalFooter>
                <Button variant="outline" onClick={onClose}>
                    Close
                </Button>
                <Button
                    variant="outline"
                    onClick={handleDownloadPdf}
                    disabled={downloading !== null}
                    className="flex items-center gap-2"
                    icon={<FileText size={16} />}
                >
                    {downloading === "pdf" ? "Downloading…" : "Download PDF"}
                </Button>
                <Button
                    variant="primary"
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
