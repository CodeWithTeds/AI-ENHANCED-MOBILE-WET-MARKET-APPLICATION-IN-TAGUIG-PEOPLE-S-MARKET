import { Link } from '@inertiajs/react';
import {
    BarChart3,
    Box,
    ChevronDown,
    ClipboardList,
    CreditCard,
    LayoutGrid,
    Leaf,
    MapPin,
    MessageSquare,
    Package,
    Settings,
    Sparkles,
    Store,
    Users,
} from 'lucide-react';
import { NavUser } from '@/components/nav-user';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubItem,
    SidebarMenuSubButton,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarSeparator,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import { useCurrentUrl } from '@/hooks/use-current-url';

type SidebarNavItem = {
    title: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bgColor: string;
    children?: { title: string; href: string }[];
};

const mainNavItems: SidebarNavItem[] = [
    {
        title: 'Dashboard',
        href: '/admin/dashboard',
        icon: LayoutGrid,
        color: 'text-[#488562]',
        bgColor: 'bg-[#488562]/10',
    },
    {
        title: 'User Management',
        href: '/admin/dashboard/users',
        icon: Users,
        color: 'text-[#0867ff]',
        bgColor: 'bg-[#0867ff]/10',
    },
    {
        title: 'Vendor Management',
        href: '/admin/dashboard/vendors',
        icon: Store,
        color: 'text-[#ee600e]',
        bgColor: 'bg-[#ee600e]/10',
        children: [
            { title: 'All Vendors', href: '/admin/dashboard/vendors' },
            { title: 'Stall Management', href: '/admin/dashboard/vendors/stalls' },
            { title: 'Pending Approval', href: '/admin/dashboard/vendors/pending' },
            { title: 'Documents', href: '/admin/dashboard/vendors/documents' },
        ],
    },
    {
        title: 'Product Management',
        href: '/admin/dashboard/products',
        icon: Package,
        color: 'text-[#488562]',
        bgColor: 'bg-[#488562]/10',
    },
    {
        title: 'Inventory Monitoring',
        href: '/admin/dashboard/inventory',
        icon: Box,
        color: 'text-[#0867ff]',
        bgColor: 'bg-[#0867ff]/10',
    },
    {
        title: 'Order Management',
        href: '/admin/dashboard/orders',
        icon: ClipboardList,
        color: 'text-[#ee600e]',
        bgColor: 'bg-[#ee600e]/10',
    },
    {
        title: 'Payment Management',
        href: '/admin/dashboard/payments',
        icon: CreditCard,
        color: 'text-[#488562]',
        bgColor: 'bg-[#488562]/10',
    },
    {
        title: 'AI Recommendations',
        href: '/admin/dashboard/recommendations',
        icon: Sparkles,
        color: 'text-[#ee600e]',
        bgColor: 'bg-[#ee600e]/10',
    },
    {
        title: 'Reports & Analytics',
        href: '/admin/dashboard/reports',
        icon: BarChart3,
        color: 'text-[#0867ff]',
        bgColor: 'bg-[#0867ff]/10',
    },
    {
        title: 'Feedback & Complaints',
        href: '/admin/dashboard/feedback',
        icon: MessageSquare,
        color: 'text-[#488562]',
        bgColor: 'bg-[#488562]/10',
    },
];

const settingsNavItems: SidebarNavItem[] = [
    {
        title: 'System Settings',
        href: '/settings/appearance',
        icon: Settings,
        color: 'text-[#ee600e]',
        bgColor: 'bg-[#ee600e]/10',
    },
];

export function AppSidebar() {
    const { isCurrentUrl } = useCurrentUrl();

    return (
        <Sidebar collapsible="icon" variant="inset">
            {/* Header / Logo */}
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-white/15">
                                    <Leaf className="size-4 text-white" />
                                </div>
                                <div className="ml-1 grid flex-1 text-left text-sm">
                                    <span className="truncate font-bold text-white">
                                        TaguigSuki
                                    </span>
                                    <span className="truncate text-[10px] text-white/60">
                                        Admin Panel
                                    </span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                {/* Main Navigation */}
                <SidebarGroup className="px-3 py-2">
                    <SidebarGroupLabel className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                        Main Menu
                    </SidebarGroupLabel>
                    <SidebarMenu>
                        {mainNavItems.map((item) => {
                            const active = isCurrentUrl(item.href);
                            const hasChildren = item.children && item.children.length > 0;
                            const isChildActive = hasChildren && item.children!.some(child => isCurrentUrl(child.href));

                            if (hasChildren) {
                                return (
                                    <Collapsible key={item.title} defaultOpen={isChildActive || active} className="group/collapsible">
                                        <SidebarMenuItem>
                                            <CollapsibleTrigger asChild>
                                                <SidebarMenuButton
                                                    tooltip={{ children: item.title }}
                                                    className={
                                                        active || isChildActive
                                                            ? 'bg-white/15 text-white font-semibold hover:bg-white/20'
                                                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                                                    }
                                                >
                                                    <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active || isChildActive ? 'bg-white' : 'bg-white/10'}`}>
                                                        <item.icon className={`size-3.5 ${active || isChildActive ? item.color : 'text-white/80'}`} />
                                                    </span>
                                                    <span className="text-[13px]">{item.title}</span>
                                                    <ChevronDown className="ml-auto size-4 text-white/50 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                                                </SidebarMenuButton>
                                            </CollapsibleTrigger>
                                            <CollapsibleContent>
                                                <SidebarMenuSub className="border-white/10">
                                                    {item.children!.map((child) => {
                                                        const childActive = isCurrentUrl(child.href);
                                                        return (
                                                            <SidebarMenuSubItem key={child.title}>
                                                                <SidebarMenuSubButton
                                                                    asChild
                                                                    isActive={childActive}
                                                                    className={
                                                                        childActive
                                                                            ? 'text-white font-medium bg-white/10'
                                                                            : 'text-white/60 hover:text-white hover:bg-white/5'
                                                                    }
                                                                >
                                                                    <Link href={child.href} prefetch>
                                                                        <span>{child.title}</span>
                                                                    </Link>
                                                                </SidebarMenuSubButton>
                                                            </SidebarMenuSubItem>
                                                        );
                                                    })}
                                                </SidebarMenuSub>
                                            </CollapsibleContent>
                                        </SidebarMenuItem>
                                    </Collapsible>
                                );
                            }

                            return (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={active}
                                        tooltip={{ children: item.title }}
                                        className={
                                            active
                                                ? 'bg-white/15 text-white font-semibold hover:bg-white/20'
                                                : 'text-white/70 hover:bg-white/10 hover:text-white'
                                        }
                                    >
                                        <Link href={item.href} prefetch>
                                            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? 'bg-white' : 'bg-white/10'}`}>
                                                <item.icon className={`size-3.5 ${active ? item.color : 'text-white/80'}`} />
                                            </span>
                                            <span className="text-[13px]">{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            );
                        })}
                    </SidebarMenu>
                </SidebarGroup>

                <SidebarSeparator className="bg-white/10" />

                {/* Settings */}
                <SidebarGroup className="px-3 py-2">
                    <SidebarGroupLabel className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-white/40">
                        Settings
                    </SidebarGroupLabel>
                    <SidebarMenu>
                        {settingsNavItems.map((item) => {
                            const active = isCurrentUrl(item.href);
                            return (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={active}
                                        tooltip={{ children: item.title }}
                                        className={
                                            active
                                                ? 'bg-white/15 text-white font-semibold hover:bg-white/20'
                                                : 'text-white/70 hover:bg-white/10 hover:text-white'
                                        }
                                    >
                                        <Link href={item.href} prefetch>
                                            <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? 'bg-white' : 'bg-white/10'}`}>
                                                <item.icon className={`size-3.5 ${active ? item.color : 'text-white/80'}`} />
                                            </span>
                                            <span className="text-[13px]">{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            );
                        })}
                    </SidebarMenu>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
