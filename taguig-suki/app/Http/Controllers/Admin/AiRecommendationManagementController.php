<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\RecipeRecommendation;
use App\Services\Admin\AiRecommendationManagementService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AiRecommendationManagementController extends Controller
{
    public function __construct(private readonly AiRecommendationManagementService $recommendationService) {}
    public function index(Request $request): Response
    {
        return Inertia::render('admin/recommendations/index', $this->recommendationService->getIndexData(
            $request->only(['search', 'status'])
        ));
    }

    public function destroy(RecipeRecommendation $recommendation): RedirectResponse
    {
        $name = $recommendation->recipe_name ?: $recommendation->query;

        $this->recommendationService->destroy($recommendation);

        return back()->with('success', "Recommendation for \"{$name}\" deleted.");
    }

    public function destroyAll(): RedirectResponse
    {
        $count = $this->recommendationService->destroyAll();

        return back()->with('success', "Cleared {$count} AI recommendation(s).");
    }
}
