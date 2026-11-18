import { Head, router } from '@inertiajs/react';
import {
    ArrowLeft,
    CheckCircle2,
    Clock,
    FileCheck,
    FileText,
    Printer,
    ShieldAlert,
    ShieldCheck,
    Store,
    XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { dashboard } from '@/routes';

type VendorRentalReport = {
    vendor_id: number;
    stall_name: string;
    stall_location: string;
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

type Props = {
    vendor_reports: VendorRentalReport[];
    summary: {
        total_vendors: number;
        compliant_requirements: number;
        up_to_date_rent: number;
        overdue_rent: number;
        total_rent_collected: number;
        total_rent_overdue: number;
    };
};

export default function RentalReportsIndex({ vendor_reports, summary }: Props) {
    const [selectedVendorForRenew, setSelectedVendorForRenew] = useState<VendorRentalReport | null>(null);
    const [renewMonths, setRenewMonths] = useState(12);

    function handlePrint() {
        window.print();
    }

    function handleApproveRenewal(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedVendorForRenew) return;
        router.post(`/admin/dashboard/vendors/${selectedVendorForRenew.vendor_id}/contract/renew-approve`, {
            additional_months: renewMonths,
        }, {
            onSuccess: () => setSelectedVendorForRenew(null),
        });
    }

    return (
        <>
            <Head title="Vendor Rental & Compliance Reports" />

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
                                Vendor Rental &amp; Requirements Report
                            </h1>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">
                            Comprehensive records of vendor stall lease contracts, monthly payment histories, and required permits.
                        </p>
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
                    <h3 className="text-sm font-bold text-gray-700">Official Vendor Rental Records &amp; Document Requirements Report</h3>
                    <p className="text-xs text-gray-500">Generated on: {new Date().toLocaleDateString()} • City of Taguig</p>
                </div>

                {/* Summary KPIs */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total Vendors</div>
                        <div className="mt-2 text-2xl font-black text-gray-900">{summary.total_vendors}</div>
                    </div>
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700">All Permits Met</div>
                        <div className="mt-2 text-2xl font-black text-emerald-700">{summary.compliant_requirements}</div>
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
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-wider text-rose-700">Total Overdue</div>
                        <div className="mt-2 text-lg font-black text-rose-700">
                            ₱{summary.total_rent_overdue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                    </div>
                </div>

                {/* Vendor Records Table */}
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
                                                    {!isRenewalReq && !isExpiring && !isExpired && (
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
                                                                p.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : p.status === 'overdue' ? 'bg-rose-50 text-rose-700' : 'bg-gray-100 text-gray-700'
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

                {/* Contract Renewal Modal */}
                {selectedVendorForRenew && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                            <h2 className="text-lg font-bold text-gray-900">Renew Stall Lease Contract</h2>
                            <p className="mt-1 text-xs text-gray-500">
                                Vendor: <span className="font-bold text-gray-800">{selectedVendorForRenew.stall_name}</span>
                            </p>
                            <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
                                <div>Current End Date: <b>{selectedVendorForRenew.contract_end || 'None'}</b></div>
                                <div>Current Status: <b>{selectedVendorForRenew.contract_status}</b></div>
                            </div>

                            <form onSubmit={handleApproveRenewal} className="mt-4 space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700">Extend Contract By (Months)</label>
                                    <select
                                        value={renewMonths}
                                        onChange={(e) => setRenewMonths(Number(e.target.value))}
                                        className="mt-1 h-9 w-full rounded-lg border border-gray-200 px-3 text-xs font-medium focus:border-[#488562] focus:ring-[#488562]"
                                    >
                                        <option value={6}>6 Months</option>
                                        <option value={12}>12 Months (1 Year)</option>
                                        <option value={24}>24 Months (2 Years)</option>
                                        <option value={36}>36 Months (3 Years)</option>
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
