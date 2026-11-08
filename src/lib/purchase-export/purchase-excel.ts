import ExcelJS from "exceljs";
import { downloadBlob } from "@/lib/document-export/download";
import { getEstimateLogoPngBase64 } from "@/lib/estimate-export/estimate-logo";
import { formatExportCurrency, toRomanLower } from "@/lib/utils";
import { formatShortDate } from "@/lib/utils/date";
import type { CategoryPurchaseRow, EventResponse, VendorFinancialRow } from "@/types/event";
import {
    buildPurchaseOrderDocumentModel,
    PURCHASE_EXPORT_COLORS,
    PURCHASE_PAYMENT_TERMS,
} from "./purchase-document";

const BORDER: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: PURCHASE_EXPORT_COLORS.border } },
    left: { style: "thin", color: { argb: PURCHASE_EXPORT_COLORS.border } },
    bottom: { style: "thin", color: { argb: PURCHASE_EXPORT_COLORS.border } },
    right: { style: "thin", color: { argb: PURCHASE_EXPORT_COLORS.border } },
};

function fillRow(row: ExcelJS.Row, endColumn: number, color: string, bold = false) {
    for (let column = 1; column <= endColumn; column++) {
        const cell = row.getCell(column);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
        cell.border = BORDER;
        if (bold) cell.font = { ...(cell.font ?? {}), bold: true };
    }
}

function addSectionTitle(
    sheet: ExcelJS.Worksheet,
    rowIndex: number,
    title: string,
    endColumn: number,
) {
    sheet.mergeCells(rowIndex, 1, rowIndex, endColumn);
    const cell = sheet.getCell(rowIndex, 1);
    cell.value = title;
    cell.font = { bold: true, size: 11 };
    cell.alignment = { vertical: "middle" };
    cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: PURCHASE_EXPORT_COLORS.summaryBg },
    };
    sheet.getRow(rowIndex).height = 22;
}

async function populatePurchaseOrderSheet(
    workbook: ExcelJS.Workbook,
    sheet: ExcelJS.Worksheet,
    eventData: EventResponse,
    eventName: string | undefined,
    categories: CategoryPurchaseRow[],
    vendorRows: VendorFinancialRow[],
    options?: {
        totalEstimatedCost?: number;
        includeProfitSummary?: boolean;
        expenseSummary?: {
            startDate: string;
            endDate?: string;
            totalAmount: number;
            hasExpenses: boolean;
        } | null;
    },
) {
    const model = buildPurchaseOrderDocumentModel(
        eventData,
        eventName,
        categories,
        vendorRows,
        options,
    );
    const headers = [
        "Sl. No",
        "Item",
        "Description",
        "Days",
        "Qty",
        "Unit",
        "Rate",
        "Total Amount",
        "GST Amount",
        "TDS Amount",
        "Net Total",
        "Vendor",
    ];
    sheet.columns = [12, 28, 40, 10, 10, 12, 16, 18, 16, 16, 18, 24].map(width => ({ width }));

    sheet.mergeCells(1, 1, 1, 12);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = `Purchase Order — ${model.title}`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    fillRow(sheet.getRow(1), 12, PURCHASE_EXPORT_COLORS.titleBg, true);
    sheet.getRow(1).height = 28;
    let rowIndex = 2;
    for (const meta of model.meta) {
        const row = sheet.getRow(rowIndex++);
        row.getCell(1).value = `${meta.label}:`;
        row.getCell(1).font = { bold: true };
        sheet.mergeCells(row.number, 2, row.number, 10);
        row.getCell(2).value = meta.value;
        row.getCell(2).alignment = { wrapText: true, vertical: "top" };
        row.height = 20;
    }

    rowIndex += 1;
    addSectionTitle(sheet, rowIndex++, "Terms & Conditions", 12);
    sheet.getCell(rowIndex - 1, 1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF9FAFB" },
    };
    for (const [label, value] of PURCHASE_PAYMENT_TERMS) {
        const row = sheet.getRow(rowIndex++);
        row.getCell(1).value = label;
        row.getCell(1).font = { bold: true };
        sheet.mergeCells(row.number, 2, row.number, 12);
        row.getCell(2).value = value;
    }
    rowIndex += 1;

    model.categories.forEach((category, categoryIndex) => {
        const categoryRow = sheet.getRow(rowIndex++);
        sheet.mergeCells(categoryRow.number, 1, categoryRow.number, 11);
        categoryRow.getCell(1).value = `${toRomanLower(categoryIndex + 1)}. ${category.category}`;
        categoryRow.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
        categoryRow.getCell(12).value =
            `${category.items.length} item${category.items.length === 1 ? "" : "s"}`;
        categoryRow.getCell(12).alignment = { horizontal: "right" };
        fillRow(categoryRow, 12, PURCHASE_EXPORT_COLORS.categoryBg, true);
        const header = sheet.getRow(rowIndex++);
        headers.forEach((label, index) => {
            const cell = header.getCell(index + 1);
            cell.value = label;
            cell.font = { bold: true };
            cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: PURCHASE_EXPORT_COLORS.headerBg },
            };
            cell.border = BORDER;
        });
        header.height = 30;
        let serial = 1;
        const appendItem = (item: CategoryPurchaseRow["items"][number]) => {
            const row = sheet.getRow(rowIndex++);
            [
                serial++,
                item.itemName,
                item.description || "—",
                item.days,
                item.qty,
                item.unit || "nos",
                item.rate,
                item.amount,
                item.gstAmount,
                -item.tdsAmount,
                item.netTotal,
                item.vendorName,
            ].forEach((value, index) => {
                const cell = row.getCell(index + 1);
                cell.value = value;
                cell.border = BORDER;
                cell.alignment = {
                    vertical: "top",
                    wrapText: true,
                    horizontal:
                        index === 0
                            ? "center"
                            : [3, 4, 5, 6, 7, 8, 9, 10].includes(index)
                              ? "right"
                              : "left",
                };
                if ([6, 7, 8, 9, 10].includes(index)) {
                    cell.numFmt =
                        index === 8 || index === 9 ? '+#,##0.00;-#,##0.00;"—"' : "#,##0.00";
                }
            });
            row.height = 30;
        };
        category.directItems.forEach(appendItem);
        category.subCategories.forEach(sub => {
            const subRow = sheet.getRow(rowIndex++);
            subRow.getCell(2).value = `Sub Category: ${sub.name}`;
            fillRow(subRow, 12, PURCHASE_EXPORT_COLORS.subCategoryBg, true);
            sub.items.forEach(appendItem);
        });
        const netSubtotal = category.items.reduce((sum, item) => sum + item.netTotal, 0);
        for (const [label, value, color] of [
            ["Category Subtotal", category.subtotal, PURCHASE_EXPORT_COLORS.subtotalBg],
            ["Net Subtotal", netSubtotal, PURCHASE_EXPORT_COLORS.totalBg],
        ] as const) {
            const row = sheet.getRow(rowIndex++);
            sheet.mergeCells(row.number, 1, row.number, 7);
            row.getCell(1).value = label;
            sheet.mergeCells(row.number, 8, row.number, 12);
            row.getCell(8).value = value;
            row.getCell(8).numFmt = "#,##0.00";
            row.getCell(8).alignment = { horizontal: "right" };
            fillRow(row, 12, color, true);
        }
        rowIndex += 1;
    });

    if (model.vendorRows.length) {
        rowIndex += 1;
        addSectionTitle(sheet, rowIndex++, "Vendor-Wise Financial Summary", 12);
        const vendorHeaders = [
            "Vendor",
            "Total Amount",
            "GST",
            "TDS",
            "Net Total",
            "Advance Paid",
            "Balance",
        ];
        const vendorColumnSpans: [number, number][] = [
            [1, 2],
            [3, 4],
            [5, 5],
            [6, 6],
            [7, 8],
            [9, 10],
            [11, 12],
        ];
        const vendorHeader = sheet.getRow(rowIndex++);
        vendorHeaders.forEach((label, index) => {
            const [startColumn, endColumn] = vendorColumnSpans[index];
            if (endColumn > startColumn)
                sheet.mergeCells(vendorHeader.number, startColumn, vendorHeader.number, endColumn);
            const cell = vendorHeader.getCell(startColumn);
            cell.value = label;
            cell.font = { bold: true };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: PURCHASE_EXPORT_COLORS.vendorFinBg },
            };
            cell.border = BORDER;
            for (let column = startColumn; column <= endColumn; column++)
                vendorHeader.getCell(column).border = BORDER;
        });
        model.vendorRows.forEach(vendor => {
            const row = sheet.getRow(rowIndex++);
            const values = [
                vendor.vendorName,
                vendor.totalAmount,
                vendor.gstPercent > 0
                    ? `${formatExportCurrency(vendor.totalAmount * (vendor.gstPercent / 100))}\n(${vendor.gstPercent}%)`
                    : "—",
                vendor.tdsPercent > 0
                    ? `${formatExportCurrency(vendor.totalAmount * (vendor.tdsPercent / 100))}\n(${vendor.tdsPercent}%)`
                    : "—",
                vendor.adjustedAmt,
                vendor.advanceAmount,
                vendor.balance,
            ];
            values.forEach((value, index) => {
                const [startColumn, endColumn] = vendorColumnSpans[index];
                if (endColumn > startColumn)
                    sheet.mergeCells(row.number, startColumn, row.number, endColumn);
                const cell = row.getCell(startColumn);
                cell.value = value;
                cell.border = BORDER;
                for (let column = startColumn; column <= endColumn; column++)
                    row.getCell(column).border = BORDER;
                if ([1, 2, 3, 4, 5, 6].includes(index)) {
                    cell.alignment = { horizontal: "right", wrapText: [2, 3].includes(index) };
                    if ([1, 4, 5, 6].includes(index)) cell.numFmt = "#,##0.00";
                }
            });
            row.height = 28;
        });
        const vendorTotal = sheet.getRow(rowIndex++);
        const vendorTotals = [
            "GRAND TOTAL",
            model.vendorRows.reduce((sum, vendor) => sum + vendor.totalAmount, 0),
            model.vendorRows.reduce(
                (sum, vendor) => sum + (vendor.totalAmount * vendor.gstPercent) / 100,
                0,
            ),
            -model.vendorRows.reduce(
                (sum, vendor) => sum + (vendor.totalAmount * vendor.tdsPercent) / 100,
                0,
            ),
            model.vendorRows.reduce((sum, vendor) => sum + vendor.adjustedAmt, 0),
            model.vendorRows.reduce((sum, vendor) => sum + vendor.advanceAmount, 0),
            model.vendorRows.reduce((sum, vendor) => sum + vendor.balance, 0),
        ];
        vendorTotals.forEach((value, index) => {
            const [startColumn, endColumn] = vendorColumnSpans[index];
            if (endColumn > startColumn)
                sheet.mergeCells(vendorTotal.number, startColumn, vendorTotal.number, endColumn);
            const cell = vendorTotal.getCell(startColumn);
            cell.value = value;
            cell.border = BORDER;
            cell.font = { bold: true };
            for (let column = startColumn; column <= endColumn; column++)
                vendorTotal.getCell(column).border = BORDER;
            if (index > 0) {
                cell.alignment = { horizontal: "right" };
                if ([2, 3].includes(index)) cell.numFmt = '+#,##0.00;-#,##0.00;"—"';
                else if ([1, 4, 5, 6].includes(index)) cell.numFmt = "#,##0.00";
            }
        });
        fillRow(vendorTotal, 12, PURCHASE_EXPORT_COLORS.totalBg, true);
    }

    rowIndex += 1;
    addSectionTitle(sheet, rowIndex++, "Consolidated Vendor Summary", 8);
    const { subtotal, tds, afterTax, advance, outstanding } = model.totals;
    const grandGstAmount = model.vendorRows.reduce(
        (sum, v) => sum + v.totalAmount * ((v.gstPercent ?? 0) / 100),
        0,
    );
    const summaryRows: [string, number, string][] = [
        ["GRAND TOTAL (Subtotal)", subtotal, PURCHASE_EXPORT_COLORS.subtotalBg],
        ...(grandGstAmount > 0
            ? [
                  ["Total GST", grandGstAmount, PURCHASE_EXPORT_COLORS.summaryBg] as [
                      string,
                      number,
                      string,
                  ],
              ]
            : []),
        ...(tds > 0
            ? [["Total TDS", -tds, PURCHASE_EXPORT_COLORS.summaryBg] as [string, number, string]]
            : []),
        ["GRAND TOTAL (After Tax)", afterTax, PURCHASE_EXPORT_COLORS.totalBg],
        ...(advance > 0
            ? [
                  ["Total Advance Paid", -advance, PURCHASE_EXPORT_COLORS.summaryBg] as [
                      string,
                      number,
                      string,
                  ],
              ]
            : []),
        ["GRAND OUTSTANDING BALANCE", outstanding, PURCHASE_EXPORT_COLORS.balanceBg],
        // Keep the after-tax and advance rows distinct as in the preview.
    ];
    summaryRows.forEach(([label, value, color]) => {
        const row = sheet.getRow(rowIndex++);
        sheet.mergeCells(row.number, 1, row.number, 6);
        sheet.mergeCells(row.number, 7, row.number, 8);
        row.getCell(1).value = label;
        row.getCell(7).value = value;
        row.getCell(7).numFmt = "#,##0.00";
        row.getCell(7).alignment = { horizontal: "right" };
        const rowColor = label === "Total Advance Paid" ? PURCHASE_EXPORT_COLORS.advanceBg : color;
        fillRow(row, 8, rowColor, label.startsWith("GRAND"));
    });
    if (model.amountInWords) {
        const row = sheet.getRow(rowIndex + 1);
        row.getCell(1).value = "Amount in Words:";
        row.getCell(1).font = { bold: true };
        sheet.mergeCells(row.number, 2, row.number, 12);
        row.getCell(2).value = model.amountInWords;
        row.getCell(2).alignment = { wrapText: true };
    }

    if (model.expenseSummary) {
        const es = model.expenseSummary;
        const dateRange = es.endDate ? `${es.startDate} - ${es.endDate}` : es.startDate;
        rowIndex += 1;
        addSectionTitle(sheet, rowIndex++, "Expenses Summary", 12);
        const header = sheet.getRow(rowIndex++);
        ["Event Date", "Total Amount"].forEach((label, index) => {
            const cell = header.getCell(index + 1);
            cell.value = label;
            cell.font = { bold: true };
            cell.alignment = {
                horizontal: "center",
                vertical: "middle",
                wrapText: true,
            };
            cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: PURCHASE_EXPORT_COLORS.headerBg },
            };
            cell.border = BORDER;
        });
        header.height = 30;
        const row = sheet.getRow(rowIndex++);
        sheet.mergeCells(row.number, 1, row.number, 6);
        sheet.mergeCells(row.number, 7, row.number, 12);
        row.getCell(1).value = dateRange;
        row.getCell(1).alignment = { horizontal: "center", vertical: "top", wrapText: true };
        row.getCell(7).value = es.hasExpenses ? es.totalAmount : "No expenses";
        row.getCell(7).numFmt = "#,##0.00";
        row.getCell(7).alignment = { horizontal: "right", vertical: "top" };
        fillRow(row, 12, PURCHASE_EXPORT_COLORS.summaryBg, false);
        rowIndex += 1;
    }

    if (model.clientBillSummary) {
        rowIndex += 2;
        addSectionTitle(sheet, rowIndex++, "Client Bill Summary", 12);
        const cb = model.clientBillSummary;
        const receivedLabel = `Amount Received from Client${
            model.amountRecievedFromClientDate
                ? ` (${formatShortDate(model.amountRecievedFromClientDate)})`
                : ""
        }`;
        const clientBillRows: [string, number, string][] = [
            ["Estimated Amount", cb.estimatedAmount, PURCHASE_EXPORT_COLORS.summaryBg],
            [
                `Service Charge (${model.profitSummary?.serviceChargePercent ?? 0}%)`,
                cb.serviceChargeAmount,
                PURCHASE_EXPORT_COLORS.summaryBg,
            ],
            ["Discount", -cb.discountAmount, PURCHASE_EXPORT_COLORS.summaryBg],
            ["Original Amount", cb.originalAmount, PURCHASE_EXPORT_COLORS.summaryBg],
            ["GST Amount", cb.gstAmount, PURCHASE_EXPORT_COLORS.summaryBg],
            ["Total (Original + GST)", cb.total, PURCHASE_EXPORT_COLORS.totalBg],
            [receivedLabel, cb.amountReceivedFromClient, PURCHASE_EXPORT_COLORS.summaryBg],
            ["TDS Deducted by Client", cb.tdsDeducted, PURCHASE_EXPORT_COLORS.summaryBg],
            ["Final Amount", cb.finalAmount, PURCHASE_EXPORT_COLORS.summaryBg],
            ["Advance", cb.advance, PURCHASE_EXPORT_COLORS.summaryBg],
            ["Balance", cb.balance, PURCHASE_EXPORT_COLORS.balanceBg],
        ];
        clientBillRows.forEach(([label, value, color]) => {
            const row = sheet.getRow(rowIndex++);
            sheet.mergeCells(row.number, 1, row.number, 6);
            sheet.mergeCells(row.number, 7, row.number, 12);
            row.getCell(1).value = label;
            row.getCell(7).value = value;
            row.getCell(7).numFmt = "#,##0.00";
            row.getCell(7).alignment = { horizontal: "right" };
            fillRow(
                row,
                12,
                color,
                label === "Total (Original + GST)" ||
                    label === "Final Amount" ||
                    label === "Balance",
            );
        });
    }

    if (model.profitSummary) {
        rowIndex += 2;
        addSectionTitle(sheet, rowIndex++, "Profit Summary", 12);
        const profit = model.profitSummary;
        const profitRows: [string, number, string][] = [
            [
                "Total (Original + GST)",
                profit.taxableAmount + profit.gstAmount,
                PURCHASE_EXPORT_COLORS.totalBg,
            ],
            ["Applied TDS Amount", -profit.tdsAmount, PURCHASE_EXPORT_COLORS.summaryBg],
            [
                "Total Client Billed Amount",
                profit.totalClientBilledAmount,
                PURCHASE_EXPORT_COLORS.subtotalBg,
            ],
            ["Total Vendor GST", profit.totalVendorGst, PURCHASE_EXPORT_COLORS.summaryBg],
            ["Total Vendor TDS", -profit.totalVendorTds, PURCHASE_EXPORT_COLORS.summaryBg],
            ["Net Vendor Total", profit.totalVendorNet, PURCHASE_EXPORT_COLORS.summaryBg],
            [
                "Client Billed Amount without GST",
                profit.clientBilledWithoutGst,
                PURCHASE_EXPORT_COLORS.totalBg,
            ],
            ["Profit", profit.profit, PURCHASE_EXPORT_COLORS.balanceBg],
            ["Net Hand", profit.netHand, PURCHASE_EXPORT_COLORS.advanceBg],
        ];
        profitRows.forEach(([label, value, color]) => {
            const row = sheet.getRow(rowIndex++);
            sheet.mergeCells(row.number, 1, row.number, 6);
            sheet.mergeCells(row.number, 7, row.number, 12);
            row.getCell(1).value = label;
            row.getCell(7).value = value;
            row.getCell(7).numFmt = '#,##0.00;[Red]-#,##0.00;"—"';
            row.getCell(7).alignment = { horizontal: "right" };
            fillRow(
                row,
                12,
                color,
                label === "Total Client Billed Amount" ||
                    label === "Client Billed Amount without GST" ||
                    label === "Profit" ||
                    label === "Net Hand",
            );
        });
        const note = sheet.getRow(rowIndex + 1);
        sheet.mergeCells(note.number, 1, note.number, 12);
        note.getCell(1).value =
            "Internal view — event management team P&L (net revenue includes GST and any additional estimates; vendor cost includes tax).";
        note.getCell(1).font = { italic: true, size: 9, color: { argb: "FF6B7280" } };
        note.getCell(1).alignment = { wrapText: true };
    }

    const metaStartRow = 2;
    const metaEndRow = metaStartRow + model.meta.length - 1;
    if (model.meta.length > 0) sheet.mergeCells(metaStartRow, 11, metaEndRow, 12);
    const logo = await getEstimateLogoPngBase64();
    if (logo) {
        const id = workbook.addImage({ base64: logo, extension: "png" });
        const metaHeight = model.meta.length * 20;
        const imageHeight = Math.min(80, Math.max(40, metaHeight - 12));
        sheet.addImage(id, {
            tl: {
                col: 10.7,
                row: metaStartRow - 1 + Math.max((model.meta.length - imageHeight / 26.67) / 2, 0),
            },
            ext: { width: 105, height: imageHeight },
        });
    }
    sheet.views = [{ showGridLines: false, state: "frozen", ySplit: 1 }];
    sheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
}

export async function generatePurchaseOrderExcelBuffer(
    eventData: EventResponse,
    eventName: string | undefined,
    categories: CategoryPurchaseRow[],
    vendorRows: VendorFinancialRow[],
    options?: {
        totalEstimatedCost?: number;
        includeProfitSummary?: boolean;
        expenseSummary?: {
            startDate: string;
            endDate?: string;
            totalAmount: number;
            hasExpenses: boolean;
        } | null;
    },
): Promise<ArrayBuffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Zentra";
    const sheet = workbook.addWorksheet("Purchase Order");
    await populatePurchaseOrderSheet(
        workbook,
        sheet,
        eventData,
        eventName,
        categories,
        vendorRows,
        options,
    );
    return workbook.xlsx.writeBuffer();
}

export async function downloadPurchaseOrderExcel(
    eventData: EventResponse,
    eventName: string | undefined,
    categories: CategoryPurchaseRow[],
    vendorRows: VendorFinancialRow[],
    options?: {
        totalEstimatedCost?: number;
        includeProfitSummary?: boolean;
        expenseSummary?: {
            startDate: string;
            endDate?: string;
            totalAmount: number;
            hasExpenses: boolean;
        } | null;
    },
) {
    const model = buildPurchaseOrderDocumentModel(
        eventData,
        eventName,
        categories,
        vendorRows,
        options,
    );
    const buffer = await generatePurchaseOrderExcelBuffer(
        eventData,
        eventName,
        categories,
        vendorRows,
        options,
    );
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, `${model.filenameBase}.xlsx`);
}
