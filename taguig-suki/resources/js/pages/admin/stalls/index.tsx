import { Head, router, useForm } from '@inertiajs/react';
import {
    Box,
    CheckCircle2,
    Edit2,
    Layers,
    MapPin,
    Plus,
    Store,
    Trash2,
    Wrench,
    X,
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
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { dashboard } from '@/routes';

type Stall = {
    id: number;
    section: string;
    section_id: number | null;
    stall_number: string;
    store_name: string;
    vendor_id: number | null;
    status: string;
    size: string;
    monthly_rent: string;
    description: string | null;
    is_active: boolean;
    image: string | null;
    vendor?: { id: number; name: string; email: string } | null;
    section_relation?: { id: number; name: string; slug: string; color: string | null } | null;
    created_at: string;
    updated_at: string;
};

type FilterOption = { value: string; label: string; slug?: string; color?: string | null };

type Props = {
    stalls: {
        data: Stall[];
        current_page: number;
        last_page: number;
        total: number;
        per_page: number;
        links: { url: string | null; label: string; active: boolean }[];
    };
    stats: { total: number; occupied: number; vacant: number; maintenance: number };
    filters: Record<string, string | undefined>;
    sections: FilterOption[];
    statuses: FilterOption[];
    sizes: FilterOption[];
};

export default function StallsIndex({ stalls, stats, filters, sections, statuses, sizes }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [createOpen, setCreateOpen] = useState(false);

    const createForm = useForm({
        section_id: '',
        stall_number: '',
        store_name: '',
        status: 'vacant',
        size: 'medium',
        monthly_rent: '0',
        description: '',
        is_active: true,
    });

    function applyFilter(key: string, value: string | undefined) {
        router.get('/admin/dashboard/vendors/stalls', {
            ...filters,
            [key]: value || undefined,
            page: undefined,
        }, { preserveState: true, preserveScroll: true });
    }

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        applyFilter('search', search || undefined);
    }

    function clearFilters() {
        router.get('/admin/dashboard/vendors/stalls', {}, { preserveState: true });
        setSearch('');
    }

    function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        createForm.post('/admin/dashboard/vendors/stalls', {
            onSuccess: () => {
                setCreateOpen(false);
                createForm.reset();
                toast.success('Stall created successfully');
            },
            onError: () => toast.error('Failed to create stall'),
        });
    }

    const [editOpen, setEditOpen] = useState(false);
    const [editingStall, setEditingStall] = useState<Stall | null>(null);
    const editForm = useForm({
        section_id: '',
        stall_number: '',
        store_name: '',
        status: 'vacant',
        size: 'medium',
        monthly_rent: '0',
        description: '',
        is_active: true,
    });

    function handleEditStall(stall: Stall) {
        setEditingStall(stall);
        editForm.setData({
            section_id: String(stall.section_id ?? ''),
            stall_number: stall.stall_number,
            store_name: stall.store_name,
            status: stall.status,
            size: stall.size,
            monthly_rent: stall.monthly_rent,
            description: stall.description ?? '',
            is_active: stall.is_active,
        });
        setEditOpen(true);
    }

    function handleUpdateStall(e: React.FormEvent) {
        e.preventDefault();
        if (!editingStall) return;
        editForm.put(`/admin/dashboard/vendors/stalls/${editingStall.id}`, {
            onSuccess: () => {
                setEditOpen(false);
                setEditingStall(null);
                toast.success('Stall updated successfully');
            },
            onError: () => toast.error('Failed to update stall'),
        });
    }

    function handleDeleteStall(id: number) {
        if (confirm('Are you sure you want to delete this stall?')) {
            router.delete(`/admin/dashboard/vendors/stalls/${id}`, {
                preserveScroll: true,
                onSuccess: () => toast.success('Stall deleted successfully'),
                onError: () => toast.error('Failed to delete stall'),
            });
        }
    }

    const hasActiveFilters = filters.section || filters.status || filters.size || filters.search;

    return (
        <>
            <Head title="Stall Management" />
            <div className="flex h-full flex-1 flex-col gap-4 p-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">Stall Management</h1>
                        <p className="text-xs text-gray-500">Manage market stalls across all sections</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <SectionManager sections={sections} />
                        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                            <DialogTrigger asChild>
                                <Button className="gap-1.5 bg-[#488562] text-white hover:bg-[#3a6e50]">
                                    <Plus className="h-4 w-4" />
                                    Add Stall
                                </Button>
                            </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogTitle>Create New Stall</DialogTitle>
                            <DialogDescription>Add a new stall to Taguig People's Market.</DialogDescription>
                            <form onSubmit={handleCreate} className="mt-4 space-y-4">
                                {createForm.errors.stall_number && (
                                    <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{createForm.errors.stall_number}</div>
                                )}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label htmlFor="c-section" className="text-xs">Section</Label>
                                        <select
                                            id="c-section"
                                            value={createForm.data.section_id}
                                            onChange={(e) => createForm.setData('section_id', e.target.value)}
                                            className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562]"
                                        >
                                            <option value="">Select section...</option>
                                            {sections.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <Label htmlFor="c-stall-number" className="text-xs">Stall Number</Label>
                                        <Input id="c-stall-number" value={createForm.data.stall_number} onChange={(e) => createForm.setData('stall_number', e.target.value)} placeholder="Stall 1" className="mt-1 h-9" />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="c-store-name" className="text-xs">Store Name</Label>
                                    <Input id="c-store-name" value={createForm.data.store_name} onChange={(e) => createForm.setData('store_name', e.target.value)} placeholder="Aling Rosa's Fresh Fish" className="mt-1 h-9" />
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <Label htmlFor="c-status" className="text-xs">Status</Label>
                                        <select
                                            id="c-status"
                                            value={createForm.data.status}
                                            onChange={(e) => createForm.setData('status', e.target.value)}
                                            className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562]"
                                        >
                                            {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <Label htmlFor="c-size" className="text-xs">Size</Label>
                                        <select
                                            id="c-size"
                                            value={createForm.data.size}
                                            onChange={(e) => createForm.setData('size', e.target.value)}
                                            className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562]"
                                        >
                                            {sizes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <Label htmlFor="c-rent" className="text-xs">Rent (&#8369;)</Label>
                                        <Input id="c-rent" type="number" value={createForm.data.monthly_rent} onChange={(e) => createForm.setData('monthly_rent', e.target.value)} className="mt-1 h-9" />
                                    </div>
                                </div>
                                <div>
                                    <Label htmlFor="c-desc" className="text-xs">Description</Label>
                                    <textarea
                                        id="c-desc"
                                        value={createForm.data.description}
                                        onChange={(e) => createForm.setData('description', e.target.value)}
                                        placeholder="What does this stall sell?"
                                        rows={2}
                                        className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562]"
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="checkbox" id="c-active" checked={createForm.data.is_active} onChange={(e) => createForm.setData('is_active', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#488562] focus:ring-[#488562]" />
                                    <Label htmlFor="c-active" className="text-xs">Active</Label>
                                </div>
                                <DialogFooter className="gap-2">
                                    <DialogClose asChild>
                                        <Button type="button" variant="secondary">Cancel</Button>
                                    </DialogClose>
                                    <Button type="submit" disabled={createForm.processing} className="bg-[#488562] hover:bg-[#3a6e50]">
                                        Create Stall
                                    </Button>
                                </DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                    </div>
                </div>

                {/* Edit Stall Modal */}
                <Dialog open={editOpen} onOpenChange={setEditOpen}>
                    <DialogContent className="sm:max-w-md">
                        <DialogTitle>Edit Stall</DialogTitle>
                        <DialogDescription>Update stall information.</DialogDescription>
                        <form onSubmit={handleUpdateStall} className="mt-4 space-y-4">
                            {editForm.errors.stall_number && (
                                <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{editForm.errors.stall_number}</div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="e-section" className="text-xs">Section</Label>
                                    <select
                                        id="e-section"
                                        value={editForm.data.section_id}
                                        onChange={(e) => editForm.setData('section_id', e.target.value)}
                                        className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562]"
                                    >
                                        <option value="">Select section...</option>
                                        {sections.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor="e-stall-number" className="text-xs">Stall Number</Label>
                                    <Input id="e-stall-number" value={editForm.data.stall_number} onChange={(e) => editForm.setData('stall_number', e.target.value)} className="mt-1 h-9" />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="e-store-name" className="text-xs">Store Name</Label>
                                <Input id="e-store-name" value={editForm.data.store_name} onChange={(e) => editForm.setData('store_name', e.target.value)} className="mt-1 h-9" />
                            </div>
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <Label htmlFor="e-status" className="text-xs">Status</Label>
                                    <select
                                        id="e-status"
                                        value={editForm.data.status}
                                        onChange={(e) => editForm.setData('status', e.target.value)}
                                        className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562]"
                                    >
                                        {statuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor="e-size" className="text-xs">Size</Label>
                                    <select
                                        id="e-size"
                                        value={editForm.data.size}
                                        onChange={(e) => editForm.setData('size', e.target.value)}
                                        className="mt-1 h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562]"
                                    >
                                        {sizes.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <Label htmlFor="e-rent" className="text-xs">Rent (&#8369;)</Label>
                                    <Input id="e-rent" type="number" value={editForm.data.monthly_rent} onChange={(e) => editForm.setData('monthly_rent', e.target.value)} className="mt-1 h-9" />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="e-desc" className="text-xs">Description</Label>
                                <textarea
                                    id="e-desc"
                                    value={editForm.data.description}
                                    onChange={(e) => editForm.setData('description', e.target.value)}
                                    rows={2}
                                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562]"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="e-active" checked={editForm.data.is_active} onChange={(e) => editForm.setData('is_active', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-[#488562] focus:ring-[#488562]" />
                                <Label htmlFor="e-active" className="text-xs">Active</Label>
                            </div>
                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button type="button" variant="secondary">Cancel</Button>
                                </DialogClose>
                                <Button type="submit" disabled={editForm.processing} className="bg-[#488562] hover:bg-[#3a6e50]">
                                    Update Stall
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Stats */}
                <div className="flex w-full gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                            <Store className="h-5 w-5 text-gray-600" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Total Stalls</div>
                            <div className="text-xl font-bold text-gray-900">{stats.total}</div>
                        </div>
                    </div>
                    <div className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#488562]/10">
                            <CheckCircle2 className="h-5 w-5 text-[#488562]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Occupied</div>
                            <div className="text-xl font-bold text-[#488562]">{stats.occupied}</div>
                        </div>
                    </div>
                    <div className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0867ff]/10">
                            <Box className="h-5 w-5 text-[#0867ff]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Vacant</div>
                            <div className="text-xl font-bold text-[#0867ff]">{stats.vacant}</div>
                        </div>
                    </div>
                    <div className="flex min-w-0 flex-1 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ee600e]/10">
                            <Wrench className="h-5 w-5 text-[#ee600e]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Maintenance</div>
                            <div className="text-xl font-bold text-[#ee600e]">{stats.maintenance}</div>
                        </div>
                    </div>
                </div>

                {/* Filters - inline chip style */}
                <div className="flex flex-wrap items-center gap-2">
                    <form onSubmit={handleSearch} className="relative">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search..."
                            className="h-8 w-44 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-[#488562] focus:outline-none focus:ring-1 focus:ring-[#488562]"
                        />
                    </form>

                    <ChipSelect label="Section" value={filters.section} options={sections} onChange={(v) => applyFilter('section', v)} />
                    <ChipSelect label="Status" value={filters.status} options={statuses} onChange={(v) => applyFilter('status', v)} />
                    <ChipSelect label="Size" value={filters.size} options={sizes} onChange={(v) => applyFilter('size', v)} />

                    {hasActiveFilters && (
                        <button onClick={clearFilters} className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-medium text-red-600 transition hover:bg-red-100">
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
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">#</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Section</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Stall No.</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Store Name</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Vendor</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Size</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Rent/mo</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Description</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Active</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {stalls.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="px-4 py-16 text-center text-sm text-gray-400">
                                            <Box className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                                            No stalls found.
                                        </td>
                                    </tr>
                                ) : (
                                    stalls.data.map((stall, idx) => (
                                        <tr key={stall.id} className="group transition hover:bg-[#488562]/[0.02]">
                                            <td className="px-4 py-2.5 text-xs text-gray-400">{(stalls.current_page - 1) * stalls.per_page + idx + 1}</td>
                                            <td className="px-4 py-2.5"><SectionBadge stall={stall} /></td>
                                            <td className="px-4 py-2.5">
                                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-800">
                                                    <MapPin className="h-3 w-3 text-gray-400" />
                                                    {stall.stall_number}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-xs font-medium text-gray-900">{stall.store_name}</td>
                                            <td className="px-4 py-2.5 text-xs text-gray-500">{stall.vendor?.name ?? <span className="italic text-gray-300">—</span>}</td>
                                            <td className="px-4 py-2.5"><StatusBadge status={stall.status} /></td>
                                            <td className="px-4 py-2.5"><SizeBadge size={stall.size} /></td>
                                            <td className="px-4 py-2.5 text-xs font-semibold text-gray-800">&#8369;{Number(stall.monthly_rent).toLocaleString()}</td>
                                            <td className="max-w-[160px] truncate px-4 py-2.5 text-[11px] text-gray-400">{stall.description || '—'}</td>
                                            <td className="px-4 py-2.5">
                                                {stall.is_active ? (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#488562]">
                                                        <span className="h-2 w-2 rounded-full bg-[#488562]" />
                                                        Yes
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-400">
                                                        <span className="h-2 w-2 rounded-full bg-gray-300" />
                                                        No
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                                                    <button
                                                        onClick={() => handleEditStall(stall)}
                                                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-[#488562]"
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteStall(stall.id)}
                                                        className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
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
                    {stalls.last_page > 1 && (
                        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
                            <span className="text-[11px] text-gray-500">
                                {(stalls.current_page - 1) * stalls.per_page + 1}–{Math.min(stalls.current_page * stalls.per_page, stalls.total)} of {stalls.total}
                            </span>
                            <div className="flex gap-0.5">
                                {stalls.links.map((link, i) => (
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
            </div>
        </>
    );
}

StallsIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Vendors', href: '/admin/dashboard/vendors' },
        { title: 'Stalls', href: '/admin/dashboard/vendors/stalls' },
    ],
};

/* ─── Sub Components ─── */

function ChipSelect({ label, value, options, onChange }: { label: string; value?: string; options: FilterOption[]; onChange: (v: string | undefined) => void }) {
    return (
        <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || undefined)}
            className={`h-8 cursor-pointer rounded-lg border px-3 text-[11px] font-medium transition focus:outline-none focus:ring-1 focus:ring-[#488562] ${
                value
                    ? 'border-[#488562]/30 bg-[#488562]/5 text-[#488562]'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
        >
            <option value="">{label}: All</option>
            {options.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    );
}

function SectionManager({ sections }: { sections: FilterOption[] }) {
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('#488562');

    const newForm = useForm({ name: '', color: '#488562', is_active: true });

    function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        newForm.post('/admin/dashboard/vendors/sections', {
            onSuccess: () => {
                newForm.reset();
                toast.success('Section created successfully');
            },
            onError: () => toast.error('Failed to create section'),
            preserveScroll: true,
        });
    }

    function startEdit(section: FilterOption) {
        setEditingId(section.value);
        setEditName(section.label);
        setEditColor(section.color ?? '#488562');
    }

    function handleUpdate() {
        if (!editingId) return;
        router.put(`/admin/dashboard/vendors/sections/${editingId}`, {
            name: editName,
            color: editColor,
            is_active: true,
        }, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: () => {
                setEditingId(null);
                toast.success('Section updated successfully');
            },
            onError: () => toast.error('Failed to update section'),
        });
    }

    function handleDelete(id: string) {
        if (confirm('Delete this section? Stalls must be unlinked first.')) {
            router.delete(`/admin/dashboard/vendors/sections/${id}`, {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => toast.success('Section deleted successfully'),
                onError: () => toast.error('Cannot delete section with assigned stalls'),
            });
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-1.5 text-xs">
                    <Layers className="h-3.5 w-3.5" />
                    Sections
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogTitle>Manage Sections</DialogTitle>
                <DialogDescription>Create, edit, or delete market sections.</DialogDescription>

                {/* Existing sections */}
                <div className="mt-4 space-y-2">
                    {sections.length === 0 ? (
                        <p className="text-sm text-gray-400">No sections yet.</p>
                    ) : (
                        sections.map((section) => (
                            <div key={section.value} className="flex items-center gap-2 rounded-lg border border-gray-100 p-2.5">
                                {editingId === section.value ? (
                                    <>
                                        <input
                                            type="color"
                                            value={editColor}
                                            onChange={(e) => setEditColor(e.target.value)}
                                            className="h-7 w-7 shrink-0 cursor-pointer rounded border-0 p-0"
                                        />
                                        <input
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="h-7 flex-1 rounded border border-gray-200 px-2 text-xs focus:border-[#488562] focus:outline-none"
                                        />
                                        <button onClick={handleUpdate} className="rounded bg-[#488562] px-2 py-1 text-[10px] font-bold text-white">Save</button>
                                        <button onClick={() => setEditingId(null)} className="rounded bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600">Cancel</button>
                                    </>
                                ) : (
                                    <>
                                        <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: section.color ?? '#6b7280' }} />
                                        <span className="flex-1 text-sm font-medium text-gray-800">{section.label}</span>
                                        <button onClick={() => startEdit(section)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => handleDelete(section.value)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Create new section */}
                <form onSubmit={handleCreate} className="mt-4 flex items-end gap-2 border-t border-gray-100 pt-4">
                    <div className="flex-1">
                        <Label className="text-[10px] uppercase tracking-wide text-gray-400">New Section</Label>
                        <Input
                            value={newForm.data.name}
                            onChange={(e) => newForm.setData('name', e.target.value)}
                            placeholder="e.g. Vegetables"
                            className="mt-1 h-8 text-xs"
                        />
                    </div>
                    <input
                        type="color"
                        value={newForm.data.color}
                        onChange={(e) => newForm.setData('color', e.target.value)}
                        className="h-8 w-8 shrink-0 cursor-pointer rounded border border-gray-200 p-0.5"
                    />
                    <Button type="submit" disabled={newForm.processing || !newForm.data.name} className="h-8 bg-[#488562] px-3 text-xs hover:bg-[#3a6e50]">
                        Add
                    </Button>
                </form>

                <DialogFooter className="mt-4">
                    <DialogClose asChild>
                        <Button variant="secondary" className="text-xs">Done</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SectionBadge({ stall }: { stall: Stall }) {
    const section = stall.section_relation;
    if (!section) {
        return <span className="rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-500">{stall.section}</span>;
    }
    const color = section.color ?? '#6b7280';
    return (
        <span
            className="rounded-md px-2 py-0.5 text-[10px] font-bold"
            style={{ backgroundColor: color + '18', color }}
        >
            {section.name}
        </span>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { bg: string; text: string; label: string; Icon: React.ComponentType<{ className?: string }> }> = {
        occupied: { bg: 'bg-[#488562]/10', text: 'text-[#488562]', label: 'Occupied', Icon: CheckCircle2 },
        vacant: { bg: 'bg-[#0867ff]/10', text: 'text-[#0867ff]', label: 'Vacant', Icon: Box },
        under_maintenance: { bg: 'bg-[#ee600e]/10', text: 'text-[#ee600e]', label: 'Maintenance', Icon: Wrench },
    };
    const c = config[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600', label: status, Icon: Box };
    return (
        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${c.bg} ${c.text}`}>
            <c.Icon className="h-3 w-3" />
            {c.label}
        </span>
    );
}

function SizeBadge({ size }: { size: string }) {
    const config: Record<string, { bg: string; text: string }> = {
        small: { bg: 'bg-gray-100', text: 'text-gray-600' },
        medium: { bg: 'bg-purple-50', text: 'text-purple-700' },
        large: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    };
    const c = config[size] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
    return <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${c.bg} ${c.text}`}>{size}</span>;
}
