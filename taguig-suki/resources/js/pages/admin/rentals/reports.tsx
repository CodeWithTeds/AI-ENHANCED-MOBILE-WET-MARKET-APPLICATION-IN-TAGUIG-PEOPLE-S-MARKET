import { Head, router } from '@inertiajs/react';
import {
    AlertCircle,
    ArrowLeft,
    Calendar,
    CheckCircle2,
    Clock,
    FileCheck,
    FileText,
    HelpCircle,
    Inbox,
    Printer,
    RefreshCw,
    ShieldAlert,
    ShieldCheck,
    Store,
    UserCheck,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { dashboard } from '@/routes';

type VendorRentalReport = {
    vendor_id: number;
    stall_id: number | null;
    stall_number: string | null;
    stall_name: string;
    stall_location: string;
    stall_status: string;
    contract_start: string | null;
    contract_end: string | null;
    contract_status: string;
    requirements: {
        valid_id: boolean;
        business_permit: boolean;
        sanitary_permit: boolean;
        dti_registration: boolean;
    };
    requirements_complete: boolean;
    total_paid: number;
    total_overdue: number;
    current_status: string;
    latest_billing_period: string | null;
    payments_history: {
        id: number;
        billing_period: string;
        amount: string;
        status: string;
        paid_at: string | null;
    }[];
};

type ContractRequestItem = {
    id: number;
    vendor_id: number;
    vendor_name: string;
    stall_name: string;
    stall_number: string | null;
    stall_location: string;
    type: 'renewal' | 'cancellation';
    requested_duration_months: number | null;
    status: 'pending' | 'approved' | 'rejected';
    reason: string | null;
    admin_notes: string | null;
    reviewer_name: string | null;
    reviewed_at: string | null;
    created_at: string;
    contract_start: string | null;
    contract_end: string | null;
    contract_status: string;
};

type Props = {
    vendor_reports: VendorRentalReport[];
    contract_requests?: ContractRequestItem[];
    summary: {
        total_vendors: number;
        occupied_stalls: number;
        compliant_requirements: number;
        up_to_date_rent: number;
        overdue_rent: number;
        total_rent_collected: number;
        total_rent_overdue: number;
        pending_requests_count?: number;
        pending_renewals_count?: number;
        pending_cancellations_count?: number;
    };
};

export default function RentalReportsIndex({ vendor_reports, contract_requests = [], summary }: Props) {
    const [activeTab, setActiveTab] = useState<'stalls' | 'requests'>('requests');
    const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
    const [requestTypeFilter, setRequestTypeFilter] = useState<'all' | 'renewal' | 'cancellation'>('all');

    // Review Modal States
    const [reviewingRequest, setReviewingRequest] = useState<ContractRequestItem | null>(null);
    const [reviewDecision, setReviewDecision] = useState<'approved' | 'rejected'>('approved');
    const [reviewMonths, setReviewMonths] = useState<number>(12);
    const [adminNotes, setAdminNotes] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Direct Renewal Modal States (fallback)
    const [selectedVendorForRenew, setSelectedVendorForRenew] = useState<VendorRentalReport | null>(null);
    const [directRenewMonths, setDirectRenewMonths] = useState(12);

    function handlePrint() {
        window.print();
    }

    function openReviewModal(req: ContractRequestItem, decision: 'approved' | 'rejected') {
        setReviewingRequest(req);
        setReviewDecision(decision);
        setReviewMonths(req.requested_duration_months || 12);
        setAdminNotes('');
    }

    function handleReviewSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!reviewingRequest) return;
        setIsSubmitting(true);

        router.post(
            `/admin/dashboard/vendors/rentals/contract-requests/${reviewingRequest.id}/review`,
            {
                decision: reviewDecision,
                admin_notes: adminNotes,
                additional_months: reviewingRequest.type === 'renewal' ? reviewMonths : null,
            },
            {
                onSuccess: () => {
                    setReviewingRequest(null);
                    setIsSubmitting(false);
                },
                onError: () => setIsSubmitting(false),
            }
        );
    }

    function handleDirectRenewalSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedVendorForRenew) return;
        router.post(
            `/admin/dashboard/vendors/${selectedVendorForRenew.vendor_id}/contract/renew-approve`,
            {
                additional_months: directRenewMonths,
            },
            {
                onSuccess: () => setSelectedVendorForRenew(null),
            }
        );
    }

    const filteredRequests = contract_requests.filter((req) => {
        if (requestStatusFilter !== 'all' && req.status !== requestStatusFilter) return false;
        if (requestTypeFilter !== 'all' && req.type !== requestTypeFilter) return false;
        return true;
    });

    const pendingCount = summary.pending_requests_count ?? contract_requests.filter((r) => r.status === 'pending').length;

    return (
        <>
            <Head title="Vendor Rental & Contract Reports" />

            <div className="flex h-full flex-1 flex-col gap-6 p-6 print:p-0">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
                    <div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => router.get('/admin/dashboard/vendors/rentals')}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
                            >
                                <ArrowLeft className="h-4 w-4 text-gray-600" />
                            </button>
                            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
                                Vendor Rental &amp; Contract Reports
                            </h1>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                            Monitor stall occupancy, review vendor contract renewal and cancellation requests, and audit lease standing.
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                Occupied Stalls Only (Unoccupied Excluded)
                            </span>
                            {pendingCount > 0 && (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200 animate-pulse">
                                    <Clock className="h-3 w-3 text-amber-600" />
                                    {pendingCount} Contract Request{pendingCount > 1 ? 's' : ''} Pending Review
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-black"
                        >
                            <Printer className="h-4 w-4" />
                            Print / Save PDF
                        </button>
                    </div>
                </div>

                {/* Printable Header */}
                <div className="hidden border-b border-gray-200 pb-4 text-center print:block">
                    <h2 className="text-xl font-black uppercase text-gray-900">Taguig People's Market Administration</h2>
                    <h3 className="text-sm font-bold text-gray-700">Vendor Rental &amp; Lease Contract Requests Audit Report</h3>
                    <p className="text-xs text-gray-500">Generated on: {new Date().toLocaleDateString()} • City of Taguig</p>
                </div>

                {/* Summary KPIs */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Occupied Stalls</div>
                        <div className="mt-2 text-2xl font-black text-gray-900">{summary.total_vendors}</div>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">Pending Requests</div>
                        <div className="mt-2 text-2xl font-black text-amber-700">{pendingCount}</div>
                    </div>
                    <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">Rent Up to Date</div>
                        <div className="mt-2 text-2xl font-black text-blue-700">{summary.up_to_date_rent}</div>
                    </div>
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-rose-700">Overdue Rent</div>
                        <div className="mt-2 text-2xl font-black text-rose-700">{summary.overdue_rent}</div>
                    </div>
                    <div className="rounded-2xl border border-[#488562]/20 bg-[#488562]/5 p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-[#488562]">Total Collected</div>
                        <div className="mt-2 text-lg font-black text-[#488562]">
                            ₱{summary.total_rent_collected.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">All Permits Met</div>
                        <div className="mt-2 text-2xl font-black text-emerald-700">{summary.compliant_requirements}</div>
                    </div>
                </div>

                {/* Section Navigation Tabs */}
                <div className="flex border-b border-gray-200 print:hidden">
                    <button
                        type="button"
                        onClick={() => setActiveTab('requests')}
                        className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${
                            activeTab === 'requests'
                                ? 'border-[#488562] text-[#488562]'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <RefreshCw className="h-4 w-4" />
                        Contract Renewal &amp; Cancellation Requests
                        {pendingCount > 0 && (
                            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[11px] font-bold text-white">
                                {pendingCount}
                            </span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('stalls')}
                        className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition ${
                            activeTab === 'stalls'
                                ? 'border-[#488562] text-[#488562]'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                        }`}
                    >
                        <Store className="h-4 w-4" />
                        Occupied Stalls &amp; Lease Records ({vendor_reports.length})
                    </button>
                </div>

                {/* ──────────────── TAB 1: CONTRACT REQUESTS ──────────────── */}
                {activeTab === 'requests' && (
                    <div className="flex flex-col gap-4">
                        {/* Filters */}
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-sm print:hidden">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status:</span>
                                {(['pending', 'approved', 'rejected', 'all'] as const).map((st) => (
                                    <button
                                        key={st}
                                        type="button"
                                        onClick={() => setRequestStatusFilter(st)}
                                        className={`rounded-lg px-3 py-1 text-xs font-bold capitalize transition ${
                                            requestStatusFilter === st
                                                ? 'bg-[#488562] text-white shadow-sm'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {st === 'pending' ? `Pending Review (${pendingCount})` : st}
                                    </button>
                                ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Type:</span>
                                {(['all', 'renewal', 'cancellation'] as const).map((tp) => (
                                    <button
                                        key={tp}
                                        type="button"
                                        onClick={() => setRequestTypeFilter(tp)}
                                        className={`rounded-lg px-3 py-1 text-xs font-bold capitalize transition ${
                                            requestTypeFilter === tp
                                                ? 'bg-gray-900 text-white shadow-sm'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    >
                                        {tp === 'all' ? 'All Types' : tp}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Requests Table */}
                        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                        <tr>
                                            <th className="px-4 py-3">Vendor / Stall</th>
                                            <th className="px-4 py-3">Request Type &amp; Details</th>
                                            <th className="px-4 py-3">Current Lease Period</th>
                                            <th className="px-4 py-3">Vendor Remarks</th>
                                            <th className="px-4 py-3">Status &amp; Review</th>
                                            <th className="px-4 py-3 text-right print:hidden">Admin Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredRequests.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                                                    <Inbox className="mx-auto h-8 w-8 text-gray-300" />
                                                    <p className="mt-2 font-medium">No contract requests found matching filters.</p>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredRequests.map((req) => {
                                                const isRenewal = req.type === 'renewal';
                                                const isPending = req.status === 'pending';
                                                const isApproved = req.status === 'approved';
                                                const isRejected = req.status === 'rejected';

                                                return (
                                                    <tr key={req.id} className="hover:bg-gray-50/50">
                                                        <td className="px-4 py-3.5">
                                                            <div className="font-bold text-gray-900">{req.stall_name}</div>
                                                            <div className="text-[11px] text-gray-500">{req.stall_location}</div>
                                                            <div className="text-[10px] text-gray-400">Owner: {req.vendor_name}</div>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            {isRenewal ? (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                                                                    <RefreshCw className="h-3 w-3" />
                                                                    Renewal · {req.requested_duration_months ? `${req.requested_duration_months} Month(s)` : '12 Months'}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 border border-rose-200">
                                                                    <XCircle className="h-3 w-3" />
                                                                    Contract Cancellation
                                                                </span>
                                                            )}
                                                            <div className="mt-1 text-[10px] text-gray-400">
                                                                Submitted: {req.created_at}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            <div className="font-semibold text-gray-800">
                                                                {req.contract_start ? new Date(req.contract_start).toLocaleDateString() : '—'} to{' '}
                                                                {req.contract_end ? new Date(req.contract_end).toLocaleDateString() : '—'}
                                                            </div>
                                                            <div className="text-[10px] text-gray-500 capitalize">
                                                                Status: {req.contract_status?.replace('_', ' ')}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3.5 max-w-xs">
                                                            <div className="text-gray-700 break-words line-clamp-2">
                                                                {req.reason || 'No remarks provided.'}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3.5">
                                                            {isPending && (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                                                    <Clock className="h-3 w-3" />
                                                                    Pending Review
                                                                </span>
                                                            )}
                                                            {isApproved && (
                                                                <div>
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                                                        <CheckCircle2 className="h-3 w-3" />
                                                                        Approved
                                                                    </span>
                                                                    {req.reviewed_at && (
                                                                        <div className="text-[10px] text-gray-400 mt-0.5">
                                                                            By {req.reviewer_name || 'Admin'} on {req.reviewed_at}
                                                                        </div>
                                                                    )}
                                                                    {req.admin_notes && (
                                                                        <div className="text-[10px] text-gray-600 italic mt-0.5">
                                                                            &ldquo;{req.admin_notes}&rdquo;
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {isRejected && (
                                                                <div>
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                                                                        <XCircle className="h-3 w-3" />
                                                                        Rejected
                                                                    </span>
                                                                    {req.reviewed_at && (
                                                                        <div className="text-[10px] text-gray-400 mt-0.5">
                                                                            By {req.reviewer_name || 'Admin'} on {req.reviewed_at}
                                                                        </div>
                                                                    )}
                                                                    {req.admin_notes && (
                                                                        <div className="text-[10px] text-rose-600 font-medium mt-0.5">
                                                                            Reason: {req.admin_notes}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3.5 text-right print:hidden">
                                                            {isPending ? (
                                                                <div className="flex items-center justify-end gap-1.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openReviewModal(req, 'approved')}
                                                                        className="rounded-lg bg-[#488562] px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-[#3a6e50]"
                                                                    >
                                                                        Approve
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openReviewModal(req, 'rejected')}
                                                                        className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-semibold text-rose-600 shadow-sm hover:bg-rose-50"
                                                                    >
                                                                        Reject
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <span className="text-[11px] text-gray-400">Processed</span>
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
                    </div>
                )}

                {/* ──────────────── TAB 2: MAIN OCCUPIED STALLS REPORT ──────────────── */}
                {activeTab === 'stalls' && (
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                                <thead className="border-b border-gray-100 bg-gray-50/75 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3">Vendor / Stall</th>
                                        <th className="px-4 py-3">Contract Period</th>
                                        <th className="px-4 py-3">Required Documents</th>
                                        <th className="px-4 py-3">Rental Standing</th>
                                        <th className="px-4 py-3">Recent Payments</th>
                                        <th className="px-4 py-3 text-right print:hidden">Contract Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {vendor_reports.map((v) => {
                                        const req = v.requirements;
                                        const isExpired = v.contract_status === 'expired';
                                        const isExpiring = v.contract_status === 'expiring_soon';
                                        const isRenewalReq = v.contract_status === 'renewal_requested';
                                        const isCancellationReq = v.contract_status === 'cancellation_requested';
                                        const isCancelled = v.contract_status === 'cancelled';

                                        return (
                                            <tr key={v.vendor_id} className="hover:bg-gray-50/50">
                                                <td className="px-4 py-3.5">
                                                    <div className="font-bold text-gray-900">{v.stall_name}</div>
                                                    <div className="text-[11px] text-gray-500">{v.stall_location}</div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="font-semibold text-gray-800">
                                                        {v.contract_start ? new Date(v.contract_start).toLocaleDateString() : '—'} to{' '}
                                                        {v.contract_end ? new Date(v.contract_end).toLocaleDateString() : '—'}
                                                    </div>
                                                    <div className="mt-1">
                                                        {isRenewalReq && (
                                                            <span className="rounded bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                                                                Renewal Requested
                                                            </span>
                                                        )}
                                                        {isCancellationReq && (
                                                            <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                                                Cancellation Requested
                                                            </span>
                                                        )}
                                                        {isExpiring && (
                                                            <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                                                                Expiring Soon
                                                            </span>
                                                        )}
                                                        {isExpired && (
                                                            <span className="rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                                                                Contract Expired
                                                            </span>
                                                        )}
                                                        {isCancelled && (
                                                            <span className="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                                                                Cancelled
                                                            </span>
                                                        )}
                                                        {!isRenewalReq && !isCancellationReq && !isExpiring && !isExpired && !isCancelled && (
                                                            <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                                                Active Lease
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex flex-col gap-1 text-[11px]">
                                                        <div className="flex items-center gap-1.5">
                                                            {req.valid_id ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-rose-500" />}
                                                            <span className={req.valid_id ? 'text-gray-700' : 'font-bold text-rose-600'}>Valid ID</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {req.business_permit ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-rose-500" />}
                                                            <span className={req.business_permit ? 'text-gray-700' : 'font-bold text-rose-600'}>Business Permit</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {req.sanitary_permit ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-rose-500" />}
                                                            <span className={req.sanitary_permit ? 'text-gray-700' : 'font-bold text-rose-600'}>Sanitary Permit</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5">
                                                            {req.dti_registration ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-rose-500" />}
                                                            <span className={req.dti_registration ? 'text-gray-700' : 'font-bold text-rose-600'}>DTI Registration</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="font-bold text-gray-900">
                                                        Paid: ₱{v.total_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                    </div>
                                                    {v.total_overdue > 0 ? (
                                                        <div className="font-bold text-rose-600">
                                                            Overdue: ₱{v.total_overdue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </div>
                                                    ) : (
                                                        <div className="text-[11px] text-emerald-600">No overdue balance</div>
                                                    )}
                                                    <div className="mt-1 text-[10px] text-gray-400">
                                                        Latest period: {v.latest_billing_period ?? '—'}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5">
                                                    <div className="flex flex-wrap gap-1">
                                                        {v.payments_history.map((p) => (
                                                            <span
                                                                key={p.id}
                                                                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                                                    p.status === 'paid'
                                                                        ? 'bg-emerald-50 text-emerald-700'
                                                                        : p.status === 'overdue'
                                                                        ? 'bg-rose-50 text-rose-700'
                                                                        : 'bg-gray-100 text-gray-700'
                                                                }`}
                                                                title={`₱${p.amount} (${p.status})`}
                                                            >
                                                                {p.billing_period}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3.5 text-right print:hidden">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedVendorForRenew(v)}
                                                        className="rounded-lg bg-[#488562] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#3a6e50]"
                                                    >
                                                        Renew Contract
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ──────────────── MODAL: REVIEW REQUEST (APPROVE OR REJECT) ──────────────── */}
                {reviewingRequest && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                        <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">
                                        {reviewDecision === 'approved' ? 'Approve' : 'Reject'}{' '}
                                        {reviewingRequest.type === 'renewal' ? 'Contract Renewal' : 'Contract Cancellation'}
                                    </h2>
                                    <p className="text-xs text-gray-500">
                                        Stall: <b className="text-gray-800">{reviewingRequest.stall_name}</b> ({reviewingRequest.stall_location})
                                    </p>
                                </div>
                                <span
                                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                                        reviewDecision === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                    }`}
                                >
                                    {reviewDecision}
                                </span>
                            </div>

                            {/* Request Details Box */}
                            <div className="mt-4 rounded-xl bg-gray-50 p-3.5 text-xs text-gray-600 space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Vendor Owner:</span>
                                    <span className="font-semibold text-gray-900">{reviewingRequest.vendor_name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Current Lease Period:</span>
                                    <span className="font-semibold text-gray-900">
                                        {reviewingRequest.contract_start ? new Date(reviewingRequest.contract_start).toLocaleDateString() : '—'} to{' '}
                                        {reviewingRequest.contract_end ? new Date(reviewingRequest.contract_end).toLocaleDateString() : '—'}
                                    </span>
                                </div>
                                {reviewingRequest.type === 'renewal' && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-500">Requested Extension:</span>
                                        <span className="font-bold text-emerald-700">
                                            {reviewingRequest.requested_duration_months} Month(s)
                                        </span>
                                    </div>
                                )}
                                {reviewingRequest.reason && (
                                    <div className="pt-1 border-t border-gray-200">
                                        <span className="text-gray-500">Vendor Reason / Remarks:</span>
                                        <p className="mt-0.5 text-gray-800 italic">&ldquo;{reviewingRequest.reason}&rdquo;</p>
                                    </div>
                                )}
                            </div>

                            <form onSubmit={handleReviewSubmit} className="mt-4 space-y-4">
                                {reviewDecision === 'approved' && reviewingRequest.type === 'renewal' && (
                                    <div>
                                        <label className="block text-xs font-bold text-gray-700">
                                            Approved Duration (Months)
                                        </label>
                                        <select
                                            value={reviewMonths}
                                            onChange={(e) => setReviewMonths(Number(e.target.value))}
                                            className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-3 text-xs font-medium focus:border-[#488562] focus:ring-[#488562]"
                                        >
                                            <option value={1}>1 Month</option>
                                            <option value={3}>3 Months</option>
                                            <option value={6}>6 Months</option>
                                            <option value={12}>1 Year (12 Months)</option>
                                        </select>
                                    </div>
                                )}

                                {reviewDecision === 'approved' && reviewingRequest.type === 'cancellation' && (
                                    <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
                                        <AlertCircle className="h-4 w-4 inline mr-1 text-amber-600" />
                                        Approving will officially cancel the vendor&apos;s lease contract and release stall{' '}
                                        <b>{reviewingRequest.stall_number || reviewingRequest.stall_name}</b> back to available status.
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-gray-700">
                                        {reviewDecision === 'approved'
                                            ? 'Admin Remarks / Notice to Vendor (Optional)'
                                            : 'Rejection Reason / Explanation (Sent to Vendor)'}
                                    </label>
                                    <textarea
                                        value={adminNotes}
                                        onChange={(e) => setAdminNotes(e.target.value)}
                                        rows={3}
                                        placeholder={
                                            reviewDecision === 'approved'
                                                ? 'E.g., Approved by market admin. New contract schedule in effect.'
                                                : 'Please provide the specific reason for rejecting this request...'
                                        }
                                        required={reviewDecision === 'rejected'}
                                        className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-xs font-medium focus:border-[#488562] focus:ring-[#488562]"
                                    />
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        disabled={isSubmitting}
                                        onClick={() => setReviewingRequest(null)}
                                        className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className={`rounded-lg px-4 py-2 text-xs font-bold text-white transition ${
                                            reviewDecision === 'approved'
                                                ? 'bg-[#488562] hover:bg-[#3a6e50]'
                                                : 'bg-rose-600 hover:bg-rose-700'
                                        }`}
                                    >
                                        {isSubmitting
                                            ? 'Processing…'
                                            : reviewDecision === 'approved'
                                            ? 'Confirm & Approve'
                                            : 'Confirm Rejection'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* ──────────────── MODAL: DIRECT CONTRACT EXTENSION ──────────────── */}
                {selectedVendorForRenew && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                            <h2 className="text-lg font-bold text-gray-900">Direct Contract Renewal</h2>
                            <p className="mt-1 text-xs text-gray-500">
                                Vendor: <span className="font-bold text-gray-800">{selectedVendorForRenew.stall_name}</span>
                            </p>
                            <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
                                <div>Current End Date: <b>{selectedVendorForRenew.contract_end || 'None'}</b></div>
                                <div>Current Status: <b>{selectedVendorForRenew.contract_status}</b></div>
                            </div>

                            <form onSubmit={handleDirectRenewalSubmit} className="mt-4 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700">Extend Contract By</label>
                                    <select
                                        value={directRenewMonths}
                                        onChange={(e) => setDirectRenewMonths(Number(e.target.value))}
                                        className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-3 text-xs font-medium focus:border-[#488562] focus:ring-[#488562]"
                                    >
                                        <option value={1}>1 Month</option>
                                        <option value={3}>3 Months</option>
                                        <option value={6}>6 Months</option>
                                        <option value={12}>12 Months (1 Year)</option>
                                    </select>
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedVendorForRenew(null)}
                                        className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="rounded-lg bg-[#488562] px-4 py-2 text-xs font-bold text-white hover:bg-[#3a6e50]"
                                    >
                                        Approve &amp; Renew Contract
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

RentalReportsIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Reports & Analytics', href: '/admin/dashboard/reports' },
        { title: 'Vendor Rental Reports', href: '/admin/dashboard/reports/rentals' },
    ],
};
