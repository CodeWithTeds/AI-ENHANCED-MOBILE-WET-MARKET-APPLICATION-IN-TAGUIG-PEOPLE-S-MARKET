<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt #{{ $receiptNumber }} - Taguig Suki</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @media print {
            .no-print { display: none !important; }
            body { background: #fff !important; padding: 0 !important; }
            .receipt-box { border: none !important; box-shadow: none !important; width: 100% !important; max-width: 100% !important; }
        }
    </style>
</head>
<body class="bg-gray-100 min-h-screen p-4 sm:p-8 flex flex-col items-center justify-center font-sans">
    <div class="no-print mb-4 flex items-center gap-3">
        <button onclick="window.print()" class="flex items-center gap-2 bg-[#488562] hover:bg-[#3b6d51] text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            Print Receipt / Save PDF
        </button>
        <button onclick="window.history.back()" class="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition">
            Back
        </button>
    </div>

    <div class="receipt-box bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-sm text-gray-800">
        <!-- Receipt Header -->
        <div class="text-center pb-5 border-b border-dashed border-gray-300">
            <div class="text-[11px] font-bold uppercase tracking-wider text-gray-400">Republic of the Philippines</div>
            <div class="text-xs font-semibold text-gray-600">City Government of Taguig</div>
            <h1 class="text-base font-black tracking-wide text-gray-900 mt-0.5">TAGUIG CITY PUBLIC MARKET</h1>
            <div class="inline-block bg-[#488562]/10 text-[#488562] font-black text-[10px] px-2.5 py-0.5 rounded-full uppercase tracking-wider mt-1.5">
                Taguig Suki Official Transaction Receipt
            </div>
        </div>

        <!-- Receipt Metadata -->
        <div class="py-4 border-b border-dashed border-gray-300 text-xs space-y-1.5">
            <div class="flex justify-between">
                <span class="text-gray-500 font-medium">Receipt No:</span>
                <span class="font-bold text-gray-900">{{ $receiptNumber }}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-500 font-medium">Order Number:</span>
                <span class="font-bold text-gray-900">{{ $order->order_number }}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-500 font-medium">Date & Time:</span>
                <span class="font-semibold text-gray-700">{{ $order->created_at->format('M d, Y · h:i A') }}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-500 font-medium">Customer:</span>
                <span class="font-semibold text-gray-900">{{ $order->user?->name ?? 'Walk-in / App User' }}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-500 font-medium">Payment Method:</span>
                <span class="font-bold uppercase text-gray-800">{{ $order->payment_method }}</span>
            </div>
            <div class="flex justify-between">
                <span class="text-gray-500 font-medium">Payment Status:</span>
                <span class="font-bold uppercase text-emerald-700">{{ $order->payment_status }}</span>
            </div>
            @if($order->payment_reference_number || $order->reference_number)
            <div class="flex justify-between">
                <span class="text-gray-500 font-medium">Ref Number:</span>
                <span class="font-mono text-gray-800 font-semibold">{{ $order->payment_reference_number ?? $order->reference_number }}</span>
            </div>
            @endif
        </div>

        <!-- Itemized Products -->
        <div class="py-4 border-b border-dashed border-gray-300">
            <div class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Itemized Purchase</div>
            <div class="space-y-3">
                @foreach($order->items as $item)
                <div class="flex justify-between items-start text-xs">
                    <div class="pr-2">
                        <div class="font-bold text-gray-900">{{ $item->product_name ?? $item->product?->name }}</div>
                        <div class="text-[11px] text-gray-500">
                            Stall: {{ $item->vendor?->stall?->stall_number ?? ($item->vendor?->stall_location ?? 'Stall') }} · {{ $item->vendor?->stall_name }}
                        </div>
                        <div class="text-[10px] text-gray-400">
                            {{ $item->quantity }} {{ $item->unit ?? 'pc' }} @ ₱{{ number_format($item->unit_price, 2) }}
                        </div>
                    </div>
                    <div class="font-black text-gray-900 text-right whitespace-nowrap">
                        ₱{{ number_format($item->subtotal, 2) }}
                    </div>
                </div>
                @endforeach
            </div>
        </div>

        <!-- Financial Summary -->
        <div class="py-4 border-b border-dashed border-gray-300 space-y-1.5 text-xs">
            <div class="flex justify-between text-gray-500 font-medium">
                <span>Subtotal</span>
                <span>₱{{ number_format($order->total_amount, 2) }}</span>
            </div>
            <div class="flex justify-between text-gray-500 font-medium">
                <span>Market Processing Fee</span>
                <span>₱0.00</span>
            </div>
            <div class="flex justify-between text-sm font-black text-gray-900 pt-1 border-t border-gray-100">
                <span>Total Amount Paid</span>
                <span class="text-[#488562]">₱{{ number_format($order->total_amount, 2) }}</span>
            </div>
        </div>

        <!-- Footer -->
        <div class="pt-5 text-center text-[10px] text-gray-400 space-y-1">
            <p class="font-semibold text-gray-500">Thank you for supporting Taguig City Market Vendors!</p>
            <p>Market Address: General Luna St., Taguig, Metro Manila</p>
            <p>System Generated via Taguig Suki Digital Marketplace</p>
        </div>
    </div>
</body>
</html>
