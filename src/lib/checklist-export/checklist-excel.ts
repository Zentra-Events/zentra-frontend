import ExcelJS from "exceljs";
import type { ChecklistItem } from "@/components/checklist-modal/types";
import {
    buildChecklistDocumentModel,
    CHECKLIST_COLUMN_COUNT,
    CHECKLIST_EXPORT_COLORS,
    CHECKLIST_EXPORT_COLUMNS,
    getChecklistItemDetails,
    getChecklistDeadlineDisplay,
    getChecklistItemName,
    type ChecklistDocumentModel,
    type ChecklistExportContext,
} from "./checklist-document";
import { getEstimateLogoPngBase64 } from "@/lib/estimate-export/estimate-logo";
import { getChecklistStatusLabel } from "@/lib/utils/checklist-status";

const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: CHECKLIST_EXPORT_COLORS.border } },
    left: { style: "thin", color: { argb: CHECKLIST_EXPORT_COLORS.border } },
    bottom: { style: "thin", color: { argb: CHECKLIST_EXPORT_COLORS.border } },
    right: { style: "thin", color: { argb: CHECKLIST_EXPORT_COLORS.border } },
};

const META_LABEL_END_COL = 2;
const META_VALUE_START_COL = 3;
const META_VALUE_END_COL = 5;
const META_LOGO_START_COL = 7;
const CHECKLIST_COLUMN_WIDTHS = [7, 24, 30, 8, 8, 22, 15, 22];

function estimateWrappedLines(value: string, width: number): number {
    return value.split("\n").reduce(
        (total, line) => total + Math.max(1, Math.ceil(line.length / Math.max(width - 2, 1))),
        0,
    );
}

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

function fillRow(row: ExcelJS.Row, fromCol: number, toCol: number, argb: string) {
    for (let c = fromCol; c <= toCol; c++) {
        const cell = row.getCell(c);
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb },
        };
        cell.border = THIN_BORDER;
    }
}

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

    // Reserve the two rightmost columns in the metadata area for the logo.
    // The merged area stays within the table width, so it cannot add a blank
    // worksheet column or push the logo past the checklist header.
    sheet.mergeCells(startRow, META_LOGO_START_COL, endRow, CHECKLIST_COLUMN_COUNT);
    const logoRegionWidthPx = CHECKLIST_COLUMN_WIDTHS.slice(META_LOGO_START_COL - 1).reduce(
        (sum, width) => sum + width * 7,
        0,
    );
    const rowHeights = Array.from(
        { length: endRow - startRow + 1 },
        (_, index) => sheet.getRow(startRow + index).height ?? 20,
    );
    const logoRegionHeightPx = rowHeights.reduce((sum, height) => sum + height, 0) * (96 / 72);
    const imageSize = Math.min(100, logoRegionWidthPx - 12, logoRegionHeightPx - 12);
    const horizontalOffset = Math.max((logoRegionWidthPx - imageSize) / 2, 0);
    const verticalOffset = Math.max((logoRegionHeightPx - imageSize) / 2, 0);
    const firstColumnWidthPx = CHECKLIST_COLUMN_WIDTHS[META_LOGO_START_COL - 1] * 7;
    const firstRowHeightPx = rowHeights[0] * (96 / 72);

    sheet.addImage(imageId, {
        tl: {
            col: META_LOGO_START_COL - 1 + horizontalOffset / firstColumnWidthPx,
            row: startRow - 1 + verticalOffset / firstRowHeightPx,
        },
        ext: { width: imageSize, height: imageSize },
    });
}

function writeTableHeader(sheet: ExcelJS.Worksheet, rowIndex: number) {
    const row = sheet.getRow(rowIndex);
    CHECKLIST_EXPORT_COLUMNS.forEach((header, index) => {
        const cell = row.getCell(index + 1);
        cell.value = header;
        cell.font = { bold: true };
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
        cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: CHECKLIST_EXPORT_COLORS.headerBg },
        };
        cell.border = THIN_BORDER;
    });
    row.height = 22;
}

async function populateWorksheet(
    workbook: ExcelJS.Workbook,
    sheet: ExcelJS.Worksheet,
    model: ChecklistDocumentModel,
) {
    // Compact widths keep the sheet close to the on-screen preview instead
    // of making long descriptions or the logo stretch the full worksheet.
    sheet.columns = CHECKLIST_COLUMN_WIDTHS.map(width => ({ width }));

    let rowIndex = 1;
    let metaLogoStartRow: number | null = null;
    let metaLogoEndRow: number | null = null;

    for (const exportRow of model.rows) {
        switch (exportRow.type) {
            case "title": {
                sheet.mergeCells(rowIndex, 1, rowIndex, CHECKLIST_COLUMN_COUNT);
                const cell = sheet.getCell(rowIndex, 1);
                cell.value = exportRow.text;
                cell.font = { bold: true, size: 14 };
                cell.alignment = { horizontal: "center", vertical: "middle" };
                fillHeaderRow(
                    sheet.getRow(rowIndex),
                    1,
                    CHECKLIST_COLUMN_COUNT,
                    CHECKLIST_EXPORT_COLORS.titleBg,
                    true,
                );
                sheet.getRow(rowIndex).height = 28;
                rowIndex += 1;
                break;
            }
            case "meta": {
                const row = sheet.getRow(rowIndex);
                if (metaLogoStartRow === null) metaLogoStartRow = rowIndex;
                metaLogoEndRow = rowIndex;

                sheet.mergeCells(rowIndex, 1, rowIndex, META_LABEL_END_COL);
                row.getCell(1).value = `${exportRow.label} :`;
                row.getCell(1).font = { bold: true };
                row.getCell(1).alignment = { horizontal: "left", vertical: "top", wrapText: false };

                sheet.mergeCells(rowIndex, META_VALUE_START_COL, rowIndex, META_VALUE_END_COL);
                row.getCell(META_VALUE_START_COL).value = exportRow.value;
                row.getCell(META_VALUE_START_COL).alignment = {
                    wrapText: true,
                    vertical: "top",
                    horizontal: "left",
                };

                clearBorderRange(row, 1, CHECKLIST_COLUMN_COUNT);
                row.height = 20;
                rowIndex += 1;
                break;
            }
            case "table-header": {
                writeTableHeader(sheet, rowIndex);
                rowIndex += 1;
                break;
            }
            case "category": {
                const row = sheet.getRow(rowIndex);
                sheet.mergeCells(rowIndex, 1, rowIndex, CHECKLIST_COLUMN_COUNT);
                row.getCell(1).value = exportRow.name.toUpperCase();
                fillRow(row, 1, CHECKLIST_COLUMN_COUNT, CHECKLIST_EXPORT_COLORS.categoryBg);
                row.getCell(1).font = { bold: true };
                row.height = 20;
                rowIndex += 1;
                break;
            }
            case "subCategory": {
                const row = sheet.getRow(rowIndex);
                sheet.mergeCells(rowIndex, 1, rowIndex, CHECKLIST_COLUMN_COUNT);
                row.getCell(1).value = exportRow.name;
                fillRow(row, 1, CHECKLIST_COLUMN_COUNT, CHECKLIST_EXPORT_COLORS.subCategoryBg);
                row.getCell(1).font = { bold: true };
                row.height = 20;
                rowIndex += 1;
                break;
            }
            case "item": {
                const row = sheet.getRow(rowIndex);
                const item = exportRow.item;
                row.getCell(1).value = exportRow.serial;
                row.getCell(1).alignment = { horizontal: "center", vertical: "top" };
                row.getCell(2).value = getChecklistItemName(item);
                row.getCell(2).alignment = { horizontal: "left", vertical: "top", wrapText: true };
                row.getCell(3).value = getChecklistItemDetails(item);
                row.getCell(3).alignment = { horizontal: "left", vertical: "top", wrapText: true };
                row.getCell(4).value = item.quantity ?? 0;
                row.getCell(4).alignment = { horizontal: "center", vertical: "top" };
                row.getCell(5).value = item.days ?? "-";
                row.getCell(5).alignment = { horizontal: "center", vertical: "top" };
                row.getCell(6).value = exportRow.vendorDisplay;
                row.getCell(6).alignment = { horizontal: "left", vertical: "top", wrapText: true };
                row.getCell(7).value = getChecklistStatusLabel(item.status);
                row.getCell(7).alignment = { horizontal: "center", vertical: "top" };
                row.getCell(8).value = getChecklistDeadlineDisplay(item);
                row.getCell(8).alignment = { horizontal: "center", vertical: "top", wrapText: true };
                applyBorderRange(row, 1, CHECKLIST_COLUMN_COUNT);
                const wrappedLines = Math.max(
                    estimateWrappedLines(String(row.getCell(2).value ?? ""), CHECKLIST_COLUMN_WIDTHS[1]),
                    estimateWrappedLines(String(row.getCell(3).value ?? ""), CHECKLIST_COLUMN_WIDTHS[2]),
                    estimateWrappedLines(String(row.getCell(6).value ?? ""), CHECKLIST_COLUMN_WIDTHS[5]),
                    estimateWrappedLines(String(row.getCell(8).value ?? ""), CHECKLIST_COLUMN_WIDTHS[7]),
                );
                row.height = Math.max(28, wrappedLines * 14 + 8);
                rowIndex += 1;
                break;
            }
            default:
                break;
        }
    }

    if (metaLogoStartRow !== null && metaLogoEndRow !== null) {
        await embedLogoInWorksheet(workbook, sheet, metaLogoStartRow, metaLogoEndRow);
    }
}

function triggerDownload(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    window.URL.revokeObjectURL(url);
}

export async function generateChecklistExcelBuffer(
    checklistData: ChecklistItem[],
    context: ChecklistExportContext = {},
    vendorList: { id?: string | number; name?: string }[] = [],
    inventoryList: { id?: string | number; itemName?: string }[] = [],
): Promise<ArrayBuffer> {
    const model = buildChecklistDocumentModel(
        checklistData,
        context,
        vendorList,
        inventoryList,
    );
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Zentra";
    const sheet = workbook.addWorksheet("Checklist", {
        views: [{ showGridLines: true }],
    });

    await populateWorksheet(workbook, sheet, model);

    return workbook.xlsx.writeBuffer();
}

export async function downloadChecklistExcel(
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
    const buffer = await generateChecklistExcelBuffer(
        checklistData,
        context,
        vendorList,
        inventoryList,
    );
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    triggerDownload(blob, `${model.filenameBase}.xlsx`);
}
