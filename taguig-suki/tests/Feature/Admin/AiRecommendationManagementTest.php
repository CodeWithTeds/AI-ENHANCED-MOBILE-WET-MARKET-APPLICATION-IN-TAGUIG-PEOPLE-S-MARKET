<?php

use App\Models\RecipeRecommendation;
use App\Models\Review;
use App\Models\User;

test('ai recommendations page is hidden and redirects to dashboard for administrators', function () {
    $admin = User::factory()->create(['is_admin' => true]);
    $this->actingAs($admin);

    RecipeRecommendation::create([
        'query' => 'adobo',
        'recipe_name' => 'Chicken Adobo',
        'status' => 'found',
        'payload' => ['recipe_name' => 'Chicken Adobo', 'servings' => '4 pax'],
        'matching_products' => [],
    ]);

    $response = $this->get(route('recommendations.index'));

    $response->assertRedirect(route('dashboard'));
});

test('admin can delete a single AI recommendation', function () {
    $admin = User::factory()->create(['is_admin' => true]);
    $this->actingAs($admin);

    $rec = RecipeRecommendation::create([
        'query' => 'sinigang',
        'recipe_name' => 'Sinigang na Baboy',
        'status' => 'found',
        'payload' => [],
    ]);

    $this->delete(route('recommendations.destroy', $rec));

    $this->assertDatabaseMissing('recipe_recommendations', ['id' => $rec->id]);
});

test('admin can clear all AI recommendations', function () {
    $admin = User::factory()->create(['is_admin' => true]);
    $this->actingAs($admin);

    RecipeRecommendation::create(['query' => 'a', 'status' => 'found', 'payload' => []]);
    RecipeRecommendation::create(['query' => 'b', 'status' => 'error', 'error_message' => 'x']);

    $this->delete(route('recommendations.destroy-all'));

    $this->assertSame(0, RecipeRecommendation::count());
});

test('recommendation service aggregates related recipe reviews', function () {
    $customer = User::factory()->create();

    $rec = RecipeRecommendation::create([
        'query' => 'adobo',
        'recipe_name' => 'Chicken Adobo',
        'status' => 'found',
        'payload' => [],
    ]);

    Review::create([
        'user_id' => $customer->id,
        'reviewable_type' => 'recipe',
        'recipe_name' => 'Chicken Adobo',
        'rating' => 5,
        'comment' => 'Sarap!',
    ]);

    $data = app(\App\Services\Admin\AiRecommendationManagementService::class)->getIndexData([]);
    expect($data['stats']['recipe_reviews'])->toBe(1)
        ->and($data['recommendations']->items()[0]['review_average'])->toBe(5.0);
});
