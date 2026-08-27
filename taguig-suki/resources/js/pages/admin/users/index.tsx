import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Eye,
    Pencil,
    Search,
    Shield,
    Store,
    ToggleLeft,
    ToggleRight,
    Trash2,
    UserCheck,
    Users,
    X,
    XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { dashboard } from '@/routes';

type VendorInfo = { id: number; stall_name: string; status: string } | null;

type AppUser = {
    id: number;
    name: string;
    email: string;
    is_admin: boolean;
    role: 'admin' | 'customer';
    is_active: boolean;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    vendor: VendorInfo;
};

type FilterOption = { value: string; label: string };

type Props = {
    users: {
        data: AppUser[];
        current_page: number;
        last_page: number;
        total: number;
        per_page: number;
        links: { url: string | null; label: string; active: boolean }[];
    };
    stats: {
        total: number;
        active: number;
        inactive: number;
        admins: number;
        customers: number;
    };
    filters: Record<string, string | undefined>;
    roles: FilterOption[];
    statuses: FilterOption[];
};

export default function UserManagementIndex({ users, stats, filters, roles, statuses }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [viewUser, setViewUser] = useState<AppUser | null>(null);
    const [editUser, setEditUser] = useState<AppUser | null>(null);

    function applyFilter(key: string, value: string | undefined) {
        router.get(
            '/admin/dashboard/users',
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
        router.get('/admin/dashboard/users', {}, { preserveState: true });
        setSearch('');
    }

    function handleToggle(user: AppUser) {
        const action = user.is_active ? 'deactivate' : 'activate';
        if (
            confirm(
                `Are you sure you want to ${action} "${user.name}"? ${user.is_active ? 'They will be blocked from logging in.' : 'Their access will be restored.'}`,
            )
        ) {
            router.patch(`/admin/dashboard/users/${user.id}/toggle`, {}, { preserveScroll: true });
        }
    }

    function handleDelete(user: AppUser) {
        if (confirm(`Permanently delete "${user.name}"? This cannot be undone.`)) {
            router.delete(`/admin/dashboard/users/${user.id}`, { preserveScroll: true });
        }
    }

    const hasActiveFilters = filters.search || filters.status || filters.role;

    return (
        <>
            <Head title="User Management" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-5">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
                    <p className="text-sm text-gray-500">
                        Manages customer accounts, including viewing, updating, activating, or deactivating users.
                    </p>
                </div>

                {/* Stats */}
                <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-5">
                    <StatCard icon={Users} label="Total Users" value={stats.total} color="#6b7280" />
                    <StatCard icon={UserCheck} label="Active" value={stats.active} color="#488562" />
                    <StatCard icon={XCircle} label="Inactive" value={stats.inactive} color="#dc2626" />
                    <StatCard icon={Shield} label="Admins" value={stats.admins} color="#7c3aed" />
                    <StatCard icon={Users} label="Customers" value={stats.customers} color="#0867ff" />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    <form onSubmit={handleSearch} className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name or email..."
                            className="h-8 w-52 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-[#488562] focus:ring-1 focus:ring-[#488562] focus:outline-none"
                        />
                    </form>

                    <ChipSelect label="Status" value={filters.status} options={statuses} onChange={(v) => applyFilter('status', v)} />
                    <ChipSelect label="Role" value={filters.role} options={roles} onChange={(v) => applyFilter('role', v)} />

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
                                        User
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Contact
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Role
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Vendor
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Joined
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {users.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-4 py-16 text-center text-base text-gray-400">
                                            <Users className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                                            No users found.
                                        </td>
                                    </tr>
                                ) : (
                                    users.data.map((user) => (
                                        <tr key={user.id} className="group transition hover:bg-[#488562]/[0.02]">
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg font-bold text-sm ${
                                                            user.is_active ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'
                                                        }`}
                                                    >
                                                        {user.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="truncate text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                                                            {user.name}
                                                            {user.is_admin && (
                                                                <span className="inline-flex items-center rounded bg-purple-50 px-1 py-0.5 text-[9px] font-bold text-purple-700">
                                                                    ADMIN
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-400">ID #{user.id}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                <div className="text-sm font-medium text-gray-900 truncate max-w-[200px]">{user.email}</div>
                                                <div className="text-xs text-gray-400">
                                                    {user.email_verified_at ? (
                                                        <span className="text-[#488562]">Verified</span>
                                                    ) : (
                                                        <span className="text-amber-600">Unverified</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3.5">
                                                {user.is_admin ? (
                                                    <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                                                        Admin
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                                                        Customer
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                {user.is_active ? (
                                                    <span className="inline-flex items-center gap-1 rounded-md bg-[#488562]/10 px-2 py-0.5 text-[10px] font-bold text-[#488562]">
                                                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#488562]" /> Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Inactive
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5">
                                                {user.vendor ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Store className="h-3.5 w-3.5 text-gray-400" />
                                                        <span className="text-xs font-medium text-gray-700">{user.vendor.stall_name}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3.5 text-xs text-gray-500">{formatDate(user.created_at)}</td>
                                            <td className="px-4 py-3.5">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        onClick={() => setViewUser(user)}
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
                                                        title="View"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => setEditUser(user)}
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-[#0867ff] transition hover:bg-blue-50"
                                                        title="Edit"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggle(user)}
                                                        className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition ${
                                                            user.is_active
                                                                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                                                : 'border-[#488562]/20 bg-[#488562]/10 text-[#488562] hover:bg-[#488562]/20'
                                                        }`}
                                                        title={user.is_active ? 'Deactivate' : 'Activate'}
                                                    >
                                                        {user.is_active ? (
                                                            <ToggleLeft className="h-3.5 w-3.5" />
                                                        ) : (
                                                            <ToggleRight className="h-3.5 w-3.5" />
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(user)}
                                                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100"
                                                        title="Delete"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {users.last_page > 1 && (
                        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                            <span className="text-sm text-gray-500">
                                {(users.current_page - 1) * users.per_page + 1}&#8211;
                                {Math.min(users.current_page * users.per_page, users.total)} of {users.total}
                            </span>
                            <div className="flex gap-1">
                                {users.links.map((link, i) => (
                                    <button
                                        key={i}
                                        disabled={!link.url}
                                        onClick={() => link.url && router.get(link.url, {}, { preserveState: true, preserveScroll: true })}
                                        className={`h-8 min-w-8 rounded-md px-2.5 text-sm font-medium transition ${
                                            link.active ? 'bg-[#488562] text-white' : link.url ? 'text-gray-600 hover:bg-gray-100' : 'text-gray-300'
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
                        Showing {users.data.length} of {users.total} users
                    </span>
                    <span>15 per page · Click eye to view, pencil to edit, toggle to activate/deactivate</span>
                </div>
            </div>

            {/* View Dialog */}
            {viewUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewUser(null)}>
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <div
                                    className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold ${viewUser.is_active ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'}`}
                                >
                                    {viewUser.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                        {viewUser.name}
                                        {viewUser.is_admin && (
                                            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">ADMIN</span>
                                        )}
                                    </h3>
                                    <p className="text-xs text-gray-500">{viewUser.email}</p>
                                </div>
                            </div>
                            <button onClick={() => setViewUser(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="space-y-3 px-6 py-4">
                            <div className="grid grid-cols-2 gap-3">
                                <DetailBox label="Role" value={viewUser.is_admin ? 'Admin' : 'Customer'} color={viewUser.is_admin ? '#7c3aed' : '#0867ff'} />
                                <DetailBox
                                    label="Status"
                                    value={viewUser.is_active ? 'Active' : 'Inactive'}
                                    color={viewUser.is_active ? '#488562' : '#dc2626'}
                                />
                                <DetailBox label="User ID" value={`#${viewUser.id}`} color="#6b7280" />
                                <DetailBox label="Vendor" value={viewUser.vendor?.stall_name ?? 'None'} color="#ee600e" />
                            </div>
                            <div className="rounded-xl bg-gray-50 p-3 text-xs space-y-2">
                                <Row label="Email" value={viewUser.email} />
                                <Row label="Verified" value={viewUser.email_verified_at ? 'Yes' : 'No'} />
                                <Row label="Joined" value={formatDate(viewUser.created_at)} />
                                <Row label="Updated" value={formatDate(viewUser.updated_at)} />
                                {viewUser.vendor && <Row label="Stall Status" value={viewUser.vendor.status} />}
                            </div>
                            {!viewUser.is_active && (
                                <div className="rounded-xl border border-red-100 bg-red-50/70 p-3 flex gap-2">
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
                                    <div className="text-xs">
                                        <div className="font-bold text-red-700">Account Deactivated</div>
                                        <p className="text-red-600/80">This user cannot log in until reactivated.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-3">
                            <button
                                onClick={() => {
                                    setViewUser(null);
                                    setEditUser(viewUser);
                                }}
                                className="rounded-lg bg-[#0867ff] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                            >
                                Edit User
                            </button>
                            <button
                                onClick={() => setViewUser(null)}
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Dialog */}
            {editUser && <EditModal user={editUser} onClose={() => setEditUser(null)} />}
        </>
    );
}

UserManagementIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'User Management', href: '/admin/dashboard/users' },
    ],
};

/* ─── Edit Modal ─── */
function EditModal({ user, onClose }: { user: AppUser; onClose: () => void }) {
    const { data, setData, put, processing, errors } = useForm({
        name: user.name,
        email: user.email,
        is_admin: user.is_admin,
        is_active: user.is_active,
    });

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        put(`/admin/dashboard/users/${user.id}`, {
            onSuccess: () => onClose(),
            preserveScroll: true,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                    <h3 className="text-sm font-bold text-gray-900">Edit User — {user.name}</h3>
                    <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
                    <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-900 text-white font-bold">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="text-xs">
                            <div className="font-medium text-gray-900">ID #{user.id}</div>
                            <div className="text-gray-500">Joined {formatDate(user.created_at)}</div>
                        </div>
                        <div className="ml-auto flex gap-1.5">
                            {user.is_admin ? (
                                <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">Admin</span>
                            ) : (
                                <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">Customer</span>
                            )}
                            {user.is_active ? (
                                <span className="rounded-md bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Active</span>
                            ) : (
                                <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Inactive</span>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Full Name *</label>
                        <input
                            type="text"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#488562] focus:ring-1 focus:ring-[#488562] focus:outline-none"
                        />
                        {errors.name && <p className="mt-1 text-[11px] text-red-500">{errors.name}</p>}
                    </div>

                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Email Address *</label>
                        <input
                            type="email"
                            value={data.email}
                            onChange={(e) => setData('email', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#488562] focus:ring-1 focus:ring-[#488562] focus:outline-none"
                        />
                        {errors.email && <p className="mt-1 text-[11px] text-red-500">{errors.email}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Role *</label>
                            <select
                                value={data.is_admin ? '1' : '0'}
                                onChange={(e) => setData('is_admin', e.target.value === '1' as never)}
                                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:border-[#488562] focus:ring-1 focus:ring-[#488562] focus:outline-none"
                            >
                                <option value="0">Customer</option>
                                <option value="1">Admin</option>
                            </select>
                            {errors.is_admin && <p className="mt-1 text-[11px] text-red-500">{errors.is_admin}</p>}
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Status *</label>
                            <select
                                value={data.is_active ? '1' : '0'}
                                onChange={(e) => setData('is_active', e.target.value === '1' as never)}
                                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:border-[#488562] focus:ring-1 focus:ring-[#488562] focus:outline-none"
                            >
                                <option value="1">Active — Can log in</option>
                                <option value="0">Inactive — Blocked</option>
                            </select>
                            {errors.is_active && <p className="mt-1 text-[11px] text-red-500">{errors.is_active}</p>}
                        </div>
                    </div>

                    <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-3 flex gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                        <p className="text-[11px] leading-relaxed text-amber-800">
                            Setting to <span className="font-bold">Inactive</span> immediately blocks login. Set to Active to restore access.
                        </p>
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing}
                            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
                        >
                            {processing ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Sub Components ─── */
function StatCard({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: number; color: string }) {
    return (
        <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${color}15` }}>
                <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="min-w-0">
                <div className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">{label}</div>
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

function DetailBox({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="flex items-center gap-2.5 rounded-xl border border-gray-100 p-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}15` }}>
                <span className="text-xs font-bold" style={{ color }}>
                    {value.charAt(0).toUpperCase()}
                </span>
            </div>
            <div className="min-w-0">
                <div className="text-[10px] font-semibold tracking-wide text-gray-400 uppercase">{label}</div>
                <div className="text-sm font-bold text-gray-900 truncate">{value}</div>
            </div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-start justify-between gap-3">
            <span className="shrink-0 text-gray-400">{label}</span>
            <span className="text-right font-medium text-gray-800 break-all">{value}</span>
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
