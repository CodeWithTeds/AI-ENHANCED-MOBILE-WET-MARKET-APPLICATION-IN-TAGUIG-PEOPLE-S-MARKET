<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

it('rejects guests from viewing the profile', function () {
    $this->getJson('/api/v1/profile')->assertUnauthorized();
});

it('rejects guests from updating the profile', function () {
    $this->putJson('/api/v1/profile', ['name' => 'Guest'])->assertUnauthorized();
});

it('rejects guests from changing the password', function () {
    $this->putJson('/api/v1/profile/password', ['new_password' => 'password123'])->assertUnauthorized();
});

it('rejects guests from updating notification preferences', function () {
    $this->putJson('/api/v1/profile/notifications', ['order_alerts' => true])->assertUnauthorized();
});

it('returns the authenticated user profile', function () {
    $user = User::factory()->create();

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/profile')
        ->assertOk()
        ->assertJsonPath('status', 'success')
        ->assertJsonPath('data.user.id', $user->id)
        ->assertJsonPath('data.user.name', $user->name)
        ->assertJsonPath('data.user.email', $user->email)
        ->assertJsonPath('data.notification_preferences', []);
});

it('returns stored notification preferences with the profile', function () {
    $user = User::factory()->create([
        'notification_preferences' => ['order_alerts' => false, 'promotion_updates' => true],
    ]);

    Sanctum::actingAs($user);

    $this->getJson('/api/v1/profile')
        ->assertOk()
        ->assertJsonPath('data.notification_preferences.order_alerts', false)
        ->assertJsonPath('data.notification_preferences.promotion_updates', true);
});

it('updates the profile name and email', function () {
    $user = User::factory()->create();

    Sanctum::actingAs($user);

    $this->putJson('/api/v1/profile', [
        'name' => 'Updated Name',
        'email' => 'updated@example.com',
    ])
        ->assertOk()
        ->assertJsonPath('status', 'success')
        ->assertJsonPath('data.user.name', 'Updated Name')
        ->assertJsonPath('data.user.email', 'updated@example.com');

    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'name' => 'Updated Name',
        'email' => 'updated@example.com',
    ]);
});

it('rejects an email already used by another user', function () {
    $user = User::factory()->create();
    $other = User::factory()->create(['email' => 'taken@example.com']);

    Sanctum::actingAs($user);

    $this->putJson('/api/v1/profile', ['email' => $other->email])
        ->assertUnprocessable()
        ->assertJsonPath('status', 'error')
        ->assertJsonStructure(['data' => ['email']]);

    $this->assertDatabaseHas('users', ['id' => $user->id, 'email' => $user->email]);
});

it('allows keeping the current email', function () {
    $user = User::factory()->create();

    Sanctum::actingAs($user);

    $this->putJson('/api/v1/profile', ['name' => 'New Name', 'email' => $user->email])
        ->assertOk();
});

it('changes the password when the current password is correct', function () {
    $user = User::factory()->create(['password' => Hash::make('old-password')]);

    Sanctum::actingAs($user);

    $this->putJson('/api/v1/profile/password', [
        'current_password' => 'old-password',
        'new_password' => 'new-password',
        'new_password_confirmation' => 'new-password',
    ])
        ->assertOk()
        ->assertJsonPath('status', 'success');

    $user->refresh();
    $this->assertTrue(Hash::check('new-password', $user->password));
    $this->assertFalse(Hash::check('old-password', $user->password));
});

it('rejects an incorrect current password', function () {
    $user = User::factory()->create(['password' => Hash::make('old-password')]);

    Sanctum::actingAs($user);

    $this->putJson('/api/v1/profile/password', [
        'current_password' => 'wrong-password',
        'new_password' => 'new-password',
        'new_password_confirmation' => 'new-password',
    ])
        ->assertUnprocessable()
        ->assertJsonPath('status', 'error')
        ->assertJsonPath('data.current_password', ['Current password is incorrect.']);

    $user->refresh();
    $this->assertTrue(Hash::check('old-password', $user->password));
});

it('rejects a new password that does not match the confirmation', function () {
    $user = User::factory()->create(['password' => Hash::make('old-password')]);

    Sanctum::actingAs($user);

    $this->putJson('/api/v1/profile/password', [
        'current_password' => 'old-password',
        'new_password' => 'new-password',
        'new_password_confirmation' => 'different-password',
    ])
        ->assertUnprocessable()
        ->assertJsonPath('status', 'error')
        ->assertJsonStructure(['data' => ['new_password']]);
});

it('rejects a new password shorter than eight characters', function () {
    $user = User::factory()->create(['password' => Hash::make('old-password')]);

    Sanctum::actingAs($user);

    $this->putJson('/api/v1/profile/password', [
        'current_password' => 'old-password',
        'new_password' => 'short',
        'new_password_confirmation' => 'short',
    ])
        ->assertUnprocessable()
        ->assertJsonPath('status', 'error')
        ->assertJsonStructure(['data' => ['new_password']]);
});

it('updates notification preferences', function () {
    $user = User::factory()->create();

    Sanctum::actingAs($user);

    $this->putJson('/api/v1/profile/notifications', [
        'order_alerts' => true,
        'promotion_updates' => false,
    ])
        ->assertOk()
        ->assertJsonPath('status', 'success')
        ->assertJsonPath('data.order_alerts', true)
        ->assertJsonPath('data.promotion_updates', false);

    $this->assertDatabaseHas('users', [
        'id' => $user->id,
        'notification_preferences' => json_encode(['order_alerts' => true, 'promotion_updates' => false]),
    ]);
});

it('rejects non-boolean notification preferences', function () {
    $user = User::factory()->create();

    Sanctum::actingAs($user);

    $this->putJson('/api/v1/profile/notifications', ['order_alerts' => 'yes'])
        ->assertUnprocessable()
        ->assertJsonPath('status', 'error')
        ->assertJsonStructure(['data' => ['order_alerts']]);
});
