import { Head, router } from '@inertiajs/react';
import {
    CheckCircle2,
    Clock,
    FileText,
    Store,
    User,
    XCircle,
} from 'lucide-react';
import { dashboard } from '@/routes';

type VendorDocument = {
    id: number;
    document_type: string;
    file_path: string;
    original_name: string;
    created_at: string;
};

type Vendor = {
    id: number;
    stall_name: string;
    stall_location: string;
    product_categories: string[];
    status: string;
    created_at: string;
    user: { id: number; name: string; email: string | null } | null;
    documents: VendorDocument[];
};

type Props = {
    vendors: {
        data: Vendor[];
        current_page: number;
        last_page: number;
        total: number;
        per_page: number;
        links: { url: string | null; label: string; active: boolean }[];
    };
    stats: { pending: number; approved: number; rejected: number; total: number };
    filters: { status: string | null };
};

export default function DocumentsIndex({ vendors, stats, filters }: Props) {
    function applyFilter(status: string | undefined) {
        router.get('/admin/dashboard/vendors/documents', {
            status: status || undefined,
        }, { preserveState: true, preserveScroll: true });
    }

    function getDocumentUrl(path: string) {
        return `/storage/${path}`;
    }

    function formatDocType(type: string) {
        return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
        pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
        approved: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
        rejected: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
    };

    return (
        <>
            <Head title="Vendor Documents" />
            <div className="flex h-full flex-1 flex-col gap-4 p-5">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Vendor Documents</h1>
                    <p className="text-sm text-gray-500">View all uploaded documents from vendor registrations</p>
                </div>

                {/* Stats */}
                <div className="flex w-full gap-4">
                    <StatCard icon={Clock} label="Pending" value={stats.pending} color="#ee600e" />
                    <StatCard icon={CheckCircle2} label="Approved" value={stats.approved} color="#488562" />
                    <StatCard icon={XCircle} label="Rejected" value={stats.rejected} color="#dc2626" />
                    <StatCard icon={Store} label="Total" value={stats.total} color="#6b7280" />
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500">Filter:</span>
                    {['all', 'pending', 'approved', 'rejected'].map((s) => {
                        const isActive = s === 'all' ? !filters.status : filters.status === s;
                        return (
                            <button
                                key={s}
                                onClick={() => applyFilter(s === 'all' ? undefined : s)}
                                className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition ${
                                    isActive
                                        ? 'bg-[#488562] text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {s}
                            </button>
                        );
                    })}
                </div>

                {/* Documents Grid */}
                <div className="flex-1 space-y-3 overflow-y-auto">
                    {vendors.data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 py-16">
                            <FileText className="mb-2 h-8 w-8 text-gray-300" />
                            <p className="text-sm text-gray-400">No vendor documents found</p>
                        </div>
                    ) : (
                        vendors.data.map((vendor) => (
                            <div key={vendor.id} className="rounded-xl border border-gray-200 bg-white p-5">
                                {/* Vendor header row */}
                                <div className="mb-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#ee600e]/10">
                                            <User className="h-5 w-5 text-[#ee600e]" />
                                        </div>
                                        <div>
                                            <div className="text-base font-semibold text-gray-900">{vendor.stall_name}</div>
                                            <div className="text-sm text-gray-400">
                                                {vendor.user?.name} • {vendor.stall_location}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${statusColors[vendor.status]?.bg ?? 'bg-gray-50'} ${statusColors[vendor.status]?.text ?? 'text-gray-600'}`}>
                                            <span className={`h-2 w-2 rounded-full ${statusColors[vendor.status]?.dot ?? 'bg-gray-400'}`} />
                                            {vendor.status}
                                        </span>
                                        <span className="text-sm text-gray-400">
                                            {new Date(vendor.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                    </div>
                                </div>

                                {/* Documents list */}
                                <div className="grid gap-2 sm:grid-cols-3">
                                    {vendor.documents.map((doc) => (
                                        <a
                                            key={doc.id}
                                            href={getDocumentUrl(doc.file_path)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2.5 rounded-lg border border-gray-100 bg-gray-50 p-3 transition hover:border-[#488562] hover:bg-[#488562]/5"
                                        >
                                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-50">
                                                <FileText className="h-5 w-5 text-blue-500" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-semibold text-gray-700">
                                                    {formatDocType(doc.document_type)}
                                                </div>
                                                <div className="truncate text-xs text-gray-400">
                                                    {doc.original_name}
                                                </div>
                                            </div>
                                        </a>
                                    ))}
                                    {vendor.documents.length === 0 && (
                                        <div className="col-span-3 py-2 text-center text-sm text-gray-400">
                                            No documents uploaded
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Pagination */}
                {vendors.last_page > 1 && (
                    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-2.5">
                        <span className="text-[11px] text-gray-500">
                            {(vendors.current_page - 1) * vendors.per_page + 1}–{Math.min(vendors.current_page * vendors.per_page, vendors.total)} of {vendors.total}
                        </span>
                        <div className="flex gap-0.5">
                            {vendors.links.map((link, i) => (
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
        </>
    );
}

DocumentsIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Vendors', href: '/admin/dashboard/vendors' },
        { title: 'Documents', href: '/admin/dashboard/vendors/documents' },
    ],
};

/* ─── Helper Components ─── */

function StatCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; color: string }) {
    return (
        <div className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}15` }}>
                <Icon className="h-6 w-6" style={{ color }} />
            </div>
            <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</div>
                <div className="text-2xl font-bold" style={{ color }}>{value}</div>
            </div>
        </div>
    );
}
