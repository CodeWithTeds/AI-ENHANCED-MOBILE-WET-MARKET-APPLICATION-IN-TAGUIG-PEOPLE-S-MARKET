<?php

use App\Enums\StallStatus;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\ProductDeletionLog;
use App\Models\Review;
use App\Models\Section;
use App\Models\Stall;
use App\Models\StallRentalPayment;
use App\Models\User;
use App\Models\Vendor;
use App\Models\VendorContractRequest;
use App\Services\Admin\FeedbackManagementService;
use App\Services\Admin\ReportsAnalyticsService;
use App\Services\Admin\StallComplaintService;
use App\Services\Admin\StallManagementService;
use App\Services\Admin\StallRentalService;
use App\Services\Admin\VendorContractService;
use App\Services\MarketplaceService;
use App\Services\OrderService;
use App\Services\RecipeService;
use App\Services\ReviewService;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

function makeSuggestionsRevisionFixture(): array
{
    $admin = User::factory()->create(['name' => 'Admin Officer', 'is_admin' => true]);
    $customer = User::factory()->create(['name' => 'Juana Dela Cruz', 'email' => 'juana@example.com']);
    $vendorUser = User::factory()->create(['name' => 'Mang Pedro']);

    $section = Section::firstOrCreate(
        ['name' => 'Meat Section'],
        ['slug' => 'meat-section', 'code' => 'MEAT', 'floor' => 'Ground Floor', 'description' => 'Fresh Pork and Beef']
    );

    $vendor = Vendor::create([
        'user_id' => $vendorUser->id,
        'stall_name' => 'Pedro Meat Shop',
        'stall_location' => 'Stall 1, Meat Section',
        'product_categories' => ['meat'],
        'status' => 'approved',
        'approved_at' => now(),
        'contract_start_date' => now()->subMonths(11)->toDateString(),
        'contract_end_date' => now()->addDays(20)->toDateString(), // within 30 days => expiring_soon
        'contract_status' => 'active',
    ]);

    $stall = Stall::create([
        'stall_number' => 'Stall 1',
        'section_id' => $section->id,
        'section' => 'meat-section',
        'store_name' => 'Pedro Meat Shop',
        'vendor_id' => $vendorUser->id,
        'status' => 'occupied',
        'monthly_rent' => 2500.00,
    ]);

    $product = Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Pork Belly (Liempo)',
        'description' => 'Fresh pork liempo cut',
        'category' => 'Meat',
        'price' => 320.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    return compact('admin', 'customer', 'vendorUser', 'vendor', 'section', 'stall', 'product');
}

test('Item 1: landing page displays APK package name and version details', function () {
    $response = $this->get('/');

    $response->assertStatus(200);
});

test('Item 2: daily sales and revenue report generates accurate totals and payment breakdown', function () {
    $fx = makeSuggestionsRevisionFixture();

    $order = Order::create([
        'user_id' => $fx['customer']->id,
        'order_number' => 'TS-DAILY-001',
        'status' => 'completed',
        'total_amount' => 640.00,
        'payment_method' => 'gcash',
        'payment_status' => 'paid',
    ]);

    OrderItem::create([
        'order_id' => $order->id,
        'product_id' => $fx['product']->id,
        'vendor_id' => $fx['vendor']->id,
        'product_name' => $fx['product']->name,
        'category' => 'Meat',
        'unit' => 'kg',
        'quantity' => 2,
        'unit_price' => 320.00,
        'subtotal' => 640.00,
    ]);

    $reportsService = app(ReportsAnalyticsService::class);
    $dailyReport = $reportsService->getDailySalesReport(now()->toDateString());

    expect($dailyReport)->toHaveKey('total_revenue')
        ->and($dailyReport['completed_orders'])->toBeGreaterThanOrEqual(1)
        ->and($dailyReport['total_revenue'])->toBeGreaterThanOrEqual(640.00)
        ->and($dailyReport['payment_breakdown']['gcash'])->toBeGreaterThanOrEqual(640.00)
        ->and(count($dailyReport['transactions']))->toBeGreaterThanOrEqual(1);
});

test('Item 3: product report clarifies admin purpose, price variance, and multi-stall stock', function () {
    $fx = makeSuggestionsRevisionFixture();

    $vendorUser2 = User::factory()->create(['name' => 'Aling Nena']);
    $vendor2 = Vendor::create([
        'user_id' => $vendorUser2->id,
        'stall_name' => 'Nena Pork Center',
        'stall_location' => 'Stall 2, Meat Section',
        'product_categories' => ['meat'],
        'status' => 'approved',
    ]);

    Stall::create([
        'stall_number' => 'Stall 2',
        'section_id' => $fx['section']->id,
        'section' => 'meat-section',
        'store_name' => 'Nena Pork Center',
        'vendor_id' => $vendorUser2->id,
        'status' => 'occupied',
        'monthly_rent' => 2500.00,
    ]);

    Product::create([
        'vendor_id' => $vendor2->id,
        'name' => 'Pork Belly (Liempo)',
        'description' => 'Fresh pork liempo cut',
        'category' => 'Meat',
        'price' => 350.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    $reportsService = app(ReportsAnalyticsService::class);
    $productReport = $reportsService->getProductReportData();

    expect($productReport['purpose'])->toContain('Clarify the purpose of Product Report')
        ->and($productReport['products'])->not->toBeEmpty();

    $liempoRow = collect($productReport['products'])->firstWhere('name', 'Pork belly (liempo)');
    expect($liempoRow)->not->toBeNull()
        ->and($liempoRow['stalls_count'])->toBe(2)
        ->and($liempoRow['min_price'])->toBe(320.0)
        ->and($liempoRow['max_price'])->toBe(350.0)
        ->and($liempoRow['price_variance'])->toBe(30.0);
});

test('Item 4: stall management enforces maximum 30 stalls per section and slot dropdown', function () {
    $fx = makeSuggestionsRevisionFixture();
    $stallService = app(StallManagementService::class);

    $existingCount = Stall::where('section_id', $fx['section']->id)->count();
    for ($i = $existingCount + 1; $i <= 30; $i++) {
        Stall::create([
            'stall_number' => "Stall {$i}",
            'section_id' => $fx['section']->id,
            'section' => 'meat-section',
            'store_name' => "Stall {$i} Shop",
            'status' => 'vacant',
            'monthly_rent' => 2000.00,
        ]);
    }

    expect(function () use ($stallService, $fx) {
        $stallService->create([
            'stall_number' => 'Stall 31',
            'section_id' => $fx['section']->id,
            'store_name' => 'Excess Stall Shop',
            'status' => 'vacant',
            'monthly_rent' => 2000.00,
        ]);
    })->toThrow(ValidationException::class);

    $indexData = $stallService->getIndexData([]);
    expect($indexData)->toHaveKeys(['stalls', 'stats', 'sections', 'available_stall_numbers', 'occupied_slots', 'market_capacity_per_section'])
        ->and($indexData['occupied_slots']->has($fx['section']->id))->toBeTrue()
        ->and($indexData['market_capacity_per_section'])->toBe(30);
});

test('Item 5: customer can submit stall complaint and admin can resolve compliance', function () {
    $fx = makeSuggestionsRevisionFixture();
    $complaintService = app(StallComplaintService::class);

    $complaint = $complaintService->createComplaint($fx['customer'], $fx['stall'], [
        'complaint_type' => 'bad_smell',
        'description' => 'Stall has an unpleasant foul odor and poor drainage cleanliness.',
    ]);

    expect($complaint->complaint_type)->toBe('bad_smell')
        ->and($complaint->status)->toBe('pending');

    $resolved = $complaintService->updateStatus($complaint, $fx['admin'], 'resolved', 'Inspected drainage; vendor sanitized stall area.');

    expect($resolved->status)->toBe('resolved')
        ->and($resolved->action_taken)->toContain('sanitized stall area');
});

test('Item 6: AI recommendation prioritizes highest-rated vendor and returns vendor comparisons', function () {
    $fx = makeSuggestionsRevisionFixture();

    $vendorUser2 = User::factory()->create(['name' => 'Top Rated Vendor']);
    $vendor2 = Vendor::create([
        'user_id' => $vendorUser2->id,
        'stall_name' => 'Premium Meat Stall',
        'stall_location' => 'Stall 5, Meat Section',
        'product_categories' => ['meat'],
        'status' => 'approved',
    ]);

    $p2 = Product::create([
        'vendor_id' => $vendor2->id,
        'name' => 'Pork Belly (Liempo)',
        'description' => 'Highest grade pork',
        'category' => 'Meat',
        'price' => 340.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    // Order containing vendor 2
    $order = Order::create([
        'user_id' => $fx['customer']->id,
        'order_number' => 'TS-ORD-REV-2',
        'status' => 'completed',
        'total_amount' => 340.00,
        'payment_method' => 'cash',
        'payment_status' => 'paid',
    ]);

    OrderItem::create([
        'order_id' => $order->id,
        'product_id' => $p2->id,
        'vendor_id' => $vendor2->id,
        'product_name' => $p2->name,
        'category' => 'Meat',
        'unit' => 'kg',
        'quantity' => 1,
        'unit_price' => 340.00,
        'subtotal' => 340.00,
    ]);

    // Give vendor 2 a 5-star review
    app(ReviewService::class)->createVendorReview($fx['customer'], [
        'order_id' => $order->id,
        'vendor_id' => $vendor2->id,
        'rating' => 5,
        'comment' => 'Clean and fresh meat!',
    ]);

    $marketService = app(MarketplaceService::class);
    $productData = $marketService->getProduct($fx['product']->id);

    expect($productData)->toHaveKey('comparison_vendors')
        ->and(count($productData['comparison_vendors']))->toBeGreaterThanOrEqual(1);

    $topVendor = $productData['comparison_vendors'][0];
    expect($topVendor['is_ai_recommended'])->toBeTrue()
        ->and($topVendor['vendor_id'])->toBe($vendor2->id);

    // Verify search('Pork') returns all vendors selling pork, with top-rated vendor prioritized first
    $searchResults = $marketService->search('Pork');
    expect($searchResults->total())->toBeGreaterThanOrEqual(2)
        ->and($searchResults->items()[0]->vendor_id)->toBe($vendor2->id)
        ->and($searchResults->items()[0]->is_ai_recommended)->toBeTrue()
        ->and($searchResults->items()[1]->vendor_id)->toBe($fx['vendor']->id);
});

test('Item 7: vendor contract expiration alerts and renewal workflow', function () {
    $fx = makeSuggestionsRevisionFixture();
    $contractService = app(VendorContractService::class);

    $counts = $contractService->checkExpiringContracts();
    expect($counts['expiring_soon_count'])->toBeGreaterThanOrEqual(1)
        ->and($fx['vendor']->fresh()->contract_status)->toBe('expiring_soon');

    // Vendor requests renewal
    $renewRequested = $contractService->requestRenewal($fx['vendor'], 'Requesting 1-year contract extension.');
    expect($renewRequested->contract_status)->toBe('renewal_requested');

    // Admin approves renewal
    $approved = $contractService->approveRenewal($fx['vendor'], 12);
    expect($approved->contract_status)->toBe('active')
        ->and($approved->contract_end_date->isFuture())->toBeTrue();
});

test('Item 8 & 11: monthly stall rental billing and rental reports', function () {
    $fx = makeSuggestionsRevisionFixture();
    $rentalService = app(StallRentalService::class);

    $billingPeriod = now()->format('Y-m');
    $generated = $rentalService->generateMonthlyBills($billingPeriod);

    expect($generated)->toBeGreaterThanOrEqual(1);

    $rental = StallRentalPayment::where('stall_id', $fx['stall']->id)
        ->where('billing_period', $billingPeriod)
        ->first();

    expect($rental)->not->toBeNull()
        ->and((float) $rental->amount)->toBe(2500.0);

    // Vendor submits payment
    $paidRental = $rentalService->recordPayment(
        $rental,
        'gcash',
        'GCASH-RENT-12345'
    );
    expect($paidRental->status)->toBe('pending');

    // Admin verifies payment
    $verified = $rentalService->verifyPayment($paidRental, $fx['admin']);
    expect($verified->status)->toBe('paid');

    // Rental report
    $reportData = $rentalService->getRentalReportData();
    expect($reportData['summary']['total_vendors'])->toBeGreaterThanOrEqual(1)
        ->and($reportData['summary']['total_rent_collected'])->toBeGreaterThanOrEqual(2500.0);
});

test('Item 9: customer receipt endpoint returns complete transaction receipt with stall details', function () {
    $fx = makeSuggestionsRevisionFixture();

    $order = Order::create([
        'user_id' => $fx['customer']->id,
        'order_number' => 'TS-ORD-REC-001',
        'status' => 'completed',
        'total_amount' => 320.00,
        'payment_method' => 'gcash',
        'payment_status' => 'paid',
        'payment_reference_number' => 'GCASH987654321',
    ]);

    OrderItem::create([
        'order_id' => $order->id,
        'product_id' => $fx['product']->id,
        'vendor_id' => $fx['vendor']->id,
        'product_name' => $fx['product']->name,
        'category' => 'Meat',
        'unit' => 'kg',
        'quantity' => 1,
        'unit_price' => 320.00,
        'subtotal' => 320.00,
    ]);

    $orderService = app(OrderService::class);
    $receipt = $orderService->getReceiptData($fx['customer'], $order->id);

    expect($receipt)->toHaveKey('receipt_number')
        ->and($receipt['order_number'])->toBe('TS-ORD-REC-001')
        ->and($receipt['payment_reference'])->toBe('GCASH987654321')
        ->and($receipt['items'][0]['vendor_name'])->toBe('Pedro Meat Shop')
        ->and($receipt['total_amount'])->toBe(320.0);

    // Also test web printable receipt route
    $response = $this->get("/orders/{$order->order_number}/receipt");
    $response->assertStatus(200)
        ->assertSee('TAGUIG CITY PUBLIC MARKET')
        ->assertSee('TS-ORD-REC-001')
        ->assertSee('Pedro Meat Shop');
});

test('Item 12: vendor payment details endpoint functions cleanly without infinite loading', function () {
    $fx = makeSuggestionsRevisionFixture();

    $fx['vendor']->update([
        'gcash_number' => '09171234567',
        'maya_number' => '09187654321',
    ]);

    $response = $this->actingAs($fx['customer'])
        ->postJson('/api/v1/orders/payment-details', [
            'items' => [
                ['product_id' => $fx['product']->id, 'quantity' => 2],
            ],
        ]);

    $response->assertStatus(200)
        ->assertJsonPath('data.0.stall_name', 'Pedro Meat Shop')
        ->assertJsonPath('data.0.gcash.number', '09171234567')
        ->assertJsonPath('data.0.maya.number', '09187654321');
});

test('Item 13: customer can rate vendor/product per distinct order', function () {
    $fx = makeSuggestionsRevisionFixture();
    $reviewService = app(ReviewService::class);

    // Order 1
    $order1 = Order::create([
        'user_id' => $fx['customer']->id,
        'order_number' => 'TS-RATE-001',
        'status' => 'completed',
        'total_amount' => 320.00,
        'payment_method' => 'cash',
        'payment_status' => 'paid',
    ]);

    OrderItem::create([
        'order_id' => $order1->id,
        'product_id' => $fx['product']->id,
        'vendor_id' => $fx['vendor']->id,
        'product_name' => $fx['product']->name,
        'category' => 'Meat',
        'unit' => 'kg',
        'quantity' => 1,
        'unit_price' => 320.00,
        'subtotal' => 320.00,
    ]);

    $review1 = $reviewService->createVendorReview($fx['customer'], [
        'order_id' => $order1->id,
        'vendor_id' => $fx['vendor']->id,
        'rating' => 4,
        'comment' => 'First order was good.',
    ]);
    expect($review1->id)->not->toBeNull();

    // Order 2 (same vendor, subsequent order)
    $order2 = Order::create([
        'user_id' => $fx['customer']->id,
        'order_number' => 'TS-RATE-002',
        'status' => 'completed',
        'total_amount' => 640.00,
        'payment_method' => 'cash',
        'payment_status' => 'paid',
    ]);

    OrderItem::create([
        'order_id' => $order2->id,
        'product_id' => $fx['product']->id,
        'vendor_id' => $fx['vendor']->id,
        'product_name' => $fx['product']->name,
        'category' => 'Meat',
        'unit' => 'kg',
        'quantity' => 2,
        'unit_price' => 320.00,
        'subtotal' => 640.00,
    ]);

    // Should succeed because order_id is distinct
    $review2 = $reviewService->createVendorReview($fx['customer'], [
        'order_id' => $order2->id,
        'vendor_id' => $fx['vendor']->id,
        'rating' => 5,
        'comment' => 'Second order was even better!',
    ]);
    expect($review2->id)->not->toBeNull();
});

test('Item 14: vendor registration requires valid ID, business permit, sanitary permit, and DTI registration', function () {
    $section = Section::firstOrCreate(
        ['name' => 'Vegetable Section'],
        ['slug' => 'vegetable-section', 'code' => 'VEG', 'floor' => 'Ground Floor']
    );

    $vacantStall = Stall::create([
        'stall_number' => 'Stall 15',
        'section_id' => $section->id,
        'section' => 'vegetable-section',
        'store_name' => 'Vacant Stall 15',
        'status' => 'vacant',
        'monthly_rent' => 2000.00,
    ]);

    $response = $this->postJson('/api/v1/vendor/register', [
        'full_name' => 'Juan Mercado',
        'email' => 'juan@example.com',
        'phone' => '09171234567',
        'password' => 'SecurePass123!',
        'stall_name' => 'Mercado Greens',
        'stall_id' => $vacantStall->id,
        'product_categories' => ['vegetables'],
        // Missing the 4 mandatory documents: valid_id, business_permit, sanitary_permit, dti_registration
    ]);

    $response->assertStatus(422);
    $errors = $response->json('data') ?? [];
    expect($errors)->toHaveKey('valid_id')
        ->and($errors)->toHaveKey('business_permit')
        ->and($errors)->toHaveKey('sanitary_permit')
        ->and($errors)->toHaveKey('dti_registration');
});

test('Item 15: AI recommendation recipe service grounds on live database products and stalls', function () {
    $fx = makeSuggestionsRevisionFixture();

    config(['services.gemini.api_key' => 'fake-gemini-key']);
    Http::fake([
        'https://generativelanguage.googleapis.com/*' => Http::response([
            'candidates' => [
                [
                    'content' => [
                        'parts' => [
                            [
                                'text' => json_encode([
                                    'found' => true,
                                    'recipe_name' => 'Sinigang na Baboy',
                                    'description' => 'Classic Filipino sour pork soup.',
                                    'servings' => '4 pax',
                                    'prep_time' => '15 mins',
                                    'cook_time' => '45 mins',
                                    'ingredients' => [
                                        ['name' => 'Pork Belly (Liempo)', 'quantity' => '1 kg', 'available_in_market' => true],
                                    ],
                                    'steps' => ['Boil pork in water with tomatoes.', 'Add sinigang mix.'],
                                    'tips' => 'Serve hot.',
                                ]),
                            ],
                        ],
                    ],
                ],
            ],
        ], 200),
    ]);

    $recipeService = app(RecipeService::class);
    $recipe = $recipeService->generateRecipe('Sinigang');

    expect($recipe['found'])->toBeTrue()
        ->and($recipe['recipe_name'])->toBe('Sinigang na Baboy')
        ->and(count($recipe['matching_products']))->toBeGreaterThanOrEqual(1)
        ->and($recipe['matching_products'][0]['stall_number'])->toContain('Stall 1')
        ->and($recipe['matching_products'][0]['vendor_name'])->toBe('Pedro Meat Shop');
});

test('Item 16: Product Deletion Reason and Vendor Notification (Admin and Vendor Interface)', function () {
    $fx = makeSuggestionsRevisionFixture();
    $admin = $fx['admin'];
    $vendorUser = $fx['vendorUser'];
    $vendor = $fx['vendor'];

    $product = Product::create([
        'vendor_id' => $vendor->id,
        'name' => 'Expired Canned Meat',
        'description' => 'Suspect expired batch',
        'category' => 'meat',
        'price' => 150.00,
        'unit' => 'pcs',
        'is_available' => true,
    ]);

    // 1. Admin deletion fails without a reason
    $responseNoReason = $this->actingAs($admin)
        ->delete(route('products.destroy', $product), []);
    $responseNoReason->assertSessionHasErrors(['reason']);

    // Reason must be at least 5 characters
    $responseShortReason = $this->actingAs($admin)
        ->delete(route('products.destroy', $product), ['reason' => 'bad']);
    $responseShortReason->assertSessionHasErrors(['reason']);

    // 2. Admin deletion succeeds with a valid reason
    $reason = 'Item violated public health guidelines due to expired packaging date.';
    $responseSuccess = $this->actingAs($admin)
        ->delete(route('products.destroy', $product), [
            'reason' => $reason,
        ]);
    $responseSuccess->assertRedirect();
    $responseSuccess->assertSessionHas('success');

    // 3. Product record is soft deleted and reason is recorded
    $deletedProduct = Product::withTrashed()->find($product->id);
    expect($deletedProduct->trashed())->toBeTrue()
        ->and($deletedProduct->deletion_reason)->toBe($reason)
        ->and((int) $deletedProduct->deleted_by)->toBe((int) $admin->id);

    // 4. Product deletion log was created
    $log = ProductDeletionLog::where('product_id', $product->id)->first();
    expect($log)->not->toBeNull()
        ->and($log->vendor_id)->toBe($vendor->id)
        ->and($log->product_name)->toBe('Expired Canned Meat')
        ->and($log->reason)->toBe($reason)
        ->and((int) $log->deleted_by_id)->toBe((int) $admin->id);

    // 5. Vendor received the automatic in-app notification
    expect($vendorUser->notifications()->count())->toBe(1);
    $notification = $vendorUser->notifications()->first();
    expect($notification->data['category'])->toBe('product_deleted')
        ->and($notification->data['reason'])->toBe($reason)
        ->and($notification->data['product_name'])->toBe('Expired Canned Meat')
        ->and($notification->data['admin_name'])->toBe($admin->name);

    // 6. Vendor can view this notification and its details via the API
    $notifResponse = $this->actingAs($vendorUser, 'sanctum')
        ->getJson('/api/v1/notifications');
    $notifResponse->assertOk()
        ->assertJsonPath('data.notifications.0.category', 'product_deleted')
        ->assertJsonPath('data.notifications.0.product_name', 'Expired Canned Meat')
        ->assertJsonPath('data.notifications.0.reason', $reason);

    // 7. Vendor can view their deletion history via the vendor audit endpoint
    $historyResponse = $this->actingAs($vendorUser, 'sanctum')
        ->getJson('/api/v1/vendor/products/deleted-history');
    $historyResponse->assertOk()
        ->assertJsonPath('data.0.product_name', 'Expired Canned Meat')
        ->assertJsonPath('data.0.reason', $reason)
        ->assertJsonPath('data.0.deleted_by', $admin->name);
});

test('Item 17: Stall Occupancy Filtering in Reports (Admin Interface) excludes unoccupied stalls', function () {
    $fx = makeSuggestionsRevisionFixture();
    $reportsService = app(ReportsAnalyticsService::class);
    $rentalService = app(StallRentalService::class);
    $complaintService = app(StallComplaintService::class);

    // 1. Fixture has 1 occupied stall: $fx['stall'] (status: 'occupied')
    expect($fx['stall']->status->value)->toBe('occupied');

    // 2. Create an unoccupied/vacant stall with a vendor and product
    $vacantVendorUser = User::factory()->create(['name' => 'Vacant Vendor']);
    $vacantVendor = Vendor::create([
        'user_id' => $vacantVendorUser->id,
        'stall_name' => 'Vacant Meat Shop',
        'stall_location' => 'Stall 20, Meat Section',
        'product_categories' => ['meat'],
        'status' => 'approved',
    ]);
    $vacantStall = Stall::create([
        'stall_number' => 'Stall 20',
        'section_id' => $fx['section']->id,
        'section' => 'meat-section',
        'store_name' => 'Vacant Meat Shop',
        'vendor_id' => $vacantVendorUser->id,
        'status' => 'vacant',
        'monthly_rent' => 2000.00,
    ]);

    // Create another stall that is under_maintenance (unoccupied)
    $maintStall = Stall::create([
        'stall_number' => 'Stall 21',
        'section_id' => $fx['section']->id,
        'section' => 'meat-section',
        'store_name' => 'Under Repair Stall',
        'vendor_id' => null,
        'status' => 'under_maintenance',
        'monthly_rent' => 2000.00,
    ]);

    // Product belonging to the vacant/unoccupied stall
    $vacantProduct = Product::create([
        'vendor_id' => $vacantVendor->id,
        'name' => 'Ghost Pork Chop',
        'description' => 'Unoccupied product',
        'category' => 'Meat',
        'price' => 450.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    // Order placed on the vacant vendor
    $vacantOrder = Order::create([
        'user_id' => $fx['customer']->id,
        'order_number' => 'TS-VACANT-ORDER-001',
        'status' => 'completed',
        'total_amount' => 450.00,
        'payment_method' => 'cash',
        'payment_status' => 'paid',
    ]);
    OrderItem::create([
        'order_id' => $vacantOrder->id,
        'product_id' => $vacantProduct->id,
        'vendor_id' => $vacantVendor->id,
        'product_name' => $vacantProduct->name,
        'category' => 'Meat',
        'unit' => 'kg',
        'quantity' => 1,
        'unit_price' => 450.00,
        'subtotal' => 450.00,
    ]);

    // 3. Rental Reports: only occupied stalls are included; vacant stalls are excluded
    $rentalReports = $rentalService->getRentalReportData();
    $rentalVendorIds = collect($rentalReports['vendor_reports'])->pluck('vendor_id')->all();
    expect($rentalVendorIds)->toContain($fx['vendor']->id)
        ->and($rentalVendorIds)->not->toContain($vacantVendor->id);

    // 4. Product & SRP Monitoring Report: only products from occupied stalls are included
    $productReport = $reportsService->getProductReportData();
    $productNames = collect($productReport['products'])->pluck('name')->map(fn ($n) => strtolower($n))->all();
    expect($productNames)->toContain('pork belly (liempo)')
        ->and($productNames)->not->toContain('ghost pork chop');

    // 5. Daily Sales & Revenue Report: only sales from occupied stalls are included
    $dailyReport = $reportsService->getDailySalesReport(now()->toDateString());
    $reportedOrderNumbers = collect($dailyReport['transactions'])->pluck('order_number')->all();
    expect($reportedOrderNumbers)->not->toContain('TS-VACANT-ORDER-001');

    // 6. Stall Complaint Selector: only occupied stalls are selectable
    $complaintIndexData = $complaintService->getIndexData([]);
    $selectableStallIds = collect($complaintIndexData['stalls'])->pluck('id')->all();
    expect($selectableStallIds)->toContain($fx['stall']->id)
        ->and($selectableStallIds)->not->toContain($vacantStall->id)
        ->and($selectableStallIds)->not->toContain($maintStall->id);
});

test('Item 18 & 19: Monthly Stall Rental Payments (Individual/Collective Billing) and Status Management', function () {
    $fx = makeSuggestionsRevisionFixture();
    $rentalService = app(StallRentalService::class);

    $billingPeriod = '2026-12';

    // 1. Generate bills individually for a selected vendor via Controller / Service
    $response = $this->actingAs($fx['admin'])
        ->post('/admin/dashboard/vendors/rentals/generate', [
            'billing_period' => $billingPeriod,
            'vendor_id' => $fx['vendor']->id,
            'due_date' => '2026-12-15',
            'amount' => 2500.00,
        ]);
    $response->assertRedirect();
    $response->assertSessionHas('success');

    // Verify bill was created in database
    $rental = StallRentalPayment::where('vendor_id', $fx['vendor']->id)
        ->where('billing_period', $billingPeriod)
        ->first();

    expect($rental)->not->toBeNull()
        ->and((float) $rental->amount)->toBe(2500.00)
        ->and($rental->status)->toBe('unpaid');

    // Verify vendor received the rental_bill_generated notification
    $vendorUser = $fx['vendorUser']->fresh();
    $billNotif = $vendorUser->notifications()
        ->where('data->category', 'rental_bill_generated')
        ->first();

    expect($billNotif)->not->toBeNull()
        ->and($billNotif->data['billing_period'])->toBe('2026-12')
        ->and((float) $billNotif->data['amount'])->toBe(2500.00);

    // 2. Generate bills collectively for all occupied stalls for another period
    $collectivePeriod = '2027-01';
    $collectiveResp = $this->actingAs($fx['admin'])
        ->post('/admin/dashboard/vendors/rentals/generate', [
            'billing_period' => $collectivePeriod,
            'vendor_id' => 'all',
        ]);
    $collectiveResp->assertRedirect();
    $collectiveResp->assertSessionHas('success');

    $collectiveRental = StallRentalPayment::where('vendor_id', $fx['vendor']->id)
        ->where('billing_period', $collectivePeriod)
        ->first();
    expect($collectiveRental)->not->toBeNull()
        ->and($collectiveRental->status)->toBe('unpaid');

    // 3. Item 19: Administrator updates payment status to PAID
    $updatePaidResp = $this->actingAs($fx['admin'])
        ->patch("/admin/dashboard/vendors/rentals/{$rental->id}/status", [
            'status' => 'paid',
            'payment_method' => 'cash',
            'payment_reference' => 'OR-2026-98765',
            'paid_at' => '2026-12-10',
            'notes' => 'Settled in cash at market administration counter.',
        ]);
    $updatePaidResp->assertRedirect();
    $updatePaidResp->assertSessionHas('success');

    $rental->refresh();
    expect($rental->status)->toBe('paid')
        ->and($rental->payment_method)->toBe('cash')
        ->and($rental->payment_reference)->toBe('OR-2026-98765')
        ->and($rental->verified_by)->toBe($fx['admin']->id)
        ->and($rental->notes)->toBe('Settled in cash at market administration counter.');

    // Verify vendor received status update notification
    $vendorUser->refresh();
    $paidNotif = $vendorUser->notifications()
        ->where('data->category', 'rental_payment_updated')
        ->latest()
        ->first();

    expect($paidNotif)->not->toBeNull()
        ->and($paidNotif->data['status'])->toBe('paid');

    // 4. Item 19: Administrator updates payment status back to UNPAID
    $updateUnpaidResp = $this->actingAs($fx['admin'])
        ->patch("/admin/dashboard/vendors/rentals/{$rental->id}/status", [
            'status' => 'unpaid',
            'notes' => 'Payment bounced or adjusted.',
        ]);
    $updateUnpaidResp->assertRedirect();
    $updateUnpaidResp->assertSessionHas('success');

    $rental->refresh();
    expect($rental->status)->toBe('unpaid')
        ->and($rental->paid_at)->toBeNull()
        ->and($rental->verified_by)->toBeNull()
        ->and($rental->notes)->toBe('Payment bounced or adjusted.');

    // Verify vendor received another status update notification
    $vendorUser->refresh();
    $statusNotifs = $vendorUser->notifications()
        ->where('data->category', 'rental_payment_updated')
        ->get();

    $unpaidNotif = $statusNotifs->last();

    expect($unpaidNotif)->not->toBeNull()
        ->and($unpaidNotif->data['status'])->toBe('unpaid');
});

test('Item 20: Vendor Rental Reports – Contract Renewal and Cancellation Requests', function () {
    $fx = makeSuggestionsRevisionFixture();
    $rentalService = app(StallRentalService::class);

    // 1. Automatic notification check for expiring contracts
    // The fixture vendor's contract expires in 20 days.
    // Running the artisan command should update status to expiring_soon and send notification.
    $this->artisan('contracts:check-expiring')->assertExitCode(0);

    $fx['vendor']->refresh();
    expect($fx['vendor']->contract_status)->toBe('expiring_soon');

    $expiringNotif = $fx['vendorUser']->notifications()
        ->where('data->category', 'contract_expiring')
        ->first();
    expect($expiringNotif)->not->toBeNull()
        ->and($expiringNotif->data['days_remaining'])->toBeLessThanOrEqual(20);

    // 2. Vendor gets contract details via API
    $detailsResp = $this->actingAs($fx['vendorUser'])->getJson('/api/v1/vendor/contract');
    $detailsResp->assertStatus(200)
        ->assertJsonPath('status', 'success')
        ->assertJsonPath('data.contract_status', 'expiring_soon')
        ->assertJsonPath('data.is_expiring_soon', true);

    // 3. Validation: Vendor submits invalid duration (e.g. 5 months)
    $invalidResp = $this->actingAs($fx['vendorUser'])->postJson('/api/v1/vendor/contract/request', [
        'type' => 'renewal',
        'duration_months' => 5,
    ]);
    $invalidResp->assertStatus(422);

    // 4. Vendor submits Contract Renewal request (6 months)
    $originalEndDate = $fx['vendor']->contract_end_date;
    $renewalResp = $this->actingAs($fx['vendorUser'])->postJson('/api/v1/vendor/contract/request', [
        'type' => 'renewal',
        'duration_months' => 6,
        'reason' => 'Business is going well and we want to extend our stall lease for 6 months.',
    ]);
    $renewalResp->assertStatus(200)
        ->assertJsonPath('status', 'success')
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.type', 'renewal')
        ->assertJsonPath('data.requested_duration_months', 6);

    // Verify contract is NOT automatically renewed upon submission!
    $fx['vendor']->refresh();
    expect($fx['vendor']->contract_status)->toBe('renewal_requested')
        ->and($fx['vendor']->contract_end_date->toDateString())->toBe($originalEndDate->toDateString());

    $renewalRequest = VendorContractRequest::where('vendor_id', $fx['vendor']->id)
        ->where('type', 'renewal')
        ->first();
    expect($renewalRequest)->not->toBeNull()
        ->and($renewalRequest->status)->toBe('pending')
        ->and($renewalRequest->requested_duration_months)->toBe(6);

    // 5. Admin side: Vendor Rental Reports includes the submitted request
    $reportData = $rentalService->getRentalReportData();
    expect($reportData['summary']['pending_requests_count'])->toBeGreaterThanOrEqual(1)
        ->and($reportData['summary']['pending_renewals_count'])->toBeGreaterThanOrEqual(1);

    $pendingInReport = collect($reportData['contract_requests'])->firstWhere('id', $renewalRequest->id);
    expect($pendingInReport)->not->toBeNull()
        ->and($pendingInReport['stall_name'])->toBe('Pedro Meat Shop');

    // 6. Admin approves the renewal request via Admin Web Portal route
    $adminReviewResp = $this->actingAs($fx['admin'])
        ->post("/admin/dashboard/vendors/rentals/contract-requests/{$renewalRequest->id}/review", [
            'decision' => 'approved',
            'additional_months' => 6,
            'admin_notes' => 'Approved. Stall lease renewed for 6 months.',
        ]);
    $adminReviewResp->assertRedirect();
    $adminReviewResp->assertSessionHas('success');

    // Verify contract is now officially extended and status is active
    $fx['vendor']->refresh();
    $renewalRequest->refresh();
    expect($renewalRequest->status)->toBe('approved')
        ->and($renewalRequest->reviewed_by)->toBe($fx['admin']->id)
        ->and($fx['vendor']->contract_status)->toBe('active')
        ->and($fx['vendor']->contract_end_date->toDateString())
        ->toBe($originalEndDate->copy()->addMonths(6)->toDateString());

    // Vendor automatically received notification with approval and updated contract status
    $approvedNotif = $fx['vendorUser']->fresh()->notifications()
        ->where('data->category', 'contract_approved')
        ->first();
    expect($approvedNotif)->not->toBeNull()
        ->and($approvedNotif->data['contract_status'])->toBe('active')
        ->and($approvedNotif->data['contract_end_date'])->toBe($fx['vendor']->contract_end_date->toDateString());

    // 7. Vendor submits Cancellation request
    $cancelResp = $this->actingAs($fx['vendorUser'])->postJson('/api/v1/vendor/contract/request', [
        'type' => 'cancellation',
        'reason' => 'Relocating to another province.',
    ]);
    $cancelResp->assertStatus(200)
        ->assertJsonPath('status', 'success')
        ->assertJsonPath('data.status', 'pending')
        ->assertJsonPath('data.type', 'cancellation');

    $fx['vendor']->refresh();
    expect($fx['vendor']->contract_status)->toBe('cancellation_requested');

    $cancelRequest = VendorContractRequest::where('vendor_id', $fx['vendor']->id)
        ->where('type', 'cancellation')
        ->first();
    expect($cancelRequest)->not->toBeNull()
        ->and($cancelRequest->status)->toBe('pending');

    // 8. Admin rejects the cancellation request first
    $rejectResp = $this->actingAs($fx['admin'])
        ->post("/admin/dashboard/vendors/rentals/contract-requests/{$cancelRequest->id}/review", [
            'decision' => 'rejected',
            'admin_notes' => 'Please settle outstanding utility fees before cancelling.',
        ]);
    $rejectResp->assertRedirect();

    $cancelRequest->refresh();
    $fx['vendor']->refresh();
    expect($cancelRequest->status)->toBe('rejected')
        ->and($fx['vendor']->contract_status)->toBe('active');

    $rejectedNotif = $fx['vendorUser']->fresh()->notifications()
        ->where('data->category', 'contract_rejected')
        ->first();
    expect($rejectedNotif)->not->toBeNull()
        ->and($rejectedNotif->data['admin_notes'])->toBe('Please settle outstanding utility fees before cancelling.');

    // 9. Vendor submits cancellation again and Admin approves it
    $cancelResp2 = $this->actingAs($fx['vendorUser'])->postJson('/api/v1/vendor/contract/request', [
        'type' => 'cancellation',
        'reason' => 'All dues settled, requesting final contract release.',
    ]);
    $cancelResp2->assertStatus(200);

    $cancelRequest2 = VendorContractRequest::where('vendor_id', $fx['vendor']->id)
        ->where('status', 'pending')
        ->first();

    $approveCancelResp = $this->actingAs($fx['admin'])
        ->post("/admin/dashboard/vendors/rentals/contract-requests/{$cancelRequest2->id}/review", [
            'decision' => 'approved',
            'admin_notes' => 'Clearance confirmed. Stall released.',
        ]);
    $approveCancelResp->assertRedirect();

    $fx['vendor']->refresh();
    $cancelRequest2->refresh();
    expect($cancelRequest2->status)->toBe('approved')
        ->and($fx['vendor']->contract_status)->toBe('cancelled');

    // Verify stall was released / marked vacant
    $stall = $fx['stall']->fresh();
    expect($stall->status)->toBe(StallStatus::Vacant)
        ->and($stall->vendor_id)->toBeNull();

    // 10. Vendor submits a new 1-month contract request after cancellation
    // Remaining months of previously cancelled contract must NOT be carried over!
    $newContractResp = $this->actingAs($fx['vendorUser'])->postJson('/api/v1/vendor/contract/request', [
        'type' => 'renewal',
        'duration_months' => 1,
        'reason' => 'Requesting new 1-month stall lease.',
    ]);
    $newContractResp->assertStatus(200);

    $newRequest = VendorContractRequest::where('vendor_id', $fx['vendor']->id)
        ->where('status', 'pending')
        ->first();

    $this->actingAs($fx['admin'])
        ->post("/admin/dashboard/vendors/rentals/contract-requests/{$newRequest->id}/review", [
            'decision' => 'approved',
            'additional_months' => 1,
            'admin_notes' => 'Approved new 1-month contract.',
        ]);

    $fx['vendor']->refresh();
    expect($fx['vendor']->contract_status)->toBe('active')
        ->and($fx['vendor']->contract_start_date->toDateString())->toBe(now()->toDateString())
        ->and($fx['vendor']->contract_end_date->toDateString())->toBe(now()->copy()->addMonth()->toDateString());
});

test('Item 21: ratings without comments do not require response while complaints require and accept vendor responses', function () {
    $fx = makeSuggestionsRevisionFixture();
    $reviewService = app(ReviewService::class);
    $feedbackService = app(FeedbackManagementService::class);

    // Create completed order for customer with vendor
    $order1 = Order::create([
        'user_id' => $fx['customer']->id,
        'order_number' => 'TS-FB-001',
        'status' => 'completed',
        'total_amount' => 320.00,
        'payment_method' => 'cash',
        'payment_status' => 'paid',
    ]);

    OrderItem::create([
        'order_id' => $order1->id,
        'product_id' => $fx['product']->id,
        'vendor_id' => $fx['vendor']->id,
        'product_name' => $fx['product']->name,
        'category' => 'Meat',
        'unit' => 'kg',
        'quantity' => 1,
        'unit_price' => 320.00,
        'subtotal' => 320.00,
    ]);

    // 1. Customer submits a rating-only review (5 stars, no comment)
    $ratingOnlyReview = $reviewService->createVendorReview($fx['customer'], [
        'order_id' => $order1->id,
        'vendor_id' => $fx['vendor']->id,
        'rating' => 5,
        'comment' => null,
    ]);

    // Verify rating-only is automatically resolved and does NOT need response
    expect($ratingOnlyReview->status)->toBe('resolved')
        ->and($ratingOnlyReview->needs_response)->toBeFalse()
        ->and($ratingOnlyReview->resolved_at)->not->toBeNull()
        ->and($ratingOnlyReview->hasComment())->toBeFalse()
        ->and($ratingOnlyReview->isComplaint())->toBeFalse();

    // 2. Vendor attempts to respond to rating-only review -> should fail with 422
    $failVendorResp = $this->actingAs($fx['vendorUser'])
        ->postJson("/api/v1/vendor/reviews/{$ratingOnlyReview->id}/respond", [
            'response' => 'Thank you for the 5 stars!',
        ]);
    $failVendorResp->assertStatus(422);
    expect($failVendorResp->json('data'))->toHaveKey('comment')
        ->and($failVendorResp->json('message'))->toContain('Ratings without customer comments do not require a response');

    // Admin attempts to respond to rating-only review -> should be redirected with error flash
    $failAdminResp = $this->actingAs($fx['admin'])
        ->post("/admin/dashboard/feedback/{$ratingOnlyReview->id}/respond", [
            'admin_response' => 'Thank you for your rating!',
        ]);
    $failAdminResp->assertRedirect();
    $failAdminResp->assertSessionHas('error');

    // 3. Customer places a second order and submits a review with a complaint/comment
    $order2 = Order::create([
        'user_id' => $fx['customer']->id,
        'order_number' => 'TS-FB-002',
        'status' => 'completed',
        'total_amount' => 320.00,
        'payment_method' => 'cash',
        'payment_status' => 'paid',
    ]);

    OrderItem::create([
        'order_id' => $order2->id,
        'product_id' => $fx['product']->id,
        'vendor_id' => $fx['vendor']->id,
        'product_name' => $fx['product']->name,
        'category' => 'Meat',
        'unit' => 'kg',
        'quantity' => 1,
        'unit_price' => 320.00,
        'subtotal' => 320.00,
    ]);

    $complaintReview = $reviewService->createVendorReview($fx['customer'], [
        'order_id' => $order2->id,
        'vendor_id' => $fx['vendor']->id,
        'rating' => 2,
        'comment' => 'The meat was slightly tough and had excess fat.',
    ]);

    // Verify complaint/comment review requires response and defaults to pending
    expect($complaintReview->status)->toBe('pending')
        ->and($complaintReview->needs_response)->toBeTrue()
        ->and($complaintReview->resolved_at)->toBeNull()
        ->and($complaintReview->hasComment())->toBeTrue()
        ->and($complaintReview->isComplaint())->toBeTrue();

    // 4. Verify Admin Feedback stats
    $stats = $feedbackService->getIndexData([])['stats'];
    expect($stats['pending'])->toBe(1)
        ->and($stats['ratings_only'])->toBe(1)
        ->and($stats['complaints'])->toBe(1)
        ->and($stats['total'])->toBe(2);

    // 5. Vendor dashboard reviews separation
    $dashboardData = $reviewService->getVendorReviewsDashboard($fx['vendorUser']);
    $stallReviews = collect($dashboardData['stall']['reviews']);
    $pendingStallReview = $stallReviews->firstWhere('id', $complaintReview->id);
    $ratingOnlyStallReview = $stallReviews->firstWhere('id', $ratingOnlyReview->id);

    expect($pendingStallReview['needs_response'])->toBeTrue()
        ->and($pendingStallReview['has_comment'])->toBeTrue()
        ->and($ratingOnlyStallReview['needs_response'])->toBeFalse()
        ->and($ratingOnlyStallReview['has_comment'])->toBeFalse();

    // 6. Vendor submits an official response to the complaint
    $vendorResp = $this->actingAs($fx['vendorUser'])
        ->postJson("/api/v1/vendor/reviews/{$complaintReview->id}/respond", [
            'response' => 'We apologize for the cut quality. We have instructed our butchers to inspect fat trimming carefully and will offer a discount on your next visit.',
        ]);

    $vendorResp->assertStatus(200)
        ->assertJsonPath('status', 'success');

    $complaintReview->refresh();
    expect($complaintReview->status)->toBe('resolved')
        ->and($complaintReview->needs_response)->toBeFalse()
        ->and($complaintReview->vendor_response)->toContain('We apologize for the cut quality')
        ->and($complaintReview->vendor_responded_at)->not->toBeNull()
        ->and($complaintReview->resolved_at)->not->toBeNull();

    // 7. Verify customer received notification
    $customerNotif = $fx['customer']->fresh()->notifications()
        ->where('data->category', 'review_response')
        ->first();
    expect($customerNotif)->not->toBeNull()
        ->and($customerNotif->data['vendor_response'])->toContain('We apologize for the cut quality');

    // 8. Admin Feedback pending count drops to 0
    $statsAfter = $feedbackService->getIndexData([])['stats'];
    expect($statsAfter['pending'])->toBe(0)
        ->and($statsAfter['resolved'])->toBe(2);
});

test('item 2: featured products automatically reflect actual customer review ratings instead of hardcoded 4.5', function () {
    $fx = makeSuggestionsRevisionFixture();

    $product = Product::create([
        'vendor_id' => $fx['vendor']->id,
        'name' => 'Sibuyas/Onions',
        'description' => 'Fresh red onions',
        'category' => 'Vegetables',
        'price' => 180.00,
        'unit' => 'kg',
        'is_available' => true,
    ]);

    $marketplaceService = app(MarketplaceService::class);

    // Initial state: No customer reviews yet -> rating defaults cleanly to 5.0, reviews_count = 0
    $initialFeatured = $marketplaceService->getFeaturedProducts();
    $foundInitial = $initialFeatured->firstWhere('id', $product->id);
    expect($foundInitial)->not->toBeNull()
        ->and((float) $foundInitial->rating)->toBe(5.0)
        ->and($foundInitial->reviews_count)->toBe(0);

    // Customer submits 2 customer reviews with 5.0 stars each
    $reviewer1 = User::factory()->create(['name' => 'Elizabeth Larioza']);
    $reviewer2 = User::factory()->create(['name' => 'Juan Luna']);

    Review::create([
        'user_id' => $reviewer1->id,
        'reviewable_type' => Product::class,
        'reviewable_id' => $product->id,
        'rating' => 5,
        'comment' => 'Very fresh onions!',
        'status' => 'pending',
        'needs_response' => true,
    ]);

    Review::create([
        'user_id' => $reviewer2->id,
        'reviewable_type' => Product::class,
        'reviewable_id' => $product->id,
        'rating' => 5,
        'comment' => 'Quality is excellent.',
        'status' => 'pending',
        'needs_response' => true,
    ]);

    // Verify MarketplaceService::getFeaturedProducts() returns actual 5.0 rating and 2 reviews_count
    $featured = $marketplaceService->getFeaturedProducts();
    $found = $featured->firstWhere('id', $product->id);

    expect($found)->not->toBeNull()
        ->and((float) $found->rating)->toBe(5.0)
        ->and((float) $found->product_rating)->toBe(5.0)
        ->and($found->reviews_count)->toBe(2);

    // Verify through the public API endpoint /api/v1/marketplace/featured
    $apiResp = $this->getJson('/api/v1/marketplace/featured');
    $apiResp->assertStatus(200)
        ->assertJsonPath('status', 'success');

    $apiProducts = collect($apiResp->json('data'));
    $apiProduct = $apiProducts->firstWhere('id', $product->id);

    expect($apiProduct)->not->toBeNull()
        ->and((float) $apiProduct['rating'])->toBe(5.0)
        ->and((int) $apiProduct['reviews_count'])->toBe(2);

    // If a 3rd review with 2.0 stars is submitted, average updates to (5+5+2)/3 = 4.0
    $reviewer3 = User::factory()->create(['name' => 'Maria Makiling']);
    Review::create([
        'user_id' => $reviewer3->id,
        'reviewable_type' => Product::class,
        'reviewable_id' => $product->id,
        'rating' => 2,
        'comment' => 'A bit soft.',
        'status' => 'pending',
        'needs_response' => true,
    ]);

    $featuredUpdated = $marketplaceService->getFeaturedProducts();
    $foundUpdated = $featuredUpdated->firstWhere('id', $product->id);
    expect($foundUpdated)->not->toBeNull()
        ->and((float) $foundUpdated->rating)->toBe(4.0)
        ->and((int) $foundUpdated->reviews_count)->toBe(3);
});
