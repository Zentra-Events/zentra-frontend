import { jsPDF } from "jspdf";
import autoTable, { type RowInput } from "jspdf-autotable";
import { formatExportCurrency, toRomanLower } from "@/lib/utils";
import { formatShortDate } from "@/lib/utils/date";
import { downloadBlob } from "@/lib/document-export/download";
import { getEstimateLogoDataUrl } from "@/lib/estimate-export/estimate-logo";
import {
    buildPurchaseOrderDocumentModel,
    purchaseArgbToRgb,
    PURCHASE_EXPORT_COLORS,
    PURCHASE_PAYMENT_TERMS,
    type PurchaseOrderDocumentModel,
} from "./purchase-document";
import type { CategoryPurchaseRow, EventResponse, VendorFinancialRow } from "@/types/event";

const AMOUNT_GREEN: [number, number, number] = [21, 128, 61];
const AMOUNT_DARK_GREEN: [number, number, number] = [22, 101, 52];
const AMOUNT_RED: [number, number, number] = [185, 28, 28];
const AMOUNT_MUTED: [number, number, number] = [107, 114, 128];
const TABLE_SECTION_GAP_MM = 10;

function addDocumentHeader(doc: jsPDF, model: PurchaseOrderDocumentModel) {
    const margin = 10;
    const width = doc.internal.pageSize.getWidth() - margin * 2;
    doc.setFillColor(...purchaseArgbToRgb(PURCHASE_EXPORT_COLORS.titleBg));
    doc.rect(margin, 8, width, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Purchase Order — ${model.title}`, doc.internal.pageSize.getWidth() / 2, 16, {
        align: "center",
    });
}

function addSectionHeading(doc: jsPDF, title: string, y: number): number {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(title.toUpperCase(), 10, y);
    doc.setTextColor(0, 0, 0);
    return y + 2;
}

function categoryTableRows(categories: CategoryPurchaseRow[]): {
    body: RowInput[];
    rowStyles: { fill?: string; bold?: boolean }[];
} {
    const body: RowInput[] = [];
    const rowStyles: { fill?: string; bold?: boolean }[] = [];
    categories.forEach((category, categoryIndex) => {
        body.push([
            toRomanLower(categoryIndex + 1),
            { content: category.category, colSpan: 10 },
            `${category.items.length} item${category.items.length === 1 ? "" : "s"}`,
        ]);
        rowStyles.push({ fill: PURCHASE_EXPORT_COLORS.categoryBg, bold: true });

        let serial = 1;
        const appendItem = (item: CategoryPurchaseRow["items"][number]) => {
            body.push([
                String(serial++),
                item.itemName,
                item.description || "—",
                String(item.days),
                String(item.qty),
                item.unit || "nos",
                formatExportCurrency(item.rate),
                formatExportCurrency(item.amount),
                item.gstAmount > 0 ? `+${formatExportCurrency(item.gstAmount)}` : "—",
                item.tdsAmount > 0 ? `-${formatExportCurrency(item.tdsAmount)}` : "—",
                formatExportCurrency(item.netTotal),
                item.vendorName,
            ]);
            rowStyles.push({});
        };
        category.directItems.forEach(appendItem);
        category.subCategories.forEach(sub => {
            body.push(["", { content: `Sub Category: ${sub.name}`, colSpan: 11 }]);
            rowStyles.push({ fill: PURCHASE_EXPORT_COLORS.subCategoryBg, bold: true });
            sub.items.forEach(appendItem);
        });

        const netSubtotal = category.items.reduce((sum, item) => sum + item.netTotal, 0);
        body.push([
            { content: "Category Subtotal", colSpan: 9 },
            { content: formatExportCurrency(category.subtotal), colSpan: 3 },
        ]);
        rowStyles.push({ fill: PURCHASE_EXPORT_COLORS.subtotalBg });
        body.push([
            { content: "Net SubTotal", colSpan: 9 },
            { content: formatExportCurrency(netSubtotal), colSpan: 3 },
        ]);
        rowStyles.push({ fill: PURCHASE_EXPORT_COLORS.totalBg, bold: true });
    });
    return { body, rowStyles };
}

export async function generatePurchaseOrderPdfBlob(
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
): Promise<Blob> {
    const model = buildPurchaseOrderDocumentModel(
        eventData,
        eventName,
        categories,
        vendorRows,
        options,
    );
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const logo = await getEstimateLogoDataUrl();
    addDocumentHeader(doc, model);
    let y = 27;
    doc.setFontSize(8);
    const metaStartY = y;
    model.meta.forEach(({ label, value }) => {
        doc.setFont("helvetica", "bold");
        doc.text(`${label}:`, 10, y);
        doc.setFont("helvetica", "normal");
        const text = doc.splitTextToSize(value, 80);
        doc.text(text, 38, y);
        y += Math.max(5, text.length * 4);
    });
    if (logo && model.meta.length > 0) {
        const logoHeight = 14;
        const metaHeight = y - metaStartY;
        const logoY = metaStartY + Math.max((metaHeight - logoHeight) / 2, 0);
        doc.addImage(logo, "PNG", doc.internal.pageSize.getWidth() - 31, logoY, 21, logoHeight);
    }
    y += 2;
    y = addSectionHeading(doc, "Terms & Conditions", y);
    const termsWidth = doc.internal.pageSize.getWidth() - 20;
    autoTable(doc, {
        startY: y,
        body: [
            [
                PURCHASE_PAYMENT_TERMS[0][0],
                PURCHASE_PAYMENT_TERMS[0][1],
                PURCHASE_PAYMENT_TERMS[1][0],
                PURCHASE_PAYMENT_TERMS[1][1],
            ],
            [
                PURCHASE_PAYMENT_TERMS[2][0],
                PURCHASE_PAYMENT_TERMS[2][1],
                PURCHASE_PAYMENT_TERMS[3][0],
                PURCHASE_PAYMENT_TERMS[3][1],
            ],
        ],
        tableWidth: termsWidth,
        theme: "grid",
        styles: {
            fontSize: 7.5,
            cellPadding: 2,
            lineColor: [209, 213, 219],
            lineWidth: 0.1,
            fillColor: [249, 250, 251],
            textColor: [31, 41, 55],
        },
        columnStyles: {
            0: { fontStyle: "bold", cellWidth: 30 },
            1: { cellWidth: 108 },
            2: { fontStyle: "bold", cellWidth: 30 },
            3: { cellWidth: termsWidth - 168 },
        },
        margin: { left: 10, right: 10 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + TABLE_SECTION_GAP_MM;

    y = addSectionHeading(doc, "Category-wise Item Breakdown", y);
    const { body: categoryBody, rowStyles } = categoryTableRows(model.categories);
    const contentWidth = doc.internal.pageSize.getWidth() - 20;
    autoTable(doc, {
        startY: y,
        head: [[
            "Sl. No",
            "Item",
            "Description",
            "Days",
            "Qty",
            "Unit",
            "Rate",
            "Total Amount",
            "GST(%)",
            "TDS(%)",
            "Net Total",
            "Vendor",
        ]],
        body: categoryBody,
        tableWidth: contentWidth,
        theme: "grid",
        styles: {
            fontSize: 7.5,
            cellPadding: 1.6,
            lineColor: [0, 0, 0],
            lineWidth: 0.1,
            overflow: "linebreak",
            textColor: [31, 41, 55],
        },
        headStyles: {
            fillColor: purchaseArgbToRgb(PURCHASE_EXPORT_COLORS.headerBg),
            textColor: [17, 24, 39],
            fontStyle: "bold",
            halign: "center",
        },
        columnStyles: {
            0: { cellWidth: 12, halign: "center" },
            1: { cellWidth: 42 },
            2: { cellWidth: 56 },
            3: { cellWidth: 9, halign: "right" },
            4: { cellWidth: 9, halign: "right" },
            5: { cellWidth: 13, halign: "center" },
            6: { cellWidth: 21, halign: "right" },
            7: { cellWidth: 23, halign: "right" },
            8: { cellWidth: 20, halign: "right" },
            9: { cellWidth: 20, halign: "right" },
            10: { cellWidth: 25, halign: "right" },
            11: { cellWidth: 27 },
        },
        didParseCell: data => {
            if (data.section !== "body") return;
            const style = rowStyles[data.row.index];
            if (style?.fill) data.cell.styles.fillColor = purchaseArgbToRgb(style.fill);
            if (style?.bold) data.cell.styles.fontStyle = "bold";
            if (!style?.fill && data.column.index === 8) data.cell.styles.textColor = [21, 128, 61];
            if (!style?.fill && data.column.index === 9) data.cell.styles.textColor = [185, 28, 28];
            if (style?.fill === PURCHASE_EXPORT_COLORS.categoryBg) {
                if (data.column.index === 0) data.cell.styles.halign = "center";
                if (data.column.index === 11) data.cell.styles.halign = "right";
            }
            if (
                style?.fill === PURCHASE_EXPORT_COLORS.subtotalBg ||
                style?.fill === PURCHASE_EXPORT_COLORS.totalBg
            ) {
                if (data.column.index === 0) data.cell.styles.halign = "left";
                if (data.column.index === 9) data.cell.styles.halign = "right";
            }
        },
        margin: { left: 10, right: 10 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + TABLE_SECTION_GAP_MM;

    if (model.vendorRows.length) {
        y = addSectionHeading(doc, "Vendor-Wise Financial Summary", y);
        autoTable(doc, {
            startY: y,
            head: [
                ["Vendor", "Total Amount", "GST", "TDS", "Net Total", "Advance Paid", "Balance"],
            ],
            body: [
                ...model.vendorRows.map(v => [
                    v.vendorName,
                    formatExportCurrency(v.totalAmount),
                    v.gstPercent > 0
                        ? `${formatExportCurrency(v.totalAmount * (v.gstPercent / 100))}\n(${v.gstPercent}%)`
                        : "—",
                    v.tdsPercent > 0
                        ? `${formatExportCurrency(v.totalAmount * (v.tdsPercent / 100))}\n(${v.tdsPercent}%)`
                        : "—",
                    formatExportCurrency(v.adjustedAmt),
                    formatExportCurrency(v.advanceAmount),
                    formatExportCurrency(v.balance),
                ]),
                [
                    "GRAND TOTAL",
                    formatExportCurrency(
                        model.vendorRows.reduce((sum, v) => sum + v.totalAmount, 0),
                    ),
                    `+${formatExportCurrency(model.vendorRows.reduce((sum, v) => sum + (v.totalAmount * v.gstPercent) / 100, 0))}`,
                    `-${formatExportCurrency(model.vendorRows.reduce((sum, v) => sum + (v.totalAmount * v.tdsPercent) / 100, 0))}`,
                    formatExportCurrency(
                        model.vendorRows.reduce((sum, v) => sum + v.adjustedAmt, 0),
                    ),
                    formatExportCurrency(
                        model.vendorRows.reduce((sum, v) => sum + v.advanceAmount, 0),
                    ),
                    formatExportCurrency(model.vendorRows.reduce((sum, v) => sum + v.balance, 0)),
                ],
            ],
            tableWidth: doc.internal.pageSize.getWidth() - 20,
            theme: "grid",
            styles: {
                fontSize: 7,
                cellPadding: 1.5,
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                overflow: "linebreak",
            },
            headStyles: {
                fillColor: purchaseArgbToRgb(PURCHASE_EXPORT_COLORS.vendorFinBg),
                textColor: [0, 0, 0],
                fontStyle: "bold",
            },
            didParseCell: data => {
                if (data.section !== "body") return;
                if (data.row.index === model.vendorRows.length) {
                    data.cell.styles.fillColor = purchaseArgbToRgb(PURCHASE_EXPORT_COLORS.totalBg);
                    data.cell.styles.fontStyle = "bold";
                }
                if (data.column.index === 2)
                    data.cell.styles.textColor =
                        data.row.index === model.vendorRows.length ||
                        model.vendorRows[data.row.index]?.gstPercent > 0
                            ? AMOUNT_GREEN
                            : AMOUNT_MUTED;
                if (data.column.index === 3)
                    data.cell.styles.textColor =
                        data.row.index === model.vendorRows.length ||
                        model.vendorRows[data.row.index]?.tdsPercent > 0
                            ? AMOUNT_RED
                            : AMOUNT_MUTED;
                if (data.column.index === 5) data.cell.styles.textColor = AMOUNT_RED;
                if (data.column.index === 6) data.cell.styles.textColor = AMOUNT_DARK_GREEN;
            },
            margin: { left: 10, right: 10 },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY + TABLE_SECTION_GAP_MM;
    }

    const { subtotal, tds, afterTax, advance, outstanding } = model.totals;
    const grandGstAmount = model.vendorRows.reduce(
        (sum, v) => sum + v.totalAmount * ((v.gstPercent ?? 0) / 100),
        0,
    );
    const summary: [string, string][] = [
        ["GRAND TOTAL (Subtotal)", formatExportCurrency(subtotal)],
    ];
    if (grandGstAmount > 0) {
        summary.push(["Total GST", `+${formatExportCurrency(grandGstAmount)}`]);
    }
    if (tds > 0) summary.push(["Total TDS", `-${formatExportCurrency(tds)}`]);
    summary.push(["GRAND TOTAL (After Tax)", formatExportCurrency(afterTax)]);
    if (advance > 0) summary.push(["Total Advance Paid", `-${formatExportCurrency(advance)}`]);
    summary.push(["GRAND OUTSTANDING BALANCE", formatExportCurrency(outstanding)]);
    const pageHeight = doc.internal.pageSize.getHeight();
    if (pageHeight - y < 45) {
        doc.addPage();
        y = 14;
    }
    y = addSectionHeading(doc, "Consolidated Vendor Summary", y);
    autoTable(doc, {
        startY: y,
        body: summary,
        tableWidth: doc.internal.pageSize.getWidth() - 20,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: {
            0: { cellWidth: contentWidth * 0.625, fontStyle: "bold" },
            1: { cellWidth: contentWidth * 0.375, halign: "right" },
        },
        didParseCell: data => {
            if (data.section !== "body") return;
            const label = summary[data.row.index][0];
            const color =
                label === "GRAND OUTSTANDING BALANCE"
                    ? PURCHASE_EXPORT_COLORS.balanceBg
                    : label === "Total Advance Paid"
                      ? PURCHASE_EXPORT_COLORS.advanceBg
                      : label === "GRAND TOTAL (After Tax)"
                        ? PURCHASE_EXPORT_COLORS.totalBg
                        : label === "GRAND TOTAL (Subtotal)"
                          ? PURCHASE_EXPORT_COLORS.subtotalBg
                          : PURCHASE_EXPORT_COLORS.summaryBg;
            data.cell.styles.fillColor = purchaseArgbToRgb(color);
            if (label.startsWith("GRAND")) data.cell.styles.fontStyle = "bold";
            if (data.column.index === 1) {
                if (label === "Total GST") data.cell.styles.textColor = AMOUNT_GREEN;
                if (label === "Total TDS" || label === "Total Advance Paid")
                    data.cell.styles.textColor = AMOUNT_RED;
                if (label === "GRAND OUTSTANDING BALANCE")
                    data.cell.styles.textColor = outstanding < 0 ? AMOUNT_RED : AMOUNT_DARK_GREEN;
            }
        },
        margin: { left: 10, right: 10 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 4;
    if (model.amountInWords) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("Amount in Words:", 10, y);
        doc.setFont("helvetica", "italic");
        doc.text(model.amountInWords, 42, y);
        y += 5;
    }
    y += TABLE_SECTION_GAP_MM;
    if (model.expenseSummary) {
        const es = model.expenseSummary;
        const dateRange = es.endDate ? `${es.startDate} - ${es.endDate}` : es.startDate;
        const pageHeight = doc.internal.pageSize.getHeight();
        if (pageHeight - y < 45) {
            doc.addPage();
            y = 14;
        }
        y = addSectionHeading(doc, "Expenses Summary", y);
        autoTable(doc, {
            startY: y,
            head: [["Event Date", "Total Amount"]],
            body: [
                [dateRange, es.hasExpenses ? formatExportCurrency(es.totalAmount) : "No expenses"],
            ],
            tableWidth: doc.internal.pageSize.getWidth() - 20,
            theme: "grid",
            styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
            columnStyles: {
                0: { cellWidth: contentWidth / 2, halign: "center" },
                1: { cellWidth: contentWidth / 2, halign: "right" },
            },
            headStyles: {
                fillColor: purchaseArgbToRgb(PURCHASE_EXPORT_COLORS.headerBg),
                textColor: [0, 0, 0],
                fontStyle: "bold",
                halign: "center",
            },
            margin: { left: 10, right: 10 },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY + TABLE_SECTION_GAP_MM;
    }
    if (model.clientBillSummary) {
        const cb = model.clientBillSummary;
        const rows: [string, string][] = [
            ["Estimated Amount", formatExportCurrency(cb.estimatedAmount)],
            [
                `Service Charge (${eventData.serviceCharge ?? 0}%)`,
                formatExportCurrency(cb.serviceChargeAmount),
            ],
            ["Discount", `-${formatExportCurrency(cb.discountAmount)}`],
            ["Original Amount", formatExportCurrency(cb.originalAmount)],
            ["GST Amount", formatExportCurrency(cb.gstAmount)],
            ["Total (Original + GST)", formatExportCurrency(cb.total)],
            [
                `Amount Received from Client${model.amountRecievedFromClientDate ? ` (${formatShortDate(model.amountRecievedFromClientDate)})` : ""}`,
                formatExportCurrency(cb.amountReceivedFromClient),
            ],
            ["TDS Deducted by Client", `-${formatExportCurrency(cb.tdsDeducted)}`],
            ["Final Amount", formatExportCurrency(cb.finalAmount)],
            ["Advance", formatExportCurrency(cb.advance)],
            ["Balance", formatExportCurrency(cb.balance)],
        ];
        const pageHeight = doc.internal.pageSize.getHeight();
        if (pageHeight - y < 45) {
            doc.addPage();
            y = 14;
        }
        y = addSectionHeading(doc, "Client Bill Summary", y);
        autoTable(doc, {
            startY: y,
            body: rows,
            tableWidth: doc.internal.pageSize.getWidth() - 20,
            theme: "grid",
            styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
            columnStyles: {
                0: { cellWidth: contentWidth / 2 },
                1: { cellWidth: contentWidth / 2, halign: "right" },
            },
            didParseCell: data => {
                if (data.section !== "body") return;
                const label = rows[data.row.index][0];
                const color =
                    label === "Balance"
                        ? PURCHASE_EXPORT_COLORS.balanceBg
                        : label === "Total (Original + GST)"
                          ? PURCHASE_EXPORT_COLORS.totalBg
                          : PURCHASE_EXPORT_COLORS.summaryBg;
                data.cell.styles.fillColor = purchaseArgbToRgb(color);
                if (
                    label === "Total (Original + GST)" ||
                    label === "Final Amount" ||
                    label === "Balance"
                ) {
                    data.cell.styles.fontStyle = "bold";
                }
                if (data.column.index === 1) {
                    if (
                        label.startsWith("Service Charge") ||
                        label === "GST Amount" ||
                        label.startsWith("Amount Received from Client") ||
                        label === "Advance"
                    ) {
                        data.cell.styles.textColor = AMOUNT_GREEN;
                    } else if (label === "Discount" || label === "TDS Deducted by Client") {
                        data.cell.styles.textColor = AMOUNT_RED;
                    } else if (label === "Final Amount") {
                        data.cell.styles.textColor = cb.finalAmount < 0 ? AMOUNT_RED : AMOUNT_GREEN;
                    } else if (label === "Balance") {
                        data.cell.styles.textColor = cb.balance < 0 ? AMOUNT_RED : AMOUNT_DARK_GREEN;
                    }
                }
            },
            margin: { left: 10, right: 10 },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY + TABLE_SECTION_GAP_MM;
    }
    if (model.profitSummary) {
        const profit = model.profitSummary;
        const rows: [string, string][] = [
            [
                "Total (Original + GST)",
                formatExportCurrency(profit.taxableAmount + profit.gstAmount),
            ],
            ["TDS Deducted (Applied TDS Amount)", `-${formatExportCurrency(profit.tdsAmount)}`],
            ["Total Client Billed Amount", formatExportCurrency(profit.totalClientBilledAmount)],
            ["Total Vendor GST", formatExportCurrency(profit.totalVendorGst)],
            ["Total Vendor TDS", `-${formatExportCurrency(profit.totalVendorTds)}`],
            ["Net Vendor Total", `-${formatExportCurrency(profit.totalVendorNet)}`],
            [
                "Client Billed Amount without GST",
                formatExportCurrency(profit.clientBilledWithoutGst),
            ],
            ["Profit", formatExportCurrency(profit.profit)],
            ["Net Hand", formatExportCurrency(profit.netHand)],
            ["Total Expenses", `-${formatExportCurrency(profit.totalExpenses)}`],
            ["Balance", formatExportCurrency(profit.balanceAfterExpenses)],
        ];
        const pageHeight = doc.internal.pageSize.getHeight();
        if (pageHeight - y < 45) {
            doc.addPage();
            y = 14;
        }
        y = addSectionHeading(doc, "Profit Summary", y);
        autoTable(doc, {
            startY: y,
            body: rows,
            tableWidth: doc.internal.pageSize.getWidth() - 20,
            theme: "grid",
            styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
            headStyles: {
                fillColor: purchaseArgbToRgb(PURCHASE_EXPORT_COLORS.headerBg),
                textColor: [0, 0, 0],
                fontStyle: "bold",
            },
            columnStyles: {
                0: { cellWidth: contentWidth / 2 },
                1: { cellWidth: contentWidth / 2, halign: "right" },
            },
            didParseCell: data => {
                if (data.section !== "body") return;
                const label = rows[data.row.index][0];
                const color =
                    label === "Total (Original + GST)"
                        ? PURCHASE_EXPORT_COLORS.totalBg
                        : label === "Total Client Billed Amount"
                          ? PURCHASE_EXPORT_COLORS.subtotalBg
                          : label === "Client Billed Amount without GST"
                            ? PURCHASE_EXPORT_COLORS.totalBg
                            : label === "Total Vendor GST" ||
                                label === "Total Vendor TDS" ||
                                label === "Net Vendor Total"
                              ? PURCHASE_EXPORT_COLORS.summaryBg
                              : label === "Profit"
                                ? PURCHASE_EXPORT_COLORS.balanceBg
                                : label === "Net Hand"
                                  ? PURCHASE_EXPORT_COLORS.balanceBg
                                  : label === "Total Expenses"
                                    ? PURCHASE_EXPORT_COLORS.advanceBg
                                    : label === "Balance"
                                      ? PURCHASE_EXPORT_COLORS.balanceBg
                                      : PURCHASE_EXPORT_COLORS.summaryBg;
                data.cell.styles.fillColor = purchaseArgbToRgb(color);
                if (data.column.index === 1) {
                    if (label === "Total Vendor GST") data.cell.styles.textColor = AMOUNT_GREEN;
                    if (
                        [
                            "TDS Deducted (Applied TDS Amount)",
                            "Total Vendor TDS",
                            "Net Vendor Total",
                            "Total Expenses",
                        ].includes(label)
                    ) {
                        data.cell.styles.textColor = AMOUNT_RED;
                    }
                    if (label === "Client Billed Amount without GST")
                        data.cell.styles.textColor = AMOUNT_DARK_GREEN;
                    if (label === "Profit")
                        data.cell.styles.textColor = profit.profit < 0 ? AMOUNT_RED : AMOUNT_DARK_GREEN;
                    if (label === "Net Hand")
                        data.cell.styles.textColor = profit.netHand < 0 ? AMOUNT_RED : AMOUNT_DARK_GREEN;
                    if (label === "Balance")
                        data.cell.styles.textColor =
                            profit.balanceAfterExpenses < 0 ? AMOUNT_RED : AMOUNT_DARK_GREEN;
                }
                if (
                    label === "Profit" ||
                    label === "Net Hand" ||
                    label === "Balance" ||
                    label.startsWith("Total Client") ||
                    label.startsWith("Client Billed") ||
                    label === "Total (Original + GST)"
                ) {
                    data.cell.styles.fontStyle = "bold";
                }
            },
            margin: { left: 10, right: 10 },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const finalY = (doc as any).lastAutoTable.finalY as number;
        const note =
            "Internal view — event management team P&L (net revenue includes GST and any additional estimates; vendor cost includes tax).";
        const noteLines = doc.splitTextToSize(note, contentWidth);
        const noteY = finalY + 4;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(7);
        doc.setTextColor(107, 114, 128);
        if (noteY + noteLines.length * 3.5 > doc.internal.pageSize.getHeight() - 8) {
            doc.addPage();
            doc.text(noteLines, 10, 14);
        } else {
            doc.text(noteLines, 10, noteY);
        }
        doc.setTextColor(0, 0, 0);
    }
    return doc.output("blob");
}

export async function downloadPurchaseOrderPdf(
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
    const blob = await generatePurchaseOrderPdfBlob(
        eventData,
        eventName,
        categories,
        vendorRows,
        options,
    );
    downloadBlob(blob, `${model.filenameBase}.pdf`);
}
