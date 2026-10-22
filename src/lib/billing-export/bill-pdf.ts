import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";

import {
    buildBillDocumentModel,
    formatExportCurrency,
    type BillDocumentConfig,
    type BillDocumentModel,
    type BillExportRow,
    type BillSummaryVariant,
} from "./bill-document";
import { getEstimateLogoDataUrl } from "@/lib/estimate-export/estimate-logo";

const LOGO_WIDTH_MM = 32;
const LOGO_META_GAP_MM = 4;

const PDF_COLORS = {
    titleBg: [231, 231, 231] as [number, number, number],
    headerBg: [230, 224, 248] as [number, number, number],
    totalBg: [180, 198, 231] as [number, number, number],
    subTotalBg: [255, 242, 204] as [number, number, number],
    summaryBg: [244, 244, 244] as [number, number, number],
};

const TABLE_HEAD = [["Sl. No", "Elements", "Details", "nos", "Unit", "Rate", "Amount"]];

/** Fixed column widths (mm); Details fills the remaining content width. */
const PDF_TABLE_FIXED_COLUMNS_MM = {
    serial: 12,
    elements: 30,
    quantity: 10,
    unit: 12,
    rate: 18,
    amount: 22,
} as const;

function buildTableColumnStyles(contentWidth: number) {
    const fixedTotal = Object.values(PDF_TABLE_FIXED_COLUMNS_MM).reduce(
        (sum, width) => sum + width,
        0,
    );
    const detailsWidth = Math.max(contentWidth - fixedTotal, 20);

    return {
        0: { halign: "center" as const, cellWidth: PDF_TABLE_FIXED_COLUMNS_MM.serial },
        1: { halign: "left" as const, cellWidth: PDF_TABLE_FIXED_COLUMNS_MM.elements },
        2: { halign: "left" as const, cellWidth: detailsWidth },
        3: { halign: "right" as const, cellWidth: PDF_TABLE_FIXED_COLUMNS_MM.quantity },
        4: { halign: "center" as const, cellWidth: PDF_TABLE_FIXED_COLUMNS_MM.unit },
        5: { halign: "right" as const, cellWidth: PDF_TABLE_FIXED_COLUMNS_MM.rate },
        6: { halign: "right" as const, cellWidth: PDF_TABLE_FIXED_COLUMNS_MM.amount },
    };
}

function summaryFillColor(variant: BillSummaryVariant): [number, number, number] {
    if (variant === "total") return PDF_COLORS.totalBg;
    if (variant === "outstanding") return PDF_COLORS.subTotalBg;
    return PDF_COLORS.summaryBg;
}

function summaryFontStyle(variant: BillSummaryVariant): "bold" | undefined {
    if (variant === "total" || variant === "outstanding") return "bold";
    return undefined;
}

/**
 * Render a bill document model to a PDF blob.
 *
 * Follows the layout conventions of the estimate export (title band, meta
 * block with the company logo, grid table, summary block) so bills look like
 * the rest of the application's documents.
 */
export async function generateBillPdfBlob(config: BillDocumentConfig): Promise<Blob> {
    const model: BillDocumentModel = buildBillDocumentModel(config);

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const margin = 14;
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
    y += 12;

    if (model.subtitle) {
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(model.subtitle, pageWidth / 2, y, { align: "center" });
        y += 8;
    }

    const metaBlockStartY = y;
    doc.setFontSize(10);
    model.meta.forEach(({ label, value }) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${label} :`, margin, y);
        doc.setFont("helvetica", "normal");
        const wrapped = doc.splitTextToSize(value || "—", Math.max(metaTextWidth, 40));
        doc.text(wrapped, margin + 34, y);
        y += Math.max(6, wrapped.length * 4.8);
    });
    const metaBlockEndY = y;

    if (logoDataUrl && model.meta.length > 0) {
        const blockHeight = Math.max(metaBlockEndY - metaBlockStartY, 20);
        const logoHeight = Math.min(LOGO_WIDTH_MM, blockHeight);
        const logoX = pageWidth - margin - LOGO_WIDTH_MM;
        doc.addImage(logoDataUrl, "PNG", logoX, metaBlockStartY, LOGO_WIDTH_MM, logoHeight);
    }

    y += 4;

    const itemRows: RowInput[] = [];
    const summaryRows: RowInput[] = [];

    model.rows.forEach((row: BillExportRow) => {
        if (row.type === "item") {
            itemRows.push([
                String(row.serial),
                row.item.name,
                row.item.details,
                String(row.item.quantity ?? 0),
                row.item.unit,
                formatExportCurrency(row.item.rate),
                formatExportCurrency(row.item.amount),
            ]);
        }
    });

    // The summary rows live in their own collection on the model, so they are
    // collected from `model.summary` and not from the shared row list.
    model.summary.forEach(row => {
        summaryRows.push([row.label, formatExportCurrency(row.value)]);
    });

    if (itemRows.length > 0) {
        autoTable(doc, {
            startY: y,
            head: TABLE_HEAD,
            body: itemRows,
            tableWidth: contentWidth,
            theme: "grid",
            styles: {
                fontSize: 8,
                cellPadding: 2,
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
            margin: { left: margin, right: margin },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY as number;
        y += 4;
    }

    if (summaryRows.length > 0) {
        autoTable(doc, {
            startY: y,
            head: [["Bill Summary", "Amount"]],
            body: summaryRows,
            tableWidth: contentWidth,
            theme: "grid",
            styles: {
                fontSize: 9,
                cellPadding: 2.5,
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
            },
            headStyles: {
                fillColor: PDF_COLORS.headerBg,
                textColor: [0, 0, 0],
                fontStyle: "bold",
            },
            columnStyles: {
                0: { halign: "left" as const, cellWidth: Math.max(contentWidth - 32, 40) },
                1: { halign: "right" as const, cellWidth: 32 },
            },
            didParseCell: data => {
                if (data.section !== "body") return;
                const row = model.summary[data.row.index];
                if (!row) return;
                data.cell.styles.fillColor = summaryFillColor(row.variant);
                const fontStyle = summaryFontStyle(row.variant);
                if (fontStyle) data.cell.styles.fontStyle = fontStyle;
            },
            margin: { left: margin, right: margin },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY as number;
        y += 4;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Amount in words:", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(doc.splitTextToSize(model.amountInWords, contentWidth - 40), margin + 34, y);

    return doc.output("blob");
}

/** Render a bill document model to a PDF and trigger a browser download. */
export async function downloadBillPdf(config: BillDocumentConfig): Promise<void> {
    const model = buildBillDocumentModel(config);
    const blob = await generateBillPdfBlob(config);
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${model.filenameBase}.pdf`;
    anchor.click();
    window.URL.revokeObjectURL(url);
}
