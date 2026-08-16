import { Head, router } from '@inertiajs/react';
import {
    Activity,
    AlertTriangle,
    BarChart3,
    Box,
    CheckCircle2,
    CircleDollarSign,
    ClipboardList,
    Database,
    Gauge,
    MessageSquare,
    ReceiptText,
    RefreshCw,
    Server,
    ShieldCheck,
    ShoppingCart,
    Sparkles,
    Star,
    Store,
    Timer,
    Users,
    Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { dashboard } from '@/routes';

/* ─── Types ─── */

type RangeOption = { value: string; label: string };
type TrendPoint = { label: string; value: number };
type StatusRow = { status: string; label: string; count: number; revenue: number };
type PaymentRow = { method: string; label: string; count: number; revenue: number; percent: number };
type ProductRow = { name: string; category: string; vendor: string; units_sold: number; revenue: number };
type VendorRow = { id: number; stall_name: string; orders: number; revenue: number };
type RoleRow = { label: string; count: number };
type VendorStatusRow = { status: string; label: string; count: number };
type LocationRow = { location: string; count: number };
type CategoryRow = { category: string; items: number; value: number };
type MovementRow = { type: string; label: string; count: number; net_change: number };
type LowStockRow = { name: string; vendor: string; stock_quantity: number; reorder_level: number; unit: string };
type AiRow = { status: string; label: string; count: number };
type Segment = { label: string; value: number; color: string };

type Props = {
    filters: { range: string };
    range: string;
    range_options: RangeOption[];
    overview: {
        total_revenue: number;
        total_orders: number;
        avg_order_value: number;
        total_users: number;
        total_vendors: number;
        total_products: number;
        inventory_value: number;
    };
    sales: {
        total_revenue: number;
        total_orders: number;
        avg_order_value: number;
        completed_orders: number;
        cancelled_orders: number;
        revenue_trend: TrendPoint[];
        status_breakdown: StatusRow[];
        payment_breakdown: PaymentRow[];
        top_products: ProductRow[];
        top_vendors: VendorRow[];
    };
    users: {
        total: number;
        new_users: number;
        customers: number;
        vendors: number;
        admins: number;
        roles: RoleRow[];
        new_users_trend: TrendPoint[];
    };
    vendors: {
        total: number;
        pending: number;
        approved: number;
        rejected: number;
        suspended: number;
        new_vendors: number;
        status_breakdown: VendorStatusRow[];
        locations: LocationRow[];
    };
    inventory: {
        total_items: number;
        in_stock: number;
        low_stock: number;
        out_of_stock: number;
        total_value: number;
        retail_value: number;
        category_breakdown: CategoryRow[];
        stock_movements: MovementRow[];
        low_stock_items: LowStockRow[];
    };
    system: {
        active_sessions: number;
        total_sessions: number;
        failed_jobs: number;
        pending_jobs: number;
        ai_requests: number;
        ai_breakdown: AiRow[];
        ai_success_rate: number;
        reviews: number;
        average_rating: number;
        pending_tasks: number;
    };
};

export default function ReportsIndex({ filters, range_options, overview, sales, users, vendors, inventory, system }: Props) {
    function applyRange(value: string) {
        router.get('/admin/dashboard/reports', { range: value || undefined }, { preserveState: true, preserveScroll: true });
    }

    const palette = PALETTE;

    return (
        <>
            <Head title="Reports & Analytics" />
            <div className="flex h-full flex-1 flex-col gap-5 overflow-x-auto p-5">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-lg font-bold text-gray-900">Reports & Analytics</h1>
                        <p className="text-xs text-gray-500">Sales, users, vendors, inventory, and system performance insights</p>
                    </div>
                    <select
                        value={filters.range ?? '30d'}
                        onChange={(e) => applyRange(e.target.value)}
                        className="h-9 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm focus:border-[#488562] focus:outline-none focus:ring-1 focus:ring-[#488562]"
                    >
                        {range_options.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>

                {/* ─── Overview KPIs ─── */}
                <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <KpiCard label="Total Revenue" value={formatMoney(overview.total_revenue)} icon={CircleDollarSign} color="#488562" bg="bg-[#488562]/10" sub={`${overview.total_orders.toLocaleString()} orders`} />
                    <KpiCard label="Avg. Order Value" value={formatMoney(overview.avg_order_value)} icon={ReceiptText} color="#0867ff" bg="bg-[#0867ff]/10" sub="across all orders" />
                    <KpiCard label="Total Users" value={overview.total_users.toLocaleString()} icon={Users} color="#8b5cf6" bg="bg-purple-50" sub={`${users.new_users.toLocaleString()} new in range`} />
                    <KpiCard label="Inventory Value" value={formatMoney(overview.inventory_value)} icon={Box} color="#ee600e" bg="bg-[#ee600e]/10" sub={`${overview.total_products.toLocaleString()} products`} />
                </div>

                {/* ─── Sales Analytics ─── */}
                <SectionHeader icon={BarChart3} color="#488562" title="Sales Analytics" subtitle="Revenue, orders, and payment insights" />

                <div className="grid gap-5 lg:grid-cols-3">
                    {/* Revenue trend */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:col-span-2">
                        <CardHeader title="Revenue Trend" sub={`${overview.total_orders.toLocaleString()} orders · ${formatMoney(sales.total_revenue)} revenue`} />
                        <BarChart data={sales.revenue_trend} />
                        <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5">
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <CheckCircle2 className="h-3.5 w-3.5 text-[#488562]" />
                                Completed
                            </div>
                            <span className="text-sm font-bold text-gray-900">{formatMoney(sales.total_revenue)}</span>
                        </div>
                    </div>

                    {/* Payment methods donut */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <CardHeader title="Payment Methods" sub="share of paid orders" />
                        <div className="flex flex-col items-center gap-5">
                            <DonutChart segments={paymentSegments(sales.payment_breakdown, palette)} />
                            <div className="w-full space-y-2.5">
                                {sales.payment_breakdown.map((p) => (
                                    <LegendRow key={p.method} label={p.label} value={`${p.count.toLocaleString()} · ${p.percent}%`} color={PAYMENT_COLORS[p.method] ?? palette[0]} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-5 lg:grid-cols-3">
                    {/* Order status breakdown */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <CardHeader title="Order Status" sub="orders in selected range" />
                        <div className="space-y-3">
                            {sales.status_breakdown.map((s) => {
                                const color = STATUS_COLORS[s.status] ?? palette[7];
                                const pct = sales.total_orders > 0 ? (s.count / sales.total_orders) * 100 : 0;

                                return (
                                    <div key={s.status}>
                                        <div className="mb-1 flex items-center justify-between text-xs">
                                            <span className="font-medium text-gray-700">{s.label}</span>
                                            <span className="font-bold text-gray-900">{s.count.toLocaleString()}</span>
                                        </div>
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Top products */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <CardHeader title="Top Products" sub="by revenue in selected range" />
                        <div className="space-y-3">
                            {sales.top_products.length === 0 ? (
                                <EmptyState text="No sales data yet" />
                            ) : (
                                sales.top_products.map((p, i) => (
                                    <div key={i} className="flex items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#488562]/10 text-xs font-bold text-[#488562]">{i + 1}</div>
                                            <div className="min-w-0">
                                                <div className="truncate text-xs font-semibold text-gray-900">{p.name}</div>
                                                <div className="text-[10px] text-gray-400">{p.category} · {p.units_sold} sold · {p.vendor}</div>
                                            </div>
                                        </div>
                                        <span className="shrink-0 text-xs font-bold text-gray-900">{formatMoney(p.revenue)}</span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Top vendors */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <CardHeader title="Top Vendors" sub="by revenue in selected range" />
                        <div className="space-y-3">
                            {sales.top_vendors.length === 0 ? (
                                <EmptyState text="No sales data yet" />
                            ) : (
                                sales.top_vendors.map((v) => {
                                    const max = sales.top_vendors[0]?.revenue || 1;

                                    return (
                                        <div key={v.id}>
                                            <div className="mb-1 flex items-center justify-between">
                                                <div className="flex min-w-0 items-center gap-2.5">
                                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#488562]/10 to-[#89baa3]/20 text-xs font-bold text-[#488562]">
                                                        {initials(v.stall_name)}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="truncate text-xs font-semibold text-gray-900">{v.stall_name}</div>
                                                        <div className="text-[10px] text-gray-400">{v.orders.toLocaleString()} orders</div>
                                                    </div>
                                                </div>
                                                <span className="shrink-0 text-xs font-bold text-gray-900">{formatMoney(v.revenue)}</span>
                                            </div>
                                            <div className="h-1 w-full overflow-hidden rounded-full bg-gray-100">
                                                <div className="h-full rounded-full bg-gradient-to-r from-[#488562] to-[#89baa3]" style={{ width: `${(v.revenue / max) * 100}%` }} />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* ─── Users ─── */}
                <SectionHeader icon={Users} color="#8b5cf6" title="Users" subtitle="Registered users and account mix" />

                <div className="grid gap-5 lg:grid-cols-3">
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <CardHeader title="User Growth" sub={`${users.new_users.toLocaleString()} new users in range`} />
                        <BarChart data={users.new_users_trend} from="#6d28d9" to="#c4b5fd" />
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <CardHeader title="Account Types" sub="all registered accounts" />
                        <div className="flex flex-col items-center gap-5">
                            <DonutChart segments={roleSegments(users.roles, palette)} />
                            <div className="w-full space-y-2.5">
                                {users.roles.map((r) => (
                                    <LegendRow key={r.label} label={r.label} value={r.count.toLocaleString()} color={ROLE_COLORS[r.label] ?? palette[0]} />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <CardHeader title="User KPIs" sub="current totals" />
                        <div className="grid grid-cols-2 gap-3">
                            <MiniStat label="Total Users" value={users.total.toLocaleString()} color="text-gray-900" />
                            <MiniStat label="New (Range)" value={users.new_users.toLocaleString()} color="text-[#8b5cf6]" />
                            <MiniStat label="Customers" value={users.customers.toLocaleString()} color="text-[#488562]" />
                            <MiniStat label="Vendors" value={users.vendors.toLocaleString()} color="text-[#ee600e]" />
                            <MiniStat label="Admins" value={users.admins.toLocaleString()} color="text-[#0867ff]" />
                            <MiniStat label="Products" value={overview.total_products.toLocaleString()} color="text-gray-500" />
                        </div>
                    </div>
                </div>

                {/* ─── Vendors ─── */}
                <SectionHeader icon={Store} color="#ee600e" title="Vendors" subtitle="Vendor roster, approvals, and locations" />

                <div className="grid gap-5 lg:grid-cols-3">
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <CardHeader title="Approval Status" sub={`${vendors.new_vendors.toLocaleString()} registered in range`} />
                        <div className="flex flex-col items-center gap-5">
                            <DonutChart segments={vendorSegments(vendors.status_breakdown, palette)} />
                            <div className="w-full space-y-2.5">
                                {vendors.status_breakdown.map((v) => (
                                    <LegendRow key={v.status} label={v.label} value={v.count.toLocaleString()} color={VENDOR_STATUS_COLORS[v.status] ?? palette[7]} />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <CardHeader title="Vendor Locations" sub="by stall location" />
                        <div className="space-y-3">
                            {vendors.locations.map((loc) => {
                                const max = vendors.locations[0]?.count || 1;

                                return (
                                    <div key={loc.location}>
                                        <div className="mb-1 flex items-center justify-between text-xs">
                                            <span className="font-medium text-gray-700">{loc.location}</span>
                                            <span className="font-bold text-gray-900">{loc.count.toLocaleString()}</span>
                                        </div>
                                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                                            <div className="h-full rounded-full bg-[#ee600e]" style={{ width: `${(loc.count / max) * 100}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <CardHeader title="Vendor KPIs" sub="current totals" />
                        <div className="grid grid-cols-2 gap-3">
                            <MiniStat label="Total Vendors" value={vendors.total.toLocaleString()} color="text-gray-900" />
                            <MiniStat label="Approved" value={vendors.approved.toLocaleString()} color="text-[#488562]" />
                            <MiniStat label="Pending" value={vendors.pending.toLocaleString()} color="text-[#ee600e]" />
                            <MiniStat label="Suspended" value={vendors.suspended.toLocaleString()} color="text-purple-600" />
                            <MiniStat label="Rejected" value={vendors.rejected.toLocaleString()} color="text-red-500" />
                            <MiniStat label="New (Range)" value={vendors.new_vendors.toLocaleString()} color="text-[#0867ff]" />
                        </div>
                    </div>
                </div>

                {/* ─── Inventory ─── */}
                <SectionHeader icon={Box} color="#0867ff" title="Inventory" subtitle="Stock levels and product value" />

                <div className="grid gap-5 lg:grid-cols-3">
                    {/* Stock health */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <CardHeader title="Stock Health" sub={`${inventory.total_items.toLocaleString()} inventory items`} />
                        <div className="space-y-3">
                            <StockHealthRow label="In Stock" count={inventory.in_stock} total={inventory.total_items} color="#488562" />
                            <StockHealthRow label="Low Stock" count={inventory.low_stock} total={inventory.total_items} color="#ee600e" />
                            <StockHealthRow label="Out of Stock" count={inventory.out_of_stock} total={inventory.total_items} color="#ef4444" />
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            <MiniStat label="Value (Cost)" value={formatMoney(inventory.total_value)} color="text-[#488562]" />
                            <MiniStat label="Value (Retail)" value={formatMoney(inventory.retail_value)} color="text-[#0867ff]" />
                        </div>
                    </div>

                    {/* Category breakdown */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <CardHeader title="Value by Category" sub="inventory value at cost" />
                        <div className="space-y-3">
                            {inventory.category_breakdown.length === 0 ? (
                                <EmptyState text="No inventory data yet" />
                            ) : (
                                inventory.category_breakdown.map((c) => {
                                    const max = inventory.category_breakdown[0]?.value || 1;

                                    return (
                                        <div key={c.category}>
                                            <div className="mb-1 flex items-center justify-between text-xs">
                                                <span className="font-medium text-gray-700">{labelize(c.category)}</span>
                                                <span className="font-bold text-gray-900">{formatMoney(c.value)}</span>
                                            </div>
                                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                                                <div className="h-full rounded-full bg-[#0867ff]" style={{ width: `${(c.value / max) * 100}%` }} />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Stock movements */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <CardHeader title="Stock Movements" sub="inventory log activity in range" />
                        <div className="space-y-2.5">
                            {inventory.stock_movements.length === 0 ? (
                                <EmptyState text="No stock movements yet" />
                            ) : (
                                inventory.stock_movements.map((m) => (
                                    <div key={m.type} className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
                                        <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                                            <RefreshCw className="h-3.5 w-3.5 text-[#0867ff]" />
                                            {m.label}
                                            <span className="text-[10px] text-gray-400">×{m.count.toLocaleString()}</span>
                                        </div>
                                        <span className={`text-xs font-bold ${m.net_change >= 0 ? 'text-[#488562]' : 'text-red-500'}`}>
                                            {m.net_change >= 0 ? '+' : ''}{m.net_change.toLocaleString()}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Low stock alert table */}
                {inventory.low_stock_items.length > 0 && (
                    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
                            <AlertTriangle className="h-4 w-4 text-[#ee600e]" />
                            <h3 className="text-sm font-bold text-gray-900">Low Stock Alerts</h3>
                            <span className="text-[11px] text-gray-400">items at or below reorder level</span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="border-b border-gray-100 bg-gray-50/60">
                                        <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Product</th>
                                        <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Vendor</th>
                                        <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Stock</th>
                                        <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Reorder Level</th>
                                        <th className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {inventory.low_stock_items.map((item, i) => (
                                        <tr key={i} className="transition hover:bg-[#488562]/[0.02]">
                                            <td className="px-5 py-2.5 text-xs font-semibold text-gray-900">{item.name}</td>
                                            <td className="px-5 py-2.5 text-xs text-gray-600">{item.vendor}</td>
                                            <td className="px-5 py-2.5 text-xs font-bold text-[#ee600e]">{item.stock_quantity.toLocaleString()} {item.unit}</td>
                                            <td className="px-5 py-2.5 text-xs text-gray-500">{item.reorder_level}</td>
                                            <td className="px-5 py-2.5">
                                                <span className="inline-flex items-center gap-1 rounded-md bg-[#ee600e]/10 px-2 py-0.5 text-[10px] font-bold text-[#ee600e]">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    Low Stock
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ─── System Performance ─── */}
                <SectionHeader icon={Activity} color="#0867ff" title="System Performance" subtitle="Platform health and activity" />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <SystemCard icon={Zap} color="#488562" bg="bg-[#488562]/10" label="Active Sessions" value={system.active_sessions.toLocaleString()} sub={`${system.total_sessions.toLocaleString()} total sessions`} />
                    <SystemCard icon={Server} color="#0867ff" bg="bg-[#0867ff]/10" label="Queue Jobs" value={system.pending_jobs.toLocaleString()} sub="jobs awaiting processing" />
                    <SystemCard icon={ShieldCheck} color="#ee600e" bg="bg-[#ee600e]/10" label="Failed Jobs" value={system.failed_jobs.toLocaleString()} sub="errors in the job queue" danger={system.failed_jobs > 0} />
                    <SystemCard icon={ClipboardList} color="#8b5cf6" bg="bg-purple-50" label="Pending Tasks" value={system.pending_tasks.toLocaleString()} sub="tasks needing attention" />
                </div>

                <div className="grid gap-5 lg:grid-cols-3">
                    {/* AI engine */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <CardHeader title="AI Recommendation Engine" sub={`${system.ai_requests.toLocaleString()} requests in range`} />
                        <div className="mb-4 flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ee600e]/10">
                                <Sparkles className="h-5 w-5 text-[#ee600e]" />
                            </div>
                            <div>
                                <div className="text-lg font-bold text-gray-900">{system.ai_success_rate}%</div>
                                <div className="text-[11px] text-gray-500">success rate</div>
                            </div>
                        </div>
                        <div className="space-y-2.5">
                            {system.ai_breakdown.map((a) => (
                                <LegendRow key={a.status} label={a.label} value={a.count.toLocaleString()} color={AI_COLORS[a.status] ?? palette[7]} />
                            ))}
                        </div>
                    </div>

                    {/* Reviews */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <CardHeader title="Customer Feedback" sub="reviews in selected range" />
                        <div className="mb-4 flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#488562]/10">
                                <Star className="h-5 w-5 text-[#488562]" />
                            </div>
                            <div>
                                <div className="flex items-center gap-1 text-lg font-bold text-gray-900">
                                    {system.average_rating ? system.average_rating.toFixed(1) : '—'}
                                    <Star className="h-4 w-4 fill-[#f59e0b] text-[#f59e0b]" />
                                </div>
                                <div className="text-[11px] text-gray-500">average rating</div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
                            <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                                <MessageSquare className="h-3.5 w-3.5 text-[#0867ff]" />
                                Reviews received
                            </div>
                            <span className="text-sm font-bold text-gray-900">{system.reviews.toLocaleString()}</span>
                        </div>
                    </div>

                    {/* Performance index */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <CardHeader title="Performance Snapshot" sub="live platform indicators" />
                        <div className="space-y-3">
                            <PerfRow icon={Database} label="Products" value={overview.total_products.toLocaleString()} color="#0867ff" />
                            <PerfRow icon={Store} label="Vendors" value={vendors.total.toLocaleString()} color="#ee600e" />
                            <PerfRow icon={ShoppingCart} label="Orders (Range)" value={sales.total_orders.toLocaleString()} color="#488562" />
                            <PerfRow icon={Users} label="Users" value={users.total.toLocaleString()} color="#8b5cf6" />
                            <PerfRow icon={Timer} label="Completed Orders" value={sales.completed_orders.toLocaleString()} color="#488562" />
                            <PerfRow icon={Gauge} label="Avg. Order Value" value={formatMoney(overview.avg_order_value)} color="#0867ff" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

ReportsIndex.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: dashboard() },
        { title: 'Reports & Analytics', href: '/admin/dashboard/reports' },
    ],
};

/* ─── Constants ─── */

const PALETTE = ['#488562', '#0867ff', '#ee600e', '#8b5cf6', '#14b8a6', '#f59e0b', '#ef4444', '#64748b'];

const STATUS_COLORS: Record<string, string> = {
    pending: '#ee600e',
    confirmed: '#0867ff',
    processing: '#0867ff',
    ready: '#8b5cf6',
    completed: '#488562',
    cancelled: '#ef4444',
};

const PAYMENT_COLORS: Record<string, string> = {
    cash: '#64748b',
    gcash: '#0867ff',
    maya: '#ee600e',
};

const VENDOR_STATUS_COLORS: Record<string, string> = {
    pending: '#ee600e',
    approved: '#488562',
    rejected: '#ef4444',
    suspended: '#8b5cf6',
};

const AI_COLORS: Record<string, string> = {
    found: '#488562',
    not_found: '#ee600e',
    error: '#ef4444',
};

const ROLE_COLORS: Record<string, string> = {
    Customers: '#488562',
    Vendors: '#ee600e',
    Admins: '#8b5cf6',
};

/* ─── Chart Data Helpers ─── */

function paymentSegments(rows: PaymentRow[], palette: string[]): Segment[] {
    return rows
        .filter((r) => r.count > 0)
        .map((r, i) => ({ label: r.label, value: r.count, color: PAYMENT_COLORS[r.method] ?? palette[i % palette.length] }));
}

function roleSegments(rows: RoleRow[], palette: string[]): Segment[] {
    return rows.filter((r) => r.count > 0).map((r) => ({ label: r.label, value: r.count, color: ROLE_COLORS[r.label] ?? palette[0] }));
}

function vendorSegments(rows: VendorStatusRow[], palette: string[]): Segment[] {
    return rows.filter((r) => r.count > 0).map((r) => ({ label: r.label, value: r.count, color: VENDOR_STATUS_COLORS[r.status] ?? palette[7] }));
}

/* ─── Shared Sub Components ─── */

function SectionHeader({ icon: Icon, color, title, subtitle }: { icon: LucideIcon; color: string; title: string; subtitle: string }) {
    return (
        <div className="mt-2 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-100 bg-white shadow-sm">
                <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <div>
                <h2 className="text-sm font-bold text-gray-900">{title}</h2>
                <p className="text-[11px] text-gray-500">{subtitle}</p>
            </div>
        </div>
    );
}

function KpiCard({ label, value, icon: Icon, color, bg, sub }: { label: string; value: string; icon: LucideIcon; color: string; bg: string; sub: string }) {
    return (
        <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="min-w-0">
                <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
                <div className="truncate text-xl font-bold text-gray-900">{value}</div>
                <div className="truncate text-[11px] text-gray-400">{sub}</div>
            </div>
        </div>
    );
}

function CardHeader({ title, sub }: { title: string; sub?: string }) {
    return (
        <div className="mb-4">
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
        </div>
    );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
            <div className={`text-base font-bold ${color}`}>{value}</div>
        </div>
    );
}

function StockHealthRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
    const pct = total > 0 ? (count / total) * 100 : 0;

    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-gray-700">{label}</span>
                <span className="font-bold text-gray-900">{count.toLocaleString()}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
        </div>
    );
}

function LegendRow({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-700">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                {label}
            </div>
            <span className="text-xs font-bold text-gray-900">{value}</span>
        </div>
    );
}

function PerfRow({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: string; color: string }) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-xs font-medium text-gray-700">
                <Icon className="h-3.5 w-3.5" style={{ color }} />
                {label}
            </div>
            <span className="text-xs font-bold text-gray-900">{value}</span>
        </div>
    );
}

function SystemCard({ icon: Icon, color, bg, label, value, sub, danger }: { icon: LucideIcon; color: string; bg: string; label: string; value: string; sub: string; danger?: boolean }) {
    return (
        <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                <Icon className="h-5 w-5" style={{ color }} />
            </div>
            <div className="min-w-0">
                <div className="truncate text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
                <div className={`truncate text-xl font-bold ${danger ? 'text-red-500' : 'text-gray-900'}`}>{value}</div>
                <div className="truncate text-[11px] text-gray-400">{sub}</div>
            </div>
        </div>
    );
}

/* ─── Charts ─── */

function BarChart({ data, from, to }: { data: TrendPoint[]; from?: string; to?: string }) {
    const max = Math.max(...data.map((d) => d.value), 1);
    const fromC = from ?? '#3a6e50';
    const toC = to ?? '#89baa3';
    const step = Math.ceil(data.length / 10);

    return (
        <div>
            <div className="flex items-end gap-1.5" style={{ height: 150 }}>
                {data.map((d, i) => (
                    <div key={i} className="group relative flex h-full flex-1 items-end">
                        <div
                            className="relative w-full rounded-t-md transition-all group-hover:opacity-80"
                            style={{ height: `${Math.max((d.value / max) * 100, 2)}%`, background: `linear-gradient(to top, ${fromC}, ${toC})` }}
                        >
                            {d.value > 0 && (
                                <div className="pointer-events-none absolute -top-8 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-semibold text-white group-hover:block">
                                    {formatNumber(d.value)}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-1.5 flex gap-1.5">
                {data.map((d, i) => (
                    <div key={i} className={`flex-1 truncate text-center text-[9px] text-gray-400 ${i % step === 0 || i === data.length - 1 ? '' : 'text-transparent'}`}>
                        {d.label}
                    </div>
                ))}
            </div>
        </div>
    );
}
function DonutChart({ segments, size = 160, thickness = 26 }: { segments: Segment[]; size?: number; thickness?: number }) {
    const total = Math.max(segments.reduce((sum, s) => sum + s.value, 0), 1);

    const ends = segments.reduce<number[]>((acc, s) => [...acc, (acc[acc.length - 1] ?? 0) + s.value], []);

    const stops = segments.map((s, i) => {
        const start = ((ends[i] - s.value) / total) * 360;
        const end = (ends[i] / total) * 360;

        return `${s.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
    });

    const background = stops.length > 0 ? `conic-gradient(${stops.join(', ')})` : 'conic-gradient(#e5e7eb 0deg 360deg)';
    const inset = thickness;

    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <div className="absolute inset-0 rounded-full" style={{ background }} />
            <div
                className="absolute inset-0 flex items-center justify-center rounded-full bg-white"
                style={{ margin: inset }}
            >
                <div className="text-center">
                    <div className="text-lg font-bold text-gray-900">{total.toLocaleString()}</div>
                    <div className="text-[9px] text-gray-400">total</div>
                </div>
            </div>
        </div>
    );
}

/* ─── Helpers ─── */

function formatMoney(value: number): string {
    return '\u20B1' + Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatNumber(value: number): string {
    if (value >= 1_000_000) {
return (value / 1_000_000).toFixed(1) + 'M';
}

    if (value >= 1_000) {
return (value / 1_000).toFixed(1) + 'K';
}

    return value.toLocaleString();
}

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join('');
}

function labelize(value: string): string {
    return value
        .split(/[\s_-]+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function EmptyState({ text }: { text: string }) {
    return <div className="py-8 text-center text-xs text-gray-400">{text}</div>;
}
