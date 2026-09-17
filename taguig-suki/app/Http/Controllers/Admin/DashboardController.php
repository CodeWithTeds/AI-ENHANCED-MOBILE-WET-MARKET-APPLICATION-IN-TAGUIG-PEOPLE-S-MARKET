<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CustomerVerification;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\RecipeRecommendation;
use App\Models\Review;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function index(Request $request): Response
    {
        // KPIs
        $totalVendors = Vendor::count();
        $totalOrders = Order::count();
        $totalProducts = Product::count();
        $activeUsers = User::where('is_active', true)->orWhereNull('is_active')->count();

        // Monthly overview (simple)
        $ordersThisMonth = Order::whereMonth('created_at', now()->month)->count();
        $customersThisMonth = User::where('is_admin', false)->whereMonth('created_at', now()->month)->count();
        $monthlyDone = Order::whereMonth('created_at', now()->month)->where('status', '!=', 'cancelled')->sum('total_amount');
        // Use 20k target like static design, percent capped 100
        $monthlyTarget = 20000;
        $monthlyPercent = $monthlyTarget > 0 ? min(100, (int) round(($ordersThisMonth / max(1, $monthlyTarget)) * 100)) : 0;

        // Recent orders (4)
        $recentOrders = Order::with(['user:id,name'])
            ->latest()
            ->take(4)
            ->get()
            ->map(function (Order $order) {
                $status = strtolower($order->status ?? 'pending');
                $map = [
                    'completed' => ['label' => 'Completed', 'color' => 'bg-[#488562]/10 text-[#488562]', 'bg' => 'bg-[#488562]/10', 'iconColor' => 'text-[#488562]'],
                    'pending' => ['label' => 'Pending', 'color' => 'bg-[#ee600e]/10 text-[#ee600e]', 'bg' => 'bg-[#ee600e]/10', 'iconColor' => 'text-[#ee600e]'],
                    'processing' => ['label' => 'Processing', 'color' => 'bg-[#0867ff]/10 text-[#0867ff]', 'bg' => 'bg-[#0867ff]/10', 'iconColor' => 'text-[#0867ff]'],
                    'confirmed' => ['label' => 'Confirmed', 'color' => 'bg-[#0867ff]/10 text-[#0867ff]', 'bg' => 'bg-[#0867ff]/10', 'iconColor' => 'text-[#0867ff]'],
                    'ready' => ['label' => 'Ready', 'color' => 'bg-[#0867ff]/10 text-[#0867ff]', 'bg' => 'bg-[#0867ff]/10', 'iconColor' => 'text-[#0867ff]'],
                    'cancelled' => ['label' => 'Cancelled', 'color' => 'bg-red-50 text-red-600', 'bg' => 'bg-red-50', 'iconColor' => 'text-red-500'],
                ];
                $meta = $map[$status] ?? $map['pending'];
                return [
                    'name' => $order->order_number ?? 'Order #' . $order->id,
                    'detail' => ($order->user->name ?? 'Customer') . ' • ' . $order->items()->count() . ' items',
                    'status' => $meta['label'],
                    'statusColor' => $meta['color'],
                    'bgColor' => $meta['bg'],
                    // icon type for frontend mapping
                    'icon' => $status === 'completed' ? 'CheckCircle2' : 'Clock',
                    'iconColor' => $meta['iconColor'],
                ];
            })
            ->all();

        // Fill placeholder if empty
        if (empty($recentOrders)) {
            $recentOrders = [
                ['name' => 'No orders yet', 'detail' => '—', 'status' => 'Pending', 'statusColor' => 'bg-gray-100 text-gray-500', 'bgColor' => 'bg-gray-100', 'icon' => 'Clock', 'iconColor' => 'text-gray-400'],
            ];
        }

        // Top vendors by revenue (6)
        $topVendors = OrderItem::query()
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('vendors', 'order_items.vendor_id', '=', 'vendors.id')
            ->where('orders.status', '!=', 'cancelled')
            ->select('vendors.stall_name', DB::raw('COUNT(DISTINCT order_items.order_id) as orders'), DB::raw('SUM(order_items.subtotal) as revenue'))
            ->groupBy('vendors.stall_name')
            ->orderByDesc('revenue')
            ->limit(4)
            ->get()
            ->map(function ($row) {
                $name = $row->stall_name;
                $parts = explode(' ', trim($name));
                $initials = strtoupper(substr($parts[0] ?? 'M', 0, 1) . substr($parts[1] ?? 'V', 0, 1));
                return [
                    'name' => $name,
                    'initials' => $initials,
                    'sales' => (string) $row->orders,
                    'revenue' => '₱' . number_format((float) $row->revenue, 1) . 'K',
                ];
            })
            ->all();

        if (empty($topVendors)) {
            // Fallback to vendors with most products if no sales yet
            $topVendors = Vendor::withCount('products')->orderByDesc('products_count')->limit(4)->get()->map(function (Vendor $v) {
                $parts = explode(' ', trim($v->stall_name ?? 'Vendor'));
                $initials = strtoupper(substr($parts[0] ?? 'V', 0, 1) . substr($parts[1] ?? 'A', 0, 1));
                return ['name' => $v->stall_name ?? 'Vendor', 'initials' => $initials, 'sales' => (string) $v->products_count, 'revenue' => '—'];
            })->all();
        }
        if (empty($topVendors)) {
            $topVendors = [
                ['name' => 'No vendors yet', 'initials' => 'NV', 'sales' => '0', 'revenue' => '₱0'],
            ];
        }

        // Activity feed (mix of recent verifications, vendors, orders, reviews, AI)
        $activities = collect();

        $latestVendor = Vendor::latest()->first();
        if ($latestVendor) {
            $activities->push([
                'text' => 'New vendor "' . $latestVendor->stall_name . '" registered',
                'time' => $latestVendor->created_at?->diffForHumans() ?? 'just now',
                'icon' => 'Store',
                'iconColor' => 'text-[#488562]',
                'bgColor' => 'bg-[#488562]/10',
            ]);
        }

        $latestVerification = CustomerVerification::with('user')->where('status', 'pending')->latest('submitted_at')->first();
        if ($latestVerification && $latestVerification->user) {
            $activities->push([
                'text' => 'ID verification pending for ' . $latestVerification->user->name,
                'time' => $latestVerification->submitted_at?->diffForHumans() ?? 'recently',
                'icon' => 'Shield',
                'iconColor' => 'text-[#d97706]',
                'bgColor' => 'bg-[#d97706]/10',
            ]);
        }

        $aiCount = RecipeRecommendation::whereDate('created_at', today())->count();
        if ($aiCount > 0) {
            $activities->push([
                'text' => "AI recommended {$aiCount} new recipes today",
                'time' => 'today',
                'icon' => 'Sparkles',
                'iconColor' => 'text-[#ee600e]',
                'bgColor' => 'bg-[#ee600e]/10',
            ]);
        }

        $newProducts = Product::whereDate('created_at', today())->count();
        if ($newProducts > 0) {
            $activities->push([
                'text' => "{$newProducts} products restocked by vendors",
                'time' => 'today',
                'icon' => 'Box',
                'iconColor' => 'text-[#0867ff]',
                'bgColor' => 'bg-[#0867ff]/10',
            ]);
        }

        $newReviews = Review::whereDate('created_at', today())->count();
        if ($newReviews > 0) {
            $activities->push([
                'text' => "New feedback from {$newReviews} customers",
                'time' => 'today',
                'icon' => 'MessageSquare',
                'iconColor' => 'text-[#488562]',
                'bgColor' => 'bg-[#488562]/10',
            ]);
        }

        if ($activities->isEmpty()) {
            $activities->push([
                'text' => 'Welcome to TaguigSuki Admin',
                'time' => 'now',
                'icon' => 'Store',
                'iconColor' => 'text-[#488562]',
                'bgColor' => 'bg-[#488562]/10',
            ]);
        }

        $activities = $activities->take(4)->values()->all();

        // Bottom stats
        $ordersToday = Order::whereDate('created_at', today())->count();
        $activeThisWeek = User::where('created_at', '>=', now()->subWeek())->count();
        $revenueThisMonth = Order::where('status', '!=', 'cancelled')->whereMonth('created_at', now()->month)->sum('total_amount');

        return Inertia::render('dashboard', [
            'stats' => [
                ['label' => 'Total Vendors', 'value' => (string) $totalVendors, 'change' => '+' . $totalVendors . ' total', 'icon' => 'Store', 'color' => '#488562'],
                ['label' => 'Total Orders', 'value' => number_format($totalOrders), 'change' => '+' . $ordersThisMonth . ' this month', 'icon' => 'ShoppingCart', 'color' => '#0867ff'],
                ['label' => 'Products', 'value' => number_format($totalProducts), 'change' => $totalProducts . ' listed', 'icon' => 'Package', 'color' => '#ee600e'],
                ['label' => 'Active Users', 'value' => number_format($activeUsers), 'change' => '+' . $activeThisWeek . ' this week', 'icon' => 'Users', 'color' => '#488562'],
            ],
            'monthly' => [
                'done' => $ordersThisMonth,
                'total' => 20000,
                'percent' => $monthlyPercent,
                'orders' => $ordersThisMonth,
                'customers' => $customersThisMonth,
            ],
            'recentOrders' => $recentOrders,
            'topVendors' => $topVendors,
            'activities' => $activities,
            'bottom' => [
                'ordersToday' => $ordersToday,
                'activeThisWeek' => $activeThisWeek,
                'revenueThisMonth' => $revenueThisMonth,
            ],
            'pendingVerifications' => CustomerVerification::where('status', 'pending')->count(),
        ]);
    }
}
