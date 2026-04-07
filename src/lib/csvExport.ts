/**
 * Smart Retail OS — CSV Export Utility
 * Generates and triggers browser download of a CSV file from any array of objects.
 */

/** Convert an array of flat objects to a CSV string */
function toCSV(rows: Record<string, any>[], columns: { key: string; label: string; format?: (val: any) => string }[]): string {
  const header = columns.map((c) => `"${c.label}"`).join(",");
  const body = rows.map((row) =>
    columns
      .map((c) => {
        const rawVal = row[c.key] ?? "";
        const val = c.format ? c.format(rawVal) : rawVal;
        // Escape quotes by doubling them
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [header, ...body].join("\r\n");
}

/** Trigger a CSV file download in the browser */
function downloadCSV(filename: string, csv: string): void {
  // Add professional branding / watermark as first line of CSV
  const brandedCSV = "--- GENERATED VIA SMART RETAIL OS ---\r\n" + csv;
  const blob = new Blob([brandedCSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ─── Domain-specific exporters ─────────────────────────────────────────────────

export function exportProductsCSV(products: any[]): void {
  const columns = [
    { key: "name", label: "Product Name" },
    { key: "brand", label: "Brand" },
    { key: "category", label: "Category" },
    { key: "sku", label: "SKU" },
    { key: "price", label: "Selling Price", format: (v: any) => Number(v).toFixed(2) },
    { key: "costPrice", label: "Cost Price", format: (v: any) => Number(v).toFixed(2) },
    { key: "stock", label: "Stock" },
  ];
  const csv = toCSV(products, columns);
  downloadCSV(`Products_${datestamp()}.csv`, csv);
}

export function exportOrdersCSV(orders: any[]): void {
  const columns = [
    { key: "orderNumber", label: "Order ID" },
    { key: "customer", label: "Customer" },
    { key: "date", label: "Date" },
    { key: "items", label: "Items" },
    { key: "total", label: "Total", format: (v: any) => Number(v).toFixed(2) },
    { key: "gst", label: "GST", format: (v: any) => Number(v).toFixed(2) },
    { key: "paymentMethod", label: "Payment Method" },
    { key: "status", label: "Status" },
  ];
  const csv = toCSV(orders, columns);
  downloadCSV(`Orders_${datestamp()}.csv`, csv);
}

export function exportCustomersCSV(customers: any[]): void {
  const columns = [
    { key: "name", label: "Name" },
    { key: "phone", label: "Phone" },
    { key: "email", label: "Email" },
    { key: "address", label: "Address" },
    { key: "totalPurchases", label: "Total Purchases" },
    { key: "lastPurchaseDate", label: "Last Purchase" },
    { key: "loyaltyTier", label: "Loyalty Tier" },
  ];
  const csv = toCSV(customers, columns);
  downloadCSV(`customers_${datestamp()}.csv`, csv);
}

function datestamp(): string {
  return new Date().toISOString().split("T")[0];
}
