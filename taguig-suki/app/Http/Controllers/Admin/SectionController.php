<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreSectionRequest;
use App\Models\Section;
use App\Services\Admin\SectionService;

class SectionController extends Controller
{
    public function __construct(private readonly SectionService $sectionService) {}

    public function index()
    {
        return $this->sectionService->getAll();
    }

    public function store(StoreSectionRequest $request)
    {
        return back()->with('success', $this->sectionService->create($request->validated()) ? 'Section created successfully.' : '');
    }

    public function update(StoreSectionRequest $request, Section $section)
    {
        return back()->with('success', $this->sectionService->update($section, $request->validated()) ? 'Section updated successfully.' : '');
    }

    public function destroy(Section $section)
    {
        return back()->with('success', tap('Section deleted successfully.', fn () => $this->sectionService->delete($section)));
    }
}
