<?php

namespace App\Services\Admin;

use App\Models\Section;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SectionService
{
    public function getAll(): Collection
    {
        return Section::withCount('stalls')->orderBy('name')->get();
    }

    public function create(array $data): Section
    {
        $data['slug'] = Str::slug($data['name']);

        return Section::create($data);
    }

    public function update(Section $section, array $data): Section
    {
        $data['slug'] = Str::slug($data['name']);

        $section->update($data);

        return $section;
    }

    public function delete(Section $section): void
    {
        if ($section->stalls()->count() > 0) {
            throw ValidationException::withMessages([
                'section' => 'Cannot delete section with assigned stalls.',
            ]);
        }

        $section->delete();
    }
}
