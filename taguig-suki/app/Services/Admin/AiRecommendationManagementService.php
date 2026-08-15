<?php

namespace App\Services\Admin;

use App\Models\RecipeRecommendation;
use App\Models\Review;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

class AiRecommendationManagementService
{
    public function getIndexData(array $filters): array
    {
        $query = RecipeRecommendation::query()
            ->with('user:id,name,email')
            ->withCount(['reviews' => fn ($q) => $q->whereNotNull('recipe_name')]);

        $this->applyFilters($query, $filters);

        $reviewAggregates = $this->reviewAggregates();

        $recommendations = $query
            ->orderByDesc('created_at')
            ->paginate(15)
            ->withQueryString()
            ->through(fn (RecipeRecommendation $rec) => $this->present($rec, $reviewAggregates));

        return [
            'recommendations' => $recommendations,
            'stats' => $this->getStats(),
            'filters' => $filters,
            'statuses' => collect([
                RecipeRecommendation::STATUS_FOUND,
                RecipeRecommendation::STATUS_NOT_FOUND,
                RecipeRecommendation::STATUS_ERROR,
            ])->map(fn (string $status) => ['value' => $status, 'label' => $this->statusLabel($status)]),
            'top_recipes' => $this->topRecipes(),
        ];
    }

    public function destroy(RecipeRecommendation $recommendation): RecipeRecommendation
    {
        $recommendation->delete();

        return $recommendation;
    }

    public function destroyAll(): int
    {
        return RecipeRecommendation::query()->delete();
    }

    private function present(RecipeRecommendation $rec, Collection $reviewAggregates): array
    {
        $payload = $rec->payload ?? [];

        return [
            'id' => $rec->id,
            'query' => $rec->query,
            'recipe_name' => $rec->recipe_name,
            'status' => $rec->status,
            'status_label' => $this->statusLabel($rec->status),
            'error_message' => $rec->error_message,
            'ingredient_count' => count($payload['ingredients'] ?? []),
            'matching_count' => count($rec->matching_products ?? []),
            'matching_products' => $rec->matching_products ?? [],
            'payload' => $payload,
            'review_count' => $rec->reviews_count ?? 0,
            'review_average' => isset($reviewAggregates[$rec->recipe_name])
                ? $reviewAggregates[$rec->recipe_name]['average']
                : 0,
            'reviews' => isset($reviewAggregates[$rec->recipe_name])
                ? $reviewAggregates[$rec->recipe_name]['reviews']
                : [],
            'user' => $rec->user
                ? ['id' => $rec->user->id, 'name' => $rec->user->name, 'email' => $rec->user->email]
                : null,
            'created_at' => $rec->created_at,
        ];
    }

    private function applyFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['search'])) {
            $term = $filters['search'];
            $query->where(function (Builder $q) use ($term) {
                $q->where('query', 'like', "%{$term}%")
                    ->orWhere('recipe_name', 'like', "%{$term}%");
            });
        }
    }

    private function getStats(): array
    {
        $recipeReviewStats = Review::whereNotNull('recipe_name');

        return [
            'total' => RecipeRecommendation::count(),
            'found' => RecipeRecommendation::where('status', RecipeRecommendation::STATUS_FOUND)->count(),
            'not_found' => RecipeRecommendation::where('status', RecipeRecommendation::STATUS_NOT_FOUND)->count(),
            'error' => RecipeRecommendation::where('status', RecipeRecommendation::STATUS_ERROR)->count(),
            'unique_recipes' => RecipeRecommendation::whereNotNull('recipe_name')->distinct()->count('recipe_name'),
            'recipe_reviews' => (clone $recipeReviewStats)->count(),
        ];
    }

    private function topRecipes(): array
    {
        return RecipeRecommendation::where('status', RecipeRecommendation::STATUS_FOUND)
            ->whereNotNull('recipe_name')
            ->selectRaw('recipe_name, COUNT(*) as count')
            ->groupBy('recipe_name')
            ->orderByDesc('count')
            ->limit(5)
            ->get()
            ->map(fn ($row) => [
                'name' => $row->recipe_name,
                'count' => $row->count,
            ])
            ->values()
            ->all();
    }

    /**
     * Recipe reviews grouped by recipe name — the "related data" for each
     * AI recommendation (customers can rate a recipe by its dish name).
     */
    private function reviewAggregates(): Collection
    {
        return Review::whereNotNull('recipe_name')
            ->with('user:id,name')
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('recipe_name')
            ->map(function (Collection $reviews) {
                return [
                    'average' => round($reviews->avg('rating'), 1),
                    'reviews' => $reviews->map(fn (Review $review) => [
                        'id' => $review->id,
                        'rating' => $review->rating,
                        'comment' => $review->comment,
                        'created_at' => $review->created_at,
                        'user' => $review->user?->name ?? 'Anonymous',
                    ])->values(),
                ];
            });
    }

    private function statusLabel(string $status): string
    {
        return match ($status) {
            RecipeRecommendation::STATUS_FOUND => 'Found',
            RecipeRecommendation::STATUS_NOT_FOUND => 'Not Found',
            RecipeRecommendation::STATUS_ERROR => 'Error',
            default => ucfirst($status),
        };
    }
}
