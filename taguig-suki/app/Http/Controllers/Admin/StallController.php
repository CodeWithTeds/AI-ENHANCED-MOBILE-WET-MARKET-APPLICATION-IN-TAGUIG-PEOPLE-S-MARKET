<?php

namespace App\Http\Controllers\Admin;

use App\Enums\StallSize;
use App\Enums\StallStatus;
use App\Http\Controllers\Controller;
use App\Models\Section;
use App\Models\Stall;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Enum;
use Inertia\Inertia;
use Inertia\Response;

class StallController extends Controller
{
    public function index(Request $request): Response
    {
        $query = Stall::query()->with(['vendor:id,name,email', 'sectionRelation:id,name,slug,color']);

        // Filter by section
        if ($request->filled('section')) {
            $query->where('section_id', $request->input('section'));
        }

        // Filter by status
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        // Filter by size
        if ($request->filled('size')) {
            $query->where('size', $request->input('size'));
        }

        // Filter by active state
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Search by store name or stall number
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('store_name', 'like', "%{$search}%")
                  ->orWhere('stall_number', 'like', "%{$search}%");
            });
        }

        // Sort
        $sortField = $request->input('sort', 'section_id');
        $sortDir = $request->input('direction', 'asc');
        $allowedSorts = ['section_id', 'stall_number', 'store_name', 'status', 'size', 'monthly_rent', 'created_at'];

        if (in_array($sortField, $allowedSorts)) {
            $query->orderBy($sortField, $sortDir === 'desc' ? 'desc' : 'asc');
        }

        $stalls = $query->paginate(15)->withQueryString();

        // Stats
        $stats = [
            'total' => Stall::count(),
            'occupied' => Stall::where('status', 'occupied')->count(),
            'vacant' => Stall::where('status', 'vacant')->count(),
            'maintenance' => Stall::where('status', 'under_maintenance')->count(),
        ];

        // Dynamic sections from DB
        $sections = Section::where('is_active', true)->orderBy('name')->get()
            ->map(fn ($s) => ['value' => (string) $s->id, 'label' => $s->name, 'slug' => $s->slug, 'color' => $s->color]);

        return Inertia::render('admin/stalls/index', [
            'stalls' => $stalls,
            'stats' => $stats,
            'filters' => $request->only(['section', 'status', 'size', 'is_active', 'search', 'sort', 'direction']),
            'sections' => $sections,
            'statuses' => collect(StallStatus::cases())->map(fn ($s) => ['value' => $s->value, 'label' => $s->label()]),
            'sizes' => collect(StallSize::cases())->map(fn ($s) => ['value' => $s->value, 'label' => $s->label()]),
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'section_id' => ['required', 'exists:sections,id'],
            'stall_number' => ['required', 'string', 'max:50'],
            'store_name' => ['required', 'string', 'max:255'],
            'vendor_id' => ['nullable', 'exists:users,id'],
            'status' => ['required', new Enum(StallStatus::class)],
            'size' => ['required', new Enum(StallSize::class)],
            'monthly_rent' => ['required', 'numeric', 'min:0'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['boolean'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        // Get the section slug for the unique constraint
        $section = Section::find($validated['section_id']);
        $validated['section'] = $section->slug;

        // Check unique constraint: section + stall_number
        $exists = Stall::where('section', $validated['section'])
            ->where('stall_number', $validated['stall_number'])
            ->exists();

        if ($exists) {
            return back()->withErrors([
                'stall_number' => "Stall number \"{$validated['stall_number']}\" already exists in the {$section->name} section.",
            ]);
        }

        if ($request->hasFile('image')) {
            $validated['image'] = $request->file('image')->store('stalls', 'public');
        }

        Stall::create($validated);

        return back()->with('success', 'Stall created successfully.');
    }

    public function update(Request $request, Stall $stall)
    {
        $validated = $request->validate([
            'section_id' => ['required', 'exists:sections,id'],
            'stall_number' => ['required', 'string', 'max:50'],
            'store_name' => ['required', 'string', 'max:255'],
            'vendor_id' => ['nullable', 'exists:users,id'],
            'status' => ['required', new Enum(StallStatus::class)],
            'size' => ['required', new Enum(StallSize::class)],
            'monthly_rent' => ['required', 'numeric', 'min:0'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['boolean'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);

        $section = Section::find($validated['section_id']);
        $validated['section'] = $section->slug;

        // Check unique constraint, excluding current stall
        $exists = Stall::where('section', $validated['section'])
            ->where('stall_number', $validated['stall_number'])
            ->where('id', '!=', $stall->id)
            ->exists();

        if ($exists) {
            return back()->withErrors([
                'stall_number' => "Stall number \"{$validated['stall_number']}\" already exists in the {$section->name} section.",
            ]);
        }

        if ($request->hasFile('image')) {
            $validated['image'] = $request->file('image')->store('stalls', 'public');
        }

        $stall->update($validated);

        return back()->with('success', 'Stall updated successfully.');
    }

    public function destroy(Stall $stall)
    {
        $stall->delete();

        return back()->with('success', 'Stall deleted successfully.');
    }
}
