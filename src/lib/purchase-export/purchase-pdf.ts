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

function categoryTableRows(category: CategoryPurchaseRow): {
    body: RowInput[];
    fills: (string | null)[];
} {
    const body: RowInput[] = [];
    const fills: (string | null)[] = [];
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
        fills.push(null);
    };
    category.directItems.forEach(appendItem);
    category.subCategories.forEach(sub => {
        body.push([`Sub Category: ${sub.name}`, ...Array(11).fill("")]);
        fills.push(PURCHASE_EXPORT_COLORS.subCategoryBg);
        sub.items.forEach(appendItem);
    });
    const netSubtotal = category.items.reduce((sum, item) => sum + item.netTotal, 0);
    body.push([
        "",
        "Category Subtotal",
        ...Array(9).fill(""),
        formatExportCurrency(category.subtotal),
    ]);
    fills.push(PURCHASE_EXPORT_COLORS.subtotalBg);
    body.push(["", "Net Subtotal", ...Array(9).fill(""), formatExportCurrency(netSubtotal)]);
    fills.push(PURCHASE_EXPORT_COLORS.totalBg);
    return { body, fills };
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
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Terms & Conditions", 10, y);
    y += 2;
    autoTable(doc, {
        startY: y,
        body: PURCHASE_PAYMENT_TERMS.map(([label, value]) => [label, value]),
        tableWidth: doc.internal.pageSize.getWidth() - 20,
        theme: "grid",
        styles: { fontSize: 7, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 35 } },
        margin: { left: 10, right: 10 },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    y = (doc as any).lastAutoTable.finalY + 4;

    for (const [categoryIndex, category] of model.categories.entries()) {
        const { body, fills } = categoryTableRows(category);
        autoTable(doc, {
            startY: y,
            head: [
                [
                    {
                        content: `${toRomanLower(categoryIndex + 1)}. ${category.category}`,
                        colSpan: 11,
                    },
                    `${category.items.length} item${category.items.length === 1 ? "" : "s"}`,
                ],
                [
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
                ],
            ],
            body,
            tableWidth: doc.internal.pageSize.getWidth() - 20,
            theme: "grid",
            styles: {
                fontSize: 6.5,
                cellPadding: 1.3,
                lineColor: [0, 0, 0],
                lineWidth: 0.1,
                overflow: "linebreak",
            },
            headStyles: {
                fillColor: purchaseArgbToRgb(PURCHASE_EXPORT_COLORS.headerBg),
                textColor: [0, 0, 0],
                fontStyle: "bold",
                halign: "center",
            },
            columnStyles: {
                0: { cellWidth: 12, halign: "center" },
                1: { cellWidth: 32 },
                2: { cellWidth: 60 },
                3: { cellWidth: 10, halign: "right" },
                4: { cellWidth: 10, halign: "right" },
                5: { cellWidth: 14 },
                6: { cellWidth: 20, halign: "right" },
                7: { cellWidth: 22, halign: "right" },
                8: { cellWidth: 20, halign: "right" },
                9: { cellWidth: 20, halign: "right" },
                10: { cellWidth: 25, halign: "right" },
                11: { cellWidth: 32 },
            },
            didParseCell: data => {
                if (data.section === "head") {
                    data.cell.styles.fillColor = purchaseArgbToRgb(
                        data.row.index === 0
                            ? PURCHASE_EXPORT_COLORS.categoryBg
                            : PURCHASE_EXPORT_COLORS.headerBg,
                    );
                    if (data.row.index === 0) data.cell.styles.fontStyle = "bold";
                    if (data.row.index === 0) {
                        data.cell.styles.halign = data.column.index === 11 ? "right" : "left";
                    }
                    return;
                }
                const color = fills[data.row.index];
                if (color) {
                    data.cell.styles.fillColor = purchaseArgbToRgb(color);
                    data.cell.styles.fontStyle = "bold";
                }
            },
            margin: { left: 10, right: 10 },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY + 5;
    }

    if (model.vendorRows.length) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Vendor-Wise Financial Summary", 10, y);
        y += 2;
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
                if (data.section === "body" && data.row.index === model.vendorRows.length) {
                    data.cell.styles.fillColor = purchaseArgbToRgb(PURCHASE_EXPORT_COLORS.totalBg);
                    data.cell.styles.fontStyle = "bold";
                }
            },
            margin: { left: 10, right: 10 },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY + 5;
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
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Consolidated Vendor Summary", 10, y);
    y += 2;
    autoTable(doc, {
        startY: y,
        body: summary,
        tableWidth: doc.internal.pageSize.getWidth() - 20,
        theme: "grid",
        styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
        columnStyles: {
            0: { cellWidth: 220, fontStyle: "bold" },
            1: { cellWidth: 57, halign: "right" },
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
    if (model.expenseSummary) {
        const es = model.expenseSummary;
        const dateRange = es.endDate ? `${es.startDate} - ${es.endDate}` : es.startDate;
        const pageHeight = doc.internal.pageSize.getHeight();
        if (pageHeight - y < 45) {
            doc.addPage();
            y = 14;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Expenses Summary", 10, y);
        y += 2;
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
                0: { cellWidth: 120, halign: "center" },
                1: { cellWidth: 57, halign: "right" },
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
        y = (doc as any).lastAutoTable.finalY + 4;
    }
    if (model.clientBillSummary) {
        const cb = model.clientBillSummary;
        const rows: [string, string][] = [
            ["Estimated Amount", formatExportCurrency(cb.estimatedAmount)],
            [
                `Service Charge (${model.profitSummary?.serviceChargePercent ?? 0}%)`,
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
            ["TDS Deducted by Client", formatExportCurrency(cb.tdsDeducted)],
            ["Final Amount", formatExportCurrency(cb.finalAmount)],
            ["Advance", formatExportCurrency(cb.advance)],
            ["Balance", formatExportCurrency(cb.balance)],
        ];
        const pageHeight = doc.internal.pageSize.getHeight();
        if (pageHeight - y < 45) {
            doc.addPage();
            y = 14;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Client Bill Summary", 10, y);
        y += 2;
        autoTable(doc, {
            startY: y,
            body: rows,
            tableWidth: doc.internal.pageSize.getWidth() - 20,
            theme: "grid",
            styles: { fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
            columnStyles: {
                0: { cellWidth: 220, fontStyle: "bold" },
                1: { cellWidth: 57, halign: "right" },
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
            },
            margin: { left: 10, right: 10 },
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY + 4;
    }
    if (model.profitSummary) {
        const profit = model.profitSummary;
        const rows: [string, string][] = [
            [
                "Total (Original + GST)",
                formatExportCurrency(profit.taxableAmount + profit.gstAmount),
            ],
            ["Applied TDS Amount", `-${formatExportCurrency(profit.tdsAmount)}`],
            ["Total Client Billed Amount", formatExportCurrency(profit.totalClientBilledAmount)],
            ["Total Vendor GST", formatExportCurrency(profit.totalVendorGst)],
            ["Total Vendor TDS", `-${formatExportCurrency(profit.totalVendorTds)}`],
            ["Net Vendor Total", formatExportCurrency(profit.totalVendorNet)],
            [
                "Client Billed Amount without GST",
                formatExportCurrency(profit.clientBilledWithoutGst),
            ],
            ["Profit", formatExportCurrency(profit.profit)],
            ["Net Hand", formatExportCurrency(profit.netHand)],
            ["Total Expenses", formatExportCurrency(profit.totalExpenses)],
            ["Balance", formatExportCurrency(profit.balanceAfterExpenses)],
        ];
        const pageHeight = doc.internal.pageSize.getHeight();
        if (pageHeight - y < 45) {
            doc.addPage();
            y = 14;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Profit Summary", 10, y);
        y += 2;
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
            columnStyles: { 0: { cellWidth: 220 }, 1: { cellWidth: 57, halign: "right" } },
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
                                  ? PURCHASE_EXPORT_COLORS.advanceBg
                                  : label === "Total Expenses"
                                    ? PURCHASE_EXPORT_COLORS.advanceBg
                                    : label === "Balance"
                                      ? PURCHASE_EXPORT_COLORS.balanceBg
                                      : PURCHASE_EXPORT_COLORS.summaryBg;
                data.cell.styles.fillColor = purchaseArgbToRgb(color);
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
