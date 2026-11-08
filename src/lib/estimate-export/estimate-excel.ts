import ExcelJS from "exceljs";
import {
    buildEstimateDocumentModel,
    ESTIMATE_EXPORT_COLORS,
    ESTIMATE_EXPORT_COLUMNS,
    getItemAmount,
    getItemDetails,
    getItemName,
    getItemRate,
    type EstimateDocumentModel,
} from "./estimate-document";
import type { EstimateDto } from "@/types/estimate";
import { getEstimateLogoPngBase64 } from "./estimate-logo";
import { downloadBlob } from "@/lib/document-export/download";

const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: ESTIMATE_EXPORT_COLORS.border } },
    left: { style: "thin", color: { argb: ESTIMATE_EXPORT_COLORS.border } },
    bottom: { style: "thin", color: { argb: ESTIMATE_EXPORT_COLORS.border } },
    right: { style: "thin", color: { argb: ESTIMATE_EXPORT_COLORS.border } },
};

/** Sl. No / meta label column — wider so labels do not overlap column B */
const SERIAL_COLUMN_WIDTH = 16;
/** Logo column (F) — merged F2:F6 in header */
const LOGO_COLUMN_WIDTH = 22;
const META_VALUE_END_COL = 5;

function clearCellBorders(cell: ExcelJS.Cell) {
    cell.border = {};
}

function applyBorderRange(row: ExcelJS.Row, fromCol: number, toCol: number) {
    for (let c = fromCol; c <= toCol; c++) {
        row.getCell(c).border = THIN_BORDER;
    }
}

function clearBorderRange(row: ExcelJS.Row, fromCol: number, toCol: number) {
    for (let c = fromCol; c <= toCol; c++) {
        clearCellBorders(row.getCell(c));
    }
}

function fillRow(row: ExcelJS.Row, fromCol: number, toCol: number, argb: string, bold = false) {
    for (let c = fromCol; c <= toCol; c++) {
        const cell = row.getCell(c);
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb },
        };
        if (bold) cell.font = { ...(cell.font || {}), bold: true };
        cell.border = THIN_BORDER;
    }
}

/** Header rows (title + meta): background fill without visible cell borders */
function fillHeaderRow(
    row: ExcelJS.Row,
    fromCol: number,
    toCol: number,
    argb?: string,
    bold = false,
) {
    for (let c = fromCol; c <= toCol; c++) {
        const cell = row.getCell(c);
        if (argb) {
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb },
            };
        }
        if (bold) cell.font = { ...(cell.font || {}), bold: true };
        clearCellBorders(cell);
    }
}

function setupLogoArea(sheet: ExcelJS.Worksheet, startRow: number, endRow: number) {
    sheet.mergeCells(startRow, 6, endRow, 6);
    const logoCell = sheet.getCell(startRow, 6);
    logoCell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    clearCellBorders(logoCell);
    for (let r = startRow; r <= endRow; r++) {
        clearBorderRange(sheet.getRow(r), 1, 6);
        sheet.getRow(r).height = Math.max(sheet.getRow(r).height ?? 0, 22);
    }
}

async function embedLogoInWorksheet(
    workbook: ExcelJS.Workbook,
    sheet: ExcelJS.Worksheet,
    startRow: number,
    endRow: number,
) {
    const logoBase64 = await getEstimateLogoPngBase64();
    if (!logoBase64) return;

    const imageId = workbook.addImage({
        base64: logoBase64,
        extension: "png",
    });

    const rowSpan = Math.max(endRow - startRow + 1, 1);
    const rowHeightPt = 22;
    const imageHeightPx = Math.round(rowSpan * rowHeightPt * 1.33);
    const imageWidthPx = Math.round(LOGO_COLUMN_WIDTH * 7);

    sheet.addImage(imageId, {
        tl: { col: 5.15, row: startRow - 1 + 0.08 },
        ext: { width: imageWidthPx, height: imageHeightPx },
    });
}

function writeTableHeader(sheet: ExcelJS.Worksheet, rowIndex: number) {
    const row = sheet.getRow(rowIndex);
    ESTIMATE_EXPORT_COLUMNS.forEach((header, index) => {
        const cell = row.getCell(index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: ESTIMATE_EXPORT_COLORS.headerBg },
        };
        cell.border = THIN_BORDER;
    });
    row.height = 22;
}

function writeSummaryRow(
    sheet: ExcelJS.Worksheet,
    rowIndex: number,
    label: string,
    value: number,
    bgArgb: string,
    labelBold: boolean,
) {
    const row = sheet.getRow(rowIndex);
    row.getCell(2).value = label;
    row.getCell(2).font = { bold: labelBold };
    row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };

    const amountCell = row.getCell(6);
    amountCell.value = value;
    amountCell.numFmt = "#,##0.00";
    amountCell.alignment = { horizontal: "right", vertical: "middle" };

    fillRow(row, 1, 6, bgArgb);
    row.getCell(2).font = { bold: labelBold };
    amountCell.numFmt = "#,##0.00";
}

function writeTermsSection(
    sheet: ExcelJS.Worksheet,
    workbook: ExcelJS.Workbook,
    startRow: number,
    terms: string,
) {
    const termsLines = terms.split("\n");

    // Title row
    const titleRow = sheet.getRow(startRow);
    sheet.mergeCells(startRow, 1, startRow, 6);
    titleRow.getCell(1).value = "Terms & Conditions";
    titleRow.getCell(1).font = { bold: true, size: 11 };
    titleRow.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
    titleRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF5F5F5" },
    };
    clearBorderRange(titleRow, 1, 6);
    titleRow.height = 22;

    // Content rows
    const contentRow = startRow + 1;
    const contentEndRow = contentRow + termsLines.length;
    sheet.mergeCells(contentRow, 1, contentEndRow, 6);

    const contentCell = sheet.getCell(contentRow, 1);
    contentCell.value = terms;
    contentCell.font = { size: 9 };
    contentCell.alignment = { wrapText: true, vertical: "top", horizontal: "left" };
    contentCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF5F5F5" },
    };
    clearBorderRange(sheet.getRow(contentRow), 1, 6);

    // Apply fill to all merged content rows
    for (let r = contentRow; r <= contentEndRow; r++) {
        const row = sheet.getRow(r);
        clearBorderRange(row, 1, 6);
        for (let c = 1; c <= 6; c++) {
            row.getCell(c).fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF5F5F5" },
            };
        }
        row.height = 18;
    }

    return contentEndRow;
}

async function populateWorksheet(
    workbook: ExcelJS.Workbook,
    sheet: ExcelJS.Worksheet,
    model: EstimateDocumentModel,
    terms?: string,
) {
    sheet.columns = [
        { width: SERIAL_COLUMN_WIDTH },
        { width: 28 },
        { width: 42 },
        { width: 10 },
        { width: 14 },
        { width: LOGO_COLUMN_WIDTH },
    ];

    let rowIndex = 1;
    let metaLogoStartRow: number | null = null;
    let metaLogoEndRow: number | null = null;

    for (const exportRow of model.rows) {
        switch (exportRow.type) {
            case "title": {
                sheet.mergeCells(rowIndex, 1, rowIndex, 6);
                const cell = sheet.getCell(rowIndex, 1);
                cell.value = exportRow.text;
                cell.font = { bold: true, size: 14 };
                cell.alignment = { horizontal: "center", vertical: "middle" };
                fillHeaderRow(sheet.getRow(rowIndex), 1, 6, ESTIMATE_EXPORT_COLORS.titleBg, true);
                sheet.getRow(rowIndex).height = 28;
                rowIndex += 1;
                break;
            }
            case "meta": {
                const row = sheet.getRow(rowIndex);
                if (metaLogoStartRow === null) metaLogoStartRow = rowIndex;
                metaLogoEndRow = rowIndex;

                row.getCell(1).value = `${exportRow.label} :`;
                row.getCell(1).font = { bold: true };
                row.getCell(1).alignment = { horizontal: "left", vertical: "top", wrapText: true };

                sheet.mergeCells(rowIndex, 2, rowIndex, META_VALUE_END_COL);
                row.getCell(2).value = exportRow.value;
                row.getCell(2).alignment = { wrapText: true, vertical: "top", horizontal: "left" };

                clearBorderRange(row, 1, 6);
                row.height = 18;
                rowIndex += 1;
                break;
            }
            case "table-header": {
                writeTableHeader(sheet, rowIndex);
                rowIndex += 1;
                break;
            }
            case "section-title": {
                const row = sheet.getRow(rowIndex);
                sheet.mergeCells(rowIndex, 1, rowIndex, 6);
                row.getCell(1).value = exportRow.text;
                row.getCell(1).font = { bold: true, size: 11 };
                row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
                clearBorderRange(row, 1, 6);
                row.height = 20;
                rowIndex += 1;
                break;
            }
            case "category": {
                const row = sheet.getRow(rowIndex);
                row.getCell(1).value = exportRow.serial;
                row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
                row.getCell(2).value = exportRow.name;
                row.getCell(2).font = { bold: true };
                fillRow(row, 1, 6, ESTIMATE_EXPORT_COLORS.categoryBg, false);
                row.getCell(2).font = { bold: true };
                row.height = 20;
                rowIndex += 1;
                break;
            }
            case "subCategory": {
                const row = sheet.getRow(rowIndex);
                row.getCell(2).value = `Sub Category: ${exportRow.name}`;
                row.getCell(2).font = { bold: true };
                fillRow(row, 1, 6, ESTIMATE_EXPORT_COLORS.subCategoryBg, false);
                row.getCell(2).font = { bold: true };
                row.height = 20;
                rowIndex += 1;
                break;
            }
            case "item": {
                const row = sheet.getRow(rowIndex);
                const item = exportRow.item;
                row.getCell(1).value = exportRow.serial;
                row.getCell(1).alignment = { horizontal: "center", vertical: "top" };
                row.getCell(2).value = getItemName(item);
                row.getCell(2).alignment = { horizontal: "left", vertical: "top", wrapText: true };
                row.getCell(3).value = getItemDetails(item);
                row.getCell(3).alignment = { horizontal: "left", vertical: "top", wrapText: true };
                row.getCell(4).value = item.quantity ?? 0;
                row.getCell(4).alignment = { horizontal: "right", vertical: "top" };
                row.getCell(5).value = getItemRate(item);
                row.getCell(5).numFmt = "#,##0.00";
                row.getCell(5).alignment = { horizontal: "right", vertical: "top" };
                row.getCell(6).value = getItemAmount(item);
                row.getCell(6).numFmt = "#,##0.00";
                row.getCell(6).alignment = { horizontal: "right", vertical: "top" };
                applyBorderRange(row, 1, 6);
                row.height = 28;
                rowIndex += 1;
                break;
            }
            case "summary": {
                const bg =
                    exportRow.variant === "total" || exportRow.variant === "service"
                        ? ESTIMATE_EXPORT_COLORS.totalBg
                        : exportRow.variant === "subtotal"
                          ? ESTIMATE_EXPORT_COLORS.subTotalBg
                          : ESTIMATE_EXPORT_COLORS.summaryBg;
                const labelBold = exportRow.variant === "subtotal" || exportRow.variant === "grand";
                writeSummaryRow(sheet, rowIndex, exportRow.label, exportRow.value, bg, labelBold);
                rowIndex += 1;
                break;
            }
            default:
                break;
        }
    }

    if (metaLogoStartRow !== null && metaLogoEndRow !== null) {
        setupLogoArea(sheet, metaLogoStartRow, metaLogoEndRow);
        await embedLogoInWorksheet(workbook, sheet, metaLogoStartRow, metaLogoEndRow);
    }

    // Append Terms & Conditions section
    if (terms?.trim()) {
        rowIndex += 1; // blank row
        rowIndex = writeTermsSection(sheet, workbook, rowIndex, terms) + 1;
    }
}

export async function generateEstimateExcelBuffer(
    estimate: EstimateDto,
    eventName?: string,
    terms?: string,
): Promise<ArrayBuffer> {
    const model = buildEstimateDocumentModel(estimate, eventName);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Zentra";
    const sheet = workbook.addWorksheet("Estimate", {
        views: [{ showGridLines: true }],
    });

    await populateWorksheet(workbook, sheet, model, terms);

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
}

export async function downloadEstimateExcel(
    estimate: EstimateDto,
    eventName?: string,
    terms?: string,
) {
    const model = buildEstimateDocumentModel(estimate, eventName);
    const buffer = await generateEstimateExcelBuffer(estimate, eventName, terms);
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, `${model.filenameBase}.xlsx`);
}
