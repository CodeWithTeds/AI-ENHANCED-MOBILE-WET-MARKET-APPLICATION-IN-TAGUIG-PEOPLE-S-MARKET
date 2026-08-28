import { Head, router } from '@inertiajs/react';
import {
    Banknote,
    CheckCircle2,
    Clock,
    CreditCard,
    DollarSign,
    HandCoins,
    Receipt,
    Store,
    TrendingUp,
    Users,
    Wallet,
    X,
    XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { dashboard } from '@/routes';

type Payout = {
    vendor_id: number;
    stall_name: string;
    stall_location: string | null;
    amount: number;
    items_count: number;
    items: { product_name: string; quantity: number; unit_price: string; subtotal: string }[];
};

type Payment = {
    id: number;
    order_number: string;
    status: string;
    payment_status: 'pending' | 'successful' | 'failed';
    payment_method: string;
    total_amount: string;
    notes: string | null;
    created_at: string;
    updated_at: string;
    customer: { id: number; name: string; email: string } | null;
    item_count: number;
    vendors: string[];
    payouts: Payout[];
    items: { product_name: string; quantity: number; unit_price: string; subtotal: string; vendor_stall: string | null }[];
};

type FilterOption = { value: string; label: string };

type Props = {
    payments: {
        data: Payment[];
        current_page: number;
        last_page: number;
        total: number;
        per_page: number;
        links: { url: string | null; label: string; active: boolean }[];
    };
    stats: {
        total_transactions: number;
        total_revenue: number;
        successful_revenue: number;
        pending_revenue: number;
        failed_revenue: number;
        successful_count: number;
        pending_count: number;
        failed_count: number;
        total_payout: number;
        pending_payout: number;
    };
    filters: Record<string, string | undefined>;
    payment_methods: FilterOption[];
    payment_statuses: FilterOption[];
    order_statuses: FilterOption[];
    method_breakdown: { method: string; label: string; count: number; revenue: number; percent: number }[];
    vendor_payouts: { id: number; stall_name: string; stall_location: string; orders_count: number; payout: number }[];
};

export default function PaymentManagementIndex({
    payments,
    stats,
    filters,
    payment_methods,
    payment_statuses,
    method_breakdown,
    vendor_payouts,
}: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [viewPayment, setViewPayment] = useState<Payment | null>(null);

    function applyFilter(key: string, value: string | undefined) {
        router.get(
            '/admin/dashboard/payments',
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
        router.get('/admin/dashboard/payments', {}, { preserveState: true });
        setSearch('');
    }

    const hasActiveFilters = filters.search || filters.payment_method || filters.payment_status || filters.status;

    return (
        <>
            <Head title="Payment Management" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Payment Management</h1>
                        <p className="text-sm text-gray-500">Track customer payments, vendor payouts and transaction history</p>
                    </div>
                    <div className="hidden rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-right sm:block">
                        <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Total Payout to Vendors</div>
                        <div className="text-lg font-bold text-[#488562]">₱{stats.total_payout.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                        <div className="text-[11px] text-gray-400">Pending ₱{stats.pending_payout.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        icon={Receipt}
                        label="Total Transactions"
                        value={stats.total_transactions}
                        color="#6b7280"
                        sub={`₱${stats.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })} gross`}
                    />
                    <StatCard
                        icon={CheckCircle2}
                        label="Successful"
                        value={stats.successful_count}
                        color="#488562"
                        sub={`₱${stats.successful_revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })} paid`}
                    />
                    <StatCard
                        icon={Clock}
                        label="Pending"
                        value={stats.pending_count}
                        color="#ee600e"
                        sub={`₱${stats.pending_revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })} awaiting`}
                    />
                    <StatCard
                        icon={XCircle}
                        label="Failed / Cancelled"
                        value={stats.failed_count}
                        color="#dc2626"
                        sub={`₱${stats.failed_revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })} lost`}
                    />
                </div>

                {/* Method breakdown + Vendor payouts */}
                <div className="grid gap-4 lg:grid-cols-2">
                    {/* Payment methods */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="mb-3 flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0867ff]/10">
                                <CreditCard className="h-4 w-4 text-[#0867ff]" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-gray-900">Payment Methods</div>
                                <div className="text-[11px] text-gray-400">Share of non-cancelled transactions</div>
                            </div>
                        </div>
                        {method_breakdown.length === 0 ? (
                            <p className="py-6 text-center text-xs text-gray-400">No payment data</p>
                        ) : (
                            <div className="space-y-2.5">
                                {method_breakdown.map((m) => (
                                    <div key={m.method} className="flex items-center gap-3">
                                        <PaymentBadge method={m.method} />
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-medium text-gray-700">{m.label}</span>
                                                <span className="font-bold text-gray-900">
                                                    ₱{m.revenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="mt-1 flex items-center gap-2">
                                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                                                    <div
                                                        className="h-full rounded-full bg-[#488562]"
                                                        style={{ width: `${m.percent}%` }}
                                                    />
                                                </div>
                                                <span className="text-[10px] font-medium text-gray-400">
                                                    {m.count} × {m.percent}%
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Vendor payouts */}
                    <div className="rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="mb-3 flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ee600e]/10">
                                <HandCoins className="h-4 w-4 text-[#ee600e]" />
                            </div>
                            <div>
                                <div className="text-xs font-bold text-gray-900">Top Vendor Payouts</div>
                                <div className="text-[11px] text-gray-400">Completed orders only</div>
                            </div>
                        </div>
                        {vendor_payouts.length === 0 ? (
                            <p className="py-6 text-center text-xs text-gray-400">No payouts yet</p>
                        ) : (
                            <div className="space-y-2">
                                {vendor_payouts.map((v) => (
                                    <div key={v.id} className="flex items-center justify-between rounded-xl border border-gray-100 px-3 py-2.5">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50">
                                                <Store className="h-4 w-4 text-gray-400" />
                                            </div>
                                            <div>
                                                <div className="text-xs font-semibold text-gray-900">{v.stall_name}</div>
                                                <div className="text-[11px] text-gray-400">
                                                    {v.stall_location} · {v.orders_count} orders
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xs font-bold text-[#488562]">₱{v.payout.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                                            <div className="text-[10px] text-gray-400">payout</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
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
                            placeholder="Search order # or customer..."
                            className="h-8 w-52 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-[#488562] focus:outline-none focus:ring-1 focus:ring-[#488562]"
                        />
                    </form>

                    <ChipSelect
                        label="Payment Status"
                        value={filters.payment_status}
                        options={payment_statuses}
                        onChange={(v) => applyFilter('payment_status', v)}
                    />
                    <ChipSelect
                        label="Method"
                        value={filters.payment_method}
                        options={payment_methods}
                        onChange={(v) => applyFilter('payment_method', v)}
                    />

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

                {/* Table */}
                <div className="flex-1 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/60">
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">#</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Transaction</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Customer</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Amount</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Method</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Payment</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Order Status</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Vendors / Payout</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {payments.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="px-4 py-16 text-center text-sm text-gray-400">
                                            <Wallet className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                                            No transactions found.
                                        </td>
                                    </tr>
                                ) : (
                                    payments.data.map((p, idx) => (
                                        <tr
                                            key={p.id}
                                            className="group cursor-pointer transition hover:bg-[#488562]/[0.02]"
                                            onClick={() => setViewPayment(p)}
                                        >
                                            <td className="px-4 py-2.5 text-xs text-gray-400">{(payments.current_page - 1) * payments.per_page + idx + 1}</td>
                                            <td className="px-4 py-2.5">
                                                <div className="text-xs font-bold text-gray-900">{p.order_number}</div>
                                                <div className="text-[11px] text-gray-400">{p.item_count} items</div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {p.customer ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Users className="h-3 w-3 shrink-0 text-gray-400" />
                                                        <div>
                                                            <div className="text-xs font-medium text-gray-800">{p.customer.name}</div>
                                                            <div className="text-[10px] text-gray-400">{p.customer.email}</div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-1 text-xs font-bold text-gray-900">
                                                    <Banknote className="h-3 w-3 text-gray-400" />₱
                                                    {Number(p.total_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <PaymentBadge method={p.payment_method} />
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <PaymentStatusBadge status={p.payment_status} />
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <OrderStatusBadge status={p.status} />
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="space-y-1">
                                                    {p.payouts.slice(0, 2).map((pay) => (
                                                        <div key={pay.vendor_id} className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1">
                                                            <span className="max-w-[90px] truncate text-[11px] font-medium text-gray-700">{pay.stall_name}</span>
                                                            <span className="text-[11px] font-bold text-[#488562]">₱{pay.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                                        </div>
                                                    ))}
                                                    {p.payouts.length > 2 && (
                                                        <div className="text-[10px] font-medium text-gray-400">+{p.payouts.length - 2} more</div>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5 text-[11px] text-gray-400">{formatDate(p.created_at)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {payments.last_page > 1 && (
                        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
                            <span className="text-[11px] text-gray-500">
                                {(payments.current_page - 1) * payments.per_page + 1}–
                                {Math.min(payments.current_page * payments.per_page, payments.total)} of {payments.total}
                            </span>
                            <div className="flex gap-0.5">
                                {payments.links.map((link, i) => (
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

                <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <span>
                        Showing {payments.data.length} of {payments.total} transactions
                    </span>
                    <span>Click row to view payout breakdown · 15 per page</span>
                </div>
            </div>

            {/* Detail Dialog */}
            {viewPayment && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewPayment(null)}>
                    <div
                        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">{viewPayment.order_number}</h3>
                                <p className="text-xs text-gray-500">
                                    {viewPayment.customer?.name ?? 'Guest'} · {formatDate(viewPayment.created_at)}
                                </p>
                            </div>
                            <button onClick={() => setViewPayment(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="space-y-4 p-6">
                            {/* Amount and method */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="rounded-xl border border-gray-100 p-3 text-center">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Amount</div>
                                    <div className="mt-1 text-sm font-bold text-gray-900">
                                        ₱{Number(viewPayment.total_amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-gray-100 p-3 text-center">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Method</div>
                                    <div className="mt-1 flex justify-center">
                                        <PaymentBadge method={viewPayment.payment_method} />
                                    </div>
                                </div>
                                <div className="rounded-xl border border-gray-100 p-3 text-center">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Payment</div>
                                    <div className="mt-1 flex justify-center">
                                        <PaymentStatusBadge status={viewPayment.payment_status} />
                                    </div>
                                </div>
                            </div>

                            {/* Payout breakdown */}
                            <div>
                                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-gray-900">
                                    <HandCoins className="h-4 w-4 text-[#ee600e]" /> Payout Breakdown
                                </div>
                                <div className="space-y-2">
                                    {viewPayment.payouts.map((pay) => (
                                        <div key={pay.vendor_id} className="rounded-xl border border-gray-100 p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Store className="h-3.5 w-3.5 text-gray-400" />
                                                    <span className="text-xs font-semibold text-gray-900">{pay.stall_name}</span>
                                                    {pay.stall_location && (
                                                        <span className="text-[11px] text-gray-400">· {pay.stall_location}</span>
                                                    )}
                                                </div>
                                                <span className="text-xs font-bold text-[#488562]">
                                                    ₱{pay.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                            <div className="mt-2 divide-y divide-gray-50 rounded-lg bg-gray-50 px-3 py-2">
                                                {pay.items.map((it, i) => (
                                                    <div key={i} className="flex items-center justify-between py-1 text-[11px]">
                                                        <span className="text-gray-700">
                                                            {it.product_name} × {it.quantity}
                                                        </span>
                                                        <span className="font-medium text-gray-900">
                                                            ₱{Number(it.subtotal).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Customer and order info */}
                            <div className="rounded-xl bg-gray-50 p-3 text-xs">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Customer</div>
                                        <div className="font-medium text-gray-900">{viewPayment.customer?.name ?? '—'}</div>
                                        <div className="text-gray-500">{viewPayment.customer?.email ?? ''}</div>
                                    </div>
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Transaction</div>
                                        <div className="font-medium text-gray-900">{viewPayment.order_number}</div>
                                        <div className="text-gray-500">Status: {viewPayment.status}</div>
                                    </div>
                                </div>
                                {viewPayment.notes && (
                                    <div className="mt-3 border-t border-gray-200 pt-3">
                                        <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Notes</div>
                                        <p className="mt-1 text-gray-700">{viewPayment.notes}</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                                <button
                                    onClick={() => setViewPayment(null)}
                                    className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

PaymentManagementIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Payment Management', href: '/admin/dashboard/payments' },
    ],
};

/* ─── Sub Components ─── */

function StatCard({
    icon: Icon,
    label,
    value,
    color,
    sub,
}: {
    icon: LucideIcon;
    label: string;
    value: number | string;
    color: string;
    sub?: string;
}) {
    return (
        <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}15` }}>
                <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="min-w-0">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
                <div className="text-xl font-bold" style={{ color }}>
                    {typeof value === 'number' ? value.toLocaleString() : value}
                </div>
                {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
            </div>
        </div>
    );
}

function ChipSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value?: string;
    options: FilterOption[];
    onChange: (v: string | undefined) => void;
}) {
    return (
        <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={`h-8 cursor-pointer rounded-lg border px-3 text-[11px] font-medium transition focus:outline-none focus:ring-1 focus:ring-[#488562] ${
                value ? 'border-[#488562]/30 bg-[#488562]/5 text-[#488562]' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
        >
            <option value="">{label}: All</option>
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                    {opt.label}
                </option>
            ))}
        </select>
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

function PaymentStatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; text: string; label: string; Icon: LucideIcon }> = {
        pending: { bg: 'bg-[#ee600e]/10', text: 'text-[#ee600e]', label: 'Pending', Icon: Clock },
        successful: { bg: 'bg-[#488562]/10', text: 'text-[#488562]', label: 'Successful', Icon: CheckCircle2 },
        failed: { bg: 'bg-red-50', text: 'text-red-500', label: 'Failed', Icon: XCircle },
    };
    const c = config[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: status, Icon: Wallet };
    return (
        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${c.bg} ${c.text}`}>
            <c.Icon className="h-3 w-3" />
            {c.label}
        </span>
    );
}

function OrderStatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; text: string; label: string }> = {
        pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending' },
        confirmed: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Confirmed' },
        processing: { bg: 'bg-blue-50', text: 'text-blue-700', label: 'Processing' },
        ready: { bg: 'bg-purple-50', text: 'text-purple-700', label: 'Ready' },
        completed: { bg: 'bg-[#488562]/10', text: 'text-[#488562]', label: 'Completed' },
        cancelled: { bg: 'bg-red-50', text: 'text-red-500', label: 'Cancelled' },
    };
    const c = config[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: status };
    return <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${c.bg} ${c.text}`}>{c.label}</span>;
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
