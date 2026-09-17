import { Head, router, useForm } from '@inertiajs/react';
import { CheckCircle2, Eye, Search, ShieldCheck, Clock, XCircle, AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';
import { dashboard } from '@/routes';

type Verification = {
    id: number;
    user_id: number;
    id_type: string | null;
    id_image_path: string | null;
    id_image_url: string | null;
    status: 'unverified' | 'pending' | 'verified' | 'rejected';
    rejection_reason: string | null;
    submitted_at: string | null;
    verified_at: string | null;
    created_at: string;
    user: { id: number; name: string; email: string } | null;
};

type Props = {
    verifications: Verification[];
    filters: { status?: string };
    idTypes: string[];
};

export default function VerificationIndex({ verifications, filters }: Props) {
    const [search, setSearch] = useState('');
    const [preview, setPreview] = useState<Verification | null>(null);
    const [rejectModal, setRejectModal] = useState<Verification | null>(null);

    const filtered = verifications.filter((v) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            v.user?.name.toLowerCase().includes(q) ||
            v.user?.email.toLowerCase().includes(q) ||
            v.id_type?.toLowerCase().includes(q)
        );
    });

    const stats = {
        total: verifications.length,
        pending: verifications.filter((v) => v.status === 'pending').length,
        verified: verifications.filter((v) => v.status === 'verified').length,
        rejected: verifications.filter((v) => v.status === 'rejected').length,
    };

    function applyStatus(value: string | undefined) {
        router.get('/admin/dashboard/verifications', { status: value || undefined }, { preserveState: true, preserveScroll: true });
    }

    function handleApprove(v: Verification) {
        if (!confirm(`Approve ID for "${v.user?.name}"?`)) return;
        router.post(`/admin/dashboard/verifications/${v.id}/approve`, {}, { preserveScroll: true });
    }

    return (
        <>
            <Head title="ID Verifications" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-5">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Customer ID Verification</h1>
                    <p className="text-sm text-gray-500">Review customer-uploaded IDs. Approve to verify, or reject with a reason.</p>
                </div>

                <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label="Total" value={stats.total} icon={ShieldCheck} color="#6b7280" />
                    <Stat label="Pending Review" value={stats.pending} icon={Clock} color="#d97706" />
                    <Stat label="Verified" value={stats.verified} icon={CheckCircle2} color="#488562" />
                    <Stat label="Rejected" value={stats.rejected} icon={XCircle} color="#dc2626" />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name, email, ID type..."
                            className="h-8 w-64 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-[#488562] focus:ring-1 focus:ring-[#488562] focus:outline-none"
                        />
                    </div>
                    <select
                        value={filters.status ?? ''}
                        onChange={(e) => applyStatus(e.target.value || undefined)}
                        className={`h-8 cursor-pointer rounded-lg border px-3 text-[11px] font-medium ${filters.status ? 'border-[#488562]/30 bg-[#488562]/5 text-[#488562]' : 'border-gray-200 bg-white text-gray-600'}`}
                    >
                        <option value="">Status: All</option>
                        <option value="pending">Pending</option>
                        <option value="verified">Verified</option>
                        <option value="rejected">Rejected</option>
                        <option value="unverified">Unverified</option>
                    </select>
                </div>

                <div className="flex-1 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/60">
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">Customer</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">ID Type</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">Status</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400">Submitted</th>
                                    <th className="px-4 py-3 text-xs font-bold uppercase text-gray-400 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.length === 0 ? (
                                    <tr><td colSpan={5} className="px-4 py-16 text-center text-gray-400">No verifications found.</td></tr>
                                ) : filtered.map((v) => (
                                    <tr key={v.id} className="hover:bg-gray-50/60">
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-gray-900">{v.user?.name ?? `User #${v.user_id}`}</div>
                                            <div className="text-xs text-gray-500">{v.user?.email ?? '—'}</div>
                                        </td>
                                        <td className="px-4 py-3 text-xs font-medium text-gray-700">{v.id_type ?? '—'}</td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={v.status} />
                                            {v.rejection_reason && v.status === 'rejected' ? <div className="text-[11px] text-red-500 mt-1 max-w-[200px] truncate" title={v.rejection_reason}>{v.rejection_reason}</div> : null}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">{v.submitted_at ? new Date(v.submitted_at).toLocaleString() : '—'}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-end gap-1">
                                                {v.id_image_url && (
                                                    <button onClick={() => setPreview(v)} className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"><Eye className="h-3.5 w-3.5" /></button>
                                                )}
                                                {v.status === 'pending' && (
                                                    <>
                                                        <button onClick={() => handleApprove(v)} className="rounded-md bg-[#488562] px-2 py-1 text-[11px] font-bold text-white hover:bg-[#3a6e50]">Approve</button>
                                                        <button onClick={() => setRejectModal(v)} className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-bold text-red-600 hover:bg-red-100">Reject</button>
                                                    </>
                                                )}
                                                {v.status === 'verified' && (
                                                    <button onClick={() => setRejectModal(v)} className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-100">Reject</button>
                                                )}
                                                {v.status === 'rejected' && (
                                                    <button onClick={() => handleApprove(v)} className="rounded-md bg-[#488562] px-2 py-1 text-[11px] font-bold text-white hover:bg-[#3a6e50]">Approve</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {preview && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setPreview(null)}>
                    <div className="w-full max-w-2xl rounded-2xl bg-white shadow-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between px-5 py-3 border-b"><h3 className="font-bold text-sm">ID — {preview.user?.name} • {preview.id_type}</h3><button onClick={() => setPreview(null)} className="p-1 rounded hover:bg-gray-100"><X className="h-4 w-4" /></button></div>
                        <div className="p-4 bg-gray-50 flex items-center justify-center"><img src={preview.id_image_url ?? ''} alt="ID" className="max-h-[70vh] w-auto rounded-lg shadow" /></div>
                    </div>
                </div>
            )}

            {rejectModal && <RejectModal verification={rejectModal} onClose={() => setRejectModal(null)} />}
        </>
    );
}

VerificationIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'ID Verifications', href: '/admin/dashboard/verifications' },
    ],
};

function StatusBadge({ status }: { status: Verification['status'] }) {
    const map: Record<string, { bg: string; color: string; label: string }> = {
        verified: { bg: '#dcfce7', color: '#15803d', label: 'Verified' },
        pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
        rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
        unverified: { bg: '#f3f4f6', color: '#4b5563', label: 'Unverified' },
    };
    const s = map[status] ?? map.unverified;
    return <span className="inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: s.bg, color: s.color }}>{s.label}</span>;
}

function Stat({ label, value, icon: Icon, color }: { label: string; value: number; icon: any; color: string }) {
    return (
        <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}15` }}><Icon className="h-5 w-5" style={{ color }} /></div>
            <div><div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div><div className="text-xl font-bold" style={{ color }}>{value}</div></div>
        </div>
    );
}

function RejectModal({ verification, onClose }: { verification: Verification; onClose: () => void }) {
    const { data, setData, post, processing, errors } = useForm({ rejection_reason: verification.rejection_reason ?? '' });
    function submit(e: React.FormEvent) {
        e.preventDefault();
        post(`/admin/dashboard/verifications/${verification.id}/reject`, { onSuccess: () => onClose(), preserveScroll: true });
    }
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="px-6 py-4 border-b flex items-center justify-between"><h3 className="font-bold text-sm">Reject ID — {verification.user?.name}</h3><button type="button" onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="h-4 w-4" /></button></div>
                <div className="px-6 py-4 space-y-3">
                    <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3"><AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" /><p className="text-xs text-amber-800">User's status will become Rejected and they will be prompted to re-upload.</p></div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Rejection Reason</label>
                    <textarea value={data.rejection_reason} onChange={(e) => setData('rejection_reason', e.target.value)} placeholder="e.g., Photo is blurry, corners cut off..." className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562] outline-none min-h-[90px]" />
                    {errors.rejection_reason && <p className="text-xs text-red-500">{errors.rejection_reason}</p>}
                </div>
                <div className="flex justify-end gap-2 px-6 py-3 border-t"><button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium">Cancel</button><button type="submit" disabled={processing} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">{processing ? 'Rejecting...' : 'Reject'}</button></div>
            </form>
        </div>
    );
}
