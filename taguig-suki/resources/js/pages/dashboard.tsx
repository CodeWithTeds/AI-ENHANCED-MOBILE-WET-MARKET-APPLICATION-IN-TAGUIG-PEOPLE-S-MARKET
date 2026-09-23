import { Head, Link, usePage } from '@inertiajs/react';
import { DotLottiePlayer } from '@dotlottie/react-player';
import {
    BadgeCheck,
    Box,
    CheckCircle2,
    Clock,
    MessageSquare,
    Package,
    ShoppingCart,
    Sparkles,
    Store,
    TrendingUp,
    Users,
    Zap,
} from 'lucide-react';
import { dashboard } from '@/routes';

type Stat = { label: string; value: string; change: string; icon: string; color: string };
type RecentOrder = { name: string; detail: string; status: string; statusColor: string; bgColor: string; icon: string; iconColor: string };
type TopVendor = { name: string; initials: string; sales: string };
type Activity = { text: string; time: string; icon: string; iconColor: string; bgColor: string };

type DashboardProps = {
    stats?: Stat[];
    monthly?: { done: number; total: number; percent: number; orders: number; customers: number };
    recentOrders?: RecentOrder[];
    topVendors?: TopVendor[];
    activities?: Activity[];
    bottom?: { ordersToday: number; activeThisWeek: number };
    pendingVerifications?: number;
};

const iconMap: Record<string, any> = {
    Store,
    ShoppingCart,
    Package,
    Users,
    CheckCircle2,
    Clock,
    Sparkles,
    Box,
    MessageSquare,
    BadgeCheck,
};

export default function Dashboard(props: DashboardProps) {
    const { auth } = usePage().props as any;
    const stats: Stat[] = props.stats ?? statCards;
    const monthly = props.monthly ?? { done: 12450, total: 20000, percent: 62, orders: 7550, customers: 4900 };
    const recentOrders: RecentOrder[] = props.recentOrders ?? staticRecentOrders;
    const topVendors: TopVendor[] = props.topVendors ?? staticTopVendors;
    const activities: Activity[] = props.activities ?? staticActivities;
    const bottom = props.bottom ?? { ordersToday: 245, activeThisWeek: 1892 };
    const pendingVerifications = props.pendingVerifications ?? 0;

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-5 overflow-x-auto p-5">
                {/* Pending verification alert */}
                {pendingVerifications > 0 && (
                    <Link
                        href="/admin/dashboard/verifications"
                        className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 hover:bg-amber-100 transition"
                    >
                        <BadgeCheck className="h-5 w-5 text-amber-600" />
                        <div className="flex-1">
                            <div className="text-sm font-bold">{pendingVerifications} ID verification{pendingVerifications > 1 ? 's' : ''} pending approval</div>
                            <div className="text-xs text-amber-800">Admin must approve before customers can login. Click to review.</div>
                        </div>
                        <span className="text-xs font-bold text-amber-700">Review →</span>
                    </Link>
                )}

                {/* Welcome Banner + Monthly Stats */}
                <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
                    {/* Welcome Card */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#488562] to-[#3a6e50] p-7">
                        <div className="relative z-10">
                            <h2 className="mb-1 text-2xl font-bold text-white">
                                Good day, {auth.user?.name ?? 'Admin'}! 👋
                            </h2>
                            <p className="mb-5 text-sm text-white/70">
                                Welcome back to TaguigSuki Admin Panel. Here&apos;s your market overview.
                            </p>
                            <div className="flex gap-3">
                                <Link
                                    href="/admin/dashboard/reports"
                                    className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#488562] shadow-sm transition hover:bg-white/90"
                                >
                                    <Sparkles className="h-4 w-4" />
                                    View Reports
                                </Link>
                                <Link
                                    href="/admin/dashboard/vendors"
                                    className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25"
                                >
                                    <Store className="h-4 w-4" />
                                    Manage Vendors
                                </Link>
                            </div>
                        </div>
                        {/* Lottie animation */}
                        <div className="absolute right-4 bottom-2 z-0 h-36 w-36 opacity-90 lg:h-44 lg:w-44">
                            <DotLottiePlayer
                                src="/iconforadmin.lottie"
                                loop
                                autoplay
                                className="h-full w-full"
                            />
                        </div>
                        {/* Decorative circles */}
                        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/5" />
                        <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5" />
                    </div>

                    {/* Monthly Overview Card — LIVE */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <div className="mb-4 flex items-center gap-2">
                            <Zap className="h-4 w-4 text-[#ee600e]" />
                            <h3 className="text-sm font-bold text-gray-900">Monthly Overview</h3>
                        </div>
                        <div className="mb-3 flex items-baseline justify-between">
                            <span className="text-xs text-gray-500">{monthly.done.toLocaleString()} / {monthly.total.toLocaleString()}</span>
                            <span className="text-sm font-bold text-[#488562]">{monthly.percent}%</span>
                        </div>
                        <div className="mb-5 h-2.5 overflow-hidden rounded-full bg-gray-100">
                            <div className="h-full rounded-full bg-gradient-to-r from-[#488562] to-[#89baa3] transition-all" style={{ width: `${monthly.percent}%` }} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                                <div className="text-xl font-bold text-gray-900">{monthly.orders.toLocaleString()}</div>
                                <div className="text-[11px] text-gray-500">Orders</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xl font-bold text-gray-900">{monthly.customers.toLocaleString()}</div>
                                <div className="text-[11px] text-gray-500">Customers</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Cards — LIVE */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {stats.map((stat, i) => {
                        const Icon = iconMap[stat.icon] ?? Store;
                        return (
                            <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                                <div className="mb-3 flex items-center justify-between">
                                    <span className="text-xs font-medium text-gray-500">{stat.label}</span>
                                    <Icon className="h-4 w-4" style={{ color: stat.color }} />
                                </div>
                                <div className="mb-1 text-2xl font-bold text-gray-900">{stat.value}</div>
                                <div className="flex items-center gap-1 text-xs">
                                    <TrendingUp className="h-3 w-3 text-[#488562]" />
                                    <span className="text-[#488562]">{stat.change}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Bottom Grid — 3 columns — LIVE */}
                <div className="grid gap-5 lg:grid-cols-3">
                    {/* Recent Orders */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <div className="mb-5 flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-[#0867ff]" />
                            <h3 className="text-sm font-bold text-gray-900">Recent Orders</h3>
                            <Link href="/admin/dashboard/orders" className="ml-auto text-xs font-semibold text-[#0867ff] hover:underline">
                                View all
                            </Link>
                        </div>
                        <div className="space-y-3.5">
                            {recentOrders.map((order, i) => {
                                const Icon = iconMap[order.icon] ?? Clock;
                                return (
                                    <div key={i} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${order.bgColor}`}>
                                                <Icon className={`h-4 w-4 ${order.iconColor}`} />
                                            </div>
                                            <div>
                                                <div className="text-sm font-medium text-gray-900">{order.name}</div>
                                                <div className="text-[11px] text-gray-400">{order.detail}</div>
                                            </div>
                                        </div>
                                        <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${order.statusColor}`}>
                                            {order.status}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Top Vendors */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <div className="mb-5 flex items-center gap-2">
                            <Store className="h-4 w-4 text-[#ee600e]" />
                            <h3 className="text-sm font-bold text-gray-900">Top Vendors</h3>
                            <Link href="/admin/dashboard/vendors" className="ml-auto text-xs font-semibold text-[#ee600e] hover:underline">
                                View all
                            </Link>
                        </div>
                        <div className="space-y-3.5">
                            {topVendors.map((vendor, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#488562]/10 to-[#89baa3]/20 text-sm font-bold text-[#488562]">
                                        {vendor.initials}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-gray-900">{vendor.name}</div>
                                        <div className="text-[11px] text-gray-400">{vendor.sales} orders</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Activity */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <div className="mb-5 flex items-center gap-2">
                            <Clock className="h-4 w-4 text-[#488562]" />
                            <h3 className="text-sm font-bold text-gray-900">Activity</h3>
                        </div>
                        <div className="space-y-4">
                            {activities.map((activity, i) => {
                                const Icon = iconMap[activity.icon] ?? Store;
                                return (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ${activity.bgColor}`}>
                                            <Icon className={`h-3 w-3 ${activity.iconColor}`} />
                                        </div>
                                        <div>
                                            <div className="text-sm text-gray-700">{activity.text}</div>
                                            <div className="text-[11px] text-gray-400">{activity.time}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Bottom Stats Bar — LIVE */}
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#488562]/10">
                            <ShoppingCart className="h-5 w-5 text-[#488562]" />
                        </div>
                        <div>
                            <div className="text-lg font-bold text-gray-900">{bottom.ordersToday}</div>
                            <div className="text-[11px] text-gray-500">Orders Today</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ee600e]/10">
                            <Users className="h-5 w-5 text-[#ee600e]" />
                        </div>
                        <div>
                            <div className="text-lg font-bold text-gray-900">{bottom.activeThisWeek}</div>
                            <div className="text-[11px] text-gray-500">Active This Week</div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};

// Static data — fallbacks if backend fails
const statCards = [
    { label: 'Total Vendors', value: '0', change: '—', icon: 'Store', color: '#488562' },
    { label: 'Total Orders', value: '0', change: '—', icon: 'ShoppingCart', color: '#0867ff' },
    { label: 'Products', value: '0', change: '—', icon: 'Package', color: '#ee600e' },
    { label: 'Active Users', value: '0', change: '—', icon: 'Users', color: '#488562' },
];

const staticRecentOrders = [
    {
        name: 'No orders yet',
        detail: '—',
        status: 'Pending',
        statusColor: 'bg-gray-100 text-gray-500',
        icon: 'Clock',
        iconColor: 'text-gray-400',
        bgColor: 'bg-gray-100',
    },
];

const staticTopVendors = [
    { name: 'No vendors yet', initials: 'NV', sales: '0' },
];

const staticActivities = [
    {
        text: 'Welcome to TaguigSuki Admin',
        time: 'now',
        icon: 'Store',
        iconColor: 'text-[#488562]',
        bgColor: 'bg-[#488562]/10',
    },
];
