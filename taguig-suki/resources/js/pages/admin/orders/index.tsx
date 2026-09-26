import { Head, router } from '@inertiajs/react';
import {
    CheckCircle2,
    ClipboardList,
    Clock,
    CreditCard,
    Eye,
    HandCoins,
    Package,
    Store,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { dashboard } from '@/routes';

type AdminOrderItem = {
    product_name: string;
    category?: string;
    unit?: string;
    quantity: number;
    vendor_stall?: string;
};

type StatusHistoryItem = {
    status: string;
    note: string | null;
    created_at: string;
};

type AdminOrder = {
    id: number;
    order_number: string;
    status: string;
    payment_method: string;
    payment_status?: string;
    notes?: string | null;
    created_at: string;
    item_count: number;
    vendors: string[];
    items: AdminOrderItem[];
    status_history?: StatusHistoryItem[];
};

type MethodBreakdown = {
    method: string;
    label: string;
    count: number;
    percent: number;
};

type VendorDistribution = {
    id: number;
    stall_name: string;
    stall_location: string | null;
    orders_count: number;
    percent: number;
};

type FilterOption = { value: string; label: string };

type Props = {
    orders: {
        data: AdminOrder[];
        current_page: number;
        last_page: number;
        total: number;
        per_page: number;
        links: { url: string | null; label: string; active: boolean }[];
    };
    stats: {
        total: number;
        pending: number;
        in_progress: number;
        completed: number;
        cancelled: number;
    };
    filters: Record<string, string | undefined>;
    statuses: FilterOption[];
    payment_methods: FilterOption[];
    method_breakdown?: MethodBreakdown[];
    vendor_distribution?: VendorDistribution[];
};

export default function CombinedOrdersAndPaymentsIndex({
    orders,
    stats,
    filters,
    statuses,
    payment_methods,
    method_breakdown = [],
    vendor_distribution = [],
}: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

    function applyFilter(key: string, value: string | undefined) {
        router.get(
            '/admin/dashboard/orders',
            {
                ...filters,
                [key]: value || undefined,
                page: undefined,
            },
            { preserveState: true, preserveScroll: true },
        );
    }

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        applyFilter('search', search || undefined);
    }

    function clearFilters() {
        router.get('/admin/dashboard/orders', {}, { preserveState: true });
        setSearch('');
    }

    function handleStatusUpdate(orderId: number, newStatus: string) {
        if (confirm(`Update order status to ${newStatus}?`)) {
            router.patch(`/admin/dashboard/orders/${orderId}/status`, { status: newStatus }, {
                preserveScroll: true,
                onSuccess: () => setSelectedOrder(null),
            });
        }
    }

    const hasActiveFilters = filters.search || filters.status || filters.payment_method;

    return (
        <>
            <Head title="Payment and Order Management" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-5">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Payment and Order Management</h1>
                    <p className="text-sm text-gray-500">
                        Track and monitor customer orders, payment methods, and vendor order distributions
                    </p>
                </div>

                {/* Stats Cards */}
                <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                            <ClipboardList className="h-5 w-5 text-gray-600" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Total Orders</div>
                            <div className="text-xl font-bold text-gray-900">{stats.total}</div>
                        </div>
                    </div>

                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ee600e]/10">
                            <Clock className="h-5 w-5 text-[#ee600e]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Pending</div>
                            <div className="text-xl font-bold text-[#ee600e]">{stats.pending}</div>
                        </div>
                    </div>

                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0867ff]/10">
                            <Package className="h-5 w-5 text-[#0867ff]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">In Progress</div>
                            <div className="text-xl font-bold text-[#0867ff]">{stats.in_progress}</div>
                        </div>
                    </div>

                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#488562]/10">
                            <CheckCircle2 className="h-5 w-5 text-[#488562]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Completed</div>
                            <div className="text-xl font-bold text-[#488562]">{stats.completed}</div>
                        </div>
                    </div>

                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
                            <X className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Cancelled</div>
                            <div className="text-xl font-bold text-red-500">{stats.cancelled}</div>
                        </div>
                    </div>
                </div>

                {/* Graphs & Charts Section (Visual distributions without specific amounts or sales figures) */}
                <div className="grid gap-4 lg:grid-cols-2">
                    {/* Payment Methods Distribution Chart */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0867ff]/10">
                                <CreditCard className="h-4 w-4 text-[#0867ff]" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-gray-900">Payment Methods Distribution</div>
                                <div className="text-[11px] text-gray-400">Order share breakdown by payment method</div>
                            </div>
                        </div>

                        {method_breakdown.length === 0 ? (
                            <p className="py-6 text-center text-xs text-gray-400">No payment data available</p>
                        ) : (
                            <PaymentMethodsDonutChart breakdown={method_breakdown} />
                        )}
                    </div>

                    {/* Vendor Order Distribution Chart */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="mb-3 flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ee600e]/10">
                                <HandCoins className="h-4 w-4 text-[#ee600e]" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-gray-900">Top Vendor Order Share</div>
                                <div className="text-[11px] text-gray-400">Completed order volume distribution by stall</div>
                            </div>
                        </div>

                        {vendor_distribution.length === 0 ? (
                            <p className="py-6 text-center text-xs text-gray-400">No completed orders yet</p>
                        ) : (
                            <VendorDistributionBarChart distribution={vendor_distribution} />
                        )}
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    <form onSubmit={handleSearch} className="relative">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search order #..."
                            className="h-8 w-48 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-[#488562] focus:outline-none focus:ring-1 focus:ring-[#488562]"
                        />
                    </form>

                    <ChipSelect label="Status" value={filters.status} options={statuses} onChange={(v) => applyFilter('status', v)} />
                    <ChipSelect label="Payment Method" value={filters.payment_method} options={payment_methods} onChange={(v) => applyFilter('payment_method', v)} />

                    {hasActiveFilters && (
                        <button
                            onClick={clearFilters}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-600 transition hover:bg-red-100"
                        >
                            <X className="h-3 w-3" />
                            Clear all
                        </button>
                    )}
                </div>

                {/* Table (NO Customer, NO Total, NO Amount columns) */}
                <div className="flex-1 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/60">
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">#</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Order No.</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Items</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Vendors</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Payment Method</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Placed Date</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {orders.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-4 py-16 text-center text-sm text-gray-400">
                                            <ClipboardList className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                                            No orders found.
                                        </td>
                                    </tr>
                                ) : (
                                    orders.data.map((order, idx) => (
                                        <tr key={order.id} className="group transition hover:bg-[#488562]/[0.02]">
                                            <td className="px-4 py-2.5 text-xs text-gray-400">
                                                {(orders.current_page - 1) * orders.per_page + idx + 1}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className="text-xs font-bold text-gray-900">{order.order_number}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-xs font-semibold text-gray-800">{order.item_count} item{order.item_count !== 1 ? 's' : ''}</td>
                                            <td className="max-w-[200px] px-4 py-2.5">
                                                <div className="flex flex-wrap gap-1">
                                                    {order.vendors.slice(0, 2).map((vendor) => (
                                                        <span key={vendor} className="rounded-md bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                                                            {vendor}
                                                        </span>
                                                    ))}
                                                    {order.vendors.length > 2 && (
                                                        <span className="rounded-md bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
                                                            +{order.vendors.length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <PaymentBadge method={order.payment_method} />
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <OrderStatusBadge status={order.status} />
                                            </td>
                                            <td className="px-4 py-2.5 text-[11px] text-gray-500">{formatDate(order.created_at)}</td>
                                            <td className="px-4 py-2.5 text-right">
                                                <button
                                                    onClick={() => setSelectedOrder(order)}
                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
                                                    title="View Details"
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {orders.last_page > 1 && (
                        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
                            <span className="text-[11px] text-gray-500">
                                {(orders.current_page - 1) * orders.per_page + 1}&#8211;
                                {Math.min(orders.current_page * orders.per_page, orders.total)} of {orders.total}
                            </span>
                            <div className="flex gap-0.5">
                                {orders.links.map((link, i) => (
                                    <button
                                        key={i}
                                        disabled={!link.url}
                                        onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                        className={`h-7 min-w-7 rounded-md px-2 text-[11px] font-medium transition ${
                                            link.active
                                                ? 'bg-[#488562] text-white'
                                                : link.url
                                                    ? 'text-gray-600 hover:bg-gray-100'
                                                    : 'text-gray-300'
                                        }`}
                                        dangerouslySetInnerHTML={{ __html: link.label }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* View Order Detail Modal (NO Customer, NO Total/Amount values) */}
            {selectedOrder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setSelectedOrder(null)}>
                    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Order {selectedOrder.order_number}</h3>
                                <p className="text-xs text-gray-500">Placed on {formatDate(selectedOrder.created_at)}</p>
                            </div>
                            <button onClick={() => setSelectedOrder(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-4 px-6 py-4">
                            <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Status</span>
                                    <div className="mt-0.5">
                                        <OrderStatusBadge status={selectedOrder.status} />
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Payment</span>
                                    <div className="mt-0.5">
                                        <PaymentBadge method={selectedOrder.payment_method} />
                                    </div>
                                </div>
                            </div>

                            {/* Items List (NO prices or amounts) */}
                            <div>
                                <div className="mb-2 text-xs font-bold text-gray-900">Order Items ({selectedOrder.items.length})</div>
                                <div className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white">
                                    {selectedOrder.items.map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3">
                                            <div>
                                                <div className="text-xs font-semibold text-gray-900">{item.product_name}</div>
                                                <div className="text-[10px] text-gray-400">
                                                    {item.vendor_stall ?? 'Vendor'} {item.unit ? `· per ${item.unit}` : ''}
                                                </div>
                                            </div>
                                            <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-700">
                                                Qty: {item.quantity}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Status Timeline */}
                            {selectedOrder.status_history && selectedOrder.status_history.length > 0 && (
                                <div>
                                    <div className="mb-2 text-xs font-bold text-gray-900">Status Timeline</div>
                                    <div className="space-y-2 rounded-xl bg-gray-50 p-3">
                                        {selectedOrder.status_history.map((h, i) => (
                                            <div key={i} className="flex items-start gap-2 text-xs">
                                                <div className="mt-1 h-2 w-2 rounded-full bg-[#488562]" />
                                                <div className="flex-1">
                                                    <span className="font-semibold capitalize text-gray-800">{h.status}</span>
                                                    {h.note && <p className="text-[10px] text-gray-500">{h.note}</p>}
                                                </div>
                                                <span className="text-[10px] text-gray-400">{formatDate(h.created_at)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Admin Status Actions */}
                            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                                <div className="mb-2 text-xs font-bold text-gray-900">Update Order Status</div>
                                <div className="flex flex-wrap gap-1.5">
                                    {['pending', 'confirmed', 'ready', 'completed', 'cancelled'].map((st) => (
                                        <button
                                            key={st}
                                            disabled={selectedOrder.status === st}
                                            onClick={() => handleStatusUpdate(selectedOrder.id, st)}
                                            className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition ${
                                                selectedOrder.status === st
                                                    ? 'bg-gray-300 text-gray-700 cursor-not-allowed'
                                                    : 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            {st}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end border-t border-gray-100 px-6 py-3">
                            <button
                                onClick={() => setSelectedOrder(null)}
                                className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

CombinedOrdersAndPaymentsIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Payment & Order Management', href: '/admin/dashboard/orders' },
    ],
};

/* ─── Sub Components ─── */

function ChipSelect({ label, value, options, onChange }: { label: string; value?: string; options: FilterOption[]; onChange: (v: string | undefined) => void }) {
    return (
        <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={`h-8 cursor-pointer rounded-lg border px-3 text-[11px] font-medium transition focus:outline-none focus:ring-1 focus:ring-[#488562] ${
                value
                    ? 'border-[#488562]/30 bg-[#488562]/5 text-[#488562]'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
        >
            <option value="">{label}: All</option>
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    );
}

function OrderStatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; text: string; label: string; Icon: React.ComponentType<{ className?: string }> }> = {
        pending: { bg: 'bg-[#ee600e]/10', text: 'text-[#ee600e]', label: 'Pending', Icon: Clock },
        confirmed: { bg: 'bg-[#0867ff]/10', text: 'text-[#0867ff]', label: 'Confirmed', Icon: CheckCircle2 },
        ready: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Ready', Icon: Store },
        completed: { bg: 'bg-[#488562]/10', text: 'text-[#488562]', label: 'Completed', Icon: CheckCircle2 },
        cancelled: { bg: 'bg-red-50', text: 'text-red-500', label: 'Cancelled', Icon: X },
    };
    const c = config[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: status, Icon: Package };

    return (
        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${c.bg} ${c.text}`}>
            <c.Icon className="h-3 w-3" />
            {c.label}
        </span>
    );
}

function PaymentBadge({ method }: { method: string }) {
    const styles: Record<string, string> = {
        cash: 'bg-gray-100 text-gray-600',
        gcash: 'bg-blue-50 text-blue-700',
        maya: 'bg-orange-50 text-orange-700',
    };

    return (
        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${styles[method] ?? 'bg-gray-100 text-gray-600'}`}>
            {method?.toUpperCase()}
        </span>
    );
}

function formatDate(value: string): string {
    return new Date(value).toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

const PAYMENT_COLOR_MAP: Record<string, string> = {
    gcash: '#0867ff',
    cash: '#488562',
    maya: '#ee600e',
};

function PaymentMethodsDonutChart({ breakdown }: { breakdown: MethodBreakdown[] }) {
    const totalOrders = breakdown.reduce((sum, b) => sum + b.count, 0);
    const palette = ['#0867ff', '#488562', '#ee600e', '#8b5cf6', '#64748b'];

    let currentAngle = 0;
    const gradientStops = breakdown.map((b, i) => {
        const color = PAYMENT_COLOR_MAP[b.method.toLowerCase()] ?? palette[i % palette.length];
        const angle = totalOrders > 0 ? (b.count / totalOrders) * 360 : 0;
        const start = currentAngle;
        currentAngle += angle;
        return `${color} ${start.toFixed(1)}deg ${currentAngle.toFixed(1)}deg`;
    });

    const background = gradientStops.length > 0
        ? `conic-gradient(${gradientStops.join(', ')})`
        : 'conic-gradient(#e5e7eb 0deg 360deg)';

    return (
        <div className="flex flex-col items-center justify-between gap-4 py-2 sm:flex-row">
            {/* Donut graphic */}
            <div className="relative flex shrink-0 items-center justify-center" style={{ width: 130, height: 130 }}>
                <div className="absolute inset-0 rounded-full" style={{ background }} />
                <div className="absolute inset-3.5 flex flex-col items-center justify-center rounded-full bg-white shadow-sm">
                    <span className="text-xl font-extrabold text-gray-900">{totalOrders}</span>
                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total</span>
                </div>
            </div>

            {/* Legend list */}
            <div className="w-full flex-1 space-y-2">
                {breakdown.map((m, i) => {
                    const color = PAYMENT_COLOR_MAP[m.method.toLowerCase()] ?? palette[i % palette.length];
                    return (
                        <div key={m.method} className="flex items-center justify-between rounded-xl bg-gray-50/80 px-3 py-2 transition hover:bg-gray-100/80">
                            <div className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                                <PaymentBadge method={m.method} />
                                <span className="text-xs font-semibold text-gray-700">{m.label}</span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-bold text-gray-900">{m.count} order{m.count !== 1 ? 's' : ''}</span>
                                <span className="ml-1 text-[11px] font-semibold text-gray-400">({m.percent}%)</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function VendorDistributionBarChart({ distribution }: { distribution: VendorDistribution[] }) {
    const maxOrders = Math.max(...distribution.map((v) => v.orders_count), 1);

    return (
        <div className="py-2">
            <div className="flex items-end gap-2 px-2" style={{ height: 110 }}>
                {distribution.map((v) => {
                    const heightPct = Math.max((v.orders_count / maxOrders) * 100, 10);
                    return (
                        <div key={v.id} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                            {/* Hover tooltip */}
                            <div className="pointer-events-none absolute -top-8 z-10 hidden whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-semibold text-white group-hover:block shadow-md">
                                {v.stall_name}: {v.orders_count} orders ({v.percent}%)
                            </div>

                            <span className="mb-1 text-[10px] font-bold text-gray-700">
                                {v.orders_count}
                            </span>
                            <div
                                className="w-full max-w-[32px] rounded-t-lg bg-gradient-to-t from-[#ee600e] to-[#f7a072] transition-all duration-300 group-hover:from-[#d54e00] group-hover:to-[#ee600e] shadow-sm"
                                style={{ height: `${heightPct}%` }}
                            />
                        </div>
                    );
                })}
            </div>

            {/* Labels under bars */}
            <div className="mt-2 flex gap-2 border-t border-gray-100 pt-2 px-2">
                {distribution.map((v) => (
                    <div key={v.id} className="flex-1 text-center min-w-0" title={`${v.stall_name} (${v.percent}%)`}>
                        <div className="truncate text-[10px] font-semibold text-gray-800">{v.stall_name}</div>
                        <div className="text-[9px] font-medium text-gray-400">{v.percent}%</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
