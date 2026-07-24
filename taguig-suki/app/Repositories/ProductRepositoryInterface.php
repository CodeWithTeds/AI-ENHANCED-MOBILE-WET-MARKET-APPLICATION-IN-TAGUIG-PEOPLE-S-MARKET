<?php

namespace App\Repositories;

use App\Models\Product;
use App\Models\Vendor;
use Illuminate\Database\Eloquent\Collection;

interface ProductRepositoryInterface
{
    public function getAllForVendor(Vendor $vendor): Collection;

    public function create(array $data): Product;

    public function update(Product $product, array $data): Product;

    public function delete(Product $product): bool;
}
