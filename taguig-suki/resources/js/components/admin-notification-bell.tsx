import { router, usePage } from '@inertiajs/react';
import { Bell, CheckCheck, Shield, Store } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type AdminNotificationItem = {
    id: string;
    category: string;
    account_type: 'customer' | 'vendor' | string | null;
    applicant_user_id: number | null;
    applicant_name: string | null;
    applicant_email: string | null;
    stall_name: string | null;
    title: string;
    message: string;
    action_url: string;
    is_read: boolean;
    read_at: string | null;
    time_ago: string;
    created_at: string | null;
};

export type AdminNotificationsPayload = {
    unread_count: number;
    pending_customers_count: number;
    pending_vendors_count: number;
    items: AdminNotificationItem[];
};

export function AdminNotificationBell() {
    const { auth, adminNotifications } = usePage<{
        auth?: { user?: { is_admin?: boolean } | null };
        adminNotifications?: AdminNotificationsPayload | null;
    }>().props;

    const [polledState, setPolledState] = useState<{
        base: AdminNotificationsPayload | null | undefined;
        data: AdminNotificationsPayload;
    } | null>(null);
    const [open, setOpen] = useState(false);

    const state =
        (polledState && polledState.base === adminNotifications ? polledState.data : adminNotifications) ?? null;

    const updateState = useCallback(
        (updater: AdminNotificationsPayload | ((prev: AdminNotificationsPayload | null) => AdminNotificationsPayload | null)) => {
            setPolledState((current) => {
                const prevData = (current && current.base === adminNotifications ? current.data : adminNotifications) ?? null;
                const nextData = typeof updater === 'function' ? updater(prevData) : updater;

                if (!nextData) {
                    return null;
                }

                return { base: adminNotifications, data: nextData };
            });
        },
        [adminNotifications],
    );

    const fetchLatest = useCallback(async () => {
        if (!auth?.user?.is_admin) {
            return;
        }

        try {
            const response = await fetch('/admin/dashboard/notifications', {
                credentials: 'same-origin',
                headers: { Accept: 'application/json' },
            });

            if (response.ok) {
                const payload = (await response.json()) as AdminNotificationsPayload;
                updateState(payload);
            }
        } catch {
            // Silently ignore transient polling errors
        }
    }, [auth?.user?.is_admin, updateState]);

    useEffect(() => {
        if (!auth?.user?.is_admin) {
            return;
        }

        const interval = window.setInterval(() => {
            if (document.visibilityState === 'visible') {
                void fetchLatest();
            }
        }, 15000);

        return () => window.clearInterval(interval);
    }, [auth?.user?.is_admin, fetchLatest]);

    if (!auth?.user?.is_admin) {
        return null;
    }

    const unreadCount = state?.unread_count ?? 0;
    const pendingVendors = state?.pending_vendors_count ?? 0;
    const pendingCustomers = state?.pending_customers_count ?? 0;
    const items = state?.items ?? [];

    function handleSelectNotification(item: AdminNotificationItem) {
        setOpen(false);

        if (!item.is_read) {
            updateState((prev) =>
                prev
                    ? {
                          ...prev,
                          unread_count: Math.max(0, prev.unread_count - 1),
                          items: prev.items.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)),
                      }
                    : prev,
            );

            router.patch(
                `/admin/dashboard/notifications/${item.id}/read`,
                {},
                {
                    preserveScroll: true,
                    onSuccess: () => {
                        router.visit(item.action_url || '/admin/dashboard');
                    },
                },
            );

            return;
        }

        router.visit(item.action_url || '/admin/dashboard');
    }

    function handleMarkAllRead() {
        updateState((prev) =>
            prev
                ? {
                      ...prev,
                      unread_count: 0,
                      items: prev.items.map((n) => ({ ...n, is_read: true })),
                  }
                : prev,
        );

        router.post('/admin/dashboard/notifications/read-all', {}, { preserveScroll: true, preserveState: true });
    }

    return (
        <DropdownMenu
            open={open}
            onOpenChange={(next) => {
                setOpen(next);

                if (next) {
                    void fetchLatest();
                }
            }}
        >
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label="Admin notifications"
                    className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
                >
                    <Bell className="h-4 w-4" />
                    {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white shadow-sm">
                            {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                    )}
                </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 rounded-xl border border-gray-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">Notifications</span>
                        {unreadCount > 0 && (
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                                {unreadCount} new
                            </span>
                        )}
                    </div>
                    {unreadCount > 0 && (
                        <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#488562] hover:underline"
                        >
                            <CheckCheck className="h-3.5 w-3.5" />
                            Mark all read
                        </button>
                    )}
                </div>

                {/* Quick pending counts strip */}
                {(pendingVendors > 0 || pendingCustomers > 0) && (
                    <div className="flex items-center gap-2 border-b border-gray-100 bg-amber-50/70 px-4 py-2 text-[11px]">
                        {pendingVendors > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    router.visit('/admin/dashboard/vendors/pending');
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 font-semibold text-[#ee600e] shadow-xs border border-amber-200 hover:bg-amber-50"
                            >
                                <Store className="h-3 w-3" />
                                {pendingVendors} Pending Vendor{pendingVendors > 1 ? 's' : ''}
                            </button>
                        )}
                        {pendingCustomers > 0 && (
                            <button
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    router.visit('/admin/dashboard/users?verification_status=pending');
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 font-semibold text-amber-700 shadow-xs border border-amber-200 hover:bg-amber-50"
                            >
                                <Shield className="h-3 w-3" />
                                {pendingCustomers} Pending Customer{pendingCustomers > 1 ? 's' : ''}
                            </button>
                        )}
                    </div>
                )}

                <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                    {items.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                            <Bell className="mx-auto mb-2 h-6 w-6 text-gray-300" />
                            <p className="text-xs font-medium text-gray-500">No notifications yet</p>
                            <p className="mt-0.5 text-[11px] text-gray-400">
                                New customer and vendor account approval requests will appear here.
                            </p>
                        </div>
                    ) : (
                        items.map((item) => {
                            const isVendor = item.account_type === 'vendor';

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => handleSelectNotification(item)}
                                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-gray-50 ${
                                        !item.is_read ? 'bg-emerald-50/40' : 'bg-white'
                                    }`}
                                >
                                    <div
                                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                            isVendor ? 'bg-[#ee600e]/10 text-[#ee600e]' : 'bg-amber-100 text-amber-700'
                                        }`}
                                    >
                                        {isVendor ? <Store className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-bold text-gray-900 truncate">
                                                {item.title}
                                            </span>
                                            {!item.is_read && (
                                                <span className="h-2 w-2 shrink-0 rounded-full bg-[#488562]" />
                                            )}
                                        </div>
                                        <p className="mt-0.5 text-[11px] leading-snug text-gray-600">
                                            {item.message}
                                        </p>
                                        <span className="mt-1 block text-[10px] text-gray-400">
                                            {item.time_ago}
                                        </span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
