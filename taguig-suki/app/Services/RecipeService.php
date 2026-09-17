<?php

namespace App\Services;

use App\Models\Product;
use App\Models\RecipeRecommendation;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

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
6. For available_in_market: set TRUE only if the ingredient EXACTLY matches an item in AVAILABLE MARKET PRODUCTS (case-insensitive whole word). Otherwise FALSE. Do NOT hallucinate availability.
7. Use simple, market-friendly ingredient names (e.g., "Chicken", "Garlic", "Onion") that can match product names.

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
        /** @var string[] $apiKeys ordered fallback pool */
        $apiKeys = config('services.groq.api_keys', []);
        // Backwards-compat: if api_keys empty, fall back to single api_key
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

                // Rate-limit → try next key
                if ($response->status() === 429) {
                    $lastError = 'AI quota exceeded for key #'.($idx + 1);
                    Log::warning('[RecipeService] Groq 429 on key #'.($idx + 1).'/'.count($apiKeys).', trying next', [
                        'status' => 429,
                        'body' => $response->body(),
                    ]);

                    // If this was the last key, surface user-friendly error
                    if ($idx === count($apiKeys) - 1) {
                        throw new \RuntimeException('AI quota exceeded. All API keys are rate-limited. Please try again in a minute.');
                    }
                    continue;
                }

                // For 5xx / other server errors, also try next key before failing
                if ($response->serverError()) {
                    Log::warning('[RecipeService] Groq server error on key #'.($idx + 1), [
                        'status' => $response->status(),
                        'body' => substr($response->body(), 0, 500),
                    ]);
                    if ($idx < count($apiKeys) - 1) {
                        continue;
                    }
                }

                // Non-retryable error
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

    private function parseResponse(string $jsonResponse, array $availableProducts): array
    {
        $recipe = json_decode($jsonResponse, true);

        if (! $recipe || ! isset($recipe['found'])) {
            return ['found' => false, 'message' => 'Could not understand the recipe request.'];
        }

        if (! $recipe['found']) {
            return $recipe;
        }

        // Match ingredients to available market products using strict word-boundary matching
        // Also fixes LLM hallucinated available_in_market flags to reflect real matches
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
     * Strict ingredient → product matcher.
     * Prevents false positives like "salt" matching "salted fish" or "water" matching "watermelon"
     * by using whole-word boundaries and token singularization instead of naive str_contains.
     */
    private function matchIngredientsStrict(array $ingredients, array $availableProducts): array
    {
        $matches = [];
        $matchedIngredientNames = [];

        foreach ($ingredients as $ingredient) {
            $rawIng = $ingredient['name'] ?? '';
            if ($rawIng === '') continue;

            $normIng = $this->normalize($rawIng);
            if ($normIng === '') continue;

            $bestScore = 0;
            $bestProduct = null;

            foreach ($availableProducts as $product) {
                $normProd = $this->normalize($product['name']);
                if ($normProd === '') continue;

                $score = $this->matchScore($normIng, $normProd);
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $bestProduct = $product;
                }
                // Exact normalized phrase is best possible — early exit
                if ($score >= 1.0) break;
            }

            // Require at least 0.5 score (e.g., one significant word matches)
            // 1.0 = exact phrase, 0.75+ = strong overlap
            if ($bestProduct && $bestScore >= 0.5) {
                // Avoid duplicate ingredient entries
                if (!in_array($rawIng, $matchedIngredientNames, true)) {
                    $matches[] = [
                        'ingredient' => $rawIng,
                        'product_id' => $bestProduct['id'],
                        'product_name' => $bestProduct['name'],
                        'price' => $bestProduct['price'],
                        'unit' => $bestProduct['unit'],
                        'category' => $bestProduct['category'],
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
        // Keep letters/numbers, replace others with space, collapse spaces
        $s = preg_replace('/[^a-z0-9]+/u', ' ', $s);
        $s = preg_replace('/\s+/', ' ', $s);
        return trim($s);
    }

    private function tokens(string $normalized): array
    {
        if ($normalized === '') return [];
        $parts = explode(' ', $normalized);
        return array_values(array_filter($parts, fn ($p) => $p !== ''));
    }

    private function singularize(string $word): string
    {
        if (strlen($word) < 3) return $word;
        if (str_ends_with($word, 'ies') && strlen($word) > 4) return substr($word, 0, -3) . 'y';
        if (str_ends_with($word, 'oes') || str_ends_with($word, 'ses') || str_ends_with($word, 'xes') || str_ends_with($word, 'ches') || str_ends_with($word, 'shes')) {
            return substr($word, 0, -2);
        }
        if (str_ends_with($word, 'es') && strlen($word) > 4) return substr($word, 0, -2);
        if (str_ends_with($word, 's') && !str_ends_with($word, 'ss')) return substr($word, 0, -1);
        return $word;
    }

    private function tokensEqual(string $a, string $b): bool
    {
        if ($a === $b) return true;
        return $this->singularize($a) === $this->singularize($b);
    }

    /**
     * Whole-word phrase contains check: does haystack contain needle as whole words?
     */
    private function containsWordPhrase(string $haystack, string $needle): bool
    {
        if ($haystack === '' || $needle === '') return false;
        if ($haystack === $needle) return true;
        return (bool) preg_match('/\b' . preg_quote($needle, '/') . '\b/u', $haystack);
    }

    /**
     * Score 0..1 how well ingredient matches product.
     * 1.0 = exact phrase or whole-phrase word-boundary.
     * 0.75 = all ingredient tokens found in product.
     * 0.5 = at least half significant tokens share.
     */
    private function matchScore(string $normIng, string $normProd): float
    {
        // Exact or whole-phrase word boundary — strongest
        if ($normIng === $normProd) return 1.0;
        if ($this->containsWordPhrase($normProd, $normIng)) return 1.0;
        if ($this->containsWordPhrase($normIng, $normProd)) return 1.0;

        $ingTokens = $this->tokens($normIng);
        $prodTokens = $this->tokens($normProd);

        // Remove tiny tokens (<2) and common stop-words that cause false positives
        $stop = ['and', 'or', 'with', 'fresh', 'dried', 'sliced', 'chopped', 'minced', 'crushed', 'ground', 'large', 'small', 'medium'];
        $ingTokens = array_values(array_filter($ingTokens, fn ($t) => strlen($t) >= 2 && !in_array($t, $stop, true)));
        $prodTokens = array_values(array_filter($prodTokens, fn ($t) => strlen($t) >= 2 && !in_array($t, $stop, true)));

        if (empty($ingTokens) || empty($prodTokens)) return 0;

        // Count token overlaps using singular-aware equality (ignore stopwords)
        $shared = 0;
        foreach ($ingTokens as $it) {
            foreach ($prodTokens as $pt) {
                if ($this->tokensEqual($it, $pt)) {
                    $shared++;
                    break;
                }
            }
        }

        if ($shared === 0) return 0;

        // Ingredient phrase largely covered by product tokens?
        if ($shared === count($ingTokens)) return 0.85;
        if ($shared / count($ingTokens) >= 0.5) return 0.6;

        // Single shared significant token (>=4 chars) is minimum viable match
        // e.g., "chicken" in "chicken wings" -> 1 shared / 1 ingredient token = 1.0 but handled above;
        // for multi-token like "pork belly" vs "pork" -> 1/2 =0.5 => 0.6 via above
        // For "salt" vs "salted fish": tokensEqual('salt','salted') false => 0 => no match

        return 0.4; // weak partial — below threshold, filtered out
    }
}
