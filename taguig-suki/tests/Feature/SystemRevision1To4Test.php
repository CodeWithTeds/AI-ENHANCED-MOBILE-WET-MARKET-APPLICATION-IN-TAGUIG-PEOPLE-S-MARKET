<?php

use App\Enums\StallSize;
use App\Models\Section;
use App\Models\Stall;
use App\Models\User;
use App\Notifications\AccountApprovalRequestedNotification;
use App\Notifications\AccountApprovedNotification;
use App\Services\Admin\StallManagementService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

uses(RefreshDatabase::class);

function makeVerifiedAdmin(array $overrides = []): User
{
    return User::factory()->create(array_merge([
        'name' => 'Market Admin',
        'is_admin' => true,
        'is_active' => true,
        'email_verified_at' => now(),
    ], $overrides));
}

function makeActiveSection(string $slug = 'meat-section', string $name = 'Meat Section', string $code = 'MEAT'): Section
{
    return Section::firstOrCreate(
        ['slug' => $slug],
        ['name' => $name, 'code' => $code, 'floor' => 'Ground Floor', 'is_active' => true]
    );
}

/*
|--------------------------------------------------------------------------
| ITEM 1: Auto Compute Rent per Month
|--------------------------------------------------------------------------
*/

test('Item 1: StallSize enum defines fixed monthly rents for small, medium, and large', function () {
    expect(StallSize::Small->monthlyRent())->toBe(1500.00)
        ->and(StallSize::Medium->monthlyRent())->toBe(2000.00)
        ->and(StallSize::Large->monthlyRent())->toBe(3000.00);

    $service = app(StallManagementService::class);
    $sizeMap = collect($service->getIndexData([])['sizes'])->keyBy('value');

    expect((float) $sizeMap['small']['monthly_rent'])->toBe(1500.0)
        ->and((float) $sizeMap['medium']['monthly_rent'])->toBe(2000.0)
        ->and((float) $sizeMap['large']['monthly_rent'])->toBe(3000.0);
});

test('Item 1: creating stalls computes monthly rent automatically for every size and ignores tampered values', function () {
    $admin = makeVerifiedAdmin();
    $section = makeActiveSection();

    $cases = [
        ['stall' => 'Stall 1', 'size' => 'small', 'tampered' => 9999, 'expected' => 1500.0],
        ['stall' => 'Stall 2', 'size' => 'medium', 'tampered' => 0, 'expected' => 2000.0],
        ['stall' => 'Stall 3', 'size' => 'large', 'tampered' => 50, 'expected' => 3000.0],
    ];

    foreach ($cases as $case) {
        $this->actingAs($admin)
            ->post('/admin/dashboard/vendors/stalls', [
                'section_id' => $section->id,
                'stall_number' => $case['stall'],
                'store_name' => "Shop {$case['stall']}",
                'status' => 'vacant',
                'size' => $case['size'],
                'monthly_rent' => $case['tampered'],
            ])
            ->assertRedirect();

        $created = Stall::where('stall_number', $case['stall'])->firstOrFail();
        expect((float) $created->monthly_rent)->toBe($case['expected']);
    }
});

test('Item 1: updating a stall size automatically recomputes monthly rent', function () {
    $admin = makeVerifiedAdmin();
    $section = makeActiveSection();

    $stall = Stall::create([
        'section_id' => $section->id,
        'section' => $section->slug,
        'stall_number' => 'Stall 4',
        'store_name' => 'Mang Karding',
        'status' => 'vacant',
        'size' => 'small',
        'monthly_rent' => 1500.00,
    ]);

    foreach (['large' => 3000.0, 'medium' => 2000.0, 'small' => 1500.0] as $size => $expectedRent) {
        $this->actingAs($admin)
            ->put("/admin/dashboard/vendors/stalls/{$stall->id}", [
                'section_id' => $section->id,
                'stall_number' => 'Stall 4',
                'store_name' => 'Mang Karding',
                'status' => 'vacant',
                'size' => $size,
                'monthly_rent' => 123.45,
            ])
            ->assertRedirect();

        expect((float) $stall->fresh()->monthly_rent)->toBe($expectedRent);
    }
});

test('Item 1: admin stalls UI locks monthly rent inputs as read-only and auto-syncs with size', function () {
    $stallsPage = file_get_contents(resource_path('js/pages/admin/stalls/index.tsx'));

    expect($stallsPage)
        ->toContain('getRentForSize')
        ->toContain('id="c-rent"')
        ->toContain('id="e-rent"')
        ->toContain('readOnly')
        ->not->toContain("onChange={(e) => createForm.setData('monthly_rent'")
        ->not->toContain("onChange={(e) => editForm.setData('monthly_rent'");
});

/*
|--------------------------------------------------------------------------
| ITEM 2: Separate Fields (Consolidated Inside Stall Management)
|--------------------------------------------------------------------------
*/

test('Item 2: stall management, monitoring, and rentals pages render properly with shared sub-navigation tabs', function () {
    $admin = makeVerifiedAdmin();

    $this->actingAs($admin)
        ->get('/admin/dashboard/vendors/stalls')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('admin/stalls/index'));

    $this->actingAs($admin)
        ->get('/admin/dashboard/vendors/stalls/monitoring')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('admin/stalls/monitoring'));

    $this->actingAs($admin)
        ->get('/admin/dashboard/vendors/rentals')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('admin/rentals/index'));
});

test('Item 2: admin sidebar removes standalone Monitoring and Rentals entries and keeps Stall Management active across sub-tabs', function () {
    $sidebar = file_get_contents(resource_path('js/components/app-sidebar.tsx'));
    $stallsIndex = file_get_contents(resource_path('js/pages/admin/stalls/index.tsx'));
    $monitoringPage = file_get_contents(resource_path('js/pages/admin/stalls/monitoring.tsx'));
    $rentalsPage = file_get_contents(resource_path('js/pages/admin/rentals/index.tsx'));

    expect($sidebar)
        ->toContain("title: 'Stall Management'")
        ->toContain("'/admin/dashboard/vendors/stalls/monitoring'")
        ->toContain("'/admin/dashboard/vendors/rentals'")
        ->not->toContain("title: 'Stall Monitoring & Complaints'")
        ->not->toContain("title: 'Stall Rentals & Billing'");

    foreach ([$stallsIndex, $monitoringPage, $rentalsPage] as $pageSource) {
        expect($pageSource)
            ->toContain('/admin/dashboard/vendors/stalls')
            ->toContain('/admin/dashboard/vendors/stalls/monitoring')
            ->toContain('/admin/dashboard/vendors/rentals');
    }

    expect($rentalsPage)->toContain("{ title: 'Stall Management', href: '/admin/dashboard/vendors/stalls' }");
});

/*
|--------------------------------------------------------------------------
| ITEM 3: PDF and Image Uploading (Customer & Vendor)
|--------------------------------------------------------------------------
*/

test('Item 3: customer registration accepts PDF, JPG, PNG, and WEBP ID documents', function () {
    Storage::fake('public');

    $samples = [
        ['email' => 'cust.pdf@gmail.com', 'file' => UploadedFile::fake()->create('national_id.pdf', 400, 'application/pdf'), 'ext' => '.pdf'],
        ['email' => 'cust.jpg@gmail.com', 'file' => UploadedFile::fake()->image('national_id.jpg', 500, 400), 'ext' => '.jpg'],
        ['email' => 'cust.png@yahoo.com', 'file' => UploadedFile::fake()->image('passport.png', 500, 400), 'ext' => '.png'],
        ['email' => 'cust.webp@gmail.com', 'file' => UploadedFile::fake()->create('umid.webp', 300, 'image/webp'), 'ext' => '.webp'],
    ];

    foreach ($samples as $sample) {
        $this->post('/api/v1/register', [
            'name' => 'Customer Doc Test',
            'email' => $sample['email'],
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'id_type' => 'national_id',
            'id_image' => $sample['file'],
        ], ['Accept' => 'application/json'])->assertCreated();

        $user = User::where('email', $sample['email'])->firstOrFail();
        expect($user->verification)->not->toBeNull()
            ->and($user->verification->status)->toBe('pending')
            ->and($user->verification->id_image_path)->toEndWith($sample['ext']);
        Storage::disk('public')->assertExists($user->verification->id_image_path);
    }
});

test('Item 3: customer profile verification endpoint supports PDF and image replacement with old file cleanup', function () {
    Storage::fake('public');

    $customer = User::factory()->create(['is_admin' => false]);

    $this->actingAs($customer)
        ->post('/api/v1/profile/verification', [
            'id_type' => 'passport',
            'id_image' => UploadedFile::fake()->image('old_id.jpg', 400, 300),
        ], ['Accept' => 'application/json'])
        ->assertOk();

    $oldPath = $customer->verification()->firstOrFail()->id_image_path;
    Storage::disk('public')->assertExists($oldPath);

    $this->actingAs($customer)
        ->post('/api/v1/profile/verification', [
            'id_type' => 'drivers_license',
            'id_image' => UploadedFile::fake()->create('license.pdf', 512, 'application/pdf'),
        ], ['Accept' => 'application/json'])
        ->assertOk()
        ->assertJsonPath('data.status', 'pending');

    $newPath = $customer->verification()->firstOrFail()->id_image_path;
    expect($newPath)->toEndWith('.pdf');
    Storage::disk('public')->assertMissing($oldPath);
    Storage::disk('public')->assertExists($newPath);
});

test('Item 3: vendor registration supports PDF and image files across all required and optional documents', function () {
    Storage::fake('public');

    $section = makeActiveSection('fish-section', 'Fish Section', 'FISH');
    $stall = Stall::create([
        'section_id' => $section->id,
        'section' => $section->slug,
        'stall_number' => 'Stall 6',
        'store_name' => 'Vacant Stall 6',
        'status' => 'vacant',
        'size' => 'medium',
        'monthly_rent' => 2000.00,
    ]);

    $this->post('/api/v1/vendor/register', [
        'full_name' => 'Aling Nena',
        'email' => 'aling.nena@gmail.com',
        'phone' => '09171234567',
        'password' => 'SecurePass123!',
        'stall_name' => 'Nena Seafood',
        'stall_id' => $stall->id,
        'product_categories' => ['Fish'],
        'valid_id' => UploadedFile::fake()->create('valid_id.pdf', 300, 'application/pdf'),
        'business_permit' => UploadedFile::fake()->image('business.jpg', 500, 500),
        'sanitary_permit' => UploadedFile::fake()->create('sanitary.pdf', 300, 'application/pdf'),
        'dti_registration' => UploadedFile::fake()->image('dti.png', 500, 500),
        'stall_lease' => UploadedFile::fake()->create('lease.pdf', 300, 'application/pdf'),
    ], ['Accept' => 'application/json'])->assertCreated();

    $vendorUser = User::where('email', 'aling.nena@gmail.com')->firstOrFail();
    $docs = $vendorUser->vendor->documents;

    expect($docs)->toHaveCount(5);
    foreach ($docs as $doc) {
        Storage::disk('public')->assertExists($doc->file_path);
    }
});

test('Item 3: customer and vendor uploads reject unsupported extensions and files exceeding 5MB', function () {
    Storage::fake('public');

    // Unsupported extension for customer
    $this->post('/api/v1/register', [
        'name' => 'Bad File Customer',
        'email' => 'bad.file@gmail.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
        'id_type' => 'national_id',
        'id_image' => UploadedFile::fake()->create('script.txt', 100, 'text/plain'),
    ], ['Accept' => 'application/json'])->assertStatus(422);

    // Oversized (> 5MB) PDF for customer
    $this->post('/api/v1/register', [
        'name' => 'Big File Customer',
        'email' => 'big.file@gmail.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
        'id_type' => 'national_id',
        'id_image' => UploadedFile::fake()->create('huge.pdf', 6000, 'application/pdf'),
    ], ['Accept' => 'application/json'])->assertStatus(422);

    // Unsupported extension & oversized document for vendor
    $section = makeActiveSection('veg-section', 'Vegetable Section', 'VEG');
    $stall = Stall::create([
        'section_id' => $section->id,
        'section' => $section->slug,
        'stall_number' => 'Stall 7',
        'store_name' => 'Vacant Stall 7',
        'status' => 'vacant',
        'size' => 'small',
        'monthly_rent' => 1500.00,
    ]);

    $response = $this->post('/api/v1/vendor/register', [
        'full_name' => 'Bad Vendor',
        'email' => 'bad.vendor@gmail.com',
        'phone' => '09171234567',
        'password' => 'SecurePass123!',
        'stall_name' => 'Bad Docs Stall',
        'stall_id' => $stall->id,
        'product_categories' => ['Vegetables'],
        'valid_id' => UploadedFile::fake()->create('notes.txt', 100, 'text/plain'),
        'business_permit' => UploadedFile::fake()->create('huge_permit.pdf', 6000, 'application/pdf'),
        'sanitary_permit' => UploadedFile::fake()->image('sp.jpg', 300, 300),
        'dti_registration' => UploadedFile::fake()->image('dti.jpg', 300, 300),
    ], ['Accept' => 'application/json']);

    $response->assertStatus(422);
    expect($response->json('data'))
        ->toHaveKey('valid_id')
        ->toHaveKey('business_permit');
});

/*
|--------------------------------------------------------------------------
| ITEM 4: Notification on Account Approval
|--------------------------------------------------------------------------
*/

test('Item 4: only active admins receive notifications when a customer or vendor requests account approval', function () {
    Storage::fake('public');

    $activeAdmin = makeVerifiedAdmin(['email' => 'active.admin@taguig-suki.com']);
    $inactiveAdmin = makeVerifiedAdmin(['email' => 'inactive.admin@taguig-suki.com', 'is_active' => false]);
    $regularUser = User::factory()->create(['is_admin' => false, 'is_active' => true]);

    // 1. Customer registers
    $this->post('/api/v1/register', [
        'name' => 'Carlo Customer',
        'email' => 'carlo.buyer@gmail.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
        'id_type' => 'national_id',
        'id_image' => UploadedFile::fake()->image('carlo_id.png', 400, 300),
    ], ['Accept' => 'application/json'])->assertCreated();

    // 2. Vendor registers
    $section = makeActiveSection();
    $stall = Stall::create([
        'section_id' => $section->id,
        'section' => $section->slug,
        'stall_number' => 'Stall 8',
        'store_name' => 'Vacant Stall 8',
        'status' => 'vacant',
        'size' => 'medium',
        'monthly_rent' => 2000.00,
    ]);

    $this->post('/api/v1/vendor/register', [
        'full_name' => 'Mang Cardo',
        'email' => 'cardo.vendor@gmail.com',
        'phone' => '09179998888',
        'password' => 'SecurePass123!',
        'stall_name' => 'Cardo Meat Market',
        'stall_id' => $stall->id,
        'product_categories' => ['Meat'],
        'valid_id' => UploadedFile::fake()->create('id.pdf', 200, 'application/pdf'),
        'business_permit' => UploadedFile::fake()->image('bp.jpg', 400, 400),
        'sanitary_permit' => UploadedFile::fake()->image('sp.jpg', 400, 400),
        'dti_registration' => UploadedFile::fake()->create('dti.pdf', 200, 'application/pdf'),
    ], ['Accept' => 'application/json'])->assertCreated();

    expect($activeAdmin->fresh()->notifications)->toHaveCount(2)
        ->and($inactiveAdmin->fresh()->notifications)->toHaveCount(0)
        ->and($regularUser->fresh()->notifications)->toHaveCount(0);

    $vendorNotif = $activeAdmin->fresh()->notifications()->where('data->account_type', 'vendor')->firstOrFail();
    $customerNotif = $activeAdmin->fresh()->notifications()->where('data->account_type', 'customer')->firstOrFail();

    expect($vendorNotif->data['action_url'])->toBe('/admin/dashboard/vendors/pending')
        ->and($vendorNotif->data['stall_name'])->toBe('Cardo Meat Market')
        ->and($customerNotif->data['action_url'])->toBe('/admin/dashboard/users?verification_status=pending')
        ->and($customerNotif->data['applicant_email'])->toBe('carlo.buyer@gmail.com');
});

test('Item 4: Inertia dashboard shares admin notification bell payload and blocks non-admin access', function () {
    Storage::fake('public');

    $admin = makeVerifiedAdmin();
    $customer = User::factory()->create([
        'is_admin' => false,
        'is_active' => true,
        'email_verified_at' => now(),
    ]);

    $this->actingAs($customer)
        ->getJson('/admin/dashboard/notifications')
        ->assertForbidden();

    $this->actingAs($admin)
        ->get('/admin/dashboard')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->has('adminNotifications.unread_count')
            ->has('adminNotifications.pending_customers_count')
            ->has('adminNotifications.pending_vendors_count')
            ->has('adminNotifications.items')
            ->has('pendingVerifications')
            ->has('pendingVendors')
        );
});

test('Item 4: approving a customer sends an email notification to their email address and clears admin unread state', function () {
    Storage::fake('public');
    $admin = makeVerifiedAdmin();

    // Register customer (real DB notification created for admin)
    $this->post('/api/v1/register', [
        'name' => 'Ana Buyer',
        'email' => 'ana.buyer@gmail.com',
        'password' => 'Password123!',
        'password_confirmation' => 'Password123!',
        'id_type' => 'national_id',
        'id_image' => UploadedFile::fake()->image('ana.jpg', 400, 300),
    ], ['Accept' => 'application/json'])->assertCreated();

    $customer = User::where('email', 'ana.buyer@gmail.com')->firstOrFail();
    expect($admin->fresh()->unreadNotifications()->count())->toBe(1);

    Notification::fake();

    $this->actingAs($admin)
        ->post("/admin/dashboard/verifications/{$customer->verification->id}/approve")
        ->assertRedirect();

    expect($customer->verification->fresh()->status)->toBe('verified')
        ->and($admin->fresh()->unreadNotifications()->count())->toBe(0);

    Notification::assertSentTo(
        $customer,
        AccountApprovedNotification::class,
        function (AccountApprovedNotification $notification, array $channels) use ($customer) {
            $mail = $notification->toMail($customer);
            $bodyText = implode(' ', $mail->introLines);

            return in_array('mail', $channels, true)
                && in_array('database', $channels, true)
                && str_contains($mail->subject, 'Customer Account Has Been Approved')
                && str_contains($bodyText, 'ana.buyer@gmail.com');
        }
    );
});

test('Item 4: approving a vendor sends an email notification to their email address and clears admin unread state', function () {
    Storage::fake('public');
    $admin = makeVerifiedAdmin();
    $section = makeActiveSection('poultry-section', 'Poultry Section', 'POUL');

    $stall = Stall::create([
        'section_id' => $section->id,
        'section' => $section->slug,
        'stall_number' => 'Stall 10',
        'store_name' => 'Vacant Stall 10',
        'status' => 'vacant',
        'size' => 'medium',
        'monthly_rent' => 2000.00,
    ]);

    // Register vendor (real DB notification created for admin)
    $this->post('/api/v1/vendor/register', [
        'full_name' => 'Mang Tomas',
        'email' => 'mang.tomas@gmail.com',
        'phone' => '09185554444',
        'password' => 'SecurePass123!',
        'stall_name' => 'Tomas Poultry Hub',
        'stall_id' => $stall->id,
        'product_categories' => ['Poultry'],
        'valid_id' => UploadedFile::fake()->create('id.pdf', 200, 'application/pdf'),
        'business_permit' => UploadedFile::fake()->image('bp.jpg', 400, 400),
        'sanitary_permit' => UploadedFile::fake()->image('sp.jpg', 400, 400),
        'dti_registration' => UploadedFile::fake()->create('dti.pdf', 200, 'application/pdf'),
    ], ['Accept' => 'application/json'])->assertCreated();

    $vendorUser = User::where('email', 'mang.tomas@gmail.com')->firstOrFail();
    $vendor = $vendorUser->vendor;
    expect($admin->fresh()->unreadNotifications()->count())->toBe(1);

    Notification::fake();

    $this->actingAs($admin)
        ->post("/admin/dashboard/vendors/{$vendor->id}/approve")
        ->assertRedirect();

    expect($vendor->fresh()->status)->toBe('approved')
        ->and($admin->fresh()->unreadNotifications()->count())->toBe(0);

    Notification::assertSentTo(
        $vendorUser,
        AccountApprovedNotification::class,
        function (AccountApprovedNotification $notification, array $channels) use ($vendorUser) {
            $mail = $notification->toMail($vendorUser);
            $bodyText = implode(' ', $mail->introLines);

            return in_array('mail', $channels, true)
                && in_array('database', $channels, true)
                && str_contains($mail->subject, 'Vendor Account Has Been Approved')
                && str_contains($bodyText, 'mang.tomas@gmail.com')
                && str_contains($bodyText, 'Tomas Poultry Hub');
        }
    );
});

test('Item 4: admin notification endpoints list requests and mark single or all notifications as read', function () {
    $admin = makeVerifiedAdmin();
    $applicant1 = User::factory()->create(['name' => 'Applicant One', 'email' => 'one@gmail.com']);
    $applicant2 = User::factory()->create(['name' => 'Applicant Two', 'email' => 'two@gmail.com']);

    $admin->notify(new AccountApprovalRequestedNotification($applicant1, 'customer'));
    $admin->notify(new AccountApprovalRequestedNotification($applicant2, 'vendor', 'Two Store'));

    $this->actingAs($admin)
        ->getJson('/admin/dashboard/notifications')
        ->assertOk()
        ->assertJsonPath('unread_count', 2)
        ->assertJsonCount(2, 'items');

    $firstId = $admin->notifications()->firstOrFail()->id;

    $this->actingAs($admin)
        ->patchJson("/admin/dashboard/notifications/{$firstId}/read")
        ->assertOk()
        ->assertJsonPath('unread_count', 1);

    $this->actingAs($admin)
        ->postJson('/admin/dashboard/notifications/read-all')
        ->assertOk()
        ->assertJsonPath('unread_count', 0);
});
