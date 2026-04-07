import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useSettingsStore } from "../store/settingsStore";

interface InvoiceData {
  invoiceId: string;
  orderId: string;
  customer: string;
  customerName?: string;
  phone?: string;
  billingAddress?: string;
  date: string;
  subtotal: number;
  gst: number;
  total: number;
  lineItems?: Array<{ productId?: string; name: string; quantity: number; unitPrice: number; discount?: number; total: number }>;
}

export const generateInvoicePDF = (invoice: InvoiceData) => {
  const doc = new jsPDF();
  const { settings } = useSettingsStore.getState();
  const formatNum = (num: number) => num.toFixed(2);
  
  // Watermark (Professional & Light)
  doc.setFontSize(25);
  doc.setTextColor(245, 245, 245);
  doc.setFont("helvetica", "bold");
  doc.text("SMART RETAIL OS", 200, 15, { align: "right" });

  // Header
  doc.setFontSize(22);
  doc.setTextColor(34, 197, 94); // Primary green
  doc.setFont("helvetica", "bold");
  doc.text(settings.storeName.toUpperCase(), 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  const addressLines = (settings.storeAddress || "Retail Business Unit").split('\\n');
  addressLines.forEach((line, i) => doc.text(line, 14, 30 + (i * 5)));
  
  const nextY = 32 + (addressLines.length * 5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(`GSTIN: ${settings.gstNumber || "N/A"}`, 14, nextY);

  // Invoice Meta
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59);
  doc.text("SALES INVOICE", 140, 35);
  
  doc.setFontSize(9);
  doc.text(`Invoice ID: ${invoice.invoiceId}`, 140, 43);
  doc.text(`Reference No: ${invoice.orderId}`, 140, 48);
  doc.text(`Date of Issue: ${new Date(invoice.date).toLocaleDateString()}`, 140, 53);

  // Bill To
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text("RECIPIENT:", 14, 65);
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.text(invoice.customerName || invoice.customer || "Walking Customer", 14, 71);
  
  let customerInfoY = 76;
  if (invoice.phone) {
    doc.text(`Phone: ${invoice.phone}`, 14, customerInfoY);
    customerInfoY += 5;
  }
  if (invoice.billingAddress) {
    doc.text(invoice.billingAddress, 14, customerInfoY);
  }

  // Line Items
  const tableData = invoice.lineItems && invoice.lineItems.length > 0 
    ? invoice.lineItems.map(item => [
        item.name, 
        item.quantity, 
        formatNum(item.unitPrice || 0), 
        formatNum(item.total || 0)
      ])
    : [["Product Item", "1", formatNum(invoice.subtotal), formatNum(invoice.subtotal)]];

  autoTable(doc, {
    startY: 85,
    head: [["DESCRIPTION", "QTY", "UNIT PRICE", "TOTAL"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [34, 197, 94], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { halign: "center" },
      2: { halign: "right" },
      3: { halign: "right" }
    },
    styles: { fontSize: 9, cellPadding: 4 },
    margin: { top: 10 },
  });

  // Totals
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text("Subtotal:", 140, finalY);
  doc.text(formatNum(invoice.subtotal), 196, finalY, { align: "right" });
  
  doc.text(`Tax (GST ${settings.taxRate || 18}%):`, 140, finalY + 7);
  doc.text(formatNum(invoice.gst), 196, finalY + 7, { align: "right" });
  
  doc.setDrawColor(34, 197, 94);
  doc.setLineWidth(0.5);
  doc.line(140, finalY + 11, 196, finalY + 11);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text("TOTAL AMOUNT:", 130, finalY + 18, { align: "left" });
  doc.text(formatNum(invoice.total), 196, finalY + 18, { align: "right" });

  // Footer / Watermark Text
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(180, 180, 180);
  doc.text("Computer generated invoice. No signature required.", 105, 275, { align: "center" });
  doc.setFont("helvetica", "bold");
  doc.text("Generated via SMART RETAIL OS", 105, 280, { align: "center" });

  const datestamp = new Date().toISOString().split("T")[0];
  doc.save(`Invoice_${invoice.orderId}_${datestamp}.pdf`);
};

export const generateReturnPDF = (returnData: {
  returnId: string;
  orderId: string;
  customer: string;
  date: string;
  reason: string;
  refundAmount: number;
  refundMethod: string;
  product: string;
}) => {
  const doc = new jsPDF();
  const { settings } = useSettingsStore.getState();
  const formatNum = (num: number) => num.toFixed(2);
  
  // Watermark
  doc.setFontSize(25);
  doc.setTextColor(250, 250, 250);
  doc.setFont("helvetica", "bold");
  doc.text("SMART RETAIL OS", 200, 15, { align: "right" });

  // Header
  doc.setFontSize(22);
  doc.setTextColor(239, 68, 68); // Red for Return
  doc.setFont("helvetica", "bold");
  doc.text(settings.storeName.toUpperCase(), 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.setFont("helvetica", "normal");
  const addressLines = (settings.storeAddress || "Retail Business Unit").split('\\n');
  addressLines.forEach((line, i) => doc.text(line, 14, 30 + (i * 5)));
  
  const nextY = 32 + (addressLines.length * 5);
  doc.text(`GSTIN: ${settings.gstNumber || "N/A"}`, 14, nextY);

  // Document Type
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59);
  doc.text("CREDIT NOTE", 140, 35);
  
  doc.setFontSize(9);
  doc.text(`Return ID: ${returnData.returnId}`, 140, 43);
  doc.text(`Orig. Order: ${returnData.orderId}`, 140, 48);
  doc.text(`Date: ${new Date(returnData.date).toLocaleDateString()}`, 140, 53);

  // Customer Info
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("CUSTOMER:", 14, 65);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(returnData.customer, 14, 71);
  doc.text(`Reason: ${returnData.reason}`, 14, 76);
  doc.text(`Refund Method: ${returnData.refundMethod}`, 14, 81);

  // Item Table
  autoTable(doc, {
    startY: 90,
    head: [["DESCRIPTION", "QTY", "CATEGORY", "REFUND AMOUNT"]],
    body: [[returnData.product, "1", "Return / Exchange", formatNum(returnData.refundAmount)]],
    theme: "grid",
    headStyles: { fillColor: [239, 68, 68], textColor: [255, 255, 255], fontStyle: "bold", halign: "center" },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "right" }
    },
    styles: { fontSize: 9, cellPadding: 4 },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(239, 68, 68);
  doc.text("REFUNDED AMOUNT:", 125, finalY, { align: "left" });
  doc.text(formatNum(returnData.refundAmount), 196, finalY, { align: "right" });

  // Footer
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(150, 150, 150);
  doc.text("Official Credit Confirmation via SMART RETAIL OS", 105, 280, { align: "center" });

  const datestamp = new Date().toISOString().split("T")[0];
  doc.save(`CreditNote_${returnData.returnId}_${datestamp}.pdf`);
};
