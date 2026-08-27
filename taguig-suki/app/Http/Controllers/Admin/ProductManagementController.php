<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Services\Admin\ProductManagementService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ProductManagementController extends Controller
{
    public function __construct(private readonly ProductManagementService $productService) {}

    public function index(Request $request): Response
    {
        return Inertia::render('admin/products/index', $this->productService->getIndexData(
            $request->only(['search', 'category', 'vendor', 'status', 'availability', 'sort', 'direction'])
        ));
    }

    public function update(Request $request, Product $product): RedirectResponse
    {
        $validated = $request->validate(ProductManagementService::validationRules());

        // Handle boolean coersion for is_available coming from form (string "1"/"0" or boolean)
        if (isset($validated['is_available'])) {
            $validated['is_available'] = filter_var($validated['is_available'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? (bool) $validated['is_available'];
        }

        $image = $request->file('image');

        // Remove image from validated if no file was uploaded to avoid overwriting
        if (! $image) {
            unset($validated['image']);
        }

        $this->productService->update($product, $validated, $image);

        return back()->with('success', "Product \"{$product->name}\" updated successfully.");
    }

    public function destroy(Product $product): RedirectResponse
    {
        $name = $product->name;
        $this->productService->destroy($product);

        return back()->with('success', "Product \"{$name}\" removed successfully.");
    }

    public function toggleAvailability(Product $product): RedirectResponse
    {
        $updated = $this->productService->toggleAvailability($product);
        $status = $updated->is_available ? 'available' : 'unavailable';

        return back()->with('success', "Product \"{$product->name}\" is now {$status}.");
    }
}
