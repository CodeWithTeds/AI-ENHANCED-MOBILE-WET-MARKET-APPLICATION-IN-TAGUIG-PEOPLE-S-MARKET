<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\InventoryLog;
use App\Models\Order;
use App\Models\Product;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class OrderService
{
    /**
     * Place an order atomically:
     *  1. Validate every item has enough stock.
     *  2. Create the Order record.
     *  3. Create OrderItems.
     *  4. Deduct inventory + log each sale.
     *
     * If any step fails the whole transaction rolls back.
     */
    public function placeOrder(User $user, array $items, string $paymentMethod = 'cash', ?string $notes = null): Order
    {
        return DB::transaction(function () use ($user, $items, $paymentMethod, $notes) {

            // ── 1. Load & lock all products in one query ──────────────────
            $productIds = array_column($items, 'product_id');
            $products   = Product::whereIn('id', $productIds)
                ->where('is_available', true)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            // ── 2. Load & lock matching inventories ───────────────────────
            $inventories = Inventory::whereIn('product_id', $productIds)
                ->where('status', 'active')
                ->lockForUpdate()
                ->get()
                ->keyBy('product_id');

            // ── 3. Validate each item ──────────────────────────────────────
            $totalAmount = 0;

            foreach ($items as $item) {
                $product   = $products->get($item['product_id']);
                $inventory = $inventories->get($item['product_id']);
                $qty       = (int) $item['quantity'];

                if (!$product) {
                    throw new UnprocessableEntityHttpException(
                        "Product \"{$item['product_name']}\" is no longer available."
                    );
                }

                // If vendor has no inventory record, skip stock check (allow legacy products)
                if ($inventory) {
                    if ($inventory->stock_quantity <= 0) {
                        throw new UnprocessableEntityHttpException(
                            "\"$product->name\" is currently out of stock."
                        );
                    }

                    if ($inventory->stock_quantity < $qty) {
                        throw new UnprocessableEntityHttpException(
                            "Only {$inventory->stock_quantity} item(s) of \"$product->name\" remaining in stock."
                        );
                    }
                }

                $totalAmount += $product->price * $qty;
            }

            // ── 4. Create Order ────────────────────────────────────────────
            $order = Order::create([
                'user_id'        => $user->id,
                'order_number'   => Order::generateOrderNumber(),
                'status'         => 'pending',
                'total_amount'   => round($totalAmount, 2),
                'payment_method' => $paymentMethod,
                'notes'          => $notes,
            ]);

            // ── 5. Create Order Items + Deduct Inventory ───────────────────
            foreach ($items as $item) {
                $product   = $products->get($item['product_id']);
                $inventory = $inventories->get($item['product_id']);
                $qty       = (int) $item['quantity'];
                $unitPrice = (float) $product->price;

                // Create order item (snapshot of product data at purchase time)
                $order->items()->create([
                    'product_id'   => $product->id,
                    'vendor_id'    => $product->vendor_id,
                    'product_name' => $product->name,
                    'category'     => $product->category,
                    'unit'         => $product->unit,
                    'quantity'     => $qty,
                    'unit_price'   => $unitPrice,
                    'subtotal'     => round($unitPrice * $qty, 2),
                ]);

                // Deduct stock and log the sale
                if ($inventory) {
                    $before = $inventory->stock_quantity;
                    $after  = max(0, $before - $qty);

                    $inventory->update(['stock_quantity' => $after]);

                    InventoryLog::create([
                        'inventory_id'     => $inventory->id,
                        'vendor_id'        => $inventory->vendor_id,
                        'product_id'       => $product->id,
                        'type'             => 'sold',
                        'quantity_before'  => $before,
                        'quantity_change'  => -$qty,
                        'quantity_after'   => $after,
                        'reason'           => "Customer order #{$order->order_number}",
                        'reference_number' => $order->order_number,
                        'unit_cost'        => $inventory->cost_price,
                        'performed_by'     => $user->name,
                    ]);
                }
            }

            return $order->load('items');
        });
    }

    /**
     * Get paginated order history for a customer.
     */
    public function getCustomerOrders(User $user, int $perPage = 20)
    {
        return Order::where('user_id', $user->id)
            ->with(['items'])
            ->orderByDesc('created_at')
            ->paginate($perPage);
    }

    /**
     * Get a single order (customer must own it).
     */
    public function getOrder(User $user, int $orderId): Order
    {
        return Order::where('user_id', $user->id)
            ->with(['items'])
            ->findOrFail($orderId);
    }

    /**
     * Get all orders that contain items belonging to this vendor.
     * Groups by order, includes only items relevant to this vendor.
     */
    public function getVendorOrders(User $user): \Illuminate\Support\Collection
    {
        $vendor = $user->vendor ?? null;

        if (!$vendor) {
            return collect();
        }

        // Find all orders that have at least one item for this vendor
        return Order::whereHas('items', fn ($q) => $q->where('vendor_id', $vendor->id))
            ->with([
                'items' => fn ($q) => $q->where('vendor_id', $vendor->id),
                'user:id,name,email',
            ])
            ->orderByDesc('created_at')
            ->get();
    }

    /**
     * Vendor updates the status of an order they own items in.
     */
    public function updateOrderStatus(User $user, int $orderId, string $status): Order
    {
        $vendor = $user->vendor ?? null;

        if (!$vendor) {
            throw new \Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException('Vendor profile not found');
        }

        // Confirm this vendor has items in this order
        $order = Order::whereHas('items', fn ($q) => $q->where('vendor_id', $vendor->id))
            ->findOrFail($orderId);

        $order->update(['status' => $status]);

        return $order->load(['items' => fn ($q) => $q->where('vendor_id', $vendor->id), 'user:id,name,email']);
    }
}
