import { Head, router } from '@inertiajs/react';
import {
    CheckCircle2,
    ClipboardList,
    Clock,
    CreditCard,
    Package,
    Store,
    Users,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { dashboard } from '@/routes';

type AdminOrder = {
    id: number;
    order_number: string;
    status: string;
    total_amount: string;
    payment_method: string;
    created_at: string;
    customer: { id: number; name: string; email: string };
    item_count: number;
    vendors: string[];
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
};

export default function OrdersIndex({ orders, stats, filters, statuses, payment_methods }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');

    function applyFilter(key: string, value: string | undefined) {
        router.get('/admin/dashboard/orders', {
            ...filters,
            [key]: value || undefined,
            page: undefined,
        }, { preserveState: true, preserveScroll: true });
    }

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        applyFilter('search', search || undefined);
    }

    function clearFilters() {
        router.get('/admin/dashboard/orders', {}, { preserveState: true });
        setSearch('');
    }

    const hasActiveFilters = filters.search || filters.status || filters.payment_method;

    return (
        <>
            <Head title="Order Management" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-5">
                {/* Header */}
                <div>
                    <h1 className="text-lg font-bold text-gray-900">Order Management</h1>
                    <p className="text-xs text-gray-500">Monitor customer orders across all vendors</p>
                </div>

                {/* Stats */}
                <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                            <ClipboardList className="h-5 w-5 text-gray-600" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Total Orders</div>
                            <div className="text-xl font-bold text-gray-900">{stats.total}</div>
                        </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ee600e]/10">
                            <Clock className="h-5 w-5 text-[#ee600e]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Pending</div>
                            <div className="text-xl font-bold text-[#ee600e]">{stats.pending}</div>
                        </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0867ff]/10">
                            <Package className="h-5 w-5 text-[#0867ff]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">In Progress</div>
                            <div className="text-xl font-bold text-[#0867ff]">{stats.in_progress}</div>
                        </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#488562]/10">
                            <CheckCircle2 className="h-5 w-5 text-[#488562]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Completed</div>
                            <div className="text-xl font-bold text-[#488562]">{stats.completed}</div>
                        </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
                            <X className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Cancelled</div>
                            <div className="text-xl font-bold text-red-500">{stats.cancelled}</div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    <form onSubmit={handleSearch} className="relative">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search order # or customer..."
                            className="h-8 w-52 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-[#488562] focus:outline-none focus:ring-1 focus:ring-[#488562]"
                        />
                    </form>

                    <ChipSelect label="Status" value={filters.status} options={statuses} onChange={(v) => applyFilter('status', v)} />
                    <ChipSelect label="Payment" value={filters.payment_method} options={payment_methods} onChange={(v) => applyFilter('payment_method', v)} />

                    {hasActiveFilters && (
                        <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-600 transition hover:bg-red-100">
                            <X className="h-3 w-3" />
                            Clear all
                        </button>
                    )}
                </div>

                {/* Table */}
                <div className="flex-1 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/60">
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">#</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Order No.</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Customer</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Items</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Vendors</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Total</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Payment</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Placed</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {orders.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-16 text-center text-sm text-gray-400">
                                            <ClipboardList className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                                            No orders found.
                                        </td>
                                    </tr>
                                ) : (
                                    orders.data.map((order, idx) => (
                                        <tr key={order.id} className="group transition hover:bg-[#488562]/[0.02]">
                                            <td className="px-4 py-2.5 text-xs text-gray-400">{(orders.current_page - 1) * orders.per_page + idx + 1}</td>
                                            <td className="px-4 py-2.5">
                                                <span className="text-xs font-bold text-gray-900">{order.order_number}</span>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Users className="h-3 w-3 shrink-0 text-gray-400" />
                                                    <div>
                                                        <div className="text-xs font-medium text-gray-800">{order.customer.name}</div>
                                                        <div className="text-[10px] text-gray-400">{order.customer.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5 text-xs font-semibold text-gray-800">{order.item_count}</td>
                                            <td className="max-w-[160px] px-4 py-2.5">
                                                <div className="flex flex-wrap gap-1">
                                                    {order.vendors.slice(0, 2).map((vendor) => (
                                                        <span key={vendor} className="rounded-md bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">{vendor}</span>
                                                    ))}
                                                    {order.vendors.length > 2 && (
                                                        <span className="rounded-md bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">+{order.vendors.length - 2}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5 text-xs font-bold text-gray-900">&#8369;{Number(order.total_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                            <td className="px-4 py-2.5"><PaymentBadge method={order.payment_method} /></td>
                                            <td className="px-4 py-2.5"><OrderStatusBadge status={order.status} /></td>
                                            <td className="px-4 py-2.5 text-[11px] text-gray-400">{formatDate(order.created_at)}</td>
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
                                {(orders.current_page - 1) * orders.per_page + 1}&#8211;{Math.min(orders.current_page * orders.per_page, orders.total)} of {orders.total}
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
        </>
    );
}

OrdersIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Order Management', href: '/admin/dashboard/orders' },
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
    const label = method.charAt(0).toUpperCase() + method.slice(1);

    return (
        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${styles[method] ?? 'bg-gray-100 text-gray-600'}`}>
            <CreditCard className="h-3 w-3" />
            {label}
        </span>
    );
}

function formatDate(value: string): string {
    return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}
