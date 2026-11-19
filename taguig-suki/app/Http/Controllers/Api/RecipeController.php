<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RecipeService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * RecipeController — Customer AI Recipe Recommendation API Endpoint.
 *
 * Exposes endpoints for the mobile client to query Google Gemini 1.5 Flash AI,
 * retrieving authentic Filipino recipes matched directly with in-stock Taguig
 * People's Market products and vendor stall locations.
 */
class RecipeController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly RecipeService $recipeService) {}

    /**
     * Search and generate a recipe using Google Gemini AI Engine.
     *
     * @param Request $request Query string parameter 'q' (e.g. "Sinigang", "Tinola")
     * @return JsonResponse Grounded recipe JSON payload with live stall ingredients
     */
    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|string|min:2|max:100',
        ]);

        try {
            // Invoke Gemini AI generation pipeline with Taguig wet market inventory grounding
            $result = $this->recipeService->generateRecipe($request->query('q'));

            return $this->successResponse($result, 'Recipe generated successfully via Google Gemini AI');
        } catch (\Throwable $e) {
            return $this->successResponse(
                ['found' => false, 'message' => $e->getMessage()],
                'Recipe generation failed'
            );
        }
    }
}
