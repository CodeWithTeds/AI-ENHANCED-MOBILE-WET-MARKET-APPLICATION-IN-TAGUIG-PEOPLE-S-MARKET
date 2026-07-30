<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RecipeService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RecipeController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly RecipeService $recipeService) {}

    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|string|min:2|max:100',
        ]);

        try {
            $result = $this->recipeService->generateRecipe($request->query('q'));

            return $this->successResponse($result, 'Recipe generated');
        } catch (\Throwable $e) {
            return $this->successResponse(
                ['found' => false, 'message' => $e->getMessage()],
                'Recipe generation failed'
            );
        }
    }
}
