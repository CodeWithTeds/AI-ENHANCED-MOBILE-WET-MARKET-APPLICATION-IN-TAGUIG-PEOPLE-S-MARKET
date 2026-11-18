<?php

namespace App\Services;

use App\Models\Product;
use App\Models\RecipeRecommendation;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class RecipeService
{
    /**
     * Generate a standard local recipe using Google Gemini AI (with Groq fallback).
     * Grounded on the actual database of products, prices, availability, and stall information.
     */
    public function generateRecipe(string $query): array
    {
        try {
            $vendorIds = Product::where('is_available', true)->pluck('vendor_id')->unique()->filter()->values();
            $vendorRatings = \App\Models\Review::where('reviewable_type', \App\Models\Vendor::class)
                ->whereIn('reviewable_id', $vendorIds)
                ->selectRaw('reviewable_id, AVG(rating) as avg_rating, COUNT(*) as review_count')
                ->groupBy('reviewable_id')
                ->get()
                ->keyBy('reviewable_id');

            $availableProducts = Product::where('is_available', true)
                ->with(['vendor.stall', 'vendor:id,stall_name,stall_location'])
                ->get()
                ->map(function ($p) use ($vendorRatings) {
                    $stallNumber = $p->vendor?->stall?->stall_number ?? $p->vendor?->stall_location ?? 'Stall';
                    $vendorName = $p->vendor?->stall_name ?? 'Market Vendor';
                    $r = $vendorRatings->get($p->vendor_id);
                    $rating = $r ? round((float) $r->avg_rating, 1) : 4.8;
                    $reviewCount = $r ? (int) $r->review_count : 0;

                    return [
                        'id' => $p->id,
                        'name' => $p->name,
                        'category' => $p->category,
                        'price' => (float) $p->price,
                        'unit' => $p->unit,
                        'image' => $p->image,
                        'vendor_id' => $p->vendor_id,
                        'vendor_name' => $vendorName,
                        'stall_location' => $p->vendor?->stall_location ?? 'Taguig Public Market',
                        'stall_number' => $stallNumber,
                        'rating' => $rating,
                        'reviews_count' => $reviewCount,
                    ];
                })
                ->toArray();

            $productList = collect($availableProducts)
                ->map(fn ($p) => "{$p['name']} ({$p['category']}) - ₱{$p['price']}/{$p['unit']} [Stall: {$p['stall_number']} - {$p['vendor_name']}]")
                ->implode(', ');

            $prompt = $this->buildPrompt($query, $productList);

            // 1. Try Google Gemini AI first
            $response = null;
            $geminiKey = config('services.gemini.api_key');
            if (! empty($geminiKey)) {
                try {
                    $response = $this->callGemini($prompt);
                } catch (\Throwable $e) {
                    Log::warning('[RecipeService] Gemini call failed, falling back to Groq: '.$e->getMessage());
                }
            }

            // 2. If Gemini was not configured or threw an exception, fall back to Groq
            if ($response === null) {
                try {
                    $response = $this->callNvidia($prompt);
                } catch (\Throwable $e) {
                    Log::warning('[RecipeService] Groq call failed: '.$e->getMessage());
                    // 3. Fallback to smart local template if both AI providers are unavailable
                    $response = $this->buildLocalFallbackResponse($query, $availableProducts);
                }
            }

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
You are a Filipino recipe assistant for the Taguig City Public Market app.
Recommendations must be based on the actual database of products, prices, availability, and stall information.

STRICT RULES:
1. Only provide STANDARD local Filipino recipes commonly cooked in Metro Manila.
2. Do NOT provide regional variations (no Bicolano-style, Ilocano-style, Visayan-style, etc.).
3. If the recipe has a regional name (like "Bicol Express"), give ONLY the standard version.
4. Do NOT act as a chatbot. Only return recipe data.
5. If the search term is not a valid Filipino dish or ingredient, return an error message.
6. For available_in_market: set TRUE only if the ingredient matches an item in AVAILABLE MARKET PRODUCTS. Otherwise FALSE. Do NOT hallucinate availability.
7. Use simple, market-friendly ingredient names (e.g., "Chicken", "Pork", "Garlic", "Onion") that can match market product names.

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
    {"name": "ingredient name", "quantity": "amount", "available_in_market": true}
  ],
  "steps": ["Step 1...", "Step 2..."],
  "tips": "Optional cooking tip"
}

If the search is not a valid Filipino dish, respond with:
{"found": false, "message": "Sorry, I can only help with standard Filipino recipes."}
PROMPT;
    }

    /**
     * Call Google Gemini API (gemini-1.5-flash or configured model).
     */
    private function callGemini(string $prompt): string
    {
        $apiKey = config('services.gemini.api_key');
        $model = config('services.gemini.model', 'gemini-1.5-flash');
        $baseUrl = rtrim(config('services.gemini.base_url', 'https://generativelanguage.googleapis.com/v1beta'), '/');

        $response = Http::timeout(30)->post("{$baseUrl}/models/{$model}:generateContent?key={$apiKey}", [
            'contents' => [
                [
                    'parts' => [
                        ['text' => $prompt],
                    ],
                ],
            ],
            'generationConfig' => [
                'temperature' => 0.7,
                'responseMimeType' => 'application/json',
            ],
        ]);

        if ($response->successful()) {
            $data = $response->json();
            $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
            if ($text) {
                return $text;
            }
        }

        Log::warning('[RecipeService] Gemini request unsuccessful', [
            'status' => $response->status(),
            'body' => substr($response->body(), 0, 500),
        ]);

        throw new \RuntimeException('Gemini API call failed with status '.$response->status());
    }

    private function callNvidia(string $prompt): string
    {
        /** @var string[] $apiKeys ordered fallback pool */
        $apiKeys = config('services.groq.api_keys', []);
        if (empty($apiKeys)) {
            $single = config('services.groq.api_key');
            $apiKeys = $single ? [$single] : [];
        }

        if (empty($apiKeys)) {
            throw new \RuntimeException('AI service not configured (missing GROQ API keys).');
        }

        $model = config('services.groq.model', 'openai/gpt-oss-20b');
        $baseUrl = config('services.groq.base_url', 'https://api.groq.com/openai/v1');

        $lastError = null;

        foreach ($apiKeys as $idx => $apiKey) {
            try {
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
                    $lastError = 'AI quota exceeded for key #'.($idx + 1);
                    Log::warning('[RecipeService] Groq 429 on key #'.($idx + 1).'/'.count($apiKeys).', trying next', [
                        'status' => 429,
                        'body' => $response->body(),
                    ]);

                    if ($idx === count($apiKeys) - 1) {
                        throw new \RuntimeException('AI quota exceeded. All API keys are rate-limited. Please try again in a minute.');
                    }
                    continue;
                }

                if ($response->serverError()) {
                    Log::warning('[RecipeService] Groq server error on key #'.($idx + 1), [
                        'status' => $response->status(),
                        'body' => substr($response->body(), 0, 500),
                    ]);
                    if ($idx < count($apiKeys) - 1) {
                        continue;
                    }
                }

                $lastError = $response->body();
                throw new \RuntimeException('AI service unavailable. Please try again later.');
            } catch (\Illuminate\Http\Client\ConnectionException $e) {
                Log::warning('[RecipeService] Groq connection failed on key #'.($idx + 1), ['msg' => $e->getMessage()]);
                $lastError = $e->getMessage();
                if ($idx < count($apiKeys) - 1) {
                    continue;
                }
                throw new \RuntimeException('AI service temporarily unreachable. Please try again.');
            }
        }

        throw new \RuntimeException($lastError ?: 'AI service unavailable. Please try again later.');
    }

    /**
     * Intelligent local fallback recipe when AI APIs are unreachable.
     */
    private function buildLocalFallbackResponse(string $query, array $availableProducts): string
    {
        $normalizedQuery = strtolower(trim($query));

        // Find matches in products
        $matching = array_filter($availableProducts, function ($p) use ($normalizedQuery) {
            return str_contains(strtolower($p['name']), $normalizedQuery) || str_contains($normalizedQuery, strtolower($p['name']));
        });

        $dishName = ucwords($query);

        $ingredients = [];
        foreach (array_slice($matching, 0, 4) as $p) {
            $ingredients[] = [
                'name' => $p['name'],
                'quantity' => '1 '.$p['unit'],
                'available_in_market' => true,
            ];
        }

        if (empty($ingredients)) {
            $ingredients[] = [
                'name' => ucwords($query),
                'quantity' => '500g',
                'available_in_market' => false,
            ];
            $ingredients[] = [
                'name' => 'Garlic',
                'quantity' => '3 cloves',
                'available_in_market' => false,
            ];
            $ingredients[] = [
                'name' => 'Onion',
                'quantity' => '1 medium',
                'available_in_market' => false,
            ];
        }

        return json_encode([
            'found' => true,
            'recipe_name' => $dishName,
            'description' => "Fresh Taguig Market {$dishName} prepared with local ingredients.",
            'servings' => '3-4 pax',
            'prep_time' => '15 mins',
            'cook_time' => '30 mins',
            'ingredients' => $ingredients,
            'steps' => [
                'Wash and prepare all fresh market ingredients.',
                'Sauté garlic and onions in a heated pot with cooking oil until fragrant.',
                'Add primary ingredients and simmer gently until tender and flavors meld.',
                'Season with salt, pepper, and patis to taste. Serve warm with steamed rice.',
            ],
            'tips' => 'Buy freshly restocked ingredients from Taguig Public Market stalls for the best flavor.',
        ]);
    }

    private function parseResponse(string $jsonResponse, array $availableProducts): array
    {
        $jsonClean = trim($jsonResponse);
        if (str_starts_with($jsonClean, '```json')) {
            $jsonClean = substr($jsonClean, 7);
        }
        if (str_ends_with($jsonClean, '```')) {
            $jsonClean = substr($jsonClean, 0, -3);
        }
        $jsonClean = trim($jsonClean);

        $recipe = json_decode($jsonClean, true);

        if (! $recipe || ! isset($recipe['found'])) {
            return ['found' => false, 'message' => 'Could not understand the recipe request.'];
        }

        if (! $recipe['found']) {
            return $recipe;
        }

        // Match ingredients to available market products with stall info
        $matchResult = $this->matchIngredientsStrict($recipe['ingredients'] ?? [], $availableProducts);
        $recipe['matching_products'] = $matchResult['matches'];

        // Overwrite LLM flags so UI "In Market" badge matches actual matched products
        $matchedIngredients = array_column($matchResult['matches'], 'ingredient');
        foreach ($recipe['ingredients'] as &$ing) {
            $ingName = $ing['name'] ?? '';
            $ing['available_in_market'] = in_array($ingName, $matchedIngredients, true);
        }
        unset($ing);

        return $recipe;
    }

    /**
     * Strict ingredient → product matcher that includes stall details.
     */
    private function matchIngredientsStrict(array $ingredients, array $availableProducts): array
    {
        $matches = [];
        $matchedIngredientNames = [];

        foreach ($ingredients as $ingredient) {
            $rawIng = $ingredient['name'] ?? '';
            if ($rawIng === '') {
                continue;
            }

            $normIng = $this->normalize($rawIng);
            if ($normIng === '') {
                continue;
            }

            $scoredProducts = [];
            foreach ($availableProducts as $product) {
                $normProd = $this->normalize($product['name']);
                if ($normProd === '') {
                    continue;
                }

                $score = $this->matchScore($normIng, $normProd);
                if ($score >= 0.5) {
                    $scoredProducts[] = [
                        'score' => $score,
                        'product' => $product,
                    ];
                }
            }

            if (! empty($scoredProducts)) {
                // Sort by vendor rating descending, then match score descending, then price ascending
                usort($scoredProducts, function ($a, $b) {
                    $rA = (float) ($a['product']['rating'] ?? 4.5);
                    $rB = (float) ($b['product']['rating'] ?? 4.5);
                    if ($rB != $rA) {
                        return $rB <=> $rA;
                    }
                    if ($b['score'] != $a['score']) {
                        return $b['score'] <=> $a['score'];
                    }
                    return $a['product']['price'] <=> $b['product']['price'];
                });

                // Pick top 3 unique vendors selling this product/ingredient
                $topVendors = [];
                $seenVendors = [];
                foreach ($scoredProducts as $sp) {
                    $prod = $sp['product'];
                    $vId = $prod['vendor_id'] ?? $prod['id'];
                    if (in_array($vId, $seenVendors, true)) {
                        continue;
                    }
                    $seenVendors[] = $vId;
                    $topVendors[] = [
                        'product_id' => $prod['id'],
                        'product_name' => $prod['name'],
                        'price' => (float) $prod['price'],
                        'unit' => $prod['unit'],
                        'category' => $prod['category'],
                        'image' => $prod['image'] ?? null,
                        'vendor_id' => $prod['vendor_id'] ?? null,
                        'vendor_name' => $prod['vendor_name'] ?? 'Market Vendor',
                        'stall_name' => $prod['vendor_name'] ?? 'Market Stall',
                        'stall_number' => $prod['stall_number'] ?? 'Stall',
                        'stall_location' => $prod['stall_location'] ?? 'Taguig People\'s Market',
                        'rating' => (float) ($prod['rating'] ?? 4.8),
                        'reviews_count' => (int) ($prod['reviews_count'] ?? 0),
                        'is_ai_recommended' => count($topVendors) === 0,
                    ];

                    if (count($topVendors) >= 3) {
                        break;
                    }
                }

                $bestProduct = $topVendors[0] ?? null;

                if ($bestProduct && ! in_array($rawIng, $matchedIngredientNames, true)) {
                    $matches[] = [
                        'ingredient' => $rawIng,
                        'product_id' => $bestProduct['product_id'],
                        'product_name' => $bestProduct['product_name'],
                        'price' => $bestProduct['price'],
                        'unit' => $bestProduct['unit'],
                        'category' => $bestProduct['category'],
                        'image' => $bestProduct['image'] ?? null,
                        'vendor_id' => $bestProduct['vendor_id'] ?? null,
                        'vendor_name' => $bestProduct['vendor_name'] ?? 'Market Vendor',
                        'stall_number' => $bestProduct['stall_number'] ?? 'Stall',
                        'stall_location' => $bestProduct['stall_location'] ?? 'Taguig Public Market',
                        'rating' => $bestProduct['rating'] ?? 4.8,
                        'reviews_count' => $bestProduct['reviews_count'] ?? 0,
                        'vendors' => $topVendors,
                    ];
                    $matchedIngredientNames[] = $rawIng;
                }
            }
        }

        return ['matches' => $matches];
    }

    private function normalize(string $s): string
    {
        $s = strtolower(trim($s));
        $s = preg_replace('/[^a-z0-9]+/u', ' ', $s);
        $s = preg_replace('/\s+/', ' ', $s);

        return trim($s);
    }

    private function tokens(string $normalized): array
    {
        if ($normalized === '') {
            return [];
        }
        $parts = explode(' ', $normalized);

        return array_values(array_filter($parts, fn ($p) => $p !== ''));
    }

    private function singularize(string $word): string
    {
        if (strlen($word) < 3) {
            return $word;
        }
        if (str_ends_with($word, 'ies') && strlen($word) > 4) {
            return substr($word, 0, -3).'y';
        }
        if (str_ends_with($word, 'oes') || str_ends_with($word, 'ses') || str_ends_with($word, 'xes') || str_ends_with($word, 'ches') || str_ends_with($word, 'shes')) {
            return substr($word, 0, -2);
        }
        if (str_ends_with($word, 'es') && strlen($word) > 4) {
            return substr($word, 0, -2);
        }
        if (str_ends_with($word, 's') && ! str_ends_with($word, 'ss')) {
            return substr($word, 0, -1);
        }

        return $word;
    }

    private function tokensEqual(string $a, string $b): bool
    {
        return $a === $b || $this->singularize($a) === $this->singularize($b);
    }

    private function matchScore(string $normIng, string $normProd): float
    {
        if ($normIng === $normProd) {
            return 1.0;
        }

        $ingTokens = $this->tokens($normIng);
        $prodTokens = $this->tokens($normProd);

        if (empty($ingTokens) || empty($prodTokens)) {
            return 0.0;
        }

        $stopWords = ['fresh', 'ground', 'sliced', 'chopped', 'whole', 'leaves', 'leaf', 'cut', 'pieces', 'piece'];
        $sigIngTokens = array_values(array_filter($ingTokens, fn ($t) => ! in_array($t, $stopWords, true)));
        if (empty($sigIngTokens)) {
            $sigIngTokens = $ingTokens;
        }

        $matched = 0;
        foreach ($sigIngTokens as $iToken) {
            foreach ($prodTokens as $pToken) {
                if ($this->tokensEqual($iToken, $pToken)) {
                    $matched++;
                    break;
                }
            }
        }

        if ($matched === 0) {
            return 0.0;
        }

        return $matched / max(count($sigIngTokens), 1);
    }
}
