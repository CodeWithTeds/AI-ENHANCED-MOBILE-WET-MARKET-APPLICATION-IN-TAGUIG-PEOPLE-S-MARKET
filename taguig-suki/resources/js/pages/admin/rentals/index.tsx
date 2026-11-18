import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    Calendar,
    CheckCircle2,
    Clock,
    DollarSign,
    FileCheck,
    Filter,
    Plus,
    Receipt,
    RefreshCw,
    ShieldAlert,
    Store,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import { dashboard } from '@/routes';

type RentalPayment = {
    id: number;
    vendor_id: number;
    stall_id: number;
    billing_period: string;
    amount: string;
    due_date: string;
    paid_at: string | null;
    payment_method: string | null;
    payment_reference: string | null;
    proof_path: string | null;
    status: string; // paid, unpaid, pending, overdue
    notes: string | null;
    vendor?: {
        id: number;
        stall_name: string;
        stall_location: string;
    };
    stall?: {
        id: number;
        stall_number: string;
        store_name: string;
        section: string;
        monthly_rent: string;
    };
    verifier?: {
        id: number;
        name: string;
    };
};

type FilterOption = { value: string; label: string };

type Props = {
    rentals: {
        data: RentalPayment[];
        current_page: number;
        last_page: number;
        total: number;
        per_page: number;
        links: { url: string | null; label: string; active: boolean }[];
    };
    stats: {
        total: number;
        paid: number;
        unpaid: number;
        pending: number;
        overdue: number;
        total_collected: number;
        total_receivable: number;
    };
    filters: Record<string, string | undefined>;
    vendors: { id: number; stall_name: string; stall_location: string }[];
    statuses: FilterOption[];
};

export default function RentalMonitoringIndex({
    rentals,
    stats,
    filters,
    vendors,
    statuses,
}: Props) {
    const [selectedStatus, setSelectedStatus] = useState(filters.status ?? '');
    const [selectedVendor, setSelectedVendor] = useState(filters.vendor_id ?? '');
    const [billingPeriod, setBillingPeriod] = useState(filters.billing_period ?? '');
    const [search, setSearch] = useState(filters.search ?? '');

    const [genModalOpen, setGenModalOpen] = useState(false);
    const genForm = useForm({
        billing_period: new Date().toISOString().slice(0, 7), // YYYY-MM
    });

    function applyFilters(updates: Record<string, string | undefined> = {}) {
        const next = {
            ...filters,
            status: selectedStatus || undefined,
            vendor_id: selectedVendor || undefined,
            billing_period: billingPeriod || undefined,
            search: search || undefined,
            ...updates,
            page: undefined,
        };
        router.get('/admin/dashboard/vendors/rentals', next, {
            preserveState: true,
            preserveScroll: true,
        });
    }

    function handleVerify(rental: RentalPayment) {
        if (confirm(`Verify payment of ₱${rental.amount} for ${rental.vendor?.stall_name} (${rental.billing_period})?`)) {
            router.patch(`/admin/dashboard/vendors/rentals/${rental.id}/verify`, {}, {
                preserveScroll: true,
            });
        }
    }

    function handleGenerateBills(e: React.FormEvent) {
        e.preventDefault();
        genForm.post('/admin/dashboard/vendors/rentals/generate', {
            onSuccess: () => setGenModalOpen(false),
        });
    }

    function statusBadge(status: string) {
        switch (status) {
            case 'paid':
                return { label: 'Paid', color: 'bg-emerald-100 text-emerald-800' };
            case 'pending':
                return { label: 'Pending Verification', color: 'bg-amber-100 text-amber-800' };
            case 'overdue':
                return { label: 'Overdue', color: 'bg-rose-100 text-rose-800' };
            case 'unpaid':
            default:
                return { label: 'Unpaid', color: 'bg-gray-100 text-gray-700' };
        }
    }

    return (
        <>
            <Head title="Monthly Stall Rental Payment Monitoring" />

            <div className="flex h-full flex-1 flex-col gap-5 p-6">
                {/* Header */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                            Monthly Stall Rental Payments
                        </h1>
                        <p className="text-sm text-gray-500">
                            Monitor monthly stall rental dues, payment statuses (paid, unpaid, pending, overdue), and due dates.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => router.get('/admin/dashboard/reports/rentals')}
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50"
                        >
                            <FileCheck className="h-4 w-4 text-[#488562]" />
                            View Rental Reports
                        </button>

                        <button
                            type="button"
                            onClick={() => setGenModalOpen(true)}
                            className="inline-flex items-center gap-2 rounded-xl bg-[#488562] px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#3a6e50]"
                        >
                            <Plus className="h-4 w-4" />
                            Generate Monthly Bills
                        </button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-1 border-b border-gray-200">
                    <Link
                        href="/admin/dashboard/vendors/stalls"
                        className="inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-xs font-semibold text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    >
                        <Store className="h-4 w-4" />
                        All Stalls
                    </Link>
                    <Link
                        href="/admin/dashboard/vendors/stalls/monitoring"
                        className="inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-xs font-semibold text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    >
                        <ShieldAlert className="h-4 w-4 text-amber-500" />
                        Stall Monitoring &amp; Customer Complaints
                    </Link>
                    <Link
                        href="/admin/dashboard/vendors/rentals"
                        className="inline-flex items-center gap-2 border-b-2 border-[#488562] px-4 py-2.5 text-xs font-bold text-[#488562]"
                    >
                        <Receipt className="h-4 w-4 text-[#488562]" />
                        Monthly Stall Rentals &amp; Billing
                    </Link>
                </div>

                {/* KPI Overview */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Billed</div>
                        <div className="mt-2 text-2xl font-black text-gray-900">{stats.total}</div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Paid</div>
                        <div className="mt-2 text-2xl font-black text-emerald-700">{stats.paid}</div>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">Pending Verification</div>
                        <div className="mt-2 text-2xl font-black text-amber-700">{stats.pending}</div>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-rose-700">Overdue</div>
                        <div className="mt-2 text-2xl font-black text-rose-700">{stats.overdue}</div>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Unpaid</div>
                        <div className="mt-2 text-2xl font-black text-gray-700">{stats.unpaid}</div>
                    </div>
                    <div className="rounded-2xl border border-[#488562]/20 bg-[#488562]/5 p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-[#488562]">Collected</div>
                        <div className="mt-2 text-xl font-black text-[#488562]">
                            ₱{stats.total_collected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>

                {/* Filter Toolbar */}
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    {/* Status Filter */}
                    <div className="w-44">
                        <label className="mb-1 block text-xs font-bold text-gray-600">Payment Status</label>
                        <select
                            value={selectedStatus}
                            onChange={(e) => {
                                setSelectedStatus(e.target.value);
                                applyFilters({ status: e.target.value || undefined });
                            }}
                            className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 focus:border-[#488562] focus:ring-[#488562]"
                        >
                            <option value="">All Statuses</option>
                            {statuses.map((st) => (
                                <option key={st.value} value={st.value}>{st.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Vendor Filter */}
                    <div className="min-w-[200px] flex-1">
                        <label className="mb-1 block text-xs font-bold text-gray-600">Filter Vendor</label>
                        <select
                            value={selectedVendor}
                            onChange={(e) => {
                                setSelectedVendor(e.target.value);
                                applyFilters({ vendor_id: e.target.value || undefined });
                            }}
                            className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 focus:border-[#488562] focus:ring-[#488562]"
                        >
                            <option value="">All Vendors</option>
                            {vendors.map((v) => (
                                <option key={v.id} value={String(v.id)}>{v.stall_name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Billing Period (YYYY-MM) */}
                    <div className="w-40">
                        <label className="mb-1 block text-xs font-bold text-gray-600">Period (YYYY-MM)</label>
                        <input
                            type="month"
                            value={billingPeriod}
                            onChange={(e) => {
                                setBillingPeriod(e.target.value);
                                applyFilters({ billing_period: e.target.value || undefined });
                            }}
                            className="h-9 w-full rounded-xl border border-gray-200 px-3 text-xs font-medium focus:border-[#488562] focus:ring-[#488562]"
                        />
                    </div>

                    {/* Clear Button */}
                    {(selectedStatus || selectedVendor || billingPeriod || search) && (
                        <div className="self-end">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedStatus('');
                                    setSelectedVendor('');
                                    setBillingPeriod('');
                                    setSearch('');
                                    router.get('/admin/dashboard/vendors/rentals');
                                }}
                                className="h-9 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>

                {/* Rentals Table */}
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">Vendor / Stall</th>
                                    <th className="px-4 py-3">Billing Period</th>
                                    <th className="px-4 py-3">Amount</th>
                                    <th className="px-4 py-3">Due Date</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Payment Info</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rentals.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                                            No rental records found.
                                        </td>
                                    </tr>
                                ) : (
                                    rentals.data.map((r) => {
                                        const badge = statusBadge(r.status);
                                        return (
                                            <tr key={r.id} className="hover:bg-gray-50/50">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-gray-900">{r.vendor?.stall_name ?? '—'}</div>
                                                    <div className="text-[11px] text-gray-500">
                                                        {r.stall?.stall_number ?? 'Stall'} ({r.stall?.section ?? 'Market'})
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 font-semibold text-gray-700">
                                                    {r.billing_period}
                                                </td>
                                                <td className="px-4 py-3 font-bold text-gray-900">
                                                    ₱{Number(r.amount).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className={`font-semibold ${r.status === 'overdue' ? 'text-rose-600' : 'text-gray-700'}`}>
                                                        {new Date(r.due_date).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${badge.color}`}>
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {r.payment_method ? (
                                                        <div>
                                                            <div className="font-semibold uppercase text-gray-800">{r.payment_method}</div>
                                                            {r.payment_reference && (
                                                                <div className="text-[10px] text-gray-400">Ref: {r.payment_reference}</div>
                                                            )}
                                                            {r.paid_at && (
                                                                <div className="text-[10px] text-gray-400">Paid: {new Date(r.paid_at).toLocaleDateString()}</div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="italic text-gray-400">Unpaid</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {r.status === 'pending' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleVerify(r)}
                                                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                                                        >
                                                            Verify &amp; Mark Paid
                                                        </button>
                                                    )}
                                                    {r.status === 'unpaid' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleVerify(r)}
                                                            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                                        >
                                                            Record Cash Payment
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Generate Monthly Bills Modal */}
                {genModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                            <h2 className="text-lg font-bold text-gray-900">Generate Monthly Stall Rental Bills</h2>
                            <p className="mt-1 text-xs text-gray-500">
                                Automatically creates monthly rental billing records for all occupied market stalls.
                            </p>

                            <form onSubmit={handleGenerateBills} className="mt-4 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700">Billing Period (YYYY-MM)</label>
                                    <input
                                        type="month"
                                        required
                                        value={genForm.data.billing_period}
                                        onChange={(e) => genForm.setData('billing_period', e.target.value)}
                                        className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-3 text-xs font-medium focus:border-[#488562] focus:ring-[#488562]"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setGenModalOpen(false)}
                                        className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={genForm.processing}
                                        className="rounded-lg bg-[#488562] px-4 py-2 text-xs font-bold text-white hover:bg-[#3a6e50]"
                                    >
                                        Generate Bills
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </>
    );
}

RentalMonitoringIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Vendor Management', href: '/admin/dashboard/vendors' },
        { title: 'Stall Rental Payments', href: '/admin/dashboard/vendors/rentals' },
    ],
};
