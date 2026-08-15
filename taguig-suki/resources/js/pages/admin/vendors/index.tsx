import { Head, router } from '@inertiajs/react';
import {
    AlertOctagon,
    CheckCircle2,
    Clock,
    FileText,
    Package,
    Play,
    Store,
    User,
    X,
    XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
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

type Vendor = {
    id: number;
    stall_name: string;
    stall_location: string;
    stall_number: string | null;
    product_categories: string[];
    status: string;
    rejection_reason: string | null;
    approved_at: string | null;
    created_at: string;
    products_count: number;
    inventories_count: number;
    documents_count: number;
    user: { id: number; name: string; email: string | null } | null;
};

type FilterOption = { value: string; label: string };

type Props = {
    vendors: {
        data: Vendor[];
        current_page: number;
        last_page: number;
        total: number;
        per_page: number;
        links: { url: string | null; label: string; active: boolean }[];
    };
    stats: {
        total: number;
        approved: number;
        pending: number;
        suspended: number;
        rejected: number;
    };
    filters: Record<string, string | undefined>;
    statuses: FilterOption[];
    categories: FilterOption[];
};

export default function VendorManagementIndex({
    vendors,
    stats,
    filters,
    statuses,
    categories,
}: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [viewVendor, setViewVendor] = useState<Vendor | null>(null);

    function applyFilter(key: string, value: string | undefined) {
        router.get(
            '/admin/dashboard/vendors',
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
        router.get('/admin/dashboard/vendors', {}, { preserveState: true });
        setSearch('');
    }

    function handleSuspend(vendor: Vendor) {
        if (
            confirm(
                `Suspend vendor "${vendor.stall_name}"? Their store will no longer appear to customers.`,
            )
        ) {
            router.post(
                `/admin/dashboard/vendors/${vendor.id}/suspend`,
                {},
                { preserveScroll: true },
            );
        }
    }

    function handleActivate(vendor: Vendor) {
        if (
            confirm(
                `Activate vendor "${vendor.stall_name}"? Their store will become available to customers.`,
            )
        ) {
            router.post(
                `/admin/dashboard/vendors/${vendor.id}/activate`,
                {},
                { preserveScroll: true },
            );
        }
    }

    const hasActiveFilters =
        filters.search || filters.status || filters.category;

    return (
        <>
            <Head title="Vendor Management" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-5">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        Vendor Management
                    </h1>
                    <p className="text-sm text-gray-500">
                        Monitor and manage all registered vendors
                    </p>
                </div>

                {/* Stats */}
                <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <StatCard
                        icon={Store}
                        label="Total"
                        value={stats.total}
                        color="#6b7280"
                    />
                    <StatCard
                        icon={CheckCircle2}
                        label="Approved"
                        value={stats.approved}
                        color="#488562"
                    />
                    <StatCard
                        icon={Clock}
                        label="Pending"
                        value={stats.pending}
                        color="#ee600e"
                    />
                    <StatCard
                        icon={AlertOctagon}
                        label="Suspended"
                        value={stats.suspended}
                        color="#7c3aed"
                    />
                    <StatCard
                        icon={XCircle}
                        label="Rejected"
                        value={stats.rejected}
                        color="#dc2626"
                    />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    <form onSubmit={handleSearch} className="relative">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search stall or owner..."
                            className="h-8 w-52 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-[#488562] focus:ring-1 focus:ring-[#488562] focus:outline-none"
                        />
                    </form>

                    <ChipSelect
                        label="Status"
                        value={filters.status}
                        options={statuses}
                        onChange={(v) => applyFilter('status', v)}
                    />
                    <ChipSelect
                        label="Category"
                        value={filters.category}
                        options={categories}
                        onChange={(v) => applyFilter('category', v)}
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
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Vendor
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Stall
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Categories
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Products
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Joined
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {vendors.data.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={7}
                                            className="px-4 py-16 text-center text-base text-gray-400"
                                        >
                                            <Store className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                                            No vendors found.
                                        </td>
                                    </tr>
                                ) : (
                                    vendors.data.map((vendor) => (
                                        <tr
                                            key={vendor.id}
                                            className="group transition hover:bg-[#488562]/[0.02]"
                                        >
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                                                        <User className="h-5 w-5 text-gray-500" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-semibold text-gray-900">
                                                            {vendor.user
                                                                ?.name ?? '—'}
                                                        </div>
                                                        <div className="text-xs text-gray-400">
                                                            {vendor.user
                                                                ?.email ??
                                                                'No email'}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {vendor.stall_name}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {vendor.stall_number
                                                        ? `Stall ${vendor.stall_number} · `
                                                        : ''}
                                                    {vendor.stall_location}
                                                </div>
                                            </td>
                                            <td className="max-w-[180px] px-4 py-3.5">
                                                <div className="flex flex-wrap gap-1">
                                                    {vendor.product_categories
                                                        .slice(0, 2)
                                                        .map((cat) => (
                                                            <span
                                                                key={cat}
                                                                className="rounded-md bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500"
                                                            >
                                                                {cat}
                                                            </span>
                                                        ))}
                                                    {vendor.product_categories
                                                        .length > 2 && (
                                                        <span className="rounded-md bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
                                                            +
                                                            {vendor
                                                                .product_categories
                                                                .length - 2}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Package className="h-3.5 w-3.5 text-gray-400" />
                                                    <span className="text-xs font-semibold text-gray-800">
                                                        {vendor.products_count}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <VendorStatusBadge
                                                    status={vendor.status}
                                                />
                                            </td>
                                            <td className="px-4 py-3.5 text-sm text-gray-500">
                                                {formatDate(vendor.created_at)}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() =>
                                                            setViewVendor(
                                                                vendor,
                                                            )
                                                        }
                                                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] font-medium text-blue-600 transition hover:bg-blue-100"
                                                    >
                                                        <FileText className="h-3.5 w-3.5" />
                                                        View
                                                    </button>
                                                    {vendor.status ===
                                                    'suspended' ? (
                                                        <button
                                                            onClick={() =>
                                                                handleActivate(
                                                                    vendor,
                                                                )
                                                            }
                                                            className="inline-flex items-center gap-1 rounded-lg bg-[#488562]/10 px-2.5 py-1.5 text-[11px] font-semibold text-[#488562] transition hover:bg-[#488562]/20"
                                                        >
                                                            <Play className="h-3.5 w-3.5" />
                                                            Activate
                                                        </button>
                                                    ) : vendor.status ===
                                                      'approved' ? (
                                                        <button
                                                            onClick={() =>
                                                                handleSuspend(
                                                                    vendor,
                                                                )
                                                            }
                                                            className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2.5 py-1.5 text-[11px] font-semibold text-purple-700 transition hover:bg-purple-100"
                                                        >
                                                            <AlertOctagon className="h-3.5 w-3.5" />
                                                            Suspend
                                                        </button>
                                                    ) : null}
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
                                {(vendors.current_page - 1) * vendors.per_page +
                                    1}
                                &#8211;
                                {Math.min(
                                    vendors.current_page * vendors.per_page,
                                    vendors.total,
                                )}{' '}
                                of {vendors.total}
                            </span>
                            <div className="flex gap-1">
                                {vendors.links.map((link, i) => (
                                    <button
                                        key={i}
                                        disabled={!link.url}
                                        onClick={() =>
                                            link.url &&
                                            router.get(
                                                link.url,
                                                {},
                                                {
                                                    preserveState: true,
                                                    preserveScroll: true,
                                                },
                                            )
                                        }
                                        className={`h-8 min-w-8 rounded-md px-2.5 text-sm font-medium transition ${
                                            link.active
                                                ? 'bg-[#488562] text-white'
                                                : link.url
                                                  ? 'text-gray-600 hover:bg-gray-100'
                                                  : 'text-gray-300'
                                        }`}
                                        dangerouslySetInnerHTML={{
                                            __html: link.label,
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Vendor detail dialog */}
            <Dialog
                open={!!viewVendor}
                onOpenChange={() => setViewVendor(null)}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogTitle className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-[#ee600e]" />
                        {viewVendor?.stall_name}
                    </DialogTitle>
                    <DialogDescription>
                        Managed by {viewVendor?.user?.name}
                        {viewVendor?.user?.email
                            ? ` · ${viewVendor.user.email}`
                            : ''}
                    </DialogDescription>
                    {viewVendor && <VendorDetail vendor={viewVendor} />}
                    <DialogFooter>
                        <DialogClose asChild>
                            <Button variant="secondary">Close</Button>
                        </DialogClose>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

VendorManagementIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Vendor Management', href: '/admin/dashboard/vendors' },
    ],
};

/* ─── Sub Components ─── */

function StatCard({
    icon: Icon,
    label,
    value,
    color,
}: {
    icon: LucideIcon;
    label: string;
    value: number;
    color: string;
}) {
    return (
        <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
            <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${color}15` }}
            >
                <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="min-w-0">
                <div className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
                    {label}
                </div>
                <div className="text-xl font-bold" style={{ color }}>
                    {value}
                </div>
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
            className={`h-8 cursor-pointer rounded-lg border px-3 text-[11px] font-medium transition focus:ring-1 focus:ring-[#488562] focus:outline-none ${
                value
                    ? 'border-[#488562]/30 bg-[#488562]/5 text-[#488562]'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
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

function VendorStatusBadge({ status }: { status: string }) {
    const config: Record<
        string,
        { bg: string; text: string; label: string; Icon: LucideIcon }
    > = {
        approved: {
            bg: 'bg-[#488562]/10',
            text: 'text-[#488562]',
            label: 'Approved',
            Icon: CheckCircle2,
        },
        pending: {
            bg: 'bg-[#ee600e]/10',
            text: 'text-[#ee600e]',
            label: 'Pending',
            Icon: Clock,
        },
        suspended: {
            bg: 'bg-purple-50',
            text: 'text-purple-700',
            label: 'Suspended',
            Icon: AlertOctagon,
        },
        rejected: {
            bg: 'bg-red-50',
            text: 'text-red-500',
            label: 'Rejected',
            Icon: XCircle,
        },
    };
    const c = config[status] ?? {
        bg: 'bg-gray-100',
        text: 'text-gray-600',
        label: status,
        Icon: Store,
    };

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${c.bg} ${c.text}`}
        >
            <c.Icon className="h-3 w-3" />
            {c.label}
        </span>
    );
}

function VendorDetail({ vendor }: { vendor: Vendor }) {
    return (
        <div className="mt-2 space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <DetailBox
                    label="Products"
                    value={String(vendor.products_count)}
                    icon={Package}
                    color="#488562"
                />
                <DetailBox
                    label="Inventory Items"
                    value={String(vendor.inventories_count)}
                    icon={Store}
                    color="#0867ff"
                />
                <DetailBox
                    label="Documents"
                    value={String(vendor.documents_count)}
                    icon={FileText}
                    color="#ee600e"
                />
                <DetailBox
                    label="Stall No."
                    value={vendor.stall_number ?? '—'}
                    icon={Store}
                    color="#6b7280"
                />
            </div>

            <div className="space-y-2 rounded-xl bg-gray-50 p-3 text-xs">
                <Row label="Owner" value={vendor.user?.name ?? '—'} />
                <Row label="Email" value={vendor.user?.email ?? '—'} />
                <Row label="Location" value={vendor.stall_location} />
                <Row
                    label="Categories"
                    value={vendor.product_categories.join(', ') || '—'}
                />
                <Row label="Joined" value={formatDate(vendor.created_at)} />
                {vendor.approved_at && (
                    <Row
                        label="Approved"
                        value={formatDate(vendor.approved_at)}
                    />
                )}
            </div>

            {vendor.rejection_reason && (
                <div className="rounded-xl border border-red-50 bg-red-50/50 p-3 text-xs text-red-600">
                    <div className="mb-0.5 font-bold">Rejection reason</div>
                    {vendor.rejection_reason}
                </div>
            )}
        </div>
    );
}

function DetailBox({
    label,
    value,
    icon: Icon,
    color,
}: {
    label: string;
    value: string;
    icon: LucideIcon;
    color: string;
}) {
    return (
        <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 p-3">
            <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${color}15` }}
            >
                <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div className="min-w-0">
                <div className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">
                    {label}
                </div>
                <div className="text-sm font-bold text-gray-900">{value}</div>
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-gray-400">{label}</span>
            <span className="text-right font-medium text-gray-800">
                {value}
            </span>
        </div>
    );
}

function formatDate(value: string): string {
    return new Date(value).toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
