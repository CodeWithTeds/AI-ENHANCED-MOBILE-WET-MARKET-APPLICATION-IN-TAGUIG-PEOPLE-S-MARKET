import { Head, router } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    BarChart3,
    Box,
    Calendar,
    CheckCircle2,
    ClipboardList,
    Database,
    DollarSign,
    Download,
    FileSpreadsheet,
    FileText,
    Filter,
    Info,
    MessageSquare,
    Printer,
    RefreshCw,
    Search,
    Server,
    ShieldCheck,
    ShoppingCart,
    SlidersHorizontal,
    Sparkles,
    Star,
    Store,
    Timer,
    TrendingUp,
    Users,
    XCircle,
    Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { dashboard } from '@/routes';

/* ─── Types ─── */

type RangeOption = { value: string; label: string };
type TrendPoint = { label: string; value: number };
type StatusRow = { status: string; label: string; count: number };
type PaymentRow = { method: string; label: string; count: number; percent: number };
type ProductRow = { name: string; category: string; vendor: string; units_sold: number };
type VendorRow = { id: number; stall_name: string; orders: number };
type RoleRow = { label: string; count: number };
type VendorStatusRow = { status: string; label: string; count: number };
type LocationRow = { location: string; count: number };
type CategoryRow = { category: string; items: number };
type MovementRow = { type: string; label: string; count: number; net_change: number };
type LowStockRow = { name: string; vendor: string; stock_quantity: number; reorder_level: number; unit: string };
type AiRow = { status: string; label: string; count: number };
type Segment = { label: string; value: number; color: string };

type DailySalesTransaction = {
    order_number: string;
    time: string;
    amount: number;
    status: string;
    payment_method: string;
    items_count: number;
};

type DailySalesReport = {
    date: string;
    formatted_date: string;
    total_orders: number;
    completed_orders: number;
    cancelled_orders: number;
    total_revenue: number;
    average_order_value: number;
    payment_breakdown: {
        cash: number;
        gcash: number;
        maya: number;
    };
    transactions: DailySalesTransaction[];
};

type ProductReportItem = {
    name: string;
    category: string;
    unit: string;
    stalls_count: number;
    min_price: number;
    max_price: number;
    avg_price: number;
    price_variance: number;
    total_stock: number;
    status: string;
};

type ProductReportData = {
    purpose: string;
    total_monitored_products: number;
    healthy_count: number;
    low_stock_count: number;
    out_of_stock_count: number;
    products: ProductReportItem[];
};

type Props = {
    filters: { range: string; date?: string };
    range: string;
    range_options: RangeOption[];
    overview: {
        total_orders: number;
        total_users: number;
        total_vendors: number;
        total_products: number;
    };
    sales: {
        total_orders: number;
        completed_orders: number;
        cancelled_orders: number;
        orders_trend: TrendPoint[];
        status_breakdown: StatusRow[];
        payment_breakdown: PaymentRow[];
        top_products: ProductRow[];
        top_vendors: VendorRow[];
    };
    users: {
        total: number;
        new_users: number;
        customers: number;
        vendors: number;
        admins: number;
        roles: RoleRow[];
        new_users_trend: TrendPoint[];
    };
    vendors: {
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        suspended: number;
        new_vendors: number;
        status_breakdown: VendorStatusRow[];
        locations: LocationRow[];
    };
    inventory: {
        total_items: number;
        in_stock: number;
        low_stock: number;
        out_of_stock: number;
        category_breakdown: CategoryRow[];
        stock_movements: MovementRow[];
        low_stock_items: LowStockRow[];
    };
    system: {
        active_sessions: number;
        total_sessions: number;
        failed_jobs: number;
        pending_jobs: number;
        ai_requests: number;
        ai_breakdown: AiRow[];
        ai_success_rate: number;
        reviews: number;
        average_rating: number;
        pending_tasks: number;
    };
    daily_sales?: DailySalesReport;
    product_report?: ProductReportData;
};

export default function ReportsIndex({ filters, range_options, overview, sales, users, vendors, inventory, system, daily_sales, product_report }: Props) {
    const [activeTab, setActiveTab] = useState<'analytics' | 'daily_sales' | 'product_report'>('analytics');
    const [productSearch, setProductSearch] = useState('');
    const [productStatusFilter, setProductStatusFilter] = useState('all');
    const [selectedDate, setSelectedDate] = useState(daily_sales?.date || new Date().toISOString().slice(0, 10));

    function applyRange(value: string) {
        router.get('/admin/dashboard/reports', { range: value || undefined, date: selectedDate }, { preserveState: true, preserveScroll: true });
    }

    function changeDate(dateValue: string) {
        setSelectedDate(dateValue);
        router.get('/admin/dashboard/reports', { range: filters.range, date: dateValue }, { preserveState: true, preserveScroll: true });
    }

    function handlePrint() {
        window.print();
    }

    // Defensive defaults — a missing series renders an empty chart, never a white screen.
    const rangeOptions = range_options ?? [];
    const ordersTrend = sales.orders_trend ?? [];
    const statusBreakdown = sales.status_breakdown ?? [];
    const paymentBreakdown = sales.payment_breakdown ?? [];
    const topVendors = sales.top_vendors ?? [];
    const newUsersTrend = users.new_users_trend ?? [];
    const roleRows = users.roles ?? [];
    const vendorStatusRows = vendors.status_breakdown ?? [];
    const vendorLocations = vendors.locations ?? [];
    const aiRows = system.ai_breakdown ?? [];

    const palette = PALETTE;

    // Filtered products for Product Report
    const filteredProducts = (product_report?.products ?? []).filter((p) => {
        const matchesSearch = p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
            p.category.toLowerCase().includes(productSearch.toLowerCase());
        const matchesStatus = productStatusFilter === 'all' || p.status === productStatusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <>
            <Head title="Reports & Analytics" />
            <div className="flex h-full flex-1 flex-col gap-5 overflow-x-auto p-5 print:p-0">
                {/* Header & Tabs */}
                <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">Reports & Market Oversight</h1>
                        <p className="text-xs text-gray-500">Sales performance, daily revenue, SRP pricing stability, and platform health</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* Tab Switcher */}
                        <div className="flex rounded-xl bg-gray-100 p-1">
                            <button
                                type="button"
                                onClick={() => setActiveTab('analytics')}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                    activeTab === 'analytics'
                                        ? 'bg-white text-gray-900 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                <BarChart3 className="h-3.5 w-3.5" />
                                <span>Overview Analytics</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('daily_sales')}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                    activeTab === 'daily_sales'
                                        ? 'bg-white text-[#488562] shadow-sm'
                                        : 'text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                <FileSpreadsheet className="h-3.5 w-3.5" />
                                <span>Daily Sales & Revenue</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab('product_report')}
                                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                    activeTab === 'product_report'
                                        ? 'bg-white text-[#0867ff] shadow-sm'
                                        : 'text-gray-500 hover:text-gray-900'
                                }`}
                            >
                                <Store className="h-3.5 w-3.5" />
                                <span>Product & SRP Monitoring</span>
                            </button>
                        </div>

                        {activeTab === 'analytics' && (
                            <select
                                value={filters.range ?? '30d'}
                                onChange={(e) => applyRange(e.target.value)}
                                className="h-9 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm focus:border-[#488562] focus:outline-none focus:ring-1 focus:ring-[#488562]"
                            >
                                {rangeOptions.map((opt) => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                ))}
                            </select>
                        )}
                    </div>
                </div>

                {/* ══════════════════════════════════════════════════════════════════ */}
                {/* TAB 1: DAILY SALES & REVENUE REPORT (ITEM 2) */}
                {/* ══════════════════════════════════════════════════════════════════ */}
                {activeTab === 'daily_sales' && daily_sales && (
                    <div className="space-y-5">
                        {/* Top bar with date picker and print/export */}
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm print:border-none print:shadow-none">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#488562]/10 text-[#488562]">
                                    <Calendar className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-base font-bold text-gray-900">
                                        Daily Sales Report for {daily_sales.formatted_date}
                                    </h2>
                                    <div className="mt-0.5 flex items-center gap-2">
                                        <p className="text-xs text-gray-500">Official daily market revenue and completed transactions summary</p>
                                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                                            Occupied Stalls Only
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 print:hidden">
                                <label className="text-xs font-medium text-gray-600">Select Date:</label>
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => changeDate(e.target.value)}
                                    className="h-9 rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-800 focus:border-[#488562] focus:outline-none"
                                />
                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    className="flex h-9 items-center gap-1.5 rounded-lg bg-[#488562] px-4 text-xs font-semibold text-white shadow-sm hover:bg-[#3d7053] transition"
                                >
                                    <Printer className="h-4 w-4" />
                                    <span>Print / Export PDF</span>
                                </button>
                            </div>
                        </div>

                        {/* Daily KPI Cards */}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Daily Revenue</div>
                                <div className="mt-1 text-2xl font-black text-[#488562]">
                                    ₱{daily_sales.total_revenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="mt-1 text-[11px] text-gray-500">from {daily_sales.completed_orders} completed orders</div>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Orders Processed</div>
                                <div className="mt-1 text-2xl font-black text-gray-900">
                                    {daily_sales.total_orders}
                                </div>
                                <div className="mt-1 text-[11px] text-gray-500">
                                    {daily_sales.completed_orders} completed · {daily_sales.cancelled_orders} cancelled
                                </div>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Avg. Order Value</div>
                                <div className="mt-1 text-2xl font-black text-[#0867ff]">
                                    ₱{daily_sales.average_order_value.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <div className="mt-1 text-[11px] text-gray-500">per completed transaction</div>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Payment Breakdown</div>
                                <div className="mt-2 space-y-1 text-xs">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Cash:</span>
                                        <span className="font-semibold text-gray-800">₱{daily_sales.payment_breakdown.cash.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">GCash:</span>
                                        <span className="font-semibold text-[#0867ff]">₱{daily_sales.payment_breakdown.gcash.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Maya:</span>
                                        <span className="font-semibold text-[#ee600e]">₱{daily_sales.payment_breakdown.maya.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Daily Transactions Table */}
                        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                            <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900">Completed & Daily Transactions</h3>
                                    <p className="text-xs text-gray-400">Audit trail of orders placed on {daily_sales.formatted_date}</p>
                                </div>
                                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                                    {daily_sales.transactions.length} Records
                                </span>
                            </div>

                            {daily_sales.transactions.length === 0 ? (
                                <div className="p-8 text-center text-xs text-gray-400">No transactions recorded on this date.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-semibold uppercase text-gray-500">
                                            <tr>
                                                <th className="px-5 py-3">Order Number</th>
                                                <th className="px-5 py-3">Time</th>
                                                <th className="px-5 py-3">Items</th>
                                                <th className="px-5 py-3">Payment Method</th>
                                                <th className="px-5 py-3">Status</th>
                                                <th className="px-5 py-3 text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 font-medium">
                                            {daily_sales.transactions.map((tx) => (
                                                <tr key={tx.order_number} className="hover:bg-gray-50/50">
                                                    <td className="px-5 py-3 font-semibold text-gray-900">{tx.order_number}</td>
                                                    <td className="px-5 py-3 text-gray-500">{tx.time}</td>
                                                    <td className="px-5 py-3 text-gray-700">{tx.items_count} items</td>
                                                    <td className="px-5 py-3">
                                                        <span className="uppercase text-[11px] font-bold tracking-wide text-gray-600">
                                                            {tx.payment_method}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3">
                                                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                                            tx.status === 'completed'
                                                                ? 'bg-emerald-50 text-emerald-700'
                                                                : tx.status === 'cancelled'
                                                                ? 'bg-red-50 text-red-700'
                                                                : 'bg-amber-50 text-amber-700'
                                                        }`}>
                                                            {tx.status}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-bold text-gray-900">
                                                        ₱{tx.amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════════ */}
                {/* TAB 2: PRODUCT REPORT & SRP PRICE MONITORING (ITEM 3) */}
                {/* ══════════════════════════════════════════════════════════════════ */}
                {activeTab === 'product_report' && product_report && (
                    <div className="space-y-5">
                        {/* Clarified Purpose Banner */}
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#488562] text-white">
                                    <Info className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-emerald-950 uppercase tracking-wide">
                                        Purpose of Admin Product Report & Price Stability Monitoring
                                    </h2>
                                    <p className="mt-1 text-xs leading-relaxed text-emerald-900">
                                        {product_report.purpose}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Product Supply & Price Monitoring KPIs */}
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Monitored Commodities</div>
                                <div className="mt-1 text-2xl font-black text-gray-900">{product_report.total_monitored_products}</div>
                                <div className="mt-1 text-[11px] text-gray-500">Across wet and dry sections</div>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Healthy Supply Status</div>
                                <div className="mt-1 text-2xl font-black text-[#488562]">{product_report.healthy_count}</div>
                                <div className="mt-1 text-[11px] text-gray-500">Sufficient stock across stalls</div>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Low Stock Warnings</div>
                                <div className="mt-1 text-2xl font-black text-[#f59e0b]">{product_report.low_stock_count}</div>
                                <div className="mt-1 text-[11px] text-gray-500">Below 10 units aggregate</div>
                            </div>

                            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Out of Stock Commodities</div>
                                <div className="mt-1 text-2xl font-black text-red-500">{product_report.out_of_stock_count}</div>
                                <div className="mt-1 text-[11px] text-gray-500">Requires market vendor restock</div>
                            </div>
                        </div>

                        {/* Filter Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                            <div className="relative flex-1 min-w-[240px]">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={productSearch}
                                    onChange={(e) => setProductSearch(e.target.value)}
                                    placeholder="Search monitored commodity or section category..."
                                    className="h-9 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-xs focus:border-[#488562] focus:outline-none"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <Filter className="h-4 w-4 text-gray-400" />
                                <select
                                    value={productStatusFilter}
                                    onChange={(e) => setProductStatusFilter(e.target.value)}
                                    className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 focus:border-[#488562] focus:outline-none"
                                >
                                    <option value="all">All Supply Statuses</option>
                                    <option value="Healthy Supply">Healthy Supply</option>
                                    <option value="Low Stock Alert">Low Stock Alert</option>
                                    <option value="Out of Stock">Out of Stock</option>
                                </select>
                            </div>
                        </div>

                        {/* Product Report Table */}
                        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                            <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900">Price Variance & Multi-Stall Stock Monitoring</h3>
                                    <p className="text-xs text-gray-400">Comparing prices across active occupied stalls selling the same commodity (unoccupied stalls excluded)</p>
                                </div>
                                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                                    {filteredProducts.length} Monitored Items
                                </span>
                            </div>

                            {filteredProducts.length === 0 ? (
                                <div className="p-8 text-center text-xs text-gray-400">No commodities matching filters.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-semibold uppercase text-gray-500">
                                            <tr>
                                                <th className="px-5 py-3">Product Name</th>
                                                <th className="px-5 py-3">Category</th>
                                                <th className="px-5 py-3 text-center">Stalls Selling</th>
                                                <th className="px-5 py-3 text-right">Min Price</th>
                                                <th className="px-5 py-3 text-right">Max Price</th>
                                                <th className="px-5 py-3 text-right">Avg Price (SRP)</th>
                                                <th className="px-5 py-3 text-right">Price Variance</th>
                                                <th className="px-5 py-3 text-right">Aggregate Stock</th>
                                                <th className="px-5 py-3 text-center">Supply Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 font-medium">
                                            {filteredProducts.map((p) => (
                                                <tr key={p.name} className="hover:bg-gray-50/50">
                                                    <td className="px-5 py-3 font-bold text-gray-900">{p.name}</td>
                                                    <td className="px-5 py-3 text-gray-600">{p.category}</td>
                                                    <td className="px-5 py-3 text-center">
                                                        <span className="rounded-md bg-gray-100 px-2 py-0.5 font-bold text-gray-700">
                                                            {p.stalls_count} {p.stalls_count === 1 ? 'stall' : 'stalls'}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-semibold text-emerald-700">
                                                        ₱{p.min_price.toFixed(2)}
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-semibold text-gray-800">
                                                        ₱{p.max_price.toFixed(2)}
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-bold text-[#0867ff]">
                                                        ₱{p.avg_price.toFixed(2)} <span className="text-[10px] font-normal text-gray-400">/{p.unit}</span>
                                                    </td>
                                                    <td className="px-5 py-3 text-right">
                                                        <span className={`font-bold ${p.price_variance > 10 ? 'text-amber-600' : 'text-gray-500'}`}>
                                                            {p.price_variance > 0 ? `±₱${p.price_variance.toFixed(2)}` : '₱0.00'}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3 text-right font-bold text-gray-900">
                                                        {p.total_stock} <span className="text-[10px] font-normal text-gray-400">{p.unit}</span>
                                                    </td>
                                                    <td className="px-5 py-3 text-center">
                                                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                                            p.status === 'Healthy Supply'
                                                                ? 'bg-emerald-50 text-emerald-700'
                                                                : p.status === 'Low Stock Alert'
                                                                ? 'bg-amber-50 text-amber-700'
                                                                : 'bg-red-50 text-red-700'
                                                        }`}>
                                                            {p.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════════════ */}
                {/* TAB 3: OVERVIEW & SYSTEM ANALYTICS (EXISTING FULL DASHBOARD) */}
                {/* ══════════════════════════════════════════════════════════════════ */}
                {activeTab === 'analytics' && (
                    <>
                        {/* ─── Overview KPIs ─── */}
                        <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            <KpiCard label="Total Orders" value={overview.total_orders.toLocaleString()} icon={ShoppingCart} color="#488562" bg="bg-[#488562]/10" sub={`${sales.completed_orders.toLocaleString()} completed`} />
                            <KpiCard label="Completed Orders" value={sales.completed_orders.toLocaleString()} icon={CheckCircle2} color="#0867ff" bg="bg-[#0867ff]/10" sub="across all orders" />
                            <KpiCard label="Total Users" value={overview.total_users.toLocaleString()} icon={Users} color="#8b5cf6" bg="bg-purple-50" sub={`${users.new_users.toLocaleString()} new in range`} />
                        </div>

                        {/* ─── Sales Analytics ─── */}
                        <SectionHeader icon={BarChart3} color="#488562" title="Sales Analytics" subtitle="Order volume and payment insights" />

                        <div className="grid gap-5 lg:grid-cols-3">
                            {/* Order volume trend */}
                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
                                <CardHeader title="Order Volume" sub={`${overview.total_orders.toLocaleString()} orders in selected range`} />
                                <BarChart data={ordersTrend} />
                                <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5">
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-[#488562]" />
                                        Completed
                                    </div>
                                    <span className="text-sm font-bold text-gray-900">{sales.completed_orders.toLocaleString()} orders</span>
                                </div>
                            </div>

                            {/* Payment methods donut */}
                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <CardHeader title="Payment Methods" sub="share of paid orders" />
                                <div className="flex flex-col items-center gap-5">
                                    <DonutChart segments={paymentSegments(paymentBreakdown, palette)} />
                                    <div className="w-full space-y-2.5">
                                        {paymentBreakdown.map((p) => (
                                            <LegendRow key={p.method} label={p.label} value={`${p.count.toLocaleString()} · ${p.percent}%`} color={PAYMENT_COLORS[p.method] ?? palette[0]} />
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid gap-5 lg:grid-cols-2">
                            {/* Order status breakdown */}
                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <CardHeader title="Order Status" sub="orders in selected range" />
                                <div className="space-y-3">
                                    {statusBreakdown.map((s) => {
                                        const color = STATUS_COLORS[s.status] ?? palette[7];
                                        const pct = sales.total_orders > 0 ? (s.count / sales.total_orders) * 100 : 0;

                                        return (
                                            <div key={s.status}>
                                                <div className="mb-1 flex items-center justify-between text-xs">
                                                    <span className="font-medium text-gray-700">{s.label}</span>
                                                    <span className="font-bold text-gray-900">{s.count.toLocaleString()}</span>
                                                </div>
                                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Top vendors */}
                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <CardHeader title="Top Vendors" sub="by orders in selected range" />
                                <div className="space-y-3">
                                    {topVendors.length === 0 ? (
                                        <EmptyState text="No sales data yet" />
                                    ) : (
                                        topVendors.map((v) => {
                                            const max = topVendors[0]?.orders || 1;

                                            return (
                                                <div key={v.id}>
                                                    <div className="mb-1 flex items-center justify-between">
                                                        <div className="flex min-w-0 items-center gap-2.5">
                                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#488562]/10 to-[#89baa3]/20 text-xs font-bold text-[#488562]">
                                                                {initials(v.stall_name)}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="truncate text-xs font-semibold text-gray-900">{v.stall_name}</div>
                                                            </div>
                                                        </div>
                                                        <span className="shrink-0 text-xs font-bold text-gray-900">{v.orders.toLocaleString()} orders</span>
                                                    </div>
                                                    <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
                                                        <div className="h-full rounded-full bg-gradient-to-r from-[#488562] to-[#89baa3]" style={{ width: `${(v.orders / max) * 100}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ─── Users ─── */}
                        <SectionHeader icon={Users} color="#8b5cf6" title="Users" subtitle="Registered users and account mix" />

                        <div className="grid gap-5 lg:grid-cols-3">
                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <CardHeader title="User Growth" sub={`${users.new_users.toLocaleString()} new users in range`} />
                                <BarChart data={newUsersTrend} from="#6d28d9" to="#c4b5fd" />
                            </div>

                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <CardHeader title="Account Types" sub="all registered accounts" />
                                <div className="flex flex-col items-center gap-5">
                                    <DonutChart segments={roleSegments(roleRows, palette)} />
                                    <div className="w-full space-y-2.5">
                                        {roleRows.map((r) => (
                                            <LegendRow key={r.label} label={r.label} value={r.count.toLocaleString()} color={ROLE_COLORS[r.label] ?? palette[0]} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <CardHeader title="User KPIs" sub="current totals" />
                                <div className="grid grid-cols-2 gap-3">
                                    <MiniStat label="Total Users" value={users.total.toLocaleString()} color="text-gray-900" />
                                    <MiniStat label="New (Range)" value={users.new_users.toLocaleString()} color="text-[#8b5cf6]" />
                                    <MiniStat label="Customers" value={users.customers.toLocaleString()} color="text-[#488562]" />
                                    <MiniStat label="Vendors" value={users.vendors.toLocaleString()} color="text-[#ee600e]" />
                                    <MiniStat label="Admins" value={users.admins.toLocaleString()} color="text-[#0867ff]" />
                                    <MiniStat label="Products" value={overview.total_products.toLocaleString()} color="text-gray-500" />
                                </div>
                            </div>
                        </div>

                        {/* ─── Vendors ─── */}
                        <SectionHeader icon={Store} color="#ee600e" title="Vendors" subtitle="Vendor roster, approvals, and locations" />

                        <div className="grid gap-5 lg:grid-cols-3">
                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <CardHeader title="Approval Status" sub={`${vendors.new_vendors.toLocaleString()} registered in range`} />
                                <div className="flex flex-col items-center gap-5">
                                    <DonutChart segments={vendorSegments(vendorStatusRows, palette)} />
                                    <div className="w-full space-y-2.5">
                                        {vendorStatusRows.map((v) => (
                                            <LegendRow key={v.status} label={v.label} value={v.count.toLocaleString()} color={VENDOR_STATUS_COLORS[v.status] ?? palette[7]} />
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <CardHeader title="Vendor Locations" sub="by stall location" />
                                <div className="space-y-3">
                                    {vendorLocations.map((loc) => {
                                        const max = vendorLocations[0]?.count || 1;

                                        return (
                                            <div key={loc.location}>
                                                <div className="mb-1 flex items-center justify-between text-xs">
                                                    <span className="font-medium text-gray-700">{loc.location}</span>
                                                    <span className="font-bold text-gray-900">{loc.count.toLocaleString()}</span>
                                                </div>
                                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                                                    <div className="h-full rounded-full bg-[#ee600e]" style={{ width: `${(loc.count / max) * 100}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <CardHeader title="Vendor KPIs" sub="current totals" />
                                <div className="grid grid-cols-2 gap-3">
                                    <MiniStat label="Total Vendors" value={vendors.total.toLocaleString()} color="text-gray-900" />
                                    <MiniStat label="Approved" value={vendors.approved.toLocaleString()} color="text-[#488562]" />
                                    <MiniStat label="Pending" value={vendors.pending.toLocaleString()} color="text-[#ee600e]" />
                                    <MiniStat label="Suspended" value={vendors.suspended.toLocaleString()} color="text-purple-600" />
                                    <MiniStat label="Rejected" value={vendors.rejected.toLocaleString()} color="text-red-500" />
                                    <MiniStat label="New (Range)" value={vendors.new_vendors.toLocaleString()} color="text-[#0867ff]" />
                                </div>
                            </div>
                        </div>

                        {/* ─── System Performance ─── */}
                        <SectionHeader icon={Activity} color="#0867ff" title="System Performance" subtitle="Platform health and activity" />

                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <SystemCard icon={Zap} color="#488562" bg="bg-[#488562]/10" label="Active Sessions" value={system.active_sessions.toLocaleString()} sub={`${system.total_sessions.toLocaleString()} total sessions`} />
                            <SystemCard icon={Server} color="#0867ff" bg="bg-[#0867ff]/10" label="Queue Jobs" value={system.pending_jobs.toLocaleString()} sub="jobs awaiting processing" />
                            <SystemCard icon={ShieldCheck} color="#ee600e" bg="bg-[#ee600e]/10" label="Failed Jobs" value={system.failed_jobs.toLocaleString()} sub="errors in the job queue" danger={system.failed_jobs > 0} />
                            <SystemCard icon={ClipboardList} color="#8b5cf6" bg="bg-purple-50" label="Pending Tasks" value={system.pending_tasks.toLocaleString()} sub="tasks needing attention" />
                        </div>

                        <div className="grid gap-5 lg:grid-cols-3">
                            {/* AI engine */}
                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <CardHeader title="AI Recommendation Engine" sub={`${system.ai_requests.toLocaleString()} requests in range`} />
                                <div className="mb-4 flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ee600e]/10">
                                        <Sparkles className="h-5 w-5 text-[#ee600e]" />
                                    </div>
                                    <div>
                                        <div className="text-lg font-bold text-gray-900">{system.ai_success_rate}%</div>
                                        <div className="text-[11px] text-gray-500">success rate</div>
                                    </div>
                                </div>
                                <div className="space-y-2.5">
                                    {aiRows.map((a) => (
                                        <LegendRow key={a.status} label={a.label} value={a.count.toLocaleString()} color={AI_COLORS[a.status] ?? palette[7]} />
                                    ))}
                                </div>
                            </div>

                            {/* Reviews */}
                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <CardHeader title="Customer Feedback" sub="reviews in selected range" />
                                <div className="mb-4 flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#488562]/10">
                                        <Star className="h-5 w-5 text-[#488562]" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1 text-lg font-bold text-gray-900">
                                            {system.average_rating ? system.average_rating.toFixed(1) : '—'}
                                            <Star className="h-4 w-4 fill-[#f59e0b] text-[#f59e0b]" />
                                        </div>
                                        <div className="text-[11px] text-gray-500">average rating</div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
                                    <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                                        <MessageSquare className="h-3.5 w-3.5 text-[#0867ff]" />
                                        Reviews received
                                    </div>
                                    <span className="text-sm font-bold text-gray-900">{system.reviews.toLocaleString()}</span>
                                </div>
                            </div>

                            {/* Performance index */}
                            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <CardHeader title="Performance Snapshot" sub="live platform indicators" />
                                <div className="space-y-3">
                                    <PerfRow icon={Database} label="Products" value={overview.total_products.toLocaleString()} color="#0867ff" />
                                    <PerfRow icon={Store} label="Vendors" value={vendors.total.toLocaleString()} color="#ee600e" />
                                    <PerfRow icon={ShoppingCart} label="Orders (Range)" value={sales.total_orders.toLocaleString()} color="#488562" />
                                    <PerfRow icon={Users} label="Users" value={users.total.toLocaleString()} color="#8b5cf6" />
                                    <PerfRow icon={Timer} label="Completed Orders" value={sales.completed_orders.toLocaleString()} color="#488562" />
                                    <PerfRow icon={XCircle} label="Cancelled Orders" value={sales.cancelled_orders.toLocaleString()} color="#ef4444" />
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </>
    );
}

ReportsIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Reports & Analytics', href: '/admin/dashboard/reports' },
    ],
};

/* ─── Constants ─── */

const PALETTE = ['#488562', '#0867ff', '#ee600e', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#64748b'];

const STATUS_COLORS: Record<string, string> = {
    pending: '#ee600e',
    confirmed: '#0867ff',
    processing: '#0867ff',
    ready: '#8b5cf6',
    completed: '#488562',
    cancelled: '#ef4444',
};

const PAYMENT_COLORS: Record<string, string> = {
    cash: '#64748b',
    gcash: '#0867ff',
    maya: '#ee600e',
};

const VENDOR_STATUS_COLORS: Record<string, string> = {
    pending: '#ee600e',
    approved: '#488562',
    rejected: '#ef4444',
    suspended: '#8b5cf6',
};

const AI_COLORS: Record<string, string> = {
    found: '#488562',
    not_found: '#ee600e',
    error: '#ef4444',
};

const ROLE_COLORS: Record<string, string> = {
    Customers: '#488562',
    Vendors: '#ee600e',
    Admins: '#8b5cf6',
};

/* ─── Chart Data Helpers ─── */

function paymentSegments(rows: PaymentRow[], palette: string[]): Segment[] {
    return rows
        .filter((r) => r.count > 0)
        .map((r, i) => ({ label: r.label, value: r.count, color: PAYMENT_COLORS[r.method] ?? palette[i % palette.length] }));
}

function roleSegments(rows: RoleRow[], palette: string[]): Segment[] {
    return rows.filter((r) => r.count > 0).map((r) => ({ label: r.label, value: r.count, color: ROLE_COLORS[r.label] ?? palette[0] }));
}

function vendorSegments(rows: VendorStatusRow[], palette: string[]): Segment[] {
    return rows.filter((r) => r.count > 0).map((r) => ({ label: r.label, value: r.count, color: VENDOR_STATUS_COLORS[r.status] ?? palette[7] }));
}

/* ─── Shared Sub Components ─── */

function SectionHeader({ icon: Icon, color, title, subtitle }: { icon: LucideIcon; color: string; title: string; subtitle: string }) {
    return (
        <div className="mt-2 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm">
                <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
                <h2 className="text-sm font-bold text-gray-900">{title}</h2>
                <p className="text-[11px] text-gray-500">{subtitle}</p>
            </div>
        </div>
    );
}

function KpiCard({ label, value, icon: Icon, color, bg, sub }: { label: string; value: string; icon: LucideIcon; color: string; bg: string; sub: string }) {
    return (
        <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="min-w-0">
                <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
                <div className="truncate text-xl font-bold text-gray-900">{value}</div>
                <div className="truncate text-[11px] text-gray-400">{sub}</div>
            </div>
        </div>
    );
}

function CardHeader({ title, sub }: { title: string; sub?: string }) {
    return (
        <div className="mb-4">
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
        </div>
    );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
            <div className={`text-base font-bold ${color}`}>{value}</div>
        </div>
    );
}

function LegendRow({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                {label}
            </div>
            <span className="text-xs font-bold text-gray-900">{value}</span>
        </div>
    );
}

function PerfRow({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: string; color: string }) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-xs font-medium text-gray-700">
                <Icon className="h-3.5 w-3.5" style={{ color }} />
                {label}
            </div>
            <span className="text-xs font-bold text-gray-900">{value}</span>
        </div>
    );
}

function SystemCard({ icon: Icon, color, bg, label, value, sub, danger }: { icon: LucideIcon; color: string; bg: string; label: string; value: string; sub: string; danger?: boolean }) {
    return (
        <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="min-w-0">
                <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
                <div className={`truncate text-xl font-bold ${danger ? 'text-red-500' : 'text-gray-900'}`}>{value}</div>
                <div className="truncate text-[11px] text-gray-400">{sub}</div>
            </div>
        </div>
    );
}

function EmptyState({ text }: { text: string }) {
    return <div className="py-8 text-center text-xs text-gray-400">{text}</div>;
}

/* ─── Charts ─── */

function BarChart({ data = [], from, to }: { data?: TrendPoint[]; from?: string; to?: string }) {
    const max = Math.max(...(data ?? []).map((d) => d.value), 1);
    const fromC = from ?? '#3a6e50';
    const toC = to ?? '#89baa3';
    const step = Math.ceil(data.length / 10);

    return (
        <div>
            <div className="flex items-end gap-1.5" style={{ height: 150 }}>
                {data.map((d, i) => (
                    <div key={i} className="group relative flex h-full flex-1 items-end">
                        <div
                            className="relative w-full rounded-t-md transition-all group-hover:opacity-80"
                            style={{ height: `${Math.max((d.value / max) * 100, 2)}%`, background: `linear-gradient(to top, ${fromC}, ${toC})` }}
                        >
                            {d.value > 0 && (
                                <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-semibold text-white group-hover:block">
                                    {formatNumber(d.value)}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-1.5 flex gap-1.5">
                {data.map((d, i) => (
                    <div key={i} className={`flex-1 truncate text-center text-[9px] text-gray-400 ${i % step === 0 || i === data.length - 1 ? '' : 'text-transparent'}`}>
                        {d.label}
                    </div>
                ))}
            </div>
        </div>
    );
}

function DonutChart({ segments, size = 160, thickness = 26 }: { segments: Segment[]; size?: number; thickness?: number }) {
    const total = Math.max(segments.reduce((sum, s) => sum + s.value, 0), 1);

    const ends = segments.reduce<number[]>((acc, s) => [...acc, (acc[acc.length - 1] ?? 0) + s.value], []);

    const stops = segments.map((s, i) => {
        const start = ((ends[i] - s.value) / total) * 360;
        const end = (ends[i] / total) * 360;

        return `${s.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
    });

    const background = stops.length > 0 ? `conic-gradient(${stops.join(', ')})` : 'conic-gradient(#e5e7eb 0deg 360deg)';
    const inset = thickness;

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <div className="absolute inset-0 rounded-full" style={{ background }} />
            <div
                className="absolute inset-0 flex items-center justify-center rounded-full bg-white"
                style={{ margin: inset }}
            >
                <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{total.toLocaleString()}</div>
                    <div className="text-[9px] text-gray-400">total</div>
                </div>
            </div>
        </div>
    );
}

/* ─── Helpers ─── */

function formatNumber(value: number): string {
    if (value >= 1_000_000) {
        return (value / 1_000_000).toFixed(1) + 'M';
    }

    if (value >= 1_000) {
        return (value / 1_000).toFixed(1) + 'K';
    }

    return value.toLocaleString();
}

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('');
}
