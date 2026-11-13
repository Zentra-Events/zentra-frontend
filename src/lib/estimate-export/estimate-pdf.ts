import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import {
    buildEstimateDocumentModel,
    formatExportCurrency,
    getItemAmount,
    getItemDetails,
    getItemName,
    getItemRate,
    type EstimateExportRow,
} from "./estimate-document";
import type { EstimateDto } from "@/types/estimate";
import { getEstimateLogoDataUrl } from "./estimate-logo";
import { downloadBlob } from "@/lib/document-export/download";

const LOGO_WIDTH_MM = 32;
const LOGO_META_GAP_MM = 4;

const PDF_COLORS = {
    titleBg: [231, 231, 231] as [number, number, number],
    headerBg: [230, 224, 248] as [number, number, number],
    categoryBg: [217, 234, 211] as [number, number, number],
    subCategoryBg: [238, 245, 234] as [number, number, number],
    totalBg: [180, 198, 231] as [number, number, number],
    subTotalBg: [255, 242, 204] as [number, number, number],
    summaryBg: [230, 224, 248] as [number, number, number],
};

const TABLE_HEAD = [["Sl. No", "Elements", "Details", "nos", "Rate", "Amount"]];

/** Fixed column widths (mm); Details fills remainder to match header/content width */
const PDF_TABLE_FIXED_COLUMNS_MM = {
    serial: 14,
    elements: 34,
    quantity: 12,
    rate: 20,
    amount: 24,
} as const;

function buildTableColumnStyles(contentWidth: number) {
    const fixedTotal = Object.values(PDF_TABLE_FIXED_COLUMNS_MM).reduce((sum, w) => sum + w, 0);
    const detailsWidth = contentWidth - fixedTotal;

    return {
        0: { halign: "center" as const, cellWidth: PDF_TABLE_FIXED_COLUMNS_MM.serial },
        1: { halign: "left" as const, cellWidth: PDF_TABLE_FIXED_COLUMNS_MM.elements },
        2: { halign: "left" as const, cellWidth: detailsWidth },
        3: { halign: "right" as const, cellWidth: PDF_TABLE_FIXED_COLUMNS_MM.quantity },
        4: { halign: "right" as const, cellWidth: PDF_TABLE_FIXED_COLUMNS_MM.rate },
        5: { halign: "right" as const, cellWidth: PDF_TABLE_FIXED_COLUMNS_MM.amount },
    };
}

type TableSegment = {
    body: RowInput[];
    rowMeta: { fillColor?: [number, number, number]; fontStyle?: "bold" }[];
};

function rowsToSegment(rows: EstimateExportRow[]): TableSegment {
    const segment: TableSegment = { body: [], rowMeta: [] };

    rows.forEach(exportRow => {
        if (exportRow.type === "category") {
            segment.body.push([exportRow.serial, exportRow.name, "", "", "", ""]);
            segment.rowMeta.push({ fillColor: PDF_COLORS.categoryBg, fontStyle: "bold" });
        } else if (exportRow.type === "subCategory") {
            segment.body.push(["", `Sub Category: ${exportRow.name}`, "", "", "", ""]);
            segment.rowMeta.push({ fillColor: PDF_COLORS.subCategoryBg, fontStyle: "bold" });
        } else if (exportRow.type === "item") {
            const item = exportRow.item;
            segment.body.push([
                String(exportRow.serial),
                getItemName(item),
                getItemDetails(item),
                String(item.quantity ?? 0),
                formatExportCurrency(getItemRate(item)),
                formatExportCurrency(getItemAmount(item)),
            ]);
            segment.rowMeta.push({});
        } else if (exportRow.type === "summary") {
            const fillColor =
                exportRow.variant === "total" || exportRow.variant === "service"
                    ? PDF_COLORS.totalBg
                    : exportRow.variant === "subtotal"
                      ? PDF_COLORS.subTotalBg
                      : PDF_COLORS.summaryBg;
            const fontStyle =
                exportRow.variant === "subtotal" || exportRow.variant === "grand"
                    ? ("bold" as const)
                    : undefined;
            segment.body.push([
                "",
                exportRow.label,
                "",
                "",
                "",
                formatExportCurrency(exportRow.value),
            ]);
            segment.rowMeta.push({ fillColor, fontStyle });
        }
    });

    return segment;
}

function splitRowsIntoSegments(rows: EstimateExportRow[]): {
    itemSegments: TableSegment[];
    summarySegment: TableSegment | null;
} {
    let itemBuffer: EstimateExportRow[] = [];
    let tableHeaderSeen = false;
    const summaryBuffer: EstimateExportRow[] = [];
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
        if (row.type === "section-title") {
            flushItems();
            return;
        }
        if (row.type === "category" || row.type === "subCategory" || row.type === "item") {
            itemBuffer.push(row);
            return;
        }
        if (row.type === "summary") {
            summaryBuffer.push(row);
        }
    });

    flushItems();

    return {
        itemSegments,
        summarySegment: summaryBuffer.length > 0 ? rowsToSegment(summaryBuffer) : null,
    };
}

function renderTableSegment(
    doc: jsPDF,
    startY: number,
    segment: TableSegment,
    margin: number,
    contentWidth: number,
    options?: { includeHead?: boolean },
): number {
    const includeHead = options?.includeHead ?? true;
    autoTable(doc, {
        startY,
        head: includeHead ? TABLE_HEAD : undefined,
        body: segment.body,
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

export async function generateEstimatePdfBlob(
    estimate: EstimateDto,
    eventName?: string,
    terms?: string,
): Promise<Blob> {
    const model = buildEstimateDocumentModel(estimate, eventName);
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
    y += 14;

    const metaBlockStartY = y;
    doc.setFontSize(10);
    model.meta.forEach(({ label, value }) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${label} :`, margin, y);
        doc.setFont("helvetica", "normal");
        const wrapped = doc.splitTextToSize(value, Math.max(metaTextWidth, 40));
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

    const { itemSegments, summarySegment } = splitRowsIntoSegments(model.rows);
    const sectionTitle = model.rows.find(
        (r): r is Extract<EstimateExportRow, { type: "section-title" }> =>
            r.type === "section-title",
    );

    itemSegments.forEach((segment, index) => {
        if (index === 1 && sectionTitle) {
            doc.setFont("helvetica", "bold");
            doc.setFontSize(10);
            doc.text(sectionTitle.text, margin, y);
            y += 8;
        }
        y = renderTableSegment(doc, y, segment, margin, contentWidth) + 4;
    });

    if (summarySegment) {
        y = renderTableSegment(doc, y, summarySegment, margin, contentWidth, {
            includeHead: false,
        });
    }

    if (terms?.trim()) {
        y += 4;
        // Check if we need a new page
        const termsHeight = 10 + terms.split("\n").length * 5;
        if (y + termsHeight > doc.internal.pageSize.getHeight() - margin) {
            doc.addPage();
            y = margin;
        }

        // Terms section background
        doc.setFillColor(245, 245, 245);
        doc.roundedRect(margin, y, contentWidth, termsHeight, 2, 2, "F");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Terms & Conditions", margin + 4, y + 6);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const termsLines = doc.splitTextToSize(terms, contentWidth - 12);
        doc.text(termsLines, margin + 4, y + 12);
    }

    return doc.output("blob");
}

export async function downloadEstimatePdf(
    estimate: EstimateDto,
    eventName?: string,
    terms?: string,
) {
    const model = buildEstimateDocumentModel(estimate, eventName);
    const blob = await generateEstimatePdfBlob(estimate, eventName, terms);
    downloadBlob(blob, `${model.filenameBase}.pdf`);
}
