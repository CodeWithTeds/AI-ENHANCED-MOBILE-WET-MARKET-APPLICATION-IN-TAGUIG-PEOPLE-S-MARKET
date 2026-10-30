<?php

use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('users.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id || ($user instanceof User && $user->isAdmin());
});

Broadcast::channel('orders.{orderId}.vendor.{vendorId}', function ($user, $orderId, $vendorId) {
    if ($user instanceof User && $user->isAdmin()) {
        return true;
    }

    $order = Order::find($orderId);
    if (! $order) {
        return false;
    }

    // Authorized if user is the customer who placed the order
    if ((int) $order->user_id === (int) $user->id) {
        return true;
    }

    // Authorized if user is the vendor for this conversation
    $userVendor = $user->vendor ?? null;
    if ($userVendor && (int) $userVendor->id === (int) $vendorId) {
        return true;
    }

    return false;
});

Broadcast::channel('orders.{orderId}', function ($user, $orderId) {
    if ($user instanceof User && $user->isAdmin()) {
        return true;
    }

    $order = Order::with('items')->find($orderId);
    if (! $order) {
        return false;
    }

    if ((int) $order->user_id === (int) $user->id) {
        return true;
    }

    $userVendor = $user->vendor ?? null;
    if ($userVendor && $order->items->contains('vendor_id', $userVendor->id)) {
        return true;
    }

    return false;
});
