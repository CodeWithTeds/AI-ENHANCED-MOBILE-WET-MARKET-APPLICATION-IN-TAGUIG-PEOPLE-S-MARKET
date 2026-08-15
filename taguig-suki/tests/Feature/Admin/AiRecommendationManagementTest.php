<?php

use App\Models\RecipeRecommendation;
use App\Models\Review;
use App\Models\User;

test('admin can view the AI recommendations page', function () {
    $admin = User::factory()->create(['is_admin' => true]);
    $this->actingAs($admin);

    RecipeRecommendation::create([
        'query' => 'adobo',
        'recipe_name' => 'Chicken Adobo',
        'status' => 'found',
        'payload' => ['recipe_name' => 'Chicken Adobo', 'servings' => '4 pax'],
        'matching_products' => [],
    ]);
    RecipeRecommendation::create([
        'query' => 'pizza',
        'status' => 'not_found',
        'error_message' => 'Not a valid Filipino dish.',
    ]);

    $response = $this->get(route('recommendations.index'));

    $response->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('admin/recommendations/index')
            ->has('recommendations.data', 2)
            ->has('stats')
            ->has('top_recipes'));
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

test('recommendation page shows related recipe reviews', function () {
    $admin = User::factory()->create(['is_admin' => true]);
    $customer = User::factory()->create();
    $this->actingAs($admin);

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

    $this->get(route('recommendations.index'))
        ->assertInertia(fn ($page) => $page
            ->has('recommendations.data.0.reviews', 1)
            ->where('recommendations.data.0.review_average', 5)
            ->where('stats.recipe_reviews', 1));
});
