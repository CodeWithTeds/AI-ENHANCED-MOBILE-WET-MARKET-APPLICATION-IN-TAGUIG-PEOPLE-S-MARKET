import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    Bell,
    Calendar,
    CheckCircle2,
    Clock,
    DollarSign,
    Edit3,
    FileCheck,
    Filter,
    Plus,
    Receipt,
    RefreshCw,
    ShieldAlert,
    Store,
    UserCheck,
    Users,
    X,
    XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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

    // Generate Bills Modal State
    const [genModalOpen, setGenModalOpen] = useState(false);
    const [generationMode, setGenerationMode] = useState<'all' | 'individual'>('all');
    const genForm = useForm({
        billing_period: new Date().toISOString().slice(0, 7), // YYYY-MM
        vendor_id: 'all',
        due_date: '',
        amount: '',
    });

    // Update Status Modal State
    const [statusModalRental, setStatusModalRental] = useState<RentalPayment | null>(null);
    const statusForm = useForm({
        status: 'paid',
        payment_method: 'cash',
        payment_reference: '',
        paid_at: new Date().toISOString().slice(0, 10),
        notes: '',
    });

    // When statusModalRental changes, populate statusForm
    useEffect(() => {
        if (statusModalRental) {
            statusForm.setData({
                status: statusModalRental.status || 'paid',
                payment_method: statusModalRental.payment_method || 'cash',
                payment_reference: statusModalRental.payment_reference || '',
                paid_at: statusModalRental.paid_at
                    ? new Date(statusModalRental.paid_at).toISOString().slice(0, 10)
                    : new Date().toISOString().slice(0, 10),
                notes: statusModalRental.notes || '',
            });
        }
    }, [statusModalRental]);

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

    function handleOpenStatusModal(rental: RentalPayment, initialStatus?: string) {
        setStatusModalRental(rental);
        if (initialStatus) {
            statusForm.setData((prev) => ({
                ...prev,
                status: initialStatus,
                payment_method: initialStatus === 'paid' ? (rental.payment_method || 'cash') : prev.payment_method,
            }));
        }
    }

    function handleStatusSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!statusModalRental) return;

        statusForm.patch(`/admin/dashboard/vendors/rentals/${statusModalRental.id}/status`, {
            preserveScroll: true,
            onSuccess: () => setStatusModalRental(null),
        });
    }

    function handleQuickToggleStatus(rental: RentalPayment, newStatus: 'paid' | 'unpaid') {
        const actionLabel = newStatus === 'paid' ? 'Mark as Paid' : 'Mark as Unpaid';
        if (
            confirm(
                `${actionLabel} for ${rental.vendor?.stall_name || 'Vendor'} (${rental.billing_period})?\nAmount: ₱${Number(
                    rental.amount
                ).toFixed(2)}`
            )
        ) {
            router.patch(
                `/admin/dashboard/vendors/rentals/${rental.id}/status`,
                {
                    status: newStatus,
                    payment_method: newStatus === 'paid' ? (rental.payment_method || 'cash') : null,
                    paid_at: newStatus === 'paid' ? new Date().toISOString().slice(0, 10) : null,
                },
                {
                    preserveScroll: true,
                }
            );
        }
    }

    function handleGenerateBills(e: React.FormEvent) {
        e.preventDefault();
        genForm.transform((data) => ({
            ...data,
            vendor_id: generationMode === 'individual' ? data.vendor_id : 'all',
            due_date: data.due_date || undefined,
            amount: data.amount || undefined,
        }));

        genForm.post('/admin/dashboard/vendors/rentals/generate', {
            preserveScroll: true,
            onSuccess: () => setGenModalOpen(false),
        });
    }

    function statusBadge(status: string) {
        switch (status) {
            case 'paid':
                return {
                    label: 'Paid',
                    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                    icon: CheckCircle2,
                };
            case 'pending':
                return {
                    label: 'Pending Verification',
                    color: 'bg-amber-100 text-amber-800 border-amber-200',
                    icon: Clock,
                };
            case 'overdue':
                return {
                    label: 'Overdue',
                    color: 'bg-rose-100 text-rose-800 border-rose-200',
                    icon: AlertCircle,
                };
            case 'unpaid':
            default:
                return {
                    label: 'Unpaid',
                    color: 'bg-gray-100 text-gray-700 border-gray-200',
                    icon: XCircle,
                };
        }
    }

    const selectedIndividualVendor = useMemo(() => {
        if (generationMode !== 'individual' || genForm.data.vendor_id === 'all') return null;
        return vendors.find((v) => String(v.id) === String(genForm.data.vendor_id)) || null;
    }, [generationMode, genForm.data.vendor_id, vendors]);

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
                            Generate monthly bills individually or collectively, update payment statuses (Paid, Unpaid, Pending, Overdue), and notify vendors.
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
                            onClick={() => {
                                setGenModalOpen(true);
                                if (vendors.length > 0 && genForm.data.vendor_id === 'all') {
                                    // keep default
                                }
                            }}
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

                    {/* Search by Ref or Stall */}
                    <div className="w-48">
                        <label className="mb-1 block text-xs font-bold text-gray-600">Search</label>
                        <input
                            type="text"
                            placeholder="Stall or reference..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    applyFilters({ search: search || undefined });
                                }
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
                                Clear Filters
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
                                    <th className="px-4 py-3">Payment Status</th>
                                    <th className="px-4 py-3">Payment Info</th>
                                    <th className="px-4 py-3 text-right">Payment Status Management</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {rentals.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                                            No rental records found matching your filters.
                                        </td>
                                    </tr>
                                ) : (
                                    rentals.data.map((r) => {
                                        const badge = statusBadge(r.status);
                                        const BadgeIcon = badge.icon;
                                        const isPaid = r.status === 'paid';

                                        return (
                                            <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                                                <td className="px-4 py-3.5">
                                                    <div className="font-bold text-gray-900">{r.vendor?.stall_name ?? '—'}</div>
                                                    <div className="text-[11px] text-gray-500">
                                                        {r.stall?.stall_number ?? 'Stall'} ({r.stall?.section ?? 'Market'})
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 font-semibold text-gray-700">
                                                    {r.billing_period}
                                                </td>
                                                <td className="px-4 py-3.5 font-black text-gray-900">
                                                    ₱{Number(r.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className={`font-semibold ${r.status === 'overdue' ? 'text-rose-600 font-bold' : 'text-gray-700'}`}>
                                                        {new Date(r.due_date).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${badge.color}`}>
                                                        <BadgeIcon className="h-3 w-3" />
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    {r.payment_method ? (
                                                        <div className="space-y-0.5">
                                                            <div className="font-bold uppercase text-gray-800 tracking-wider text-[10px]">
                                                                {r.payment_method}
                                                            </div>
                                                            {r.payment_reference && (
                                                                <div className="text-[10px] text-gray-500 font-mono">Ref: {r.payment_reference}</div>
                                                            )}
                                                            {r.paid_at && (
                                                                <div className="text-[10px] text-gray-400">
                                                                    Paid: {new Date(r.paid_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="italic text-gray-400">Unsettled</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3.5 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {/* Quick Status Action Button */}
                                                        {isPaid ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleQuickToggleStatus(r, 'unpaid')}
                                                                className="rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-100 transition shadow-sm"
                                                                title="Revert rental status to Unpaid"
                                                            >
                                                                Mark Unpaid
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleOpenStatusModal(r, 'paid')}
                                                                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-700 transition"
                                                                title="Mark this rental bill as Paid"
                                                            >
                                                                Mark as Paid
                                                            </button>
                                                        )}

                                                        {/* Full Edit / Update Status Modal Button */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenStatusModal(r)}
                                                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition"
                                                        >
                                                            <Edit3 className="h-3.5 w-3.5 text-gray-500" />
                                                            Update Status
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ─── Item 18: Generate Monthly Bills Modal ─── */}
                {genModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
                        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-gray-100">
                            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Generate Monthly Stall Rental Bills</h2>
                                    <p className="mt-0.5 text-xs text-gray-500">
                                        Create rental bills individually for a selected vendor or collectively for all vendors.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setGenModalOpen(false)}
                                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <form onSubmit={handleGenerateBills} className="mt-5 space-y-4">
                                {/* Mode Switcher (Collective vs Individual) */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                                        Billing Scope
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setGenerationMode('all');
                                                genForm.setData('vendor_id', 'all');
                                            }}
                                            className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                                                generationMode === 'all'
                                                    ? 'border-[#488562] bg-[#488562]/5 ring-2 ring-[#488562]/20'
                                                    : 'border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                                                <Users className="h-4 w-4 text-[#488562]" />
                                                All Occupied Stalls
                                            </div>
                                            <span className="text-[11px] text-gray-500 mt-1">
                                                Collectively bill all market vendors currently occupying a stall
                                            </span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setGenerationMode('individual');
                                                if (vendors.length > 0 && genForm.data.vendor_id === 'all') {
                                                    genForm.setData('vendor_id', String(vendors[0].id));
                                                }
                                            }}
                                            className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                                                generationMode === 'individual'
                                                    ? 'border-[#488562] bg-[#488562]/5 ring-2 ring-[#488562]/20'
                                                    : 'border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-1.5 font-bold text-xs text-gray-900">
                                                <UserCheck className="h-4 w-4 text-[#488562]" />
                                                Individual Vendor
                                            </div>
                                            <span className="text-[11px] text-gray-500 mt-1">
                                                Bill a specific vendor or single stall assignment
                                            </span>
                                        </button>
                                    </div>
                                </div>

                                {/* Target Vendor Dropdown (Visible only if Individual Mode) */}
                                {generationMode === 'individual' && (
                                    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3 space-y-2">
                                        <label className="block text-xs font-bold text-gray-700">
                                            Select Vendor <span className="text-rose-500">*</span>
                                        </label>
                                        <select
                                            value={genForm.data.vendor_id}
                                            onChange={(e) => genForm.setData('vendor_id', e.target.value)}
                                            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-xs font-medium focus:border-[#488562] focus:ring-[#488562]"
                                        >
                                            {vendors.map((v) => (
                                                <option key={v.id} value={v.id}>
                                                    {v.stall_name} ({v.stall_location || `Vendor #${v.id}`})
                                                </option>
                                            ))}
                                        </select>

                                        {selectedIndividualVendor && (
                                            <div className="text-[11px] text-gray-600 bg-white p-2.5 rounded-lg border border-gray-200 flex items-center justify-between">
                                                <div>
                                                    <span className="font-bold text-gray-800">{selectedIndividualVendor.stall_name}</span>
                                                    <div className="text-gray-500">{selectedIndividualVendor.stall_location || 'Designated Stall'}</div>
                                                </div>
                                                <span className="rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5">
                                                    Ready to Bill
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    {/* Billing Period (YYYY-MM) */}
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

                                    {/* Due Date */}
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700">Payment Due Date</label>
                                        <input
                                            type="date"
                                            value={genForm.data.due_date}
                                            onChange={(e) => genForm.setData('due_date', e.target.value)}
                                            placeholder="Default (15th of month)"
                                            className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-3 text-xs font-medium focus:border-[#488562] focus:ring-[#488562]"
                                        />
                                    </div>
                                </div>

                                {/* Custom Amount Override */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700">
                                        Custom Amount (Optional)
                                    </label>
                                    <div className="relative mt-1">
                                        <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-gray-400 font-bold">
                                            ₱
                                        </span>
                                        <input
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            placeholder="Leave blank to use stall's standard monthly rent"
                                            value={genForm.data.amount}
                                            onChange={(e) => genForm.setData('amount', e.target.value)}
                                            className="h-9 w-full rounded-lg border border-gray-200 pl-7 pr-3 text-xs font-medium focus:border-[#488562] focus:ring-[#488562]"
                                        />
                                    </div>
                                    <p className="mt-1 text-[11px] text-gray-400">
                                        Default is the stall&rsquo;s configured monthly rent (standard ₱3,500.00 if unconfigured).
                                    </p>
                                </div>

                                {/* Automatic Vendor Notification Notice */}
                                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 flex items-start gap-2.5">
                                    <Bell className="h-4 w-4 text-[#488562] mt-0.5 shrink-0" />
                                    <div className="text-[11px] text-emerald-900 leading-relaxed">
                                        <span className="font-bold">Automated Vendor Notification:</span> Every vendor billed will immediately receive an in-app notification with their outstanding rental bill amount, billing period, and payment due date.
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
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
                                        className="rounded-lg bg-[#488562] px-4 py-2 text-xs font-bold text-white hover:bg-[#3a6e50] shadow-sm disabled:opacity-50"
                                    >
                                        {genForm.processing
                                            ? 'Generating...'
                                            : generationMode === 'individual'
                                            ? 'Generate Bill for Selected Vendor'
                                            : 'Generate Bills for All Occupied Stalls'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ─── Item 19: Update Rental Payment Status Modal ─── */}
                {statusModalRental && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
                        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-gray-100">
                            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Update Rental Payment Status</h2>
                                    <p className="mt-0.5 text-xs text-gray-500">
                                        Update the payment status (Paid, Unpaid, Pending, Overdue) to accurately reflect payments.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setStatusModalRental(null)}
                                    className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            {/* Rental Summary Card */}
                            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-2">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="text-xs font-bold text-gray-900">
                                            {statusModalRental.vendor?.stall_name || 'Vendor Stall'}
                                        </div>
                                        <div className="text-[11px] text-gray-500">
                                            {statusModalRental.stall?.stall_number || 'Stall'} &bull; {statusModalRental.stall?.section || 'Market'}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-black text-[#488562]">
                                            ₱{Number(statusModalRental.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-[10px] text-gray-400">
                                            Period: {statusModalRental.billing_period}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <form onSubmit={handleStatusSubmit} className="mt-4 space-y-4">
                                {/* Status Selector */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                                        Payment Status <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        {[
                                            { id: 'paid', label: 'Paid', color: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
                                            { id: 'unpaid', label: 'Unpaid', color: 'border-gray-400 bg-gray-50 text-gray-800' },
                                            { id: 'pending', label: 'Pending', color: 'border-amber-500 bg-amber-50 text-amber-800' },
                                            { id: 'overdue', label: 'Overdue', color: 'border-rose-500 bg-rose-50 text-rose-800' },
                                        ].map((opt) => (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                onClick={() => statusForm.setData('status', opt.id)}
                                                className={`py-2 px-3 rounded-xl border text-xs font-bold text-center transition ${
                                                    statusForm.data.status === opt.id
                                                        ? `${opt.color} ring-2 ring-offset-1`
                                                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Paid Details (shown when status is paid) */}
                                {statusForm.data.status === 'paid' && (
                                    <div className="space-y-3 rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5">
                                        <div className="text-xs font-bold text-emerald-900">Payment Settlement Details</div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700">Payment Method</label>
                                                <select
                                                    value={statusForm.data.payment_method}
                                                    onChange={(e) => statusForm.setData('payment_method', e.target.value)}
                                                    className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium focus:border-[#488562] focus:ring-[#488562]"
                                                >
                                                    <option value="cash">Cash (Market Office)</option>
                                                    <option value="gcash">GCash</option>
                                                    <option value="maya">Maya</option>
                                                    <option value="bank_transfer">Bank Transfer</option>
                                                    <option value="other">Other / Cheque</option>
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-[11px] font-bold text-gray-700">Date Paid</label>
                                                <input
                                                    type="date"
                                                    value={statusForm.data.paid_at}
                                                    onChange={(e) => statusForm.setData('paid_at', e.target.value)}
                                                    className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium focus:border-[#488562] focus:ring-[#488562]"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-gray-700">
                                                Payment Reference / Official Receipt # (Optional)
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g. OR-2026-0042 or GCash Ref 908123"
                                                value={statusForm.data.payment_reference}
                                                onChange={(e) => statusForm.setData('payment_reference', e.target.value)}
                                                className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium focus:border-[#488562] focus:ring-[#488562]"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Admin Notes / Remarks */}
                                <div>
                                    <label className="block text-xs font-bold text-gray-700">
                                        Administrative Notes / Remarks (Optional)
                                    </label>
                                    <textarea
                                        rows={2}
                                        placeholder="Add any notes regarding this payment update..."
                                        value={statusForm.data.notes}
                                        onChange={(e) => statusForm.setData('notes', e.target.value)}
                                        className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-xs font-medium focus:border-[#488562] focus:ring-[#488562]"
                                    />
                                </div>

                                {/* Live Vendor Notification Notice */}
                                <div className="rounded-xl border border-gray-200 bg-gray-50/80 p-3 flex items-start gap-2.5">
                                    <Bell className="h-4 w-4 text-gray-600 mt-0.5 shrink-0" />
                                    <div className="text-[11px] text-gray-600 leading-relaxed">
                                        <span className="font-bold text-gray-800">Transparency Notice:</span> Saving this update will immediately update the vendor&rsquo;s official rental records and send an automated notification to the vendor.
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                                    <button
                                        type="button"
                                        onClick={() => setStatusModalRental(null)}
                                        className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={statusForm.processing}
                                        className="rounded-lg bg-[#488562] px-4 py-2 text-xs font-bold text-white hover:bg-[#3a6e50] shadow-sm disabled:opacity-50"
                                    >
                                        {statusForm.processing ? 'Saving...' : 'Save Payment Status'}
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
        { title: 'Stall Management', href: '/admin/dashboard/vendors/stalls' },
        { title: 'Monthly Stall Rentals & Billing', href: '/admin/dashboard/vendors/rentals' },
    ],
};
