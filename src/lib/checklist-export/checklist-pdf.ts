import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import type { ChecklistItem } from "@/components/checklist-modal/types";
import {
    buildChecklistDocumentModel,
    CHECKLIST_EXPORT_COLUMNS,
    getChecklistItemDetails,
    getChecklistItemName,
    getChecklistItemUnit,
    type ChecklistExportContext,
    type ChecklistExportRow,
} from "./checklist-document";
import { getEstimateLogoDataUrl } from "@/lib/estimate-export/estimate-logo";

const LOGO_WIDTH_MM = 32;
const LOGO_META_GAP_MM = 4;

const PDF_COLORS = {
    titleBg: [231, 231, 231] as [number, number, number],
    headerBg: [230, 224, 248] as [number, number, number],
    categoryBg: [217, 234, 211] as [number, number, number],
    subCategoryBg: [238, 245, 234] as [number, number, number],
};

const TABLE_HEAD = [CHECKLIST_EXPORT_COLUMNS as unknown as string[]];

type TableSegment = {
    body: RowInput[];
    rowMeta: { fillColor?: [number, number, number]; fontStyle?: "bold" }[];
};

function rowsToSegment(rows: ChecklistExportRow[]): TableSegment {
    const segment: TableSegment = { body: [], rowMeta: [] };

    rows.forEach(exportRow => {
        if (exportRow.type === "category") {
            segment.body.push([
                exportRow.serial,
                exportRow.name,
                "",
                "",
                "",
                "",
                "",
                "",
                "",
            ]);
            segment.rowMeta.push({ fillColor: PDF_COLORS.categoryBg, fontStyle: "bold" });
        } else if (exportRow.type === "subCategory") {
            segment.body.push([
                "",
                `Sub Category: ${exportRow.name}`,
                "",
                "",
                "",
                "",
                "",
                "",
                "",
            ]);
            segment.rowMeta.push({ fillColor: PDF_COLORS.subCategoryBg, fontStyle: "bold" });
        } else if (exportRow.type === "item") {
            const item = exportRow.item;
            segment.body.push([
                String(exportRow.serial),
                getChecklistItemName(item),
                getChecklistItemDetails(item),
                String(item.quantity ?? 0),
                getChecklistItemUnit(item),
                item.days != null ? String(item.days) : "—",
                exportRow.vendorDisplay,
                item.status || "PENDING",
                item.deadlineDate || "—",
            ]);
            segment.rowMeta.push({});
        }
    });

    return segment;
}

function splitRowsIntoSegments(rows: ChecklistExportRow[]): TableSegment[] {
    let itemBuffer: ChecklistExportRow[] = [];
    let tableHeaderSeen = false;
    const itemSegments: TableSegment[] = [];

    const flushItems = () => {
        if (itemBuffer.length === 0) return;
        itemSegments.push(rowsToSegment(itemBuffer));
        itemBuffer = [];
    };

    rows.forEach(row => {
        if (row.type === "table-header") {
            if (tableHeaderSeen) flushItems();
            tableHeaderSeen = true;
            return;
        }
        if (row.type === "category" || row.type === "subCategory" || row.type === "item") {
            itemBuffer.push(row);
        }
    });

    flushItems();
    return itemSegments;
}

function buildTableColumnStyles(contentWidth: number) {
    const serial = 10;
    const quantity = 10;
    const unit = 10;
    const days = 10;
    const status = 16;
    const dates = 18;
    const vendor = 24;
    const fixedTotal = serial + quantity + unit + days + status + dates * 2 + vendor;
    const elements = Math.round((contentWidth - fixedTotal) * 0.38);
    const details = contentWidth - fixedTotal - elements;

    return {
        0: { halign: "center" as const, cellWidth: serial },
        1: { halign: "left" as const, cellWidth: elements },
        2: { halign: "left" as const, cellWidth: details },
        3: { halign: "right" as const, cellWidth: quantity },
        4: { halign: "center" as const, cellWidth: unit },
        5: { halign: "center" as const, cellWidth: days },
        6: { halign: "left" as const, cellWidth: vendor },
        7: { halign: "center" as const, cellWidth: status },
        8: { halign: "center" as const, cellWidth: dates },
        9: { halign: "center" as const, cellWidth: dates },
    };
}

function renderTableSegment(
    doc: jsPDF,
    startY: number,
    segment: TableSegment,
    margin: number,
    contentWidth: number,
): number {
    autoTable(doc, {
        startY,
        head: TABLE_HEAD,
        body: segment.body,
        tableWidth: contentWidth,
        theme: "grid",
        styles: {
            fontSize: 7,
            cellPadding: 1.5,
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            overflow: "linebreak",
        },
        headStyles: {
            fillColor: PDF_COLORS.headerBg,
            textColor: [0, 0, 0],
            fontStyle: "bold",
            halign: "center",
        },
        columnStyles: buildTableColumnStyles(contentWidth),
        didParseCell: data => {
            if (data.section !== "body") return;
            const meta = segment.rowMeta[data.row.index];
            if (!meta) return;
            if (meta.fillColor) data.cell.styles.fillColor = meta.fillColor;
            if (meta.fontStyle) data.cell.styles.fontStyle = meta.fontStyle;
        },
        margin: { left: margin, right: margin },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (doc as any).lastAutoTable.finalY as number;
}

export async function generateChecklistPdfBlob(
    checklistData: ChecklistItem[],
    context: ChecklistExportContext = {},
    vendorList: { id?: string | number; name?: string }[] = [],
    inventoryList: { id?: string | number; itemName?: string }[] = [],
): Promise<Blob> {
    const model = buildChecklistDocumentModel(
        checklistData,
        context,
        vendorList,
        inventoryList,
    );
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const margin = 10;
    let y = margin;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    const logoDataUrl = await getEstimateLogoDataUrl();
    const metaTextWidth = logoDataUrl
        ? contentWidth - LOGO_WIDTH_MM - LOGO_META_GAP_MM - 34
        : contentWidth - 34;

    doc.setFillColor(...PDF_COLORS.titleBg);
    doc.rect(margin, y - 4, contentWidth, 11, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(model.title, pageWidth / 2, y + 3, { align: "center" });
    y += 14;

    const metaBlockStartY = y;
    doc.setFontSize(9);
    model.meta.forEach(({ label, value }) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${label} :`, margin, y);
        doc.setFont("helvetica", "normal");
        const wrapped = doc.splitTextToSize(value, Math.max(metaTextWidth, 40));
        doc.text(wrapped, margin + 34, y);
        y += Math.max(5.5, wrapped.length * 4.2);
    });
    const metaBlockEndY = y;

    if (logoDataUrl && model.meta.length > 0) {
        const blockHeight = Math.max(metaBlockEndY - metaBlockStartY, 20);
        const logoHeight = Math.min(LOGO_WIDTH_MM, blockHeight);
        const logoX = pageWidth - margin - LOGO_WIDTH_MM;
        doc.addImage(logoDataUrl, "PNG", logoX, metaBlockStartY, LOGO_WIDTH_MM, logoHeight);
    }

    y += 4;

    const itemSegments = splitRowsIntoSegments(model.rows);
    itemSegments.forEach(segment => {
        y = renderTableSegment(doc, y, segment, margin, contentWidth) + 4;
    });

    return doc.output("blob");
}

export async function downloadChecklistPdf(
    checklistData: ChecklistItem[],
    context: ChecklistExportContext = {},
    vendorList: { id?: string | number; name?: string }[] = [],
    inventoryList: { id?: string | number; itemName?: string }[] = [],
) {
    const model = buildChecklistDocumentModel(
        checklistData,
        context,
        vendorList,
        inventoryList,
    );
    const blob = await generateChecklistPdfBlob(
        checklistData,
        context,
        vendorList,
        inventoryList,
    );
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${model.filenameBase}.pdf`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}
