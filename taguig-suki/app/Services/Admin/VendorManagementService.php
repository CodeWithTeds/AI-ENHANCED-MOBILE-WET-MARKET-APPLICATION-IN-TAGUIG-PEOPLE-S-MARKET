<?php

namespace App\Services\Admin;

use App\Enums\VendorStatus;
use App\Models\Stall;
use App\Models\Vendor;
use Illuminate\Database\Eloquent\Builder;

class VendorManagementService
{
    public function getIndexData(array $filters): array
    {
        $query = Vendor::query()
            ->with(['user:id,name,email', 'documents:id,vendor_id,document_type'])
            ->withCount(['products', 'inventories']);

        $this->applyFilters($query, $filters);

        $vendors = $query->orderByDesc('created_at')->paginate(15)->withQueryString();

        $stallNumbers = Stall::whereIn('vendor_id', $vendors->pluck('user_id')->filter())
            ->pluck('stall_number', 'vendor_id');

        $vendors->getCollection()->transform(fn (Vendor $vendor) => $this->present($vendor, $stallNumbers[$vendor->user_id] ?? null));

        return [
            'vendors' => $vendors,
            'stats' => $this->getStats(),
            'filters' => $filters,
            'statuses' => collect(VendorStatus::cases())->map(fn (VendorStatus $status) => ['value' => $status->value, 'label' => $status->label()]),
            'categories' => $this->getCategories(),
        ];
    }

    public function suspend(Vendor $vendor): Vendor
    {
        $vendor->update([
            'status' => VendorStatus::Suspended->value,
            'rejection_reason' => null,
        ]);

        return $vendor;
    }

    public function activate(Vendor $vendor): Vendor
    {
        $vendor->update([
            'status' => VendorStatus::Approved->value,
            'approved_at' => $vendor->approved_at ?? now(),
            'rejection_reason' => null,
        ]);

        return $vendor;
    }

    private function present(Vendor $vendor, ?string $stallNumber): array
    {
        return [
            'id' => $vendor->id,
            'stall_name' => $vendor->stall_name,
            'stall_location' => $vendor->stall_location,
            'stall_number' => $stallNumber,
            'product_categories' => $vendor->product_categories ?? [],
            'status' => $vendor->status,
            'rejection_reason' => $vendor->rejection_reason,
            'approved_at' => $vendor->approved_at,
            'created_at' => $vendor->created_at,
            'products_count' => $vendor->products_count ?? 0,
            'inventories_count' => $vendor->inventories_count ?? 0,
            'documents_count' => $vendor->documents->count(),
            'user' => $vendor->user
                ? ['id' => $vendor->user->id, 'name' => $vendor->user->name, 'email' => $vendor->user->email]
                : null,
        ];
    }

    private function applyFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['category'])) {
            $category = $filters['category'];
            $query->whereJsonContains('product_categories', $category);
        }

        if (! empty($filters['search'])) {
            $term = $filters['search'];
            $query->where(function (Builder $q) use ($term) {
                $q->where('stall_name', 'like', "%{$term}%")
                    ->orWhere('stall_location', 'like', "%{$term}%")
                    ->orWhereHas('user', fn ($uq) => $uq->where('name', 'like', "%{$term}%")->orWhere('email', 'like', "%{$term}%"));
            });
        }
    }

    private function getStats(): array
    {
        return [
            'total' => Vendor::count(),
            'approved' => Vendor::where('status', VendorStatus::Approved->value)->count(),
            'pending' => Vendor::where('status', VendorStatus::Pending->value)->count(),
            'suspended' => Vendor::where('status', VendorStatus::Suspended->value)->count(),
            'rejected' => Vendor::where('status', VendorStatus::Rejected->value)->count(),
        ];
    }

    private function getCategories(): array
    {
        return Vendor::query()
            ->get('product_categories')
            ->flatMap(fn (Vendor $vendor) => (array) $vendor->product_categories)
            ->filter()
            ->unique()
            ->sort()
            ->values()
            ->map(fn (string $category) => ['value' => $category, 'label' => ucfirst($category)])
            ->all();
    }
}
