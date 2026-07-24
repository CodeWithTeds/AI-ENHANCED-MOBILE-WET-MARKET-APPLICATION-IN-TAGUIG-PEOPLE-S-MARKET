<?php

namespace App\Services;

use App\Models\Product;
use App\Models\Vendor;
use App\Repositories\ProductRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;

class ProductService
{
    public function __construct(
        private readonly ProductRepositoryInterface $productRepository,
    ) {}

    public function getAllForVendor(Vendor $vendor): Collection
    {
        return $this->productRepository->getAllForVendor($vendor);
    }

    public function create(Vendor $vendor, array $data, ?UploadedFile $image = null): Product
    {
        $data['vendor_id'] = $vendor->id;

        if ($image) {
            $data['image'] = $image->store("products/{$vendor->id}", 'public');
        }

        return $this->productRepository->create($data);
    }

    public function update(Product $product, array $data, ?UploadedFile $image = null): Product
    {
        if ($image) {
            $data['image'] = $image->store("products/{$product->vendor_id}", 'public');
        }

        return $this->productRepository->update($product, $data);
    }

    public function delete(Product $product): bool
    {
        return $this->productRepository->delete($product);
    }
}
