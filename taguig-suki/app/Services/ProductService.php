<?php

namespace App\Services;

use App\Models\Product;
use App\Models\User;
use App\Models\Vendor;
use App\Repositories\ProductRepositoryInterface;
use App\Repositories\VendorRepositoryInterface;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\UploadedFile;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class ProductService
{
    public function __construct(
        private readonly ProductRepositoryInterface $productRepository,
        private readonly VendorRepositoryInterface $vendorRepository,
    ) {}

    public function getAllForVendor(User $user): Collection
    {
        return $this->productRepository->getAllForVendor($this->resolveVendor($user));
    }

    public function create(User $user, array $data, ?UploadedFile $image = null): Product
    {
        $vendor = $this->resolveVendor($user);
        $data['vendor_id'] = $vendor->id;

        if ($image) {
            $data['image'] = $image->store("products/{$vendor->id}", 'public');
        }

        return $this->productRepository->create($data);
    }

    public function update(User $user, Product $product, array $data, ?UploadedFile $image = null): Product
    {
        $this->authorizeProduct($user, $product);

        if ($image) {
            $data['image'] = $image->store("products/{$product->vendor_id}", 'public');
        }

        return $this->productRepository->update($product, $data);
    }

    public function delete(User $user, Product $product): bool
    {
        $this->authorizeProduct($user, $product);

        return $this->productRepository->delete($product);
    }

    private function resolveVendor(User $user): Vendor
    {
        $vendor = $this->vendorRepository->findByUser($user);

        if (!$vendor) {
            throw new NotFoundHttpException('Vendor profile not found');
        }

        return $vendor;
    }

    private function authorizeProduct(User $user, Product $product): void
    {
        $vendor = $this->resolveVendor($user);

        if ($product->vendor_id !== $vendor->id) {
            throw new AccessDeniedHttpException('Unauthorized');
        }
    }
}
