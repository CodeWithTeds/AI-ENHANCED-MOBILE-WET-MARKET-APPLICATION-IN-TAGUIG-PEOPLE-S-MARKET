import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    Filter,
    HelpCircle,
    Info,
    Receipt,
    ShieldAlert,
    Store,
    Volume2,
    Wind,
    Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { dashboard } from '@/routes';

type Complaint = {
    id: number;
    stall_id: number;
    stall_number: string;
    complaint_type: string;
    description: string;
    status: string;
    action_taken: string | null;
    resolved_at: string | null;
    created_at: string;
    stall?: {
        id: number;
        stall_number: string;
        store_name: string;
        section: string;
    };
    user?: {
        id: number;
        name: string;
        email: string;
    };
    resolver?: {
        id: number;
        name: string;
    };
};

type FilterOption = { value: string; label: string };

type Props = {
    complaints: {
        data: Complaint[];
        current_page: number;
        last_page: number;
        total: number;
        per_page: number;
        links: { url: string | null; label: string; active: boolean }[];
    };
    stats: {
        total: number;
        pending: number;
        in_review: number;
        complied: number;
        resolved: number;
    };
    filters: Record<string, string | undefined>;
    stalls: { id: number; stall_number: string; store_name: string; section: string }[];
    types: FilterOption[];
    statuses: FilterOption[];
};

export default function StallMonitoringIndex({
    complaints,
    stats,
    filters,
    stalls,
    types,
    statuses,
}: Props) {
    const [selectedStallId, setSelectedStallId] = useState(filters.stall_id ?? '');
    const [selectedStatus, setSelectedStatus] = useState(filters.status ?? '');
    const [selectedType, setSelectedType] = useState(filters.complaint_type ?? '');
    const [search, setSearch] = useState(filters.search ?? '');

    const [activeComplaint, setActiveComplaint] = useState<Complaint | null>(null);
    const [actionModalOpen, setActionModalOpen] = useState(false);

    const actionForm = useForm({
        status: 'complied',
        action_taken: '',
    });

    function applyFilters(updates: Record<string, string | undefined> = {}) {
        const next = {
            ...filters,
            stall_id: selectedStallId || undefined,
            status: selectedStatus || undefined,
            complaint_type: selectedType || undefined,
            search: search || undefined,
            ...updates,
            page: undefined,
        };
        router.get('/admin/dashboard/vendors/stalls/monitoring', next, {
            preserveState: true,
            preserveScroll: true,
        });
    }

    function openResolve(complaint: Complaint) {
        setActiveComplaint(complaint);
        actionForm.setData({
            status: complaint.status === 'pending' ? 'complied' : complaint.status,
            action_taken: complaint.action_taken ?? '',
        });
        setActionModalOpen(true);
    }

    function handleActionSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!activeComplaint) return;
        actionForm.patch(`/admin/dashboard/vendors/stalls/complaints/${activeComplaint.id}`, {
            onSuccess: () => {
                setActionModalOpen(false);
                setActiveComplaint(null);
            },
        });
    }

    function typeBadge(type: string) {
        switch (type) {
            case 'bad_smell':
                return { label: 'Bad Smell / Odor', icon: Wind, color: 'bg-amber-50 text-amber-700 border-amber-200' };
            case 'cleanliness':
                return { label: 'Cleanliness Issue', icon: Sparkles, color: 'bg-rose-50 text-rose-700 border-rose-200' };
            case 'noise':
                return { label: 'Excessive Noise', icon: Volume2, color: 'bg-purple-50 text-purple-700 border-purple-200' };
            case 'obstruction':
                return { label: 'Pathway Obstruction', icon: ShieldAlert, color: 'bg-orange-50 text-orange-700 border-orange-200' };
            default:
                return { label: type.replace(/_/g, ' '), icon: AlertTriangle, color: 'bg-gray-50 text-gray-700 border-gray-200' };
        }
    }

    function statusBadge(status: string) {
        switch (status) {
            case 'pending':
                return { label: 'Pending Review', color: 'bg-amber-100 text-amber-800' };
            case 'in_review':
                return { label: 'Under Inspection', color: 'bg-blue-100 text-blue-800' };
            case 'complied':
                return { label: 'Complied by Vendor', color: 'bg-emerald-100 text-emerald-800' };
            case 'resolved':
                return { label: 'Resolved', color: 'bg-green-100 text-green-800' };
            case 'dismissed':
                return { label: 'Dismissed', color: 'bg-gray-100 text-gray-700' };
            default:
                return { label: status, color: 'bg-gray-100 text-gray-700' };
        }
    }

    return (
        <>
            <Head title="Stall Monitoring & Complaints" />

            <div className="flex h-full flex-1 flex-col gap-5 p-6">
                {/* Header */}
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                            Stall Monitoring &amp; Sanitation Complaints
                        </h1>
                        <p className="text-sm text-gray-500">
                            Monitor customer reports on stall cleanliness, odors, sanitation, and track vendor compliance.
                        </p>
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
                        className="inline-flex items-center gap-2 border-b-2 border-[#488562] px-4 py-2.5 text-xs font-bold text-[#488562]"
                    >
                        <ShieldAlert className="h-4 w-4 text-amber-500" />
                        Stall Monitoring &amp; Customer Complaints ({stats.pending} Pending)
                    </Link>
                    <Link
                        href="/admin/dashboard/vendors/rentals"
                        className="inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-xs font-semibold text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    >
                        <Receipt className="h-4 w-4 text-blue-500" />
                        Monthly Stall Rentals &amp; Billing
                    </Link>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Reports</div>
                        <div className="mt-2 text-2xl font-black text-gray-900">{stats.total}</div>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">Pending Review</div>
                        <div className="mt-2 text-2xl font-black text-amber-700">{stats.pending}</div>
                    </div>
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">Under Inspection</div>
                        <div className="mt-2 text-2xl font-black text-blue-700">{stats.in_review}</div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Complied</div>
                        <div className="mt-2 text-2xl font-black text-emerald-700">{stats.complied}</div>
                    </div>
                    <div className="rounded-2xl border border-green-200 bg-green-50/50 p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-green-700">Resolved</div>
                        <div className="mt-2 text-2xl font-black text-green-700">{stats.resolved}</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    {/* Stall Selector Dropdown */}
                    <div className="min-w-[200px] flex-1">
                        <label className="mb-1 block text-xs font-bold text-gray-600">Filter by Stall</label>
                        <select
                            value={selectedStallId}
                            onChange={(e) => {
                                setSelectedStallId(e.target.value);
                                applyFilters({ stall_id: e.target.value || undefined });
                            }}
                            className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 focus:border-[#488562] focus:ring-[#488562]"
                        >
                            <option value="">All Stalls</option>
                            {stalls.map((s) => (
                                <option key={s.id} value={String(s.id)}>
                                    {s.stall_number} — {s.store_name} ({s.section})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Complaint Type */}
                    <div className="w-48">
                        <label className="mb-1 block text-xs font-bold text-gray-600">Concern Type</label>
                        <select
                            value={selectedType}
                            onChange={(e) => {
                                setSelectedType(e.target.value);
                                applyFilters({ complaint_type: e.target.value || undefined });
                            }}
                            className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 focus:border-[#488562] focus:ring-[#488562]"
                        >
                            <option value="">All Concern Types</option>
                            {types.map((t) => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status */}
                    <div className="w-44">
                        <label className="mb-1 block text-xs font-bold text-gray-600">Compliance Status</label>
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

                    {/* Clear Button */}
                    {(selectedStallId || selectedType || selectedStatus || search) && (
                        <div className="self-end">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedStallId('');
                                    setSelectedType('');
                                    setSelectedStatus('');
                                    setSearch('');
                                    router.get('/admin/dashboard/vendors/stalls/monitoring');
                                }}
                                className="h-9 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                            >
                                Clear
                            </button>
                        </div>
                    )}
                </div>

                {/* Complaints Table */}
                <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                <tr>
                                    <th className="px-4 py-3">Stall &amp; Vendor</th>
                                    <th className="px-4 py-3">Concern Category</th>
                                    <th className="px-4 py-3">Customer Description</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Action Taken</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {complaints.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                                            No stall complaints found.
                                        </td>
                                    </tr>
                                ) : (
                                    complaints.data.map((c) => {
                                        const typeInfo = typeBadge(c.complaint_type);
                                        const TypeIcon = typeInfo.icon;
                                        const statusInfo = statusBadge(c.status);

                                        return (
                                            <tr key={c.id} className="hover:bg-gray-50/50">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-gray-900">{c.stall_number}</div>
                                                    <div className="text-[11px] text-gray-500">{c.stall?.store_name ?? '—'}</div>
                                                    <div className="text-[10px] text-gray-400 capitalize">{c.stall?.section ?? '—'} Section</div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${typeInfo.color}`}>
                                                        <TypeIcon className="h-3.5 w-3.5" />
                                                        {typeInfo.label}
                                                    </span>
                                                </td>
                                                <td className="max-w-xs px-4 py-3">
                                                    <p className="line-clamp-2 text-gray-700">{c.description}</p>
                                                    <div className="mt-1 text-[10px] text-gray-400">
                                                        Reported by: {c.user?.name ?? 'Market Customer'} • {new Date(c.created_at).toLocaleDateString()}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusInfo.color}`}>
                                                        {statusInfo.label}
                                                    </span>
                                                </td>
                                                <td className="max-w-xs px-4 py-3">
                                                    {c.action_taken ? (
                                                        <p className="line-clamp-2 text-gray-700">{c.action_taken}</p>
                                                    ) : (
                                                        <span className="italic text-gray-400">No action recorded</span>
                                                    )}
                                                    {c.resolver && (
                                                        <div className="text-[10px] text-gray-400">By {c.resolver.name}</div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => openResolve(c)}
                                                        className="rounded-lg bg-[#488562] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#3a6e50]"
                                                    >
                                                        Review / Resolve
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Resolution / Compliance Modal */}
                {actionModalOpen && activeComplaint && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                            <h2 className="text-lg font-bold text-gray-900">Update Stall Report Compliance</h2>
                            <p className="mt-1 text-xs text-gray-500">
                                Stall: <span className="font-bold text-gray-700">{activeComplaint.stall_number} ({activeComplaint.stall?.store_name})</span>
                            </p>
                            <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
                                <b>Customer Complaint:</b> {activeComplaint.description}
                            </div>

                            <form onSubmit={handleActionSubmit} className="mt-4 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700">Compliance Status</label>
                                    <select
                                        value={actionForm.data.status}
                                        onChange={(e) => actionForm.setData('status', e.target.value)}
                                        className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-3 text-xs font-medium focus:border-[#488562] focus:ring-[#488562]"
                                    >
                                        <option value="in_review">Under Inspection</option>
                                        <option value="complied">Complied by Vendor</option>
                                        <option value="resolved">Resolved / Cleaned</option>
                                        <option value="dismissed">Dismissed (Unfounded)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-gray-700">Actions Taken &amp; Compliance Notes</label>
                                    <textarea
                                        rows={3}
                                        value={actionForm.data.action_taken}
                                        onChange={(e) => actionForm.setData('action_taken', e.target.value)}
                                        placeholder="e.g., Stall inspected by market admin; vendor cleaned drainage and removed spoiled stock; complied with sanitation standards."
                                        className="mt-1 w-full rounded-lg border border-gray-200 p-2 text-xs focus:border-[#488562] focus:ring-[#488562]"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setActionModalOpen(false)}
                                        className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={actionForm.processing}
                                        className="rounded-lg bg-[#488562] px-4 py-2 text-xs font-bold text-white hover:bg-[#3a6e50]"
                                    >
                                        Save Compliance Status
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

StallMonitoringIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Stall Management', href: '/admin/dashboard/vendors/stalls' },
        { title: 'Stall Monitoring & Complaints', href: '/admin/dashboard/vendors/stalls/monitoring' },
    ],
};
