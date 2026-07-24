<?php

namespace App\Services;

use App\Models\Section;
use App\Models\Stall;
use Illuminate\Database\Eloquent\Collection;

class StallService
{
    public function getActiveSections(): Collection
    {
        return Section::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'color']);
    }

    public function getVacantStalls(?int $sectionId = null): Collection
    {
        $query = Stall::where('status', 'vacant')->where('is_active', true);

        if ($sectionId) {
            $query->where('section_id', $sectionId);
        }

        return $query->orderBy('stall_number')
            ->get(['id', 'section_id', 'section', 'stall_number', 'store_name', 'size', 'monthly_rent', 'description']);
    }
}
