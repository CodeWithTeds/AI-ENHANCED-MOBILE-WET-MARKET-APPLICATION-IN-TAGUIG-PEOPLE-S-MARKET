<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\RecipeService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * RecipeController — Controller para sa AI Recipe Recommendations ng TaguigSuki.
 *
 * Dito dumadaan ang request mula sa customer mobile app patungo sa Google Gemini 1.5 Flash AI,
 * upang makabuo ng authentic Filipino recipe na direktang nakatugma sa mga puwesto at
 * paninda sa Taguig People's Market.
 */
class RecipeController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly RecipeService $recipeService) {}

    /**
     * Maghanap at bumuo ng recipe gamit ang Google Gemini AI Engine.
     *
     * @param Request $request Naglalaman ng 'q' query (halimbawa: "Sinigang na Baboy", "Tinola")
     * @return JsonResponse Recipe data na may listahan ng mga mabibiling sangkap sa palengke
     */
    public function search(Request $request): JsonResponse
    {
        $request->validate([
            'q' => 'required|string|min:2|max:100',
        ]);

        try {
            // Patakbuhin ang recipe generation sa tulong ng Google Gemini AI at database inventory
            $result = $this->recipeService->generateRecipe($request->query('q'));

            return $this->successResponse($result, 'Matagumpay na nabuo ang recipe gamit ang Google Gemini AI');
        } catch (\Throwable $e) {
            return $this->successResponse(
                ['found' => false, 'message' => $e->getMessage()],
                'Hindi nabuo ang recipe'
            );
        }
    }
}
