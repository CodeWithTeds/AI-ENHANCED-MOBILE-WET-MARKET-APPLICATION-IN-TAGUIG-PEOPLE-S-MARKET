<?php

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\Section;
use App\Models\Stall;
use App\Models\StallComplaint;
use App\Models\StallRentalPayment;
use App\Models\User;
use App\Models\Vendor;
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
