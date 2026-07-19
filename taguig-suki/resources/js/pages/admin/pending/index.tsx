import { Head, router, useForm } from '@inertiajs/react';
import {
    CheckCircle2,
    Clock,
    FileText,
    Store,
    User,
    X,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogTitle,
} from '@/components/ui/dialog';
import { dashboard } from '@/routes';

type VendorDocument = {
    id: number;
    document_type: string;
    file_path: string;
    original_name: string;
};

type Vendor = {
    id: number;
    user_id: number;
    stall_name: string;
    stall_location: string;
    product_categories: string[];
    status: string;
    rejection_reason: string | null;
    approved_at: string | null;
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
};

export default function PendingApprovalIndex({ vendors, stats }: Props) {
    const [viewVendor, setViewVendor] = useState<Vendor | null>(null);
    const [rejectVendor, setRejectVendor] = useState<Vendor | null>(null);

    const rejectForm = useForm({ rejection_reason: '' });

    function handleApprove(vendor: Vendor) {
        if (confirm(`Approve vendor "${vendor.stall_name}"?`)) {
            router.post(`/admin/dashboard/vendors/${vendor.id}/approve`, {}, {
                preserveScroll: true,
                onSuccess: () => toast.success(`Vendor "${vendor.stall_name}" approved!`),
                onError: () => toast.error('Failed to approve vendor'),
            });
        }
    }

    function handleReject(e: React.FormEvent) {
        e.preventDefault();
        if (!rejectVendor) return;
        rejectForm.post(`/admin/dashboard/vendors/${rejectVendor.id}/reject`, {
            preserveScroll: true,
            onSuccess: () => {
                setRejectVendor(null);
                rejectForm.reset();
                toast.success('Vendor rejected');
            },
            onError: () => toast.error('Failed to reject vendor'),
        });
    }

    function getDocumentUrl(path: string) {
        return `/storage/${path}`;
    }

    function formatDocType(type: string) {
        return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }

    return (
        <>
            <Head title="Pending Approval" />
            <div className="flex h-full flex-1 flex-col gap-4 p-5">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Pending Vendor Approvals</h1>
                    <p className="text-sm text-gray-500">Review and approve vendor registrations from mobile app</p>
                </div>

                {/* Stats */}
                <div className="flex w-full gap-4">
                    <StatCard icon={Clock} label="Pending" value={stats.pending} color="#ee600e" />
                    <StatCard icon={CheckCircle2} label="Approved" value={stats.approved} color="#488562" />
                    <StatCard icon={XCircle} label="Rejected" value={stats.rejected} color="#dc2626" />
                    <StatCard icon={Store} label="Total" value={stats.total} color="#6b7280" />
                </div>

                {/* Table */}
                <div className="flex-1 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/60">
                                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Vendor</th>
                                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Stall Info</th>
                                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Categories</th>
                                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Documents</th>
                                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Submitted</th>
                                    <th className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wider text-gray-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {vendors.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-16 text-center text-base text-gray-400">
                                            <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                                            No pending approvals. All caught up!
                                        </td>
                                    </tr>
                                ) : (
                                    vendors.data.map((vendor) => (
                                        <tr key={vendor.id} className="group transition hover:bg-[#488562]/[0.02]">
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ee600e]/10">
                                                        <User className="h-5 w-5 text-[#ee600e]" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-semibold text-gray-900">{vendor.user?.name ?? '—'}</div>
                                                        <div className="text-xs text-gray-400">{vendor.user?.email ?? 'No email'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="text-sm font-medium text-gray-900">{vendor.stall_name}</div>
                                                <div className="text-xs text-gray-400">{vendor.stall_location}</div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {(vendor.product_categories ?? []).map((cat) => (
                                                        <span key={cat} className="inline-block rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                                                            {cat}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <button
                                                    onClick={() => setViewVendor(vendor)}
                                                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-100"
                                                >
                                                    <FileText className="h-4 w-4" />
                                                    {vendor.documents.length} docs
                                                </button>
                                            </td>
                                            <td className="px-4 py-3.5 text-sm text-gray-500">
                                                {new Date(vendor.created_at).toLocaleDateString('en-PH', {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    year: 'numeric',
                                                })}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleApprove(vendor)}
                                                        className="h-8 gap-1.5 bg-[#488562] px-3 text-xs hover:bg-[#3a6e50]"
                                                    >
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => setRejectVendor(vendor)}
                                                        className="h-8 gap-1.5 border-red-200 px-3 text-xs text-red-600 hover:bg-red-50"
                                                    >
                                                        <XCircle className="h-4 w-4" />
                                                        Reject
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {vendors.last_page > 1 && (
                        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                            <span className="text-sm text-gray-500">
                                {(vendors.current_page - 1) * vendors.per_page + 1}–{Math.min(vendors.current_page * vendors.per_page, vendors.total)} of {vendors.total}
                            </span>
                            <div className="flex gap-1">
                                {vendors.links.map((link, i) => (
                                    <button
                                        key={i}
                                        disabled={!link.url}
                                        onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                        className={`h-8 min-w-8 rounded-md px-2.5 text-sm font-medium transition ${
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

            {/* View Documents Dialog */}
            <Dialog open={!!viewVendor} onOpenChange={() => setViewVendor(null)}>
                <DialogContent className="sm:max-w-lg">
                    <DialogTitle>Vendor Documents — {viewVendor?.stall_name}</DialogTitle>
                    <DialogDescription>
                        Submitted by {viewVendor?.user?.name} on{' '}
                        {viewVendor && new Date(viewVendor.created_at).toLocaleDateString('en-PH')}
                    </DialogDescription>
                    <div className="mt-4 space-y-3">
                        {viewVendor?.documents.map((doc) => (
                            <a
                                key={doc.id}
                                href={getDocumentUrl(doc.file_path)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 transition hover:border-[#488562] hover:bg-[#488562]/5"
                            >
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
                                    <FileText className="h-5 w-5 text-blue-500" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-gray-800">
                                        {formatDocType(doc.document_type)}
                                    </div>
                                    <div className="truncate text-[11px] text-gray-400">
                                        {doc.original_name}
                                    </div>
                                </div>
                                <span className="text-[10px] font-medium text-[#488562]">View →</span>
                            </a>
                        ))}
                        {viewVendor?.documents.length === 0 && (
                            <p className="py-4 text-center text-sm text-gray-400">No documents uploaded</p>
                        )}
                    </div>
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="secondary">Close</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reject Reason Dialog */}
            <Dialog open={!!rejectVendor} onOpenChange={() => setRejectVendor(null)}>
                <DialogContent className="sm:max-w-md">
                    <DialogTitle>Reject Vendor</DialogTitle>
                    <DialogDescription>
                        Provide a reason for rejecting "{rejectVendor?.stall_name}". The vendor will be able to see this reason.
                    </DialogDescription>
                    <form onSubmit={handleReject} className="mt-4 space-y-4">
                        <textarea
                            value={rejectForm.data.rejection_reason}
                            onChange={(e) => rejectForm.setData('rejection_reason', e.target.value)}
                            placeholder="e.g. Business permit is expired, please upload a valid one."
                            rows={3}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-red-400 focus:ring-1 focus:ring-red-400"
                            required
                        />
                        {rejectForm.errors.rejection_reason && (
                            <p className="text-xs text-red-500">{rejectForm.errors.rejection_reason}</p>
                        )}
                        <DialogFooter className="gap-2">
                            <DialogClose asChild>
                                <Button type="button" variant="secondary">Cancel</Button>
                            </DialogClose>
                            <Button
                                type="submit"
                                disabled={rejectForm.processing}
                                className="bg-red-600 hover:bg-red-700"
                            >
                                Reject Vendor
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </>
    );
}

PendingApprovalIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Vendors', href: '/admin/dashboard/vendors' },
        { title: 'Pending Approval', href: '/admin/dashboard/vendors/pending' },
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
