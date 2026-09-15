import ExcelJS from "exceljs";
import type { ChecklistItem } from "@/components/checklist-modal/types";
import {
    buildChecklistDocumentModel,
    CHECKLIST_COLUMN_COUNT,
    CHECKLIST_EXPORT_COLORS,
    CHECKLIST_EXPORT_COLUMNS,
    getChecklistItemDetails,
    getChecklistItemName,
    getChecklistItemUnit,
    type ChecklistDocumentModel,
    type ChecklistExportContext,
} from "./checklist-document";
import { getEstimateLogoPngBase64 } from "@/lib/estimate-export/estimate-logo";

const THIN_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: CHECKLIST_EXPORT_COLORS.border } },
    left: { style: "thin", color: { argb: CHECKLIST_EXPORT_COLORS.border } },
    bottom: { style: "thin", color: { argb: CHECKLIST_EXPORT_COLORS.border } },
    right: { style: "thin", color: { argb: CHECKLIST_EXPORT_COLORS.border } },
};

const SERIAL_COLUMN_WIDTH = 10;
const LOGO_COLUMN_WIDTH = 18;
const LOGO_COLUMN_INDEX = CHECKLIST_COLUMN_COUNT + 1;
const META_VALUE_END_COL = CHECKLIST_COLUMN_COUNT - 1;

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

function setupLogoArea(sheet: ExcelJS.Worksheet, startRow: number, endRow: number) {
    sheet.mergeCells(startRow, LOGO_COLUMN_INDEX, endRow, LOGO_COLUMN_INDEX);
    const logoCell = sheet.getCell(startRow, LOGO_COLUMN_INDEX);
    logoCell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    clearCellBorders(logoCell);
    for (let r = startRow; r <= endRow; r++) {
        clearBorderRange(sheet.getRow(r), 1, LOGO_COLUMN_INDEX);
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
        tl: { col: LOGO_COLUMN_INDEX - 1 + 0.15, row: startRow - 1 + 0.08 },
        ext: { width: imageWidthPx, height: imageHeightPx },
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
    sheet.columns = [
        { width: SERIAL_COLUMN_WIDTH },
        { width: 24 },
        { width: 36 },
        { width: 8 },
        { width: 10 },
        { width: 8 },
        { width: 18 },
        { width: 14 },
        { width: 12 },
        { width: 12 },
        { width: LOGO_COLUMN_WIDTH },
    ];

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

                row.getCell(1).value = `${exportRow.label} :`;
                row.getCell(1).font = { bold: true };
                row.getCell(1).alignment = { horizontal: "left", vertical: "top", wrapText: true };

                sheet.mergeCells(rowIndex, 2, rowIndex, META_VALUE_END_COL);
                row.getCell(2).value = exportRow.value;
                row.getCell(2).alignment = { wrapText: true, vertical: "top", horizontal: "left" };

                clearBorderRange(row, 1, LOGO_COLUMN_INDEX);
                row.height = 18;
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
                row.getCell(1).value = exportRow.serial;
                row.getCell(1).alignment = { horizontal: "center", vertical: "middle" };
                row.getCell(2).value = exportRow.name;
                row.getCell(2).font = { bold: true };
                fillRow(row, 1, CHECKLIST_COLUMN_COUNT, CHECKLIST_EXPORT_COLORS.categoryBg);
                row.getCell(2).font = { bold: true };
                row.height = 20;
                rowIndex += 1;
                break;
            }
            case "subCategory": {
                const row = sheet.getRow(rowIndex);
                row.getCell(2).value = `Sub Category: ${exportRow.name}`;
                row.getCell(2).font = { bold: true };
                fillRow(row, 1, CHECKLIST_COLUMN_COUNT, CHECKLIST_EXPORT_COLORS.subCategoryBg);
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
                row.getCell(2).value = getChecklistItemName(item);
                row.getCell(2).alignment = { horizontal: "left", vertical: "top", wrapText: true };
                row.getCell(3).value = getChecklistItemDetails(item);
                row.getCell(3).alignment = { horizontal: "left", vertical: "top", wrapText: true };
                row.getCell(4).value = item.quantity ?? 0;
                row.getCell(4).alignment = { horizontal: "right", vertical: "top" };
                row.getCell(5).value = getChecklistItemUnit(item);
                row.getCell(5).alignment = { horizontal: "center", vertical: "top" };
                row.getCell(6).value = item.days ?? "—";
                row.getCell(6).alignment = { horizontal: "center", vertical: "top" };
                row.getCell(7).value = exportRow.vendorDisplay;
                row.getCell(7).alignment = { horizontal: "left", vertical: "top", wrapText: true };
                row.getCell(8).value = item.status || "PENDING";
                row.getCell(8).alignment = { horizontal: "center", vertical: "top" };
                row.getCell(9).value = item.deadlineDate || "—";
                row.getCell(9).alignment = { horizontal: "center", vertical: "top" };
                applyBorderRange(row, 1, CHECKLIST_COLUMN_COUNT);
                row.height = 28;
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
