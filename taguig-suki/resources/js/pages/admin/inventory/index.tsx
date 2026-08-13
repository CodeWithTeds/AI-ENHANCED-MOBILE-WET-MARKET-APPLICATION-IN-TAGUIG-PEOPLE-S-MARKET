import { Head, router } from '@inertiajs/react';
import {
    AlertTriangle,
    Box,
    CheckCircle2,
    Package,
    Store,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { dashboard } from '@/routes';

type InventoryItem = {
    id: number;
    status: string;
    stock_quantity: number;
    reorder_level: number;
    max_stock_level: number;
    cost_price: string;
    selling_price: string;
    profit_per_unit: number | null;
    inventory_value: number | null;
    stock_status: 'in' | 'low' | 'out';
    product: {
        id: number;
        name: string;
        category: string;
        unit: string;
        price: string;
        image: string | null;
        is_available: boolean;
    };
    vendor: {
        id: number;
        stall_name: string;
        stall_location: string;
    };
};

type FilterOption = { value: string; label: string };

type Props = {
    inventories: {
        data: InventoryItem[];
        current_page: number;
        last_page: number;
        total: number;
        per_page: number;
        links: { url: string | null; label: string; active: boolean }[];
    };
    stats: {
        total: number;
        in_stock: number;
        low_stock: number;
        out_of_stock: number;
        total_value: number;
        vendor_count: number;
    };
    filters: Record<string, string | undefined>;
    stock_statuses: FilterOption[];
    categories: FilterOption[];
    vendors: FilterOption[];
};

export default function InventoryIndex({ inventories, stats, filters, stock_statuses, categories, vendors }: Props) {
    const [search, setSearch] = useState(filters.search ?? '');

    function applyFilter(key: string, value: string | undefined) {
        router.get('/admin/dashboard/inventory', {
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
        router.get('/admin/dashboard/inventory', {}, { preserveState: true });
        setSearch('');
    }

    const hasActiveFilters = filters.search || filters.stock_status || filters.category || filters.vendor;

    return (
        <>
            <Head title="Inventory Monitoring" />
            <div className="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">Inventory Monitoring</h1>
                        <p className="text-xs text-gray-500">Inventory levels and product availability across all vendors</p>
                    </div>
                    <div className="rounded-xl bg-[#0867ff]/10 px-3 py-2 text-right">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-[#0867ff]">Inventory Value</div>
                        <div className="text-lg font-bold text-[#0867ff]">&#8369;{stats.total_value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100">
                            <Package className="h-5 w-5 text-gray-600" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Total Items</div>
                            <div className="text-xl font-bold text-gray-900">{stats.total}</div>
                            <div className="text-[11px] text-gray-400">{stats.vendor_count} vendors</div>
                        </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#488562]/10">
                            <CheckCircle2 className="h-5 w-5 text-[#488562]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">In Stock</div>
                            <div className="text-xl font-bold text-[#488562]">{stats.in_stock}</div>
                        </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ee600e]/10">
                            <AlertTriangle className="h-5 w-5 text-[#ee600e]" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Low Stock</div>
                            <div className="text-xl font-bold text-[#ee600e]">{stats.low_stock}</div>
                        </div>
                    </div>
                    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50">
                            <X className="h-5 w-5 text-red-500" />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Out of Stock</div>
                            <div className="text-xl font-bold text-red-500">{stats.out_of_stock}</div>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                    <form onSubmit={handleSearch} className="relative">
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search product or vendor..."
                            className="h-8 w-48 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-[#488562] focus:outline-none focus:ring-1 focus:ring-[#488562]"
                        />
                    </form>

                    <ChipSelect label="Stock Status" value={filters.stock_status} options={stock_statuses} onChange={(v) => applyFilter('stock_status', v)} />
                    <ChipSelect label="Category" value={filters.category} options={categories} onChange={(v) => applyFilter('category', v)} />
                    <ChipSelect label="Vendor" value={filters.vendor} options={vendors} onChange={(v) => applyFilter('vendor', v)} />

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
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Product</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Category</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Vendor</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Price</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Stock</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Reorder</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Inventory Value</th>
                                    <th className="whitespace-nowrap px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Available</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {inventories.data.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="px-4 py-16 text-center text-sm text-gray-400">
                                            <Box className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                                            No inventory found.
                                        </td>
                                    </tr>
                                ) : (
                                    inventories.data.map((item, idx) => (
                                        <tr key={item.id} className="group transition hover:bg-[#488562]/[0.02]">
                                            <td className="px-4 py-2.5 text-xs text-gray-400">{(inventories.current_page - 1) * inventories.per_page + idx + 1}</td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-2.5">
                                                    {item.product.image ? (
                                                        <img src={`/storage/${item.product.image}`} alt={item.product.name} className="h-9 w-9 shrink-0 rounded-lg object-cover" />
                                                    ) : (
                                                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                                                            <Package className="h-4 w-4 text-gray-400" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-semibold text-gray-900">{item.product.name}</div>
                                                        <div className="text-[10px] text-gray-400">{item.product.unit}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5"><CategoryBadge category={item.product.category} /></td>
                                            <td className="px-4 py-2.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Store className="h-3 w-3 shrink-0 text-gray-400" />
                                                    <div>
                                                        <div className="text-xs font-medium text-gray-800">{item.vendor.stall_name}</div>
                                                        <div className="text-[10px] text-gray-400">{item.vendor.stall_location}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-2.5 text-xs font-semibold text-gray-800">&#8369;{Number(item.selling_price).toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                            <td className="px-4 py-2.5"><StockBadge item={item} /></td>
                                            <td className="px-4 py-2.5 text-xs text-gray-500">{item.reorder_level}</td>
                                            <td className="px-4 py-2.5"><StockStatusBadge status={item.stock_status} /></td>
                                            <td className="px-4 py-2.5 text-xs font-semibold text-gray-800">
                                                {item.inventory_value != null
                                                    ? '&#8369;' + Number(item.inventory_value).toLocaleString(undefined, { maximumFractionDigits: 2 })
                                                    : <span className="italic text-gray-300">—</span>}
                                            </td>
                                            <td className="px-4 py-2.5">
                                                {item.product.is_available ? (
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
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {inventories.last_page > 1 && (
                        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5">
                            <span className="text-[11px] text-gray-500">
                                {(inventories.current_page - 1) * inventories.per_page + 1}&#8211;{Math.min(inventories.current_page * inventories.per_page, inventories.total)} of {inventories.total}
                            </span>
                            <div className="flex gap-0.5">
                                {inventories.links.map((link, i) => (
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

InventoryIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Inventory Monitoring', href: '/admin/dashboard/inventory' },
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

function CategoryBadge({ category }: { category: string }) {
    return <span className="rounded-md bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-600">{category}</span>;
}

function StockBadge({ item }: { item: InventoryItem }) {
    const low = item.stock_quantity <= item.reorder_level;
    const text = low ? 'text-red-500' : 'text-gray-900';
    const pct = item.max_stock_level > 0 ? Math.min(100, Math.round((item.stock_quantity / item.max_stock_level) * 100)) : 0;
    const barColor = item.stock_quantity === 0
        ? 'bg-red-400'
        : low
            ? 'bg-[#ee600e]'
            : 'bg-[#488562]';

    return (
        <div className="min-w-[90px]">
            <div className={`text-xs font-bold ${text}`}>
                {item.stock_quantity.toLocaleString()} <span className="font-normal text-gray-400">{item.product.unit}</span>
            </div>
            {item.max_stock_level > 0 && (
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                </div>
            )}
        </div>
    );
}

function StockStatusBadge({ status }: { status: 'in' | 'low' | 'out' }) {
    const config: Record<'in' | 'low' | 'out', { bg: string; text: string; label: string; Icon: React.ComponentType<{ className?: string }> }> = {
        in: { bg: 'bg-[#488562]/10', text: 'text-[#488562]', label: 'In Stock', Icon: CheckCircle2 },
        low: { bg: 'bg-[#ee600e]/10', text: 'text-[#ee600e]', label: 'Low Stock', Icon: AlertTriangle },
        out: { bg: 'bg-red-50', text: 'text-red-500', label: 'Out of Stock', Icon: X },
    };
    const c = config[status];

    return (
        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${c.bg} ${c.text}`}>
            <c.Icon className="h-3 w-3" />
            {c.label}
        </span>
    );
}
