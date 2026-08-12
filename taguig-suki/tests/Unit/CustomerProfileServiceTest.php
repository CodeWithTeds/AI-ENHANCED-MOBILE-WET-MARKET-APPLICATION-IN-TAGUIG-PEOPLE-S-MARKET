<?php

use App\Models\User;
use App\Services\CustomerProfileService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

pest()->extend(TestCase::class)->use(RefreshDatabase::class);

it('returns the profile with empty preferences by default', function () {
    $user = User::factory()->create();

    $profile = (new CustomerProfileService())->getProfile($user);

    expect($profile['user']->id)->toBe($user->id)
        ->and($profile['notification_preferences'])->toBe([]);
});

it('returns stored notification preferences', function () {
    $user = User::factory()->create([
        'notification_preferences' => ['order_alerts' => true, 'promotion_updates' => true],
    ]);

    $profile = (new CustomerProfileService())->getProfile($user);

    expect($profile['notification_preferences'])->toBe([
        'order_alerts' => true,
        'promotion_updates' => true,
    ]);
});

it('updates the profile name and email', function () {
    $user = User::factory()->create();

    $result = (new CustomerProfileService())->updateProfile($user, [
        'name' => 'New Name',
        'email' => 'new@example.com',
    ]);

    expect($result['user']->name)->toBe('New Name')
        ->and($result['user']->email)->toBe('new@example.com');

    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'name' => 'New Name',
        'email' => 'new@example.com',
    ]);
});

it('ignores missing fields when updating the profile', function () {
    $user = User::factory()->create(['name' => 'Original']);

    (new CustomerProfileService())->updateProfile($user, []);

    $user->refresh();
    expect($user->name)->toBe('Original');
});

it('changes the password when the current password matches', function () {
    $user = User::factory()->create(['password' => Hash::make('old-password')]);

    (new CustomerProfileService())->changePassword($user, [
        'current_password' => 'old-password',
        'new_password' => 'new-password',
    ]);

    $user->refresh();
    expect(Hash::check('new-password', $user->password))->toBeTrue()
        ->and(Hash::check('old-password', $user->password))->toBeFalse();
});

it('throws when the current password is incorrect', function () {
    $user = User::factory()->create(['password' => Hash::make('old-password')]);

    (new CustomerProfileService())->changePassword($user, [
        'current_password' => 'wrong-password',
        'new_password' => 'new-password',
    ]);
})->throws(ValidationException::class, 'Current password is incorrect.');

it('updates notification preferences', function () {
    $user = User::factory()->create();

    $preferences = (new CustomerProfileService())->updateNotificationPreferences($user, [
        'order_alerts' => false,
        'promotion_updates' => true,
    ]);

    expect($preferences)->toBe(['order_alerts' => false, 'promotion_updates' => true]);

    $user->refresh();
    expect($user->notification_preferences)->toBe([
        'order_alerts' => false,
        'promotion_updates' => true,
    ]);
});
