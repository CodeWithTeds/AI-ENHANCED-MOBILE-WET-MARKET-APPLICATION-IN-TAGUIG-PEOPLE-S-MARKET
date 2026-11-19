import { Head, router, useForm } from '@inertiajs/react';
import {
    AlertTriangle,
    CheckCircle2,
    Eye,
    History,
    Package,
    Pencil,
    Search,
    Store,
    Tag,
    ToggleLeft,
    ToggleRight,
    Trash2,
    X,
    XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState } from 'react';
import { dashboard } from '@/routes';

type Product = {
    id: number;
    name: string;
    description: string | null;
    category: string;
    unit: string;
    image: string | null;
    is_available: boolean;
    deletion_reason?: string | null;
    deleted_at?: string | null;
    deleted_by?: { id: number; name: string } | null;
    created_at: string;
    updated_at: string;
    vendor: { id: number; stall_name: string; stall_location: string; status: string } | null;
    inventory: { stock_quantity: number; reorder_level: number; status: string } | null;
};

type DeletionLog = {
    id: number;
    product_id: number | null;
    product_name: string;
    category: string | null;
    unit: string | null;
    price: number | null;
    image: string | null;
    reason: string;
    created_at: string | null;
    vendor: { id: number; stall_name: string; stall_location: string } | null;
    deleted_by: { id: number; name: string; email?: string } | null;
};

type FilterOption = { value: string; label: string };

function getCategoryFallback(category?: string | null): string {
    const raw = (category ?? '').toLowerCase().trim();
    if (/poult|chick|manok|duck|turkey/i.test(raw)) return '/images/categories/poultry.jpg';
    if (/fish|isda|bangus|tilapia|salmon/i.test(raw)) return '/images/categories/fish.jpg';
    if (/seafood|shrimp|hipon|crab|squid/i.test(raw)) return '/images/categories/seafood.jpg';
    if (/meat|beef|pork|karne|baboy|baka/i.test(raw)) return '/images/categories/meat.jpg';
    if (/veg|gulay/i.test(raw)) return '/images/categories/vegetables.jpg';
    if (/fruit|prutas/i.test(raw)) return '/images/categories/fruits.jpg';
    if (/spice|sili|chili|pepper|garlic|onion/i.test(raw)) return '/images/categories/spices.jpg';
    if (/condiment|sauce|toyo|patis|suka/i.test(raw)) return '/images/categories/condiments.jpg';
    if (/dairy|milk|cheese|egg|itlog/i.test(raw)) return '/images/categories/dairy.jpg';
    if (/grain|rice|bigas/i.test(raw)) return '/images/categories/grains.jpg';
    if (/dry/i.test(raw)) return '/images/categories/dry-ingredients.jpg';
    if (/herb/i.test(raw)) return '/images/categories/herbs.jpg';
    return '/images/categories/meat.jpg';
}

function getProductImageUrl(img: string | null | undefined): string | null {
    if (!img) return null;
    const trimmed = img.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    const clean = trimmed.replace(/^\/?(storage\/)?/, '');
    return `/storage/${clean}`;
}

function getProductPhoto(img: string | null | undefined, category?: string | null): string {
    const url = getProductImageUrl(img);
    return url || getCategoryFallback(category);
}

type Props = {
    products: {
        data: Product[];
        current_page: number;
        last_page: number;
        total: number;
        per_page: number;
        links: { url: string | null; label: string; active: boolean }[];
    };
    stats: {
        total: number;
        available: number;
        unavailable: number;
        deleted?: number;
        categories: number;
        vendors: number;
    };
    filters: Record<string, string | undefined>;
    categories: FilterOption[];
    vendors: FilterOption[];
    statuses: FilterOption[];
    units: FilterOption[];
    deletion_logs?: DeletionLog[];
};

export default function ProductManagementIndex({
    products,
    stats,
    filters,
    categories,
    vendors,
    statuses,
    deletion_logs = [],
}: Props) {
    const [search, setSearch] = useState(filters.search ?? '');
    const [viewProduct, setViewProduct] = useState<Product | null>(null);
    const [editProduct, setEditProduct] = useState<Product | null>(null);
    const [deleteProduct, setDeleteProduct] = useState<Product | null>(null);
    const [showHistoryModal, setShowHistoryModal] = useState(false);

    function applyFilter(key: string, value: string | undefined) {
        router.get(
            '/admin/dashboard/products',
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
        router.get('/admin/dashboard/products', {}, { preserveState: true });
        setSearch('');
    }

    function handleToggle(product: Product) {
        const action = product.is_available ? 'make unavailable' : 'make available';
        if (confirm(`Are you sure you want to ${action} "${product.name}"?`)) {
            router.patch(`/admin/dashboard/products/${product.id}/toggle`, {}, { preserveScroll: true });
        }
    }

    const hasActiveFilters = filters.search || filters.category || filters.vendor || filters.status || filters.availability || filters.view;

    return (
        <>
            <Head title="Product Management" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-5">
                {/* Header */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Product Management</h1>
                        <p className="text-sm text-gray-500">
                            Oversee all products sold by vendors — review, edit, or remove prohibited items with vendor notification
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setShowHistoryModal(true)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
                        >
                            <History className="h-4 w-4 text-[#488562]" />
                            <span>Deletion Audit Logs ({deletion_logs.length})</span>
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-6">
                    <StatCard icon={Package} label="Total Active" value={stats.total} color="#6b7280" sub={`${stats.categories} categories`} />
                    <StatCard icon={CheckCircle2} label="Available" value={stats.available} color="#488562" sub="Visible to buyers" />
                    <StatCard icon={XCircle} label="Unavailable" value={stats.unavailable} color="#f59e0b" sub="Temporarily hidden" />
                    <div
                        onClick={() => applyFilter('status', filters.status === 'deleted' ? undefined : 'deleted')}
                        className={`cursor-pointer transition hover:opacity-90 ${filters.status === 'deleted' ? 'ring-2 ring-red-500 rounded-2xl' : ''}`}
                    >
                        <StatCard
                            icon={Trash2}
                            label="Removed by Admin"
                            value={stats.deleted ?? 0}
                            color="#dc2626"
                            sub={filters.status === 'deleted' ? 'Filter active (click to reset)' : 'With recorded reason'}
                        />
                    </div>
                    <StatCard icon={Tag} label="Categories" value={stats.categories} color="#0867ff" sub="Product types" />
                    <StatCard icon={Store} label="Vendors" value={stats.vendors} color="#ee600e" sub="With products" />
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    <form onSubmit={handleSearch} className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search product, category, vendor..."
                            className="h-8 w-56 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-[#488562] focus:ring-1 focus:ring-[#488562] focus:outline-none"
                        />
                    </form>

                    <ChipSelect label="Category" value={filters.category} options={categories} onChange={(v) => applyFilter('category', v)} />
                    <ChipSelect label="Vendor" value={filters.vendor} options={vendors} onChange={(v) => applyFilter('vendor', v)} />
                    <ChipSelect
                        label="Status"
                        value={filters.status || filters.availability}
                        options={statuses}
                        onChange={(v) => applyFilter('status', v)}
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
                                        Product
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Category
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Vendor
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase">
                                        Updated
                                    </th>
                                    <th className="px-4 py-3 text-xs font-bold tracking-wider whitespace-nowrap text-gray-400 uppercase text-right">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {products.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-16 text-center text-base text-gray-400">
                                            <Package className="mx-auto mb-2 h-10 w-10 text-gray-300" />
                                            No products found.
                                        </td>
                                    </tr>
                                ) : (
                                    products.data.map((product) => {
                                        const isDeleted = Boolean(product.deleted_at);

                                        return (
                                            <tr key={product.id} className={`transition ${isDeleted ? 'bg-red-50/20 hover:bg-red-50/40' : 'hover:bg-gray-50/70'}`}>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <img
                                                            src={getProductPhoto(product.image, product.category)}
                                                            alt={product.name}
                                                            className="h-10 w-10 rounded-lg object-cover border"
                                                            onError={(e) => {
                                                                const fallback = getCategoryFallback(product.category);
                                                                if (e.currentTarget.src !== fallback && !e.currentTarget.src.endsWith(fallback)) {
                                                                    e.currentTarget.src = fallback;
                                                                }
                                                            }}
                                                        />
                                                        <div>
                                                            <div className="font-semibold text-gray-900">{product.name}</div>
                                                            <div className="text-xs text-gray-400">per {product.unit}</div>
                                                            {isDeleted && product.deletion_reason && (
                                                                <div className="text-[11px] font-medium text-red-600 truncate max-w-xs mt-0.5" title={product.deletion_reason}>
                                                                    Reason: {product.deletion_reason}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-600 capitalize">
                                                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                                                        {product.category}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-xs">
                                                    <div className="font-medium text-gray-800">{product.vendor?.stall_name ?? '—'}</div>
                                                    <div className="text-gray-400">{product.vendor?.stall_location ?? '—'}</div>
                                                </td>
                                                <td className="px-4 py-3 text-xs">
                                                    {isDeleted ? (
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">
                                                            <Trash2 className="h-3 w-3" />
                                                            Removed by Admin
                                                        </span>
                                                    ) : product.is_available ? (
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">
                                                            <CheckCircle2 className="h-3 w-3" />
                                                            Available
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">
                                                            <XCircle className="h-3 w-3" />
                                                            Unavailable
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-xs text-gray-400">
                                                    {formatDate(product.deleted_at ?? product.updated_at)}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="inline-flex items-center gap-1">
                                                        <button
                                                            onClick={() => setViewProduct(product)}
                                                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
                                                            title="View Details"
                                                        >
                                                            <Eye className="h-3.5 w-3.5" />
                                                        </button>
                                                        {!isDeleted && (
                                                            <>
                                                                <button
                                                                    onClick={() => setEditProduct(product)}
                                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-[#0867ff] transition hover:bg-blue-50"
                                                                    title="Edit"
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleToggle(product)}
                                                                    className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition ${
                                                                        product.is_available
                                                                            ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                                                            : 'border-[#488562]/20 bg-[#488562]/10 text-[#488562] hover:bg-[#488562]/20'
                                                                    }`}
                                                                    title={product.is_available ? 'Make unavailable' : 'Make available'}
                                                                >
                                                                    {product.is_available ? <ToggleLeft className="h-3.5 w-3.5" /> : <ToggleRight className="h-3.5 w-3.5" />}
                                                                </button>
                                                                <button
                                                                    onClick={() => setDeleteProduct(product)}
                                                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100"
                                                                    title="Delete Product (Reason Required)"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {products.last_page > 1 && (
                        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
                            <span className="text-sm text-gray-500">
                                {(products.current_page - 1) * products.per_page + 1}–
                                {Math.min(products.current_page * products.per_page, products.total)} of {products.total}
                            </span>
                            <div className="flex gap-1">
                                {products.links.map((link, i) => (
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
                        Showing {products.data.length} of {products.total} items
                    </span>
                    <span>15 per page · Product removals record reasons and automatically notify affected vendors</span>
                </div>
            </div>

            {/* View Dialog */}
            {viewProduct && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewProduct(null)}>
                    <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                            <div className="flex items-center gap-3">
                                <img
                                    src={getProductPhoto(viewProduct.image, viewProduct.category)}
                                    alt={viewProduct.name}
                                    className="h-10 w-10 rounded-lg object-cover border"
                                    onError={(e) => {
                                        const fallback = getCategoryFallback(viewProduct.category);
                                        if (e.currentTarget.src !== fallback && !e.currentTarget.src.endsWith(fallback)) {
                                            e.currentTarget.src = fallback;
                                        }
                                    }}
                                />
                                <div>
                                    <h3 className="text-sm font-bold text-gray-900">{viewProduct.name}</h3>
                                    <p className="text-xs text-gray-500">
                                        {viewProduct.category} · per {viewProduct.unit}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setViewProduct(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="space-y-3 px-6 py-4">
                            {/* Deletion Notice Callout if deleted */}
                            {viewProduct.deletion_reason && (
                                <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 space-y-1.5">
                                    <div className="flex items-center gap-2 text-xs font-bold text-red-800">
                                        <AlertTriangle className="h-4 w-4 text-red-600" />
                                        <span>Product Removed by Administrator</span>
                                    </div>
                                    <div className="rounded-lg bg-white/70 p-2 text-xs border border-red-100">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-red-700">
                                            Reason for Removal:
                                        </div>
                                        <p className="text-red-900 mt-0.5 leading-relaxed font-medium">
                                            {viewProduct.deletion_reason}
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-between text-[11px] text-red-700 pt-1">
                                        <span>Action by: <strong>{viewProduct.deleted_by?.name ?? 'Admin Officer'}</strong></span>
                                        {viewProduct.deleted_at && <span>{formatDate(viewProduct.deleted_at)}</span>}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-3 gap-3">
                                <DetailBox label="Category" value={viewProduct.category} color="#0867ff" />
                                <DetailBox label="Unit" value={viewProduct.unit} color="#6b7280" />
                                <DetailBox
                                    label="Status"
                                    value={viewProduct.deleted_at ? 'Removed' : viewProduct.is_available ? 'Available' : 'Unavailable'}
                                    color={viewProduct.deleted_at ? '#dc2626' : viewProduct.is_available ? '#488562' : '#f59e0b'}
                                />
                            </div>
                            {viewProduct.description && (
                                <div className="rounded-xl bg-gray-50 p-3">
                                    <div className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Description</div>
                                    <p className="mt-1 text-xs leading-relaxed text-gray-700">{viewProduct.description}</p>
                                </div>
                            )}
                            <div className="rounded-xl bg-gray-50 p-3 text-xs space-y-2">
                                <Row label="Vendor" value={viewProduct.vendor?.stall_name ?? '—'} />
                                <Row label="Location" value={viewProduct.vendor?.stall_location ?? '—'} />
                                <Row label="Vendor Status" value={viewProduct.vendor?.status ?? '—'} />
                                <Row label="Created" value={formatDate(viewProduct.created_at)} />
                                <Row label="Updated" value={formatDate(viewProduct.updated_at)} />
                                <Row label="Product ID" value={`#${viewProduct.id}`} />
                            </div>
                            {!viewProduct.is_available && !viewProduct.deleted_at && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 flex gap-2">
                                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                                    <div className="text-xs">
                                        <div className="font-bold text-amber-800">Unavailable</div>
                                        <p className="text-amber-700/80">This product is hidden from the marketplace and cannot be ordered.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-3">
                            {!viewProduct.deleted_at && (
                                <button
                                    onClick={() => {
                                        setViewProduct(null);
                                        setEditProduct(viewProduct);
                                    }}
                                    className="rounded-lg bg-[#0867ff] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                                >
                                    Edit Product
                                </button>
                            )}
                            <button
                                onClick={() => setViewProduct(null)}
                                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Dialog */}
            {editProduct && (
                <EditModal product={editProduct} onClose={() => setEditProduct(null)} categories={categories} units={[]} />
            )}

            {/* Delete Confirmation & Reason Modal */}
            {deleteProduct && (
                <DeleteModal
                    product={deleteProduct}
                    onClose={() => setDeleteProduct(null)}
                />
            )}

            {/* Deletion History & Audit Log Modal */}
            {showHistoryModal && (
                <DeletionHistoryModal
                    logs={deletion_logs}
                    onClose={() => setShowHistoryModal(false)}
                />
            )}
        </>
    );
}

ProductManagementIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Product Management', href: '/admin/dashboard/products' },
    ],
};

/* ─── Delete Reason Modal (Item 16) ─── */
function DeleteModal({
    product,
    onClose,
}: {
    product: Product;
    onClose: () => void;
}) {
    const { data, setData, delete: destroy, processing, errors, reset } = useForm({
        reason: '',
    });

    const commonReasons = [
        'Prohibited or restricted item under market regulations',
        'Misleading product description, photo, or pricing',
        'Expired product or sanitary / health inspection violation',
        'Duplicate listing or miscategorized item',
        'Vendor stall policy non-compliance',
    ];

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (data.reason.trim().length < 5) return;

        destroy(`/admin/dashboard/products/${product.id}`, {
            preserveScroll: true,
            onSuccess: () => {
                reset();
                onClose();
            },
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
                            <Trash2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-gray-900">Remove Vendor Product</h3>
                            <p className="text-xs text-gray-500">Provide an administrative deletion reason</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 px-6 py-4">
                        {/* Product Summary */}
                        <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-3">
                            <img
                                src={getProductPhoto(product.image, product.category)}
                                alt={product.name}
                                className="h-12 w-12 rounded-lg object-cover border"
                                onError={(e) => {
                                    const fallback = getCategoryFallback(product.category);
                                    if (e.currentTarget.src !== fallback && !e.currentTarget.src.endsWith(fallback)) {
                                        e.currentTarget.src = fallback;
                                    }
                                }}
                            />
                            <div className="min-w-0 flex-1">
                                <h4 className="text-sm font-bold text-gray-900 truncate">{product.name}</h4>
                                <p className="text-xs text-gray-500">
                                    {product.category} · per {product.unit}
                                </p>
                                <p className="text-xs font-medium text-[#488562] mt-0.5">
                                    {product.vendor?.stall_name ?? 'Vendor Stall'} ({product.vendor?.stall_location ?? 'Market'})
                                </p>
                            </div>
                        </div>

                        {/* Transparency Notice */}
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                                <div className="space-y-1">
                                    <span className="font-bold text-amber-900">Reason Required & Sent to Vendor</span>
                                    <p className="text-amber-800 leading-relaxed">
                                        The reason you specify below will be permanently recorded in the system audit logs and automatically sent as an in-app notification to the vendor so they understand why their product was removed.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Common Reason Presets */}
                        <div>
                            <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                                Quick Reason Presets
                            </label>
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                                {commonReasons.map((preset) => (
                                    <button
                                        type="button"
                                        key={preset}
                                        onClick={() => setData('reason', preset)}
                                        className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-600 transition hover:border-[#488562] hover:bg-emerald-50 hover:text-[#488562]"
                                    >
                                        + {preset}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Reason Textarea */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-xs font-bold text-gray-700">
                                    Specific Reason for Deletion <span className="text-red-500">*</span>
                                </label>
                                <span className={`text-[11px] ${data.reason.length < 5 ? 'text-gray-400' : 'text-[#488562] font-medium'}`}>
                                    {data.reason.length} / 1000 (min 5)
                                </span>
                            </div>
                            <textarea
                                value={data.reason}
                                onChange={(e) => setData('reason', e.target.value)}
                                placeholder="Explain specifically why this product is being deleted (e.g., Expired goods reported, violates market sanitation standards, misleading photo)..."
                                rows={3}
                                className="w-full rounded-xl border border-gray-200 p-3 text-xs leading-relaxed text-gray-800 placeholder:text-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none"
                            />
                            {errors.reason && <p className="mt-1 text-xs text-red-600">{errors.reason}</p>}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-3 bg-gray-50/50 rounded-b-2xl">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing || data.reason.trim().length < 5}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                            {processing ? 'Removing & Notifying...' : 'Delete Product & Notify Vendor'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/* ─── Deletion Audit Logs Modal ─── */
function DeletionHistoryModal({
    logs,
    onClose,
}: {
    logs: DeletionLog[];
    onClose: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                    <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
                            <History className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-gray-900">Product Deletion Audit Logs</h3>
                            <p className="text-xs text-gray-500">History of products removed by market administrators and notifications sent</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                    {logs.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <Package className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                            <p className="text-sm font-medium">No product deletion records found.</p>
                            <p className="text-xs mt-1">When administrators delete vendor products with reasons, records appear here.</p>
                        </div>
                    ) : (
                        logs.map((log) => (
                            <div key={log.id} className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-gray-900">{log.product_name}</span>
                                            {log.category && (
                                                <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                                                    {log.category}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-[#488562] font-medium mt-0.5">
                                            {log.vendor?.stall_name ?? 'Vendor'} {log.vendor?.stall_location ? `· ${log.vendor.stall_location}` : ''}
                                        </p>
                                    </div>
                                    <span className="text-[11px] text-gray-400 whitespace-nowrap">
                                        {log.created_at ? formatDate(log.created_at) : '—'}
                                    </span>
                                </div>

                                <div className="rounded-lg border border-red-100 bg-red-50/60 p-2.5 text-xs">
                                    <div className="font-semibold text-red-800 text-[11px] uppercase tracking-wider mb-0.5">
                                        Deletion Reason:
                                    </div>
                                    <p className="text-red-900 leading-relaxed">{log.reason}</p>
                                </div>

                                <div className="flex items-center justify-between text-[11px] text-gray-400 pt-1 border-t border-gray-100">
                                    <span>Removed by: <strong className="text-gray-600">{log.deleted_by?.name ?? 'Admin'}</strong></span>
                                    <span>Vendor notified via in-app alert</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="flex justify-end border-t border-gray-100 px-6 py-3 bg-gray-50 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ─── Edit Modal ─── */
function EditModal({ product, onClose, categories }: { product: Product; onClose: () => void; categories: FilterOption[]; units: FilterOption[] }) {
    const { data, setData, post, processing, errors } = useForm({
        name: product.name,
        description: product.description ?? '',
        category: product.category,
        unit: product.unit,
        is_available: product.is_available ? 1 : 0,
        image: null as File | null,
        _method: 'PUT' as const,
    });

    const [preview, setPreview] = useState<string | null>(getProductPhoto(product.image, product.category));

    function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0] ?? null;
        setData('image', file as never);
        if (file) {
            setPreview(URL.createObjectURL(file));
        } else {
            setPreview(getProductPhoto(product.image, product.category));
        }
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        post(`/admin/dashboard/products/${product.id}`, {
            onSuccess: () => onClose(),
            preserveScroll: true,
            forceFormData: true,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
                    <h3 className="text-sm font-bold text-gray-900">Edit Product — {product.name}</h3>
                    <button onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
                    <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                        <img
                            src={preview || getCategoryFallback(product.category)}
                            alt={product.name}
                            className="h-12 w-12 rounded-lg object-cover border"
                            onError={(e) => {
                                const fallback = getCategoryFallback(product.category);
                                if (e.currentTarget.src !== fallback && !e.currentTarget.src.endsWith(fallback)) {
                                    e.currentTarget.src = fallback;
                                }
                            }}
                        />
                        <div className="text-xs">
                            <div className="font-medium text-gray-900">ID #{product.id}</div>
                            <div className="text-gray-500">{product.vendor?.stall_name ?? 'No vendor'}</div>
                        </div>
                        <div className="ml-auto">
                            {product.is_available ? (
                                <span className="rounded-md bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Available</span>
                            ) : (
                                <span className="rounded-md bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">Unavailable</span>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Product Name *</label>
                        <input
                            type="text"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#488562] focus:ring-1 focus:ring-[#488562] focus:outline-none"
                        />
                        {errors.name && <p className="mt-1 text-[11px] text-red-500">{errors.name}</p>}
                    </div>

                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Description</label>
                        <textarea
                            value={data.description}
                            onChange={(e) => setData('description', e.target.value)}
                            rows={3}
                            placeholder="Product description (max 1000 chars)"
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#488562] focus:ring-1 focus:ring-[#488562] focus:outline-none"
                        />
                        {errors.description && <p className="mt-1 text-[11px] text-red-500">{errors.description}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Category *</label>
                            <input
                                type="text"
                                list="admin-categories"
                                value={data.category}
                                onChange={(e) => setData('category', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-[#488562] focus:ring-1 focus:ring-[#488562] focus:outline-none"
                                placeholder="e.g. vegetables"
                            />
                            <datalist id="admin-categories">
                                {categories.map((c) => (
                                    <option key={c.value} value={c.value} />
                                ))}
                            </datalist>
                            {errors.category && <p className="mt-1 text-[11px] text-red-500">{errors.category}</p>}
                        </div>
                        <div>
                            <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Unit *</label>
                            <select
                                value={data.unit}
                                onChange={(e) => setData('unit', e.target.value)}
                                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562] focus:outline-none"
                            >
                                <option value="kg">kg</option>
                                <option value="g">g</option>
                                <option value="pcs">pcs</option>
                                <option value="bundle">bundle</option>
                                <option value="pack">pack</option>
                                <option value="L">L</option>
                                <option value="ml">ml</option>
                                <option value="box">box</option>
                                <option value="sack">sack</option>
                            </select>
                            {errors.unit && <p className="mt-1 text-[11px] text-red-500">{errors.unit}</p>}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Availability *</label>
                        <select
                            value={String(data.is_available)}
                            onChange={(e) => setData('is_available', Number(e.target.value) as never)}
                            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-[#488562] focus:ring-1 focus:ring-[#488562] focus:outline-none"
                        >
                            <option value="1">Available — Visible</option>
                            <option value="0">Unavailable — Hidden</option>
                        </select>
                        {errors.is_available && <p className="mt-1 text-[11px] text-red-500">{errors.is_available}</p>}
                    </div>

                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Product Image</label>
                        <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/jpg"
                            onChange={handleImageChange}
                            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-gray-900 file:px-3 file:py-1 file:text-xs file:font-medium file:text-white hover:file:bg-black"
                        />
                        {errors.image && <p className="mt-1 text-[11px] text-red-500">{errors.image}</p>}
                        <p className="mt-1 text-[11px] text-gray-400">Leave blank to keep current image. Max 3MB, JPG/PNG/WEBP.</p>
                    </div>

                    <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-3 flex gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                        <p className="text-[11px] leading-relaxed text-amber-800">
                            As admin, you can edit or remove any product that violates policy. Changes are immediate and visible to customers.
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
function StatCard({
    icon: Icon,
    label,
    value,
    color,
    sub,
}: {
    icon: LucideIcon;
    label: string;
    value: number;
    color: string;
    sub?: string;
}) {
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
                {sub && <div className="text-[11px] text-gray-400">{sub}</div>}
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
