<?php

namespace App\Services\Admin;

use App\Enums\StallSize;
use App\Enums\StallStatus;
use App\Enums\VendorStatus;
use App\Models\Section;
use App\Models\Stall;
use App\Models\Vendor;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class StallManagementService
{
    public function getIndexData(array $filters): array
    {
        $query = Stall::query()->with(['vendor:id,name,email', 'sectionRelation:id,name,slug,color']);

        $this->applyFilters($query, $filters);
        $this->applySort($query, $filters['sort'] ?? 'section_id', $filters['direction'] ?? 'asc');

        $activeVendors = Vendor::with('user:id,name,email')
            ->where('status', VendorStatus::Approved->value)
            ->get()
            ->map(fn ($v) => [
                'id' => $v->user_id,
                'name' => ($v->user?->name ?: $v->stall_name).' ('.$v->stall_name.')',
            ]);

        $standardStallNumbers = collect(range(1, 30))->map(fn ($n) => "Stall {$n}")->all();

        $occupiedSlots = Stall::query()
            ->select('id', 'section_id', 'stall_number', 'store_name', 'status')
            ->get()
            ->groupBy('section_id')
            ->map(fn ($items) => $items->map(fn ($s) => [
                'id' => $s->id,
                'stall_number' => $s->stall_number,
                'store_name' => $s->store_name,
                'status' => $s->status instanceof \BackedEnum ? $s->status->value : (string) $s->status,
            ]));

        $sectionCapacities = Section::all()->mapWithKeys(fn ($s) => [(string) $s->id => self::getSectionMaxCapacity($s)]);

        return [
            'stalls' => $query->paginate(15)->withQueryString(),
            'stats' => $this->getStats(),
            'filters' => $filters,
            'sections' => $this->getSectionOptions(),
            'statuses' => collect(StallStatus::cases())->map(fn ($s) => ['value' => $s->value, 'label' => $s->label()]),
            'sizes' => collect(StallSize::cases())->map(fn ($s) => [
                'value' => $s->value,
                'label' => $s->label(),
                'monthly_rent' => $s->monthlyRent(),
            ]),
            'vendors' => $activeVendors,
            'available_stall_numbers' => $standardStallNumbers,
            'occupied_slots' => $occupiedSlots,
            'section_capacities' => $sectionCapacities,
            'market_capacity_per_section' => 30,
            'market_total_capacity' => 365,
        ];
    }

    public static function getSectionMaxCapacity(?Section $section): int
    {
        if (! $section) {
            return 30;
        }

        $slug = strtolower($section->slug ?? '');
        $name = strtolower($section->name ?? '');

        // Official Taguig People's Market (TPM) Stall Distribution (Total: 365 stalls)
        // Eatery (E): 15
        if ($slug === 'e' || $slug === 'eatery' || $name === 'eatery') {
            return 15;
        }
        // Miscellaneous (MISC): 15
        if ($slug === 'misc' || $slug === 'miscellaneous' || $name === 'miscellaneous') {
            return 15;
        }
        // Dry Goods (DG): 254
        if ($slug === 'dg' || $slug === 'dry-goods') {
            return 254;
        }

        // Standard sub-section limit (Wet section WM, WF, WC, MP partitions of the 81 total)
        return 30;
    }

    public function create(array $data, ?UploadedFile $image = null): Stall
    {
        $section = Section::find($data['section_id']);
        $data['section'] = $section->slug;

        $maxCapacity = self::getSectionMaxCapacity($section);
        $count = Stall::where('section_id', $data['section_id'])->count();
        if ($count >= $maxCapacity) {
            throw ValidationException::withMessages([
                'section_id' => "Market capacity limit reached: Maximum {$maxCapacity} stalls allowed in the {$section->name} section.",
            ]);
        }

        $this->validateUniqueStall($data['section'], $data['stall_number'], $section->name);

        $computedRent = $this->resolveMonthlyRent($data['size'] ?? null);
        if ($computedRent !== null) {
            $data['monthly_rent'] = $computedRent;
        }

        if ($image) {
            $data['image'] = $image->store('stalls', 'public');
        }

        return Stall::create($data);
    }

    public function update(Stall $stall, array $data, ?UploadedFile $image = null): Stall
    {
        $section = Section::find($data['section_id']);
        $data['section'] = $section->slug;

        $maxCapacity = self::getSectionMaxCapacity($section);
        if ((int) $stall->section_id !== (int) $data['section_id']) {
            $count = Stall::where('section_id', $data['section_id'])->count();
            if ($count >= $maxCapacity) {
                throw ValidationException::withMessages([
                    'section_id' => "Market capacity limit reached: Maximum {$maxCapacity} stalls allowed in the {$section->name} section.",
                ]);
            }
        }

        $this->validateUniqueStall($data['section'], $data['stall_number'], $section->name, $stall->id);

        $computedRent = $this->resolveMonthlyRent($data['size'] ?? null);
        if ($computedRent !== null) {
            $data['monthly_rent'] = $computedRent;
        }

        if ($image) {
            $data['image'] = $image->store('stalls', 'public');
        }

        $stall->update($data);

        return $stall;
    }

    private function resolveMonthlyRent(mixed $size): ?float
    {
        if ($size instanceof StallSize) {
            return $size->monthlyRent();
        }

        if (is_string($size) && $size !== '') {
            return StallSize::tryFrom($size)?->monthlyRent();
        }

        return null;
    }

    public function delete(Stall $stall): void
    {
        $stall->delete();
    }

    private function applyFilters($query, array $filters): void
    {
        if (! empty($filters['section'])) {
            $query->where('section_id', $filters['section']);
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['size'])) {
            $query->where('size', $filters['size']);
        }

        if (isset($filters['is_active'])) {
            $query->where('is_active', filter_var($filters['is_active'], FILTER_VALIDATE_BOOLEAN));
        }

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(fn ($q) => $q->where('store_name', 'like', "%{$search}%")->orWhere('stall_number', 'like', "%{$search}%"));
        }
    }

    private function applySort($query, string $field, string $direction): void
    {
        $allowed = ['section_id', 'stall_number', 'store_name', 'status', 'size', 'monthly_rent', 'created_at'];

        if (in_array($field, $allowed)) {
            $query->orderBy($field, $direction === 'desc' ? 'desc' : 'asc');
        }
    }

    private function getStats(): array
    {
        return [
            'total' => Stall::count(),
            'occupied' => Stall::where('status', 'occupied')->count(),
            'vacant' => Stall::where('status', 'vacant')->count(),
            'maintenance' => Stall::where('status', 'under_maintenance')->count(),
        ];
    }

    private function getSectionOptions(): Collection
    {
        return Section::where('is_active', true)->orderBy('name')->get()
            ->map(fn ($s) => ['value' => (string) $s->id, 'label' => $s->name, 'slug' => $s->slug, 'color' => $s->color]);
    }

    private function validateUniqueStall(string $section, string $stallNumber, string $sectionName, ?int $excludeId = null): void
    {
        $query = Stall::where('section', $section)->where('stall_number', $stallNumber);

        if ($excludeId) {
            $query->where('id', '!=', $excludeId);
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'stall_number' => "Stall number \"{$stallNumber}\" already exists in the {$sectionName} section.",
            ]);
        }
    }
}
