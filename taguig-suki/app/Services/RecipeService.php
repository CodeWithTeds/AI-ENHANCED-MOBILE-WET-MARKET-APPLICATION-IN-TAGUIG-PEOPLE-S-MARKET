<?php

namespace App\Services;

use App\Models\Product;
use App\Models\RecipeRecommendation;
use Illuminate\Support\Facades\Http;

class RecipeService
{
    /**
     * Generate a standard local recipe using NVIDIA AI (OpenAI-compatible API).
     * Only returns standard Metro Manila recipes — no regional variations.
     * Matches ingredients against available marketplace products.
     */
    public function generateRecipe(string $query): array
    {
        try {
            $availableProducts = Product::where('is_available', true)
                ->select('id', 'name', 'category', 'price', 'unit')
                ->get()
                ->toArray();

            $productList = collect($availableProducts)
                ->map(fn ($p) => "{$p['name']} ({$p['category']}) - ₱{$p['price']}/{$p['unit']}")
                ->implode(', ');

            $prompt = $this->buildPrompt($query, $productList);
            $response = $this->callNvidia($prompt);

            $recipe = $this->parseResponse($response, $availableProducts);

            $this->record($query, $recipe);

            return $recipe;
        } catch (\Throwable $e) {
            $this->record($query, ['found' => false, 'message' => $e->getMessage()], $e);

            throw $e;
        }
    }

    /**
     * Persist an AI recommendation so admins can monitor and manage them.
     * Logging must never break the recipe flow, so failures are swallowed.
     */
    private function record(string $query, array $recipe, ?\Throwable $error = null): void
    {
        try {
            $found = ($recipe['found'] ?? false) === true;

            RecipeRecommendation::create([
                'user_id' => auth('sanctum')->id(),
                'query' => $query,
                'recipe_name' => $found ? ($recipe['recipe_name'] ?? null) : null,
                'status' => $error
                    ? RecipeRecommendation::STATUS_ERROR
                    : ($found ? RecipeRecommendation::STATUS_FOUND : RecipeRecommendation::STATUS_NOT_FOUND),
                'payload' => $found ? $recipe : null,
                'matching_products' => $found ? ($recipe['matching_products'] ?? []) : null,
                'error_message' => $error?->getMessage() ?? ($found ? null : ($recipe['message'] ?? null)),
            ]);
        } catch (\Throwable) {
            // Logging is best-effort — never let it take down recipe search.
        }
    }

    private function buildPrompt(string $query, string $productList): string
    {
        return <<<PROMPT
You are a Filipino recipe assistant for a local market app in Taguig, Metro Manila.

STRICT RULES:
1. Only provide STANDARD local Filipino recipes commonly cooked in Metro Manila.
2. Do NOT provide regional variations (no Bicolano-style, Ilocano-style, Visayan-style, etc.).
3. If the recipe has a regional name (like "Bicol Express"), give ONLY the standard version.
4. Do NOT act as a chatbot. Only return recipe data.
5. If the search term is not a valid Filipino dish or ingredient, return an error message.

USER SEARCH: "{$query}"

AVAILABLE MARKET PRODUCTS: {$productList}

Respond in this exact JSON format:
{
  "found": true,
  "recipe_name": "Name of dish",
  "description": "Brief 1-sentence description",
  "servings": "4 pax",
  "prep_time": "15 mins",
  "cook_time": "45 mins",
  "ingredients": [
    {"name": "ingredient name", "quantity": "amount", "available_in_market": true/false}
  ],
  "steps": ["Step 1...", "Step 2..."],
  "tips": "Optional cooking tip"
}

If the search is not a valid Filipino dish, respond with:
{"found": false, "message": "Sorry, I can only help with standard Filipino recipes."}
PROMPT;
    }

    private function callNvidia(string $prompt): string
    {
        $apiKey = config('services.groq.api_key');
        $model = config('services.groq.model', 'openai/gpt-oss-20b');
        $baseUrl = config('services.groq.base_url', 'https://api.groq.com/openai/v1');

        $response = Http::withToken($apiKey)
            ->timeout(30)
            ->post("{$baseUrl}/chat/completions", [
                'model' => $model,
                'messages' => [
                    ['role' => 'user', 'content' => $prompt],
                ],
                'temperature' => 0.7,
                'max_tokens' => 4096,
            ]);

        if ($response->successful()) {
            $data = $response->json();
            $message = $data['choices'][0]['message'] ?? [];

            return $message['content'] ?? '{"found": false, "message": "Could not generate recipe."}';
        }

        if ($response->status() === 429) {
            throw new \RuntimeException('AI quota exceeded. Please wait a moment and try again.');
        }

        throw new \RuntimeException('AI service unavailable. Please try again later.');
    }

    private function parseResponse(string $jsonResponse, array $availableProducts): array
    {
        $recipe = json_decode($jsonResponse, true);

        if (! $recipe || ! isset($recipe['found'])) {
            return ['found' => false, 'message' => 'Could not understand the recipe request.'];
        }

        if (! $recipe['found']) {
            return $recipe;
        }

        // Match ingredients to available market products
        $recipe['matching_products'] = $this->matchIngredients($recipe['ingredients'] ?? [], $availableProducts);

        return $recipe;
    }

    /**
     * Match recipe ingredients against available marketplace products.
     */
    private function matchIngredients(array $ingredients, array $availableProducts): array
    {
        $matches = [];

        foreach ($ingredients as $ingredient) {
            $ingredientName = strtolower($ingredient['name'] ?? '');

            foreach ($availableProducts as $product) {
                $productName = strtolower($product['name']);

                // Fuzzy match — check if ingredient name is contained in product name or vice versa
                if (str_contains($productName, $ingredientName) || str_contains($ingredientName, $productName)) {
                    $matches[] = [
                        'ingredient' => $ingredient['name'],
                        'product_id' => $product['id'],
                        'product_name' => $product['name'],
                        'price' => $product['price'],
                        'unit' => $product['unit'],
                        'category' => $product['category'],
                    ];
                    break;
                }
            }
        }

        return $matches;
    }
}
