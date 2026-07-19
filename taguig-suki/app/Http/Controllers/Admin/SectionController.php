<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Section;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class SectionController extends Controller
{
    public function index()
    {
        return Section::withCount('stalls')
            ->orderBy('name')
            ->get();
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'color' => ['nullable', 'string', 'max:7'],
            'is_active' => ['boolean'],
        ]);

        $validated['slug'] = Str::slug($validated['name']);

        Section::create($validated);

        return back()->with('success', 'Section created successfully.');
    }

    public function update(Request $request, Section $section)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'color' => ['nullable', 'string', 'max:7'],
            'is_active' => ['boolean'],
        ]);

        $validated['slug'] = Str::slug($validated['name']);

        $section->update($validated);

        return back()->with('success', 'Section updated successfully.');
    }

    public function destroy(Section $section)
    {
        if ($section->stalls()->count() > 0) {
            return back()->withErrors(['section' => 'Cannot delete section with assigned stalls.']);
        }

        $section->delete();

        return back()->with('success', 'Section deleted successfully.');
    }
}
