import { Head, Link, router, useForm } from '@inertiajs/react';
import {
    AlertCircle,
    Box,
    CheckCircle2,
    Edit2,
    Layers,
    Loader2,
    MapPin,
    Plus,
    Receipt,
    ShieldAlert,
    Store,
    Trash2,
    Wrench,
    X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
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

type FilterOption = { value: string; label: string; slug?: string; color?: string | null; monthly_rent?: number };

const DEFAULT_RENT_BY_SIZE: Record<string, number> = {
    small: 1500,
    medium: 2000,
    large: 3000,
};

type OccupiedSlot = {
    id: number;
    stall_number: string;
    store_name: string;
    status: string;
};

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
    vendors?: { id: number; name: string }[];
    available_stall_numbers?: string[];
    occupied_slots?: Record<string | number, OccupiedSlot[]>;
    section_capacities?: Record<string, number>;
    market_capacity_per_section?: number;
    market_total_capacity?: number;
};

function getSlotStatus(
    sectionId: string | number,
    slotName: string,
    occupiedSlotsMap: Record<string | number, OccupiedSlot[]> | undefined,
    currentStallId?: number | null
): { isOccupied: boolean; isCurrent: boolean; occupierName?: string } {
    if (!sectionId || !occupiedSlotsMap) {
        return { isOccupied: false, isCurrent: false };
    }
    const slots = occupiedSlotsMap[sectionId] || [];
    const normalizedSlot = slotName.trim().toLowerCase();
    const match = slots.find((s) => s.stall_number.trim().toLowerCase() === normalizedSlot);
    if (!match) {
        return { isOccupied: false, isCurrent: false };
    }
    if (currentStallId && match.id === currentStallId) {
        return { isOccupied: false, isCurrent: true, occupierName: match.store_name };
    }
    return { isOccupied: true, isCurrent: false, occupierName: match.store_name };
}

function getSectionCapacity(
    sectionId: string | number,
    occupiedSlotsMap: Record<string | number, OccupiedSlot[]> | undefined,
    sectionCapacitiesMap?: Record<string, number>,
    fallbackCapacity = 30
): { count: number; max: number; isFull: boolean; available: number } | null {
    if (!sectionId) return null;
    const slots = occupiedSlotsMap?.[sectionId] || [];
    const count = slots.length;
    const max = sectionCapacitiesMap?.[String(sectionId)] ?? fallbackCapacity;
    return {
        count,
        max,
        isFull: count >= max,
        available: Math.max(0, max - count),
    };
}

export default function StallsIndex({
    stalls,
    stats,
    filters,
    sections,
    statuses,
    sizes,
    vendors = [],
    available_stall_numbers = [],
    occupied_slots = {},
    section_capacities = {},
    market_capacity_per_section = 30,
    market_total_capacity = 365,
}: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [createOpen, setCreateOpen] = useState(false);
    const [imagePreview, setImagePreview] = useState<string | null>(null);

    const [editOpen, setEditOpen] = useState(false);
    const [editingStall, setEditingStall] = useState<Stall | null>(null);
    const [editImagePreview, setEditImagePreview] = useState<string | null>(null);

    const getRentForSize = (sizeValue: string): string => {
        const option = sizes.find((s) => s.value === sizeValue);
        const amount = option?.monthly_rent ?? DEFAULT_RENT_BY_SIZE[sizeValue] ?? DEFAULT_RENT_BY_SIZE.medium;
        return amount.toFixed(2);
    };

    const baseStallNumbers = useMemo(() => {
        return available_stall_numbers.length > 0
            ? available_stall_numbers
            : Array.from({ length: 30 }, (_, i) => `Stall ${i + 1}`);
    }, [available_stall_numbers]);

    const createForm = useForm<{
        section_id: string;
        stall_number: string;
        store_name: string;
        vendor_id: string;
        status: string;
        size: string;
        monthly_rent: string;
        description: string;
        is_active: boolean;
        image: File | null;
    }>({
        section_id: '',
        stall_number: '',
        store_name: '',
        vendor_id: '',
        status: 'vacant',
        size: 'medium',
        monthly_rent: getRentForSize('medium'),
        description: '',
        is_active: true,
        image: null,
    });

    const editForm = useForm<{
        section_id: string;
        stall_number: string;
        store_name: string;
        vendor_id: string;
        status: string;
        size: string;
        monthly_rent: string;
        description: string;
        is_active: boolean;
        image: File | null;
    }>({
        section_id: '',
        stall_number: '',
        store_name: '',
        vendor_id: '',
        status: 'vacant',
        size: 'medium',
        monthly_rent: getRentForSize('medium'),
        description: '',
        is_active: true,
        image: null,
    });

    const createSectionCap = useMemo(() => {
        return getSectionCapacity(
            createForm.data.section_id,
            occupied_slots,
            section_capacities,
            market_capacity_per_section
        );
    }, [createForm.data.section_id, occupied_slots, section_capacities, market_capacity_per_section]);

    const editSectionCap = useMemo(() => {
        return getSectionCapacity(
            editForm.data.section_id,
            occupied_slots,
            section_capacities,
            market_capacity_per_section
        );
    }, [editForm.data.section_id, occupied_slots, section_capacities, market_capacity_per_section]);

    // Available stall numbers for edit form, guaranteeing current stall number is included
    const editStallNumbers = useMemo(() => {
        const list = [...baseStallNumbers];
        if (editForm.data.stall_number) {
            const hasMatch = list.some(
                (n) => n.trim().toLowerCase() === editForm.data.stall_number.trim().toLowerCase()
            );
            if (!hasMatch) {
                list.unshift(editForm.data.stall_number);
            }
        }
        return list;
    }, [baseStallNumbers, editForm.data.stall_number]);

    function applyFilter(key: string, value: string | undefined) {
        router.get(
            '/admin/dashboard/vendors/stalls',
            {
                ...filters,
                [key]: value || undefined,
                page: undefined,
            },
            { preserveState: true, preserveScroll: true }
        );
    }

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        applyFilter('search', search || undefined);
    }

    function clearFilters() {
        router.get('/admin/dashboard/vendors/stalls', {}, { preserveState: true });
        setSearch('');
    }

    function handleOpenCreate() {
        createForm.reset();
        createForm.setData('monthly_rent', getRentForSize('medium'));
        createForm.clearErrors();
        setImagePreview(null);
        setCreateOpen(true);
    }

    function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        createForm.post('/admin/dashboard/vendors/stalls', {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                setCreateOpen(false);
                createForm.reset();
                createForm.clearErrors();
                setImagePreview(null);
                toast.success('Stall created successfully');
            },
            onError: (errs) => {
                const firstErr = Object.values(errs)[0];
                toast.error(typeof firstErr === 'string' ? firstErr : 'Failed to create stall. Please check the fields.');
            },
        });
    }

    function handleEditStall(stall: Stall) {
        setEditingStall(stall);
        editForm.clearErrors();
        editForm.setData({
            section_id: String(stall.section_id ?? ''),
            stall_number: stall.stall_number,
            store_name: stall.store_name,
            vendor_id: stall.vendor_id ? String(stall.vendor_id) : '',
            status: stall.status,
            size: stall.size,
            monthly_rent: getRentForSize(stall.size),
            description: stall.description ?? '',
            is_active: stall.is_active,
            image: null,
        });
        setEditImagePreview(stall.image ? `/storage/${stall.image}` : null);
        setEditOpen(true);
    }

    function handleUpdateStall(e: React.FormEvent) {
        e.preventDefault();
        if (!editingStall) return;

        if (editForm.data.image) {
            router.post(
                `/admin/dashboard/vendors/stalls/${editingStall.id}`,
                {
                    _method: 'put',
                    ...editForm.data,
                },
                {
                    forceFormData: true,
                    preserveScroll: true,
                    onSuccess: () => {
                        setEditOpen(false);
                        setEditingStall(null);
                        editForm.clearErrors();
                        setEditImagePreview(null);
                        toast.success('Stall updated successfully');
                    },
                    onError: (errs) => {
                        const firstErr = Object.values(errs)[0];
                        toast.error(typeof firstErr === 'string' ? firstErr : 'Failed to update stall. Please check the fields.');
                    },
                }
            );
        } else {
            editForm.put(`/admin/dashboard/vendors/stalls/${editingStall.id}`, {
                preserveScroll: true,
                onSuccess: () => {
                    setEditOpen(false);
                    setEditingStall(null);
                    editForm.clearErrors();
                    setEditImagePreview(null);
                    toast.success('Stall updated successfully');
                },
                onError: (errs) => {
                    const firstErr = Object.values(errs)[0];
                    toast.error(typeof firstErr === 'string' ? firstErr : 'Failed to update stall. Please check the fields.');
                },
            });
        }
    }

    function handleDeleteStall(id: number) {
        if (confirm('Are you sure you want to delete this stall? This action cannot be undone.')) {
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
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">Stall Management</h1>
                        <p className="text-xs text-gray-500">
                            Taguig People's Market (TPM) — 365 Total Stalls across Wet, Dry, Eatery &amp; Misc Sections
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <SectionManager sections={sections} />
                        <Button
                            onClick={handleOpenCreate}
                            className="gap-1.5 bg-[#488562] text-white hover:bg-[#3a6e50] shadow-sm"
                        >
                            <Plus className="h-4 w-4" />
                            Add Stall
                        </Button>
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex items-center gap-1 border-b border-gray-200">
                    <Link
                        href="/admin/dashboard/vendors/stalls"
                        className="inline-flex items-center gap-2 border-b-2 border-[#488562] px-4 py-2.5 text-xs font-bold text-[#488562]"
                    >
                        <Store className="h-4 w-4" />
                        All Stalls ({stats.total} / {market_total_capacity})
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
                        className="inline-flex items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-xs font-semibold text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    >
                        <Receipt className="h-4 w-4 text-blue-500" />
                        Monthly Stall Rentals &amp; Billing
                    </Link>
                </div>

                {/* Create Stall Modal */}
                <Dialog
                    open={createOpen}
                    onOpenChange={(open) => {
                        setCreateOpen(open);
                        if (!open) {
                            createForm.clearErrors();
                            setImagePreview(null);
                        }
                    }}
                >
                    <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader className="border-b border-gray-100 pb-3">
                            <DialogTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
                                <Store className="h-5 w-5 text-[#488562]" />
                                Create New Stall
                            </DialogTitle>
                            <DialogDescription className="text-xs text-gray-500">
                                Add a new stall slot to Taguig People's Market. Slots are capped at 30 stalls per section.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleCreate} className="mt-2 space-y-4">
                            {/* Validation Errors Summary Alert */}
                            {Object.keys(createForm.errors).length > 0 && (
                                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                                    <div className="flex items-center gap-1.5 font-bold mb-1">
                                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                                        Please correct the following errors:
                                    </div>
                                    <ul className="list-disc pl-5 space-y-0.5">
                                        {Object.entries(createForm.errors).map(([field, err]) => (
                                            <li key={field}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Section Capacity Banner */}
                            {createSectionCap && (
                                <div
                                    className={`rounded-xl p-3 text-xs flex items-center justify-between border ${
                                        createSectionCap.isFull
                                            ? 'bg-red-50 border-red-200 text-red-700'
                                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    }`}
                                >
                                    <span className="font-medium">
                                        Section Occupancy: <strong>{createSectionCap.count} / {createSectionCap.max}</strong> stalls used
                                    </span>
                                    <span className="font-semibold">
                                        {createSectionCap.isFull
                                            ? '⚠️ Market Limit Reached'
                                            : `${createSectionCap.available} slot(s) available`}
                                    </span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="c-section" className="text-xs font-semibold text-gray-700">
                                        Category / Section <span className="text-red-500">*</span>
                                    </Label>
                                    <select
                                        id="c-section"
                                        value={createForm.data.section_id}
                                        onChange={(e) => {
                                            const secId = e.target.value;
                                            createForm.setData((prev) => ({
                                                ...prev,
                                                section_id: secId,
                                                stall_number: '',
                                            }));
                                        }}
                                        className={`mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562] ${
                                            createForm.errors.section_id
                                                ? 'border-red-400 bg-red-50/30'
                                                : 'border-gray-200'
                                        }`}
                                    >
                                        <option value="">Select section...</option>
                                        {sections.map((s) => (
                                            <option key={s.value} value={s.value}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                    {createForm.errors.section_id && (
                                        <p className="mt-1 text-xs text-red-600">{createForm.errors.section_id}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="c-stall-number" className="text-xs font-semibold text-gray-700">
                                        Stall Number (Predefined Slots 1–30) <span className="text-red-500">*</span>
                                    </Label>
                                    <select
                                        id="c-stall-number"
                                        value={createForm.data.stall_number}
                                        disabled={!createForm.data.section_id || createSectionCap?.isFull}
                                        onChange={(e) => createForm.setData('stall_number', e.target.value)}
                                        className={`mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562] ${
                                            createForm.errors.stall_number
                                                ? 'border-red-400 bg-red-50/30'
                                                : 'border-gray-200'
                                        } ${
                                            !createForm.data.section_id || createSectionCap?.isFull
                                                ? 'bg-gray-100 cursor-not-allowed opacity-75'
                                                : ''
                                        }`}
                                    >
                                        <option value="">
                                            {!createForm.data.section_id
                                                ? 'Select section first...'
                                                : createSectionCap?.isFull
                                                  ? 'Section at maximum capacity (30/30)'
                                                  : 'Select stall slot...'}
                                        </option>
                                        {baseStallNumbers.map((num) => {
                                            const slot = getSlotStatus(
                                                createForm.data.section_id,
                                                num,
                                                occupied_slots
                                            );
                                            return (
                                                <option key={num} value={num} disabled={slot.isOccupied}>
                                                    {num}{' '}
                                                    {slot.isOccupied
                                                        ? `(Taken - ${slot.occupierName || 'Occupied'})`
                                                        : '(Available)'}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    {createForm.errors.stall_number && (
                                        <p className="mt-1 text-xs text-red-600">
                                            {createForm.errors.stall_number}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="c-store-name" className="text-xs font-semibold text-gray-700">
                                        Store Name <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="c-store-name"
                                        value={createForm.data.store_name}
                                        onChange={(e) => createForm.setData('store_name', e.target.value)}
                                        placeholder="e.g. Aling Rosa's Fresh Fish"
                                        className={`mt-1 h-9 ${createForm.errors.store_name ? 'border-red-400 bg-red-50/30' : ''}`}
                                    />
                                    {createForm.errors.store_name && (
                                        <p className="mt-1 text-xs text-red-600">{createForm.errors.store_name}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="c-vendor" className="text-xs font-semibold text-gray-700">
                                        Assigned Vendor
                                    </Label>
                                    <select
                                        id="c-vendor"
                                        value={createForm.data.vendor_id}
                                        onChange={(e) => {
                                            const vId = e.target.value;
                                            createForm.setData('vendor_id', vId);
                                            if (vId) {
                                                createForm.setData('status', 'occupied');
                                                const vendorObj = vendors.find((v) => String(v.id) === vId);
                                                if (vendorObj && !createForm.data.store_name) {
                                                    const match = vendorObj.name.match(/\((.*?)\)/);
                                                    createForm.setData('store_name', match ? match[1] : vendorObj.name);
                                                }
                                            } else {
                                                createForm.setData('status', 'vacant');
                                            }
                                        }}
                                        className={`mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562] ${
                                            createForm.errors.vendor_id
                                                ? 'border-red-400 bg-red-50/30'
                                                : 'border-gray-200'
                                        }`}
                                    >
                                        <option value="">No vendor assigned (Vacant stall)</option>
                                        {vendors.map((v) => (
                                            <option key={v.id} value={String(v.id)}>
                                                {v.name}
                                            </option>
                                        ))}
                                    </select>
                                    {createForm.errors.vendor_id && (
                                        <p className="mt-1 text-xs text-red-600">{createForm.errors.vendor_id}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <Label htmlFor="c-status" className="text-xs font-semibold text-gray-700">
                                        Status <span className="text-red-500">*</span>
                                    </Label>
                                    <select
                                        id="c-status"
                                        value={createForm.data.status}
                                        onChange={(e) => createForm.setData('status', e.target.value)}
                                        className={`mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562] ${
                                            createForm.errors.status
                                                ? 'border-red-400 bg-red-50/30'
                                                : 'border-gray-200'
                                        }`}
                                    >
                                        {statuses.map((s) => (
                                            <option key={s.value} value={s.value}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                    {createForm.errors.status && (
                                        <p className="mt-1 text-xs text-red-600">{createForm.errors.status}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="c-size" className="text-xs font-semibold text-gray-700">
                                        Size <span className="text-red-500">*</span>
                                    </Label>
                                    <select
                                        id="c-size"
                                        value={createForm.data.size}
                                        onChange={(e) => {
                                            const nextSize = e.target.value;
                                            createForm.setData((prev) => ({
                                                ...prev,
                                                size: nextSize,
                                                monthly_rent: getRentForSize(nextSize),
                                            }));
                                        }}
                                        className={`mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562] ${
                                            createForm.errors.size
                                                ? 'border-red-400 bg-red-50/30'
                                                : 'border-gray-200'
                                        }`}
                                    >
                                        {sizes.map((s) => (
                                            <option key={s.value} value={s.value}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                    {createForm.errors.size && (
                                        <p className="mt-1 text-xs text-red-600">{createForm.errors.size}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="c-rent" className="text-xs font-semibold text-gray-700">
                                        Rent / Month (₱) <span className="text-[10px] font-medium text-[#488562]">(Auto)</span>
                                    </Label>
                                    <Input
                                        id="c-rent"
                                        type="text"
                                        readOnly
                                        tabIndex={-1}
                                        aria-readonly="true"
                                        value={Number(createForm.data.monthly_rent || 0).toLocaleString('en-PH', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                        className={`mt-1 h-9 cursor-not-allowed bg-gray-100 font-semibold text-gray-700 select-none focus-visible:ring-0 ${createForm.errors.monthly_rent ? 'border-red-400 bg-red-50/30' : ''}`}
                                    />
                                    {createForm.errors.monthly_rent && (
                                        <p className="mt-1 text-xs text-red-600">
                                            {createForm.errors.monthly_rent}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Stall Image / Photo (Optional) */}
                            <div>
                                <Label htmlFor="c-image" className="text-xs font-semibold text-gray-700">
                                    Stall Photo (Optional)
                                </Label>
                                <div className="mt-1 flex items-center gap-3">
                                    {imagePreview ? (
                                        <div className="relative h-14 w-14 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                                            <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="h-full w-full object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    createForm.setData('image', null);
                                                    setImagePreview(null);
                                                }}
                                                className="absolute top-0.5 right-0.5 rounded-full bg-red-600 p-0.5 text-white shadow hover:bg-red-700"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400 shrink-0">
                                            <Store className="h-6 w-6" />
                                        </div>
                                    )}
                                    <input
                                        id="c-image"
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0] || null;
                                            createForm.setData('image', file);
                                            if (file) {
                                                setImagePreview(URL.createObjectURL(file));
                                            } else {
                                                setImagePreview(null);
                                            }
                                        }}
                                        className="text-xs file:mr-2 file:rounded-md file:border-0 file:bg-[#488562]/10 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-[#488562] hover:file:bg-[#488562]/20"
                                    />
                                </div>
                                {createForm.errors.image && (
                                    <p className="mt-1 text-xs text-red-600">{createForm.errors.image}</p>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="c-desc" className="text-xs font-semibold text-gray-700">
                                    Description (Optional)
                                </Label>
                                <textarea
                                    id="c-desc"
                                    value={createForm.data.description}
                                    onChange={(e) => createForm.setData('description', e.target.value)}
                                    placeholder="What does this stall specialize in?"
                                    rows={2}
                                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562] ${
                                        createForm.errors.description
                                            ? 'border-red-400 bg-red-50/30'
                                            : 'border-gray-200'
                                    }`}
                                />
                                {createForm.errors.description && (
                                    <p className="mt-1 text-xs text-red-600">{createForm.errors.description}</p>
                                )}
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="c-active"
                                    checked={createForm.data.is_active}
                                    onChange={(e) => createForm.setData('is_active', e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-[#488562] focus:ring-[#488562]"
                                />
                                <Label htmlFor="c-active" className="text-xs font-medium text-gray-700 cursor-pointer">
                                    Stall is active and visible to market customers
                                </Label>
                            </div>

                            <DialogFooter className="gap-2 border-t border-gray-100 pt-3">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => {
                                        setCreateOpen(false);
                                        createForm.clearErrors();
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={createForm.processing || createSectionCap?.isFull}
                                    className="gap-1.5 bg-[#488562] hover:bg-[#3a6e50] text-white"
                                >
                                    {createForm.processing ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Creating Stall...
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4" />
                                            Create Stall
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Edit Stall Modal */}
                <Dialog
                    open={editOpen}
                    onOpenChange={(open) => {
                        setEditOpen(open);
                        if (!open) {
                            setEditingStall(null);
                            editForm.clearErrors();
                            setEditImagePreview(null);
                        }
                    }}
                >
                    <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader className="border-b border-gray-100 pb-3">
                            <DialogTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
                                <Edit2 className="h-5 w-5 text-[#488562]" />
                                Edit Stall — {editingStall?.store_name || editingStall?.stall_number}
                            </DialogTitle>
                            <DialogDescription className="text-xs text-gray-500">
                                Update stall details, section assignment, or vendor allocation.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleUpdateStall} className="mt-2 space-y-4">
                            {/* Validation Errors Summary Alert */}
                            {Object.keys(editForm.errors).length > 0 && (
                                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                                    <div className="flex items-center gap-1.5 font-bold mb-1">
                                        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                                        Please correct the following errors:
                                    </div>
                                    <ul className="list-disc pl-5 space-y-0.5">
                                        {Object.entries(editForm.errors).map(([field, err]) => (
                                            <li key={field}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Section Capacity Banner */}
                            {editSectionCap && (
                                <div
                                    className={`rounded-xl p-3 text-xs flex items-center justify-between border ${
                                        editSectionCap.isFull
                                            ? 'bg-amber-50 border-amber-200 text-amber-800'
                                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    }`}
                                >
                                    <span className="font-medium">
                                        Section Occupancy: <strong>{editSectionCap.count} / {editSectionCap.max}</strong> stalls used
                                    </span>
                                    <span className="font-semibold">
                                        {editSectionCap.isFull
                                            ? '⚠️ Section At Maximum Capacity'
                                            : `${editSectionCap.available} slot(s) available`}
                                    </span>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="e-section" className="text-xs font-semibold text-gray-700">
                                        Category / Section <span className="text-red-500">*</span>
                                    </Label>
                                    <select
                                        id="e-section"
                                        value={editForm.data.section_id}
                                        onChange={(e) => {
                                            const secId = e.target.value;
                                            editForm.setData((prev) => ({
                                                ...prev,
                                                section_id: secId,
                                            }));
                                        }}
                                        className={`mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562] ${
                                            editForm.errors.section_id
                                                ? 'border-red-400 bg-red-50/30'
                                                : 'border-gray-200'
                                        }`}
                                    >
                                        <option value="">Select section...</option>
                                        {sections.map((s) => (
                                            <option key={s.value} value={s.value}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                    {editForm.errors.section_id && (
                                        <p className="mt-1 text-xs text-red-600">{editForm.errors.section_id}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="e-stall-number" className="text-xs font-semibold text-gray-700">
                                        Stall Number (Predefined Slots 1–30) <span className="text-red-500">*</span>
                                    </Label>
                                    <select
                                        id="e-stall-number"
                                        value={editForm.data.stall_number}
                                        onChange={(e) => editForm.setData('stall_number', e.target.value)}
                                        className={`mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562] ${
                                            editForm.errors.stall_number
                                                ? 'border-red-400 bg-red-50/30'
                                                : 'border-gray-200'
                                        }`}
                                    >
                                        <option value="">Select stall slot...</option>
                                        {editStallNumbers.map((num) => {
                                            const slot = getSlotStatus(
                                                editForm.data.section_id,
                                                num,
                                                occupied_slots,
                                                editingStall?.id
                                            );
                                            const isCurrent =
                                                slot.isCurrent ||
                                                (editingStall &&
                                                    editingStall.stall_number.trim().toLowerCase() ===
                                                        num.trim().toLowerCase());
                                            return (
                                                <option
                                                    key={num}
                                                    value={num}
                                                    disabled={slot.isOccupied && !isCurrent}
                                                >
                                                    {num}{' '}
                                                    {isCurrent
                                                        ? '(Current Slot)'
                                                        : slot.isOccupied
                                                          ? `(Taken - ${slot.occupierName || 'Occupied'})`
                                                          : '(Available)'}
                                                </option>
                                            );
                                        })}
                                    </select>
                                    {editForm.errors.stall_number && (
                                        <p className="mt-1 text-xs text-red-600">{editForm.errors.stall_number}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <Label htmlFor="e-store-name" className="text-xs font-semibold text-gray-700">
                                        Store Name <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="e-store-name"
                                        value={editForm.data.store_name}
                                        onChange={(e) => editForm.setData('store_name', e.target.value)}
                                        className={`mt-1 h-9 ${editForm.errors.store_name ? 'border-red-400 bg-red-50/30' : ''}`}
                                    />
                                    {editForm.errors.store_name && (
                                        <p className="mt-1 text-xs text-red-600">{editForm.errors.store_name}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="e-vendor" className="text-xs font-semibold text-gray-700">
                                        Assigned Vendor
                                    </Label>
                                    <select
                                        id="e-vendor"
                                        value={editForm.data.vendor_id}
                                        onChange={(e) => {
                                            const vId = e.target.value;
                                            editForm.setData('vendor_id', vId);
                                            if (vId) {
                                                editForm.setData('status', 'occupied');
                                                const vendorObj = vendors.find((v) => String(v.id) === vId);
                                                if (vendorObj && !editForm.data.store_name) {
                                                    const match = vendorObj.name.match(/\((.*?)\)/);
                                                    editForm.setData('store_name', match ? match[1] : vendorObj.name);
                                                }
                                            } else {
                                                editForm.setData('status', 'vacant');
                                            }
                                        }}
                                        className={`mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562] ${
                                            editForm.errors.vendor_id
                                                ? 'border-red-400 bg-red-50/30'
                                                : 'border-gray-200'
                                        }`}
                                    >
                                        <option value="">No vendor assigned (Vacant stall)</option>
                                        {vendors.map((v) => (
                                            <option key={v.id} value={String(v.id)}>
                                                {v.name}
                                            </option>
                                        ))}
                                    </select>
                                    {editForm.errors.vendor_id && (
                                        <p className="mt-1 text-xs text-red-600">{editForm.errors.vendor_id}</p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div>
                                    <Label htmlFor="e-status" className="text-xs font-semibold text-gray-700">
                                        Status <span className="text-red-500">*</span>
                                    </Label>
                                    <select
                                        id="e-status"
                                        value={editForm.data.status}
                                        onChange={(e) => editForm.setData('status', e.target.value)}
                                        className={`mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562] ${
                                            editForm.errors.status
                                                ? 'border-red-400 bg-red-50/30'
                                                : 'border-gray-200'
                                        }`}
                                    >
                                        {statuses.map((s) => (
                                            <option key={s.value} value={s.value}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                    {editForm.errors.status && (
                                        <p className="mt-1 text-xs text-red-600">{editForm.errors.status}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="e-size" className="text-xs font-semibold text-gray-700">
                                        Size <span className="text-red-500">*</span>
                                    </Label>
                                    <select
                                        id="e-size"
                                        value={editForm.data.size}
                                        onChange={(e) => {
                                            const nextSize = e.target.value;
                                            editForm.setData((prev) => ({
                                                ...prev,
                                                size: nextSize,
                                                monthly_rent: getRentForSize(nextSize),
                                            }));
                                        }}
                                        className={`mt-1 h-9 w-full rounded-lg border bg-white px-3 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562] ${
                                            editForm.errors.size
                                                ? 'border-red-400 bg-red-50/30'
                                                : 'border-gray-200'
                                        }`}
                                    >
                                        {sizes.map((s) => (
                                            <option key={s.value} value={s.value}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </select>
                                    {editForm.errors.size && (
                                        <p className="mt-1 text-xs text-red-600">{editForm.errors.size}</p>
                                    )}
                                </div>

                                <div>
                                    <Label htmlFor="e-rent" className="text-xs font-semibold text-gray-700">
                                        Rent / Month (₱) <span className="text-[10px] font-medium text-[#488562]">(Auto)</span>
                                    </Label>
                                    <Input
                                        id="e-rent"
                                        type="text"
                                        readOnly
                                        tabIndex={-1}
                                        aria-readonly="true"
                                        value={Number(editForm.data.monthly_rent || 0).toLocaleString('en-PH', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                        className={`mt-1 h-9 cursor-not-allowed bg-gray-100 font-semibold text-gray-700 select-none focus-visible:ring-0 ${editForm.errors.monthly_rent ? 'border-red-400 bg-red-50/30' : ''}`}
                                    />
                                    {editForm.errors.monthly_rent && (
                                        <p className="mt-1 text-xs text-red-600">{editForm.errors.monthly_rent}</p>
                                    )}
                                </div>
                            </div>

                            {/* Stall Image / Photo (Optional) */}
                            <div>
                                <Label htmlFor="e-image" className="text-xs font-semibold text-gray-700">
                                    Stall Photo (Optional)
                                </Label>
                                <div className="mt-1 flex items-center gap-3">
                                    {editImagePreview ? (
                                        <div className="relative h-14 w-14 rounded-lg overflow-hidden border border-gray-200 shrink-0">
                                            <img
                                                src={editImagePreview}
                                                alt="Preview"
                                                className="h-full w-full object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    editForm.setData('image', null);
                                                    setEditImagePreview(null);
                                                }}
                                                className="absolute top-0.5 right-0.5 rounded-full bg-red-600 p-0.5 text-white shadow hover:bg-red-700"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-gray-400 shrink-0">
                                            <Store className="h-6 w-6" />
                                        </div>
                                    )}
                                    <input
                                        id="e-image"
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0] || null;
                                            editForm.setData('image', file);
                                            if (file) {
                                                setEditImagePreview(URL.createObjectURL(file));
                                            } else {
                                                setEditImagePreview(
                                                    editingStall?.image ? `/storage/${editingStall.image}` : null
                                                );
                                            }
                                        }}
                                        className="text-xs file:mr-2 file:rounded-md file:border-0 file:bg-[#488562]/10 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-[#488562] hover:file:bg-[#488562]/20"
                                    />
                                </div>
                                {editForm.errors.image && (
                                    <p className="mt-1 text-xs text-red-600">{editForm.errors.image}</p>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="e-desc" className="text-xs font-semibold text-gray-700">
                                    Description (Optional)
                                </Label>
                                <textarea
                                    id="e-desc"
                                    value={editForm.data.description}
                                    onChange={(e) => editForm.setData('description', e.target.value)}
                                    rows={2}
                                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562] ${
                                        editForm.errors.description
                                            ? 'border-red-400 bg-red-50/30'
                                            : 'border-gray-200'
                                    }`}
                                />
                                {editForm.errors.description && (
                                    <p className="mt-1 text-xs text-red-600">{editForm.errors.description}</p>
                                )}
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="e-active"
                                    checked={editForm.data.is_active}
                                    onChange={(e) => editForm.setData('is_active', e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-[#488562] focus:ring-[#488562]"
                                />
                                <Label htmlFor="e-active" className="text-xs font-medium text-gray-700 cursor-pointer">
                                    Stall is active and visible to market customers
                                </Label>
                            </div>

                            <DialogFooter className="gap-2 border-t border-gray-100 pt-3">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => {
                                        setEditOpen(false);
                                        editForm.clearErrors();
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={editForm.processing}
                                    className="gap-1.5 bg-[#488562] hover:bg-[#3a6e50] text-white"
                                >
                                    {editForm.processing ? (
                                        <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Updating Stall...
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="h-4 w-4" />
                                            Update Stall
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                            <Store className="h-5 w-5 text-gray-600" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Total Stalls
                            </div>
                            <div className="text-xl font-bold text-gray-900">{stats.total}</div>
                        </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#488562]/10">
                            <CheckCircle2 className="h-5 w-5 text-[#488562]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Occupied
                            </div>
                            <div className="text-xl font-bold text-[#488562]">{stats.occupied}</div>
                        </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0867ff]/10">
                            <Box className="h-5 w-5 text-[#0867ff]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Vacant
                            </div>
                            <div className="text-xl font-bold text-[#0867ff]">{stats.vacant}</div>
                        </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ee600e]/10">
                            <Wrench className="h-5 w-5 text-[#ee600e]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Maintenance
                            </div>
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
                            placeholder="Search stalls..."
                            className="h-8 w-44 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-[#488562] focus:outline-none focus:ring-1 focus:ring-[#488562]"
                        />
                    </form>

                    <ChipSelect
                        label="Section"
                        value={filters.section}
                        options={sections}
                        onChange={(v) => applyFilter('section', v)}
                    />
                    <ChipSelect
                        label="Status"
                        value={filters.status}
                        options={statuses}
                        onChange={(v) => applyFilter('status', v)}
                    />
                    <ChipSelect
                        label="Size"
                        value={filters.size}
                        options={sizes}
                        onChange={(v) => applyFilter('size', v)}
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
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        #
                                    </th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        Section
                                    </th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        Stall No.
                                    </th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        Store Name
                                    </th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        Vendor
                                    </th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        Status
                                    </th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        Size
                                    </th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        Rent/mo
                                    </th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        Description
                                    </th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        Active
                                    </th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                        Actions
                                    </th>
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
                                        <tr
                                            key={stall.id}
                                            className="group transition hover:bg-[#488562]/[0.02]"
                                        >
                                            <td className="px-4 py-2.5 text-xs text-gray-400">
                                                {(stalls.current_page - 1) * stalls.per_page + idx + 1}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <SectionBadge stall={stall} />
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-800">
                                                    <MapPin className="h-3 w-3 text-gray-400" />
                                                    {stall.stall_number}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-xs font-medium text-gray-900">
                                                {stall.store_name}
                                            </td>
                                            <td className="px-4 py-2.5 text-xs text-gray-500">
                                                {stall.vendor?.name ?? (
                                                    <span className="italic text-gray-300">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <StatusBadge status={stall.status} />
                                            </td>
                                            <td className="px-4 py-2.5">
                                                <SizeBadge size={stall.size} />
                                            </td>
                                            <td className="px-4 py-2.5 text-xs font-semibold text-gray-800">
                                                &#8369;{Number(stall.monthly_rent).toLocaleString()}
                                            </td>
                                            <td className="max-w-[160px] truncate px-4 py-2.5 text-[11px] text-gray-400">
                                                {stall.description || '—'}
                                            </td>
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
                                                <div className="flex items-center gap-1 text-gray-400">
                                                    <button
                                                        onClick={() => handleEditStall(stall)}
                                                        title="Edit Stall"
                                                        className="rounded p-1.5 text-gray-500 hover:bg-[#488562]/10 hover:text-[#488562] transition"
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteStall(stall.id)}
                                                        title="Delete Stall"
                                                        className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition"
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
                                {(stalls.current_page - 1) * stalls.per_page + 1}–
                                {Math.min(stalls.current_page * stalls.per_page, stalls.total)} of {stalls.total}
                            </span>
                            <div className="flex gap-0.5">
                                {stalls.links.map((link, i) => (
                                    <button
                                        key={i}
                                        disabled={!link.url}
                                        onClick={() =>
                                            link.url &&
                                            router.get(link.url, {}, { preserveState: true, preserveScroll: true })
                                        }
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
            className={`h-8 cursor-pointer rounded-lg border px-3 text-[11px] font-medium transition focus:outline-none focus:ring-1 focus:ring-[#488562] ${
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
        router.put(
            `/admin/dashboard/vendors/sections/${editingId}`,
            {
                name: editName,
                color: editColor,
                is_active: true,
            },
            {
                preserveScroll: true,
                preserveState: true,
                onSuccess: () => {
                    setEditingId(null);
                    toast.success('Section updated successfully');
                },
                onError: () => toast.error('Failed to update section'),
            }
        );
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
                <Button variant="outline" className="gap-1.5 text-xs shadow-sm">
                    <Layers className="h-3.5 w-3.5 text-gray-500" />
                    Sections
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader className="border-b border-gray-100 pb-3">
                    <DialogTitle className="flex items-center gap-2 text-base font-bold text-gray-900">
                        <Layers className="h-4 w-4 text-[#488562]" />
                        Manage Market Sections
                    </DialogTitle>
                    <DialogDescription className="text-xs text-gray-500">
                        Create, edit, or configure market sections and their color tags.
                    </DialogDescription>
                </DialogHeader>

                {/* Existing sections */}
                <div className="mt-3 space-y-2">
                    {sections.length === 0 ? (
                        <p className="text-sm text-gray-400 py-3 text-center">No sections configured yet.</p>
                    ) : (
                        sections.map((section) => (
                            <div
                                key={section.value}
                                className="flex items-center gap-2 rounded-lg border border-gray-100 p-2.5 bg-gray-50/50"
                            >
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
                                        <button
                                            onClick={handleUpdate}
                                            className="rounded bg-[#488562] px-2 py-1 text-[10px] font-bold text-white hover:bg-[#3a6e50]"
                                        >
                                            Save
                                        </button>
                                        <button
                                            onClick={() => setEditingId(null)}
                                            className="rounded bg-gray-100 px-2 py-1 text-[10px] font-bold text-gray-600 hover:bg-gray-200"
                                        >
                                            Cancel
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <span
                                            className="h-4 w-4 shrink-0 rounded-full"
                                            style={{ backgroundColor: section.color ?? '#6b7280' }}
                                        />
                                        <span className="flex-1 text-sm font-medium text-gray-800">
                                            {section.label}
                                        </span>
                                        <button
                                            onClick={() => startEdit(section)}
                                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                                        >
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(section.value)}
                                            className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Create new section */}
                <form
                    onSubmit={handleCreate}
                    className="mt-4 flex items-end gap-2 border-t border-gray-100 pt-4"
                >
                    <div className="flex-1">
                        <Label className="text-[10px] uppercase tracking-wide text-gray-400 font-bold">
                            New Section Name
                        </Label>
                        <Input
                            value={newForm.data.name}
                            onChange={(e) => newForm.setData('name', e.target.value)}
                            placeholder="e.g. Vegetables & Spices"
                            className="mt-1 h-8 text-xs"
                        />
                    </div>
                    <input
                        type="color"
                        value={newForm.data.color}
                        onChange={(e) => newForm.setData('color', e.target.value)}
                        className="h-8 w-8 shrink-0 cursor-pointer rounded border border-gray-200 p-0.5"
                    />
                    <Button
                        type="submit"
                        disabled={newForm.processing || !newForm.data.name}
                        className="h-8 bg-[#488562] px-3 text-xs hover:bg-[#3a6e50] text-white"
                    >
                        Add
                    </Button>
                </form>

                <DialogFooter className="mt-4 border-t border-gray-100 pt-3">
                    <DialogClose asChild>
                        <Button variant="secondary" className="text-xs">
                            Done
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SectionBadge({ stall }: { stall: Stall }) {
    const section = stall.section_relation;
    if (!section) {
        return (
            <span className="rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-500">
                {stall.section}
            </span>
        );
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
    const config: Record<
        string,
        { bg: string; text: string; label: string; Icon: React.ComponentType<{ className?: string }> }
    > = {
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
