<?php

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('rejects vendor registration when email is missing or empty', function () {
    $response = $this->postJson('/api/v1/vendor/register', [
        'full_name' => 'Vendor Test',
        'phone' => '09123456789',
        'password' => 'password123',
        'stall_name' => 'Stall A',
        'stall_id' => 1,
        'product_categories' => ['Vegetables'],
    ]);

    $response->assertStatus(422)
        ->assertJsonPath('status', 'error')
        ->assertJsonStructure(['data' => ['email']]);

    expect($response->json('data.email.0'))->toBe('Email address is required.');
});

it('rejects vendor registration when email format is invalid', function () {
    $response = $this->postJson('/api/v1/vendor/register', [
        'full_name' => 'Vendor Test',
        'email' => 'invalid-email',
        'phone' => '09123456789',
        'password' => 'password123',
        'stall_name' => 'Stall A',
        'stall_id' => 1,
        'product_categories' => ['Vegetables'],
    ]);

    $response->assertStatus(422)
        ->assertJsonPath('status', 'error')
        ->assertJsonStructure(['data' => ['email']]);

    expect($response->json('data.email.0'))->toBe('Please provide a valid email address.');
});

it('rejects customer registration when email is missing or empty', function () {
    $response = $this->postJson('/api/v1/register', [
        'name' => 'Customer Test',
        'password' => 'password123',
        'password_confirmation' => 'password123',
        'id_type' => 'national_id',
    ]);

    $response->assertStatus(422)
        ->assertJsonPath('status', 'error')
        ->assertJsonStructure(['data' => ['email']]);

    expect($response->json('data.email.0'))->toBe('Email address is required.');
});

it('rejects customer registration when email format is invalid', function () {
    $response = $this->postJson('/api/v1/register', [
        'name' => 'Customer Test',
        'email' => 'invalid-email',
        'password' => 'password123',
        'password_confirmation' => 'password123',
        'id_type' => 'national_id',
    ]);

    $response->assertStatus(422)
        ->assertJsonPath('status', 'error')
        ->assertJsonStructure(['data' => ['email']]);

    expect($response->json('data.email.0'))->toBe('Please provide a valid email address.');
});
