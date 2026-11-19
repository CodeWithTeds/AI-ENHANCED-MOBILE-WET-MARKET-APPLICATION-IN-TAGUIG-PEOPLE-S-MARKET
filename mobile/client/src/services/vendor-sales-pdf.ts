/**
 * Vendor Sales & Revenue PDF Report Service
 * Generates and prints official Taguig Suki vendor sales reports.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import {
  type CategoryBreakdown,
  type CompletedTransaction,
  type PaymentMethodBreakdown,
  type SalesSummary,
  type TopProductSale,
} from './sales';

export interface VendorReportMetadata {
  stallName: string;
  stallLocation?: string | null;
  vendorName?: string | null;
  periodLabel: string;
}

export interface GenerateReportOptions {
  metadata: VendorReportMetadata;
  summary: SalesSummary;
  topProducts: TopProductSale[];
  categoryBreakdown?: CategoryBreakdown[];
  paymentMethods: PaymentMethodBreakdown[];
  transactions: CompletedTransaction[];
}

function formatCurrency(amount: number): string {
  return '₱' + Number(amount || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function escapeHtml(text?: string | null): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Builds printable HTML for the official vendor sales report.
 */
export function buildVendorSalesHTML(options: GenerateReportOptions): string {
  const { metadata, summary, topProducts, categoryBreakdown, paymentMethods, transactions } = options;

  const now = new Date();
  const generatedAt = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) + ' · ' + now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const totalRevenue = formatCurrency(summary.total_revenue);
  const avgOrder = formatCurrency(summary.average_order_value);
  const unitsSold = (summary.total_units_sold || 0).toLocaleString();
  const completedCount = (summary.completed_orders_count || 0).toLocaleString();

  // Top Products Table rows
  const topProductsRows = (topProducts || []).slice(0, 10).map((p, idx) => `
    <tr style="border-bottom: 1px solid #f1f5f9;">
      <td style="padding: 8px 10px; font-weight: 600; color: #0f172a;">${idx + 1}. ${escapeHtml(p.product_name)}</td>
      <td style="padding: 8px 10px; color: #64748b;">${escapeHtml(p.category)}</td>
      <td style="padding: 8px 10px; text-align: center; color: #334155;">${p.quantity_sold} ${escapeHtml(p.unit || 'units')}</td>
      <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #059669;">${formatCurrency(p.revenue)}</td>
    </tr>
  `).join('') || `<tr><td colspan="4" style="padding: 12px; text-align: center; color: #94a3b8;">No top products recorded.</td></tr>`;

  // Payment Breakdown cards
  const paymentBreakdownRows = (paymentMethods || []).map((pm) => `
    <div style="flex: 1; min-width: 120px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 600;">${escapeHtml(pm.payment_method)}</div>
      <div style="font-size: 16px; font-weight: 800; color: #0f172a; margin-top: 4px;">${formatCurrency(pm.revenue)}</div>
      <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">${pm.count} orders (${pm.percentage}%)</div>
    </div>
  `).join('');

  // Transactions Table rows
  const transactionsRows = (transactions || []).map((t) => {
    const dateFormatted = t.completed_at || t.created_at
      ? new Date(t.completed_at || t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : '—';
    const itemsPreview = (t.items || [])
      .map((it) => `${it.quantity}${it.unit ? ' ' + it.unit : ''} ${it.product_name}`)
      .join(', ');

    return `
      <tr style="border-bottom: 1px solid #f1f5f9; font-size: 11px;">
        <td style="padding: 8px 10px; font-weight: 700; color: #0f172a;">${escapeHtml(t.order_number)}</td>
        <td style="padding: 8px 10px; color: #64748b;">${dateFormatted}</td>
        <td style="padding: 8px 10px; color: #334155;">${escapeHtml(t.customer_name || 'Customer')}</td>
        <td style="padding: 8px 10px; color: #64748b; text-transform: uppercase; font-weight: 600;">${escapeHtml(t.payment_method || 'CASH')}</td>
        <td style="padding: 8px 10px; color: #475569; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(itemsPreview)}</td>
        <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: #059669;">${formatCurrency(t.vendor_subtotal || t.total_amount)}</td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="6" style="padding: 16px; text-align: center; color: #94a3b8;">No completed transactions recorded for this period.</td></tr>`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Sales & Revenue Report - ${escapeHtml(metadata.stallName)}</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 10mm 14mm 10mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.4;
    }
    .report-wrap {
      max-width: 800px;
      margin: 0 auto;
      padding: 16px;
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #10b981;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .seal-text {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1.2px;
      color: #64748b;
      text-transform: uppercase;
    }
    .city-text {
      font-size: 11px;
      font-weight: 600;
      color: #475569;
    }
    .market-title {
      font-size: 18px;
      font-weight: 900;
      letter-spacing: 0.5px;
      color: #065f46;
      margin: 2px 0 6px 0;
    }
    .badge-report {
      display: inline-block;
      background: #e7f7ef;
      color: #047857;
      font-size: 10px;
      font-weight: 800;
      padding: 3px 12px;
      border-radius: 999px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      border: 1px solid #a7f3d0;
    }
    .meta-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px 16px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    .meta-col {
      min-width: 140px;
    }
    .meta-label {
      font-size: 9px;
      font-weight: 700;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .meta-value {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 2px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px;
      box-shadow: 0 1px 2px rgba(0,0,0,0.02);
    }
    .kpi-label {
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .kpi-amount {
      font-size: 18px;
      font-weight: 900;
      color: #0f172a;
      margin-top: 4px;
    }
    .kpi-amount.primary {
      color: #059669;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      margin: 16px 0 8px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .section-sub {
      font-size: 10px;
      font-weight: 500;
      color: #64748b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    th {
      background: #f1f5f9;
      color: #475569;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 8px 10px;
      border-bottom: 1px solid #cbd5e1;
    }
    .payments-row {
      display: flex;
      gap: 10px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px dashed #cbd5e1;
      text-align: center;
      font-size: 10px;
      color: #64748b;
    }
    .footer strong {
      color: #059669;
    }
    @media print {
      body { background: #fff !important; }
      .report-wrap { padding: 0 !important; max-width: 100% !important; }
    }
  </style>
</head>
<body>
  <div class="report-wrap">
    <!-- Header -->
    <div class="header">
      <div class="seal-text">Republic of the Philippines · City Government of Taguig</div>
      <div class="city-text">Taguig City Public Market Administration</div>
      <div class="market-title">TAGUIG PEOPLE'S MARKET</div>
      <div class="badge-report">Official Vendor Sales &amp; Revenue Report</div>
    </div>

    <!-- Vendor & Stall Meta -->
    <div class="meta-box">
      <div class="meta-col">
        <div class="meta-label">Stall Name</div>
        <div class="meta-value">${escapeHtml(metadata.stallName)}</div>
      </div>
      <div class="meta-col">
        <div class="meta-label">Location / Stall No.</div>
        <div class="meta-value">${escapeHtml(metadata.stallLocation || 'Taguig People\'s Market')}</div>
      </div>
      <div class="meta-col">
        <div class="meta-label">Report Period</div>
        <div class="meta-value" style="color: #059669;">${escapeHtml(metadata.periodLabel)}</div>
      </div>
      <div class="meta-col">
        <div class="meta-label">Generated Date</div>
        <div class="meta-value" style="font-size: 11px; font-weight: 600;">${generatedAt}</div>
      </div>
    </div>

    <!-- Executive KPIs -->
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total Revenue</div>
        <div class="kpi-amount primary">${totalRevenue}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Completed Orders</div>
        <div class="kpi-amount">${completedCount}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Units Sold</div>
        <div class="kpi-amount">${unitsSold}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Avg. Order Value</div>
        <div class="kpi-amount">${avgOrder}</div>
      </div>
    </div>

    <!-- Payment Methods Breakdown -->
    <div class="section-title">
      <span>Payment Method Breakdown</span>
      <span class="section-sub">Cash, GCash &amp; Maya settlements</span>
    </div>
    <div class="payments-row">
      ${paymentBreakdownRows}
    </div>

    <!-- Top Products -->
    <div class="section-title">
      <span>Top Performing Products</span>
      <span class="section-sub">Highest revenue commodities</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="text-align: left;">Product</th>
          <th style="text-align: left;">Category</th>
          <th style="text-align: center;">Units Sold</th>
          <th style="text-align: right;">Revenue</th>
        </tr>
      </thead>
      <tbody>
        ${topProductsRows}
      </tbody>
    </table>

    <!-- Completed Transactions Audit -->
    <div class="section-title">
      <span>Completed Order Audit Trail</span>
      <span class="section-sub">${transactions.length} record${transactions.length === 1 ? '' : 's'}</span>
    </div>
    <table>
      <thead>
        <tr>
          <th style="text-align: left;">Order #</th>
          <th style="text-align: left;">Time</th>
          <th style="text-align: left;">Customer</th>
          <th style="text-align: left;">Method</th>
          <th style="text-align: left;">Items Summary</th>
          <th style="text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${transactionsRows}
      </tbody>
    </table>

    <!-- Official Footer -->
    <div class="footer">
      <div><strong>Taguig Suki Market Platform</strong> · Official Electronic Vendor Statement</div>
      <div style="margin-top: 4px; color: #94a3b8;">
        Certified accurate based on completed transactions processed via the Taguig Suki Vendor App · City of Taguig
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Directly prints the vendor sales report using native print spooler / AirPrint or web print.
 */
export async function printVendorSalesReport(options: GenerateReportOptions): Promise<void> {
  const html = buildVendorSalesHTML(options);

  if (Platform.OS === 'web') {
    // Web fallback
    if (typeof window !== 'undefined') {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
        return;
      }
    }
  }

  await Print.printAsync({ html });
}

/**
 * Generates a PDF file from the report and opens the native Share Sheet to save or send.
 * If sharing fails or is unavailable on the device, gracefully falls back to native print spooler.
 */
export async function exportVendorSalesReportPDF(options: GenerateReportOptions): Promise<string> {
  const html = buildVendorSalesHTML(options);

  if (Platform.OS === 'web') {
    // On web, printToFileAsync is not supported in the same way, trigger direct print dialog to save as PDF
    await printVendorSalesReport(options);
    return 'web-printed';
  }

  // Generate PDF file with Base64 so we can relocate safely into standard app cacheDirectory
  const { uri: generatedUri, base64 } = await Print.printToFileAsync({
    html,
    base64: true,
  });

  // Clean filename for the vendor report
  const rawStall = options.metadata.stallName || 'Vendor';
  const cleanStall = rawStall.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
  const rawPeriod = (options.metadata.periodLabel || 'Report').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `TaguigSuki_${cleanStall}_${rawPeriod}_${Date.now()}.pdf`;

  const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  let targetUri = generatedUri;

  if (cacheDir) {
    targetUri = `${cacheDir.replace(/\/*$/, '/')}${fileName}`;
    try {
      if (base64) {
        // Writing fresh from Base64 guarantees safe scoped storage and avoids file descriptor locks
        await FileSystem.writeAsStringAsync(targetUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else {
        await FileSystem.copyAsync({
          from: generatedUri,
          to: targetUri,
        });
      }
    } catch (fsErr) {
      console.warn('Failed to write PDF to cacheDirectory, falling back to generatedUri:', fsErr);
      targetUri = generatedUri;
    }
  }

  // Ensure uri starts with proper triple slash on Android (file:///)
  if (targetUri.startsWith('file:/') && !targetUri.startsWith('file:///')) {
    targetUri = targetUri.replace(/^file:\/*/, 'file:///');
  }

  // Check if native sharing is available
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    try {
      await Sharing.shareAsync(targetUri, {
        mimeType: 'application/pdf',
        dialogTitle: `${options.metadata.stallName} - Sales Report (${options.metadata.periodLabel})`,
        UTI: 'com.adobe.pdf',
      });
      return targetUri;
    } catch (shareErr) {
      console.warn('Sharing.shareAsync failed, falling back to native Print spooler:', shareErr);
      // Fallback: Launch native Print Spooler which includes "Save as PDF" option
      await Print.printAsync({ html });
      return targetUri;
    }
  } else {
    // Sharing not available on device, launch Print Spooler directly
    await Print.printAsync({ html });
    return targetUri;
  }
}
