import { Head, usePage } from '@inertiajs/react';
import { DotLottiePlayer } from '@dotlottie/react-player';
import {
    ArrowUpRight,
    BarChart3,
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

export default function Dashboard() {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-5 overflow-x-auto p-5">
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
                                <button className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-[#488562] shadow-sm transition hover:bg-white/90">
                                    <Sparkles className="h-4 w-4" />
                                    View Reports
                                </button>
                                <button className="inline-flex items-center gap-2 rounded-lg bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25">
                                    <Store className="h-4 w-4" />
                                    Manage Vendors
                                </button>
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

                    {/* Monthly Overview Card */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <div className="mb-4 flex items-center gap-2">
                            <Zap className="h-4 w-4 text-[#ee600e]" />
                            <h3 className="text-sm font-bold text-gray-900">Monthly Overview</h3>
                        </div>
                        <div className="mb-3 flex items-baseline justify-between">
                            <span className="text-xs text-gray-500">12,450 / 20,000</span>
                            <span className="text-sm font-bold text-[#488562]">62%</span>
                        </div>
                        <div className="mb-5 h-2.5 overflow-hidden rounded-full bg-gray-100">
                            <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-[#488562] to-[#89baa3]" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-center">
                                <div className="text-xl font-bold text-gray-900">7,550</div>
                                <div className="text-[11px] text-gray-500">Orders</div>
                            </div>
                            <div className="text-center">
                                <div className="text-xl font-bold text-gray-900">4,900</div>
                                <div className="text-[11px] text-gray-500">Customers</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {statCards.map((stat, i) => (
                        <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                            <div className="mb-3 flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-500">{stat.label}</span>
                                <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
                            </div>
                            <div className="mb-1 text-2xl font-bold text-gray-900">{stat.value}</div>
                            <div className="flex items-center gap-1 text-xs">
                                <TrendingUp className="h-3 w-3 text-[#488562]" />
                                <span className="text-[#488562]">{stat.change}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom Grid — 3 columns */}
                <div className="grid gap-5 lg:grid-cols-3">
                    {/* Recent Orders */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <div className="mb-5 flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4 text-[#0867ff]" />
                            <h3 className="text-sm font-bold text-gray-900">Recent Orders</h3>
                        </div>
                        <div className="space-y-3.5">
                            {recentOrders.map((order, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${order.bgColor}`}>
                                            <order.icon className={`h-4 w-4 ${order.iconColor}`} />
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
                            ))}
                        </div>
                    </div>

                    {/* Top Vendors */}
                    <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                        <div className="mb-5 flex items-center gap-2">
                            <Store className="h-4 w-4 text-[#ee600e]" />
                            <h3 className="text-sm font-bold text-gray-900">Top Vendors</h3>
                        </div>
                        <div className="space-y-3.5">
                            {topVendors.map((vendor, i) => (
                                <div key={i} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[#488562]/10 to-[#89baa3]/20 text-sm font-bold text-[#488562]">
                                            {vendor.initials}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{vendor.name}</div>
                                            <div className="text-[11px] text-gray-400">{vendor.sales} sales</div>
                                        </div>
                                    </div>
                                    <span className="text-sm font-semibold text-gray-900">{vendor.revenue}</span>
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
                            {activities.map((activity, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <div className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full ${activity.bgColor}`}>
                                        <activity.icon className={`h-3 w-3 ${activity.iconColor}`} />
                                    </div>
                                    <div>
                                        <div className="text-sm text-gray-700">{activity.text}</div>
                                        <div className="text-[11px] text-gray-400">{activity.time}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bottom Stats Bar */}
                <div className="grid gap-4 sm:grid-cols-3">
                    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#488562]/10">
                            <ShoppingCart className="h-5 w-5 text-[#488562]" />
                        </div>
                        <div>
                            <div className="text-lg font-bold text-gray-900">245</div>
                            <div className="text-[11px] text-gray-500">Orders Today</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ee600e]/10">
                            <Users className="h-5 w-5 text-[#ee600e]" />
                        </div>
                        <div>
                            <div className="text-lg font-bold text-gray-900">1,892</div>
                            <div className="text-[11px] text-gray-500">Active This Week</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0867ff]/10">
                            <BarChart3 className="h-5 w-5 text-[#0867ff]" />
                        </div>
                        <div>
                            <div className="text-lg font-bold text-gray-900">&#8369;89.5K</div>
                            <div className="text-[11px] text-gray-500">Revenue This Month</div>
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

// Static data
const statCards = [
    { label: 'Total Vendors', value: '52', change: '+3.2%', icon: Store, color: '#488562' },
    { label: 'Total Orders', value: '1,247', change: '+12.5%', icon: ShoppingCart, color: '#0867ff' },
    { label: 'Products', value: '3,890', change: '+5.1%', icon: Package, color: '#ee600e' },
    { label: 'Active Users', value: '4,912', change: '+8.7%', icon: Users, color: '#488562' },
];

const recentOrders = [
    {
        name: 'Order #1247',
        detail: 'Maria Santos \u2022 5 items',
        status: 'Completed',
        statusColor: 'bg-[#488562]/10 text-[#488562]',
        icon: CheckCircle2,
        iconColor: 'text-[#488562]',
        bgColor: 'bg-[#488562]/10',
    },
    {
        name: 'Order #1246',
        detail: 'Juan Dela Cruz \u2022 3 items',
        status: 'Processing',
        statusColor: 'bg-[#0867ff]/10 text-[#0867ff]',
        icon: Clock,
        iconColor: 'text-[#0867ff]',
        bgColor: 'bg-[#0867ff]/10',
    },
    {
        name: 'Order #1245',
        detail: 'Ana Reyes \u2022 7 items',
        status: 'Completed',
        statusColor: 'bg-[#488562]/10 text-[#488562]',
        icon: CheckCircle2,
        iconColor: 'text-[#488562]',
        bgColor: 'bg-[#488562]/10',
    },
    {
        name: 'Order #1244',
        detail: 'Pedro Garcia \u2022 2 items',
        status: 'Pending',
        statusColor: 'bg-[#ee600e]/10 text-[#ee600e]',
        icon: Clock,
        iconColor: 'text-[#ee600e]',
        bgColor: 'bg-[#ee600e]/10',
    },
];

const topVendors = [
    { name: 'Aling Rosa', initials: 'AR', sales: '342', revenue: '\u20B124.5K' },
    { name: 'Mang Tony', initials: 'MT', sales: '289', revenue: '\u20B118.2K' },
    { name: 'Aling Nena', initials: 'AN', sales: '256', revenue: '\u20B115.8K' },
    { name: 'Kuya Ben', initials: 'KB', sales: '198', revenue: '\u20B112.1K' },
];

const activities = [
    {
        text: 'New vendor "Aling Luz" registered',
        time: '2h ago',
        icon: Store,
        iconColor: 'text-[#488562]',
        bgColor: 'bg-[#488562]/10',
    },
    {
        text: 'AI recommended 12 new recipes',
        time: '4h ago',
        icon: Sparkles,
        iconColor: 'text-[#ee600e]',
        bgColor: 'bg-[#ee600e]/10',
    },
    {
        text: '15 products restocked by vendors',
        time: '6h ago',
        icon: Box,
        iconColor: 'text-[#0867ff]',
        bgColor: 'bg-[#0867ff]/10',
    },
    {
        text: 'New feedback from 3 customers',
        time: '1d ago',
        icon: MessageSquare,
        iconColor: 'text-[#488562]',
        bgColor: 'bg-[#488562]/10',
    },
];
