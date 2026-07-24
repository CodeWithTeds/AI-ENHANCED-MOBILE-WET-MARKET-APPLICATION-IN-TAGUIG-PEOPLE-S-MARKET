<?php

namespace App\Services\Admin;

use App\Enums\StallSize;
use App\Enums\StallStatus;
use App\Models\Section;
use App\Models\Stall;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\ValidationException;

class StallManagementService
{
    public function getIndexData(array $filters): array
    {
        $query = Stall::query()->with(['vendor:id,name,email', 'sectionRelation:id,name,slug,color']);

        $this->applyFilters($query, $filters);
        $this->applySort($query, $filters['sort'] ?? 'section_id', $filters['direction'] ?? 'asc');

        return [
            'stalls' => $query->paginate(15)->withQueryString(),
            'stats' => $this->getStats(),
            'filters' => $filters,
            'sections' => $this->getSectionOptions(),
            'statuses' => collect(StallStatus::cases())->map(fn ($s) => ['value' => $s->value, 'label' => $s->label()]),
            'sizes' => collect(StallSize::cases())->map(fn ($s) => ['value' => $s->value, 'label' => $s->label()]),
        ];
    }

    public function create(array $data, ?UploadedFile $image = null): Stall
    {
        $section = Section::find($data['section_id']);
        $data['section'] = $section->slug;

        $this->validateUniqueStall($data['section'], $data['stall_number'], $section->name);

        if ($image) {
            $data['image'] = $image->store('stalls', 'public');
        }

        return Stall::create($data);
    }

    public function update(Stall $stall, array $data, ?UploadedFile $image = null): Stall
    {
        $section = Section::find($data['section_id']);
        $data['section'] = $section->slug;

        $this->validateUniqueStall($data['section'], $data['stall_number'], $section->name, $stall->id);

        if ($image) {
            $data['image'] = $image->store('stalls', 'public');
        }

        $stall->update($data);

        return $stall;
    }

    public function delete(Stall $stall): void
    {
        $stall->delete();
    }

    private function applyFilters($query, array $filters): void
    {
        if (!empty($filters['section'])) {
            $query->where('section_id', $filters['section']);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['size'])) {
            $query->where('size', $filters['size']);
        }

        if (isset($filters['is_active'])) {
            $query->where('is_active', filter_var($filters['is_active'], FILTER_VALIDATE_BOOLEAN));
        }

        if (!empty($filters['search'])) {
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

    private function getSectionOptions(): \Illuminate\Support\Collection
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
