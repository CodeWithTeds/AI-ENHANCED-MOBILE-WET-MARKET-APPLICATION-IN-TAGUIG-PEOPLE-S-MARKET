<?php

namespace App\Repositories;

use App\Models\Product;
use App\Models\Vendor;
use Illuminate\Database\Eloquent\Collection;

class ProductRepository implements ProductRepositoryInterface
{
    public function getAllForVendor(Vendor $vendor): Collection
    {
        return Product::where('vendor_id', $vendor->id)
            ->orderByDesc('updated_at')
            ->get();
    }

    public function create(array $data): Product
    {
        return Product::create($data);
    }

    public function update(Product $product, array $data): Product
    {
        $product->update($data);

        return $product->fresh();
    }

    public function delete(Product $product): bool
    {
        return $product->delete();
    }
}
