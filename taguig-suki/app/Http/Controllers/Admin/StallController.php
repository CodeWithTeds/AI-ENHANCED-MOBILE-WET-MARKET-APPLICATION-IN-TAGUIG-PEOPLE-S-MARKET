<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\StoreStallRequest;
use App\Models\Stall;
use App\Services\Admin\StallManagementService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class StallController extends Controller
{
    public function __construct(private readonly StallManagementService $stallService) {}

    public function index(Request $request): Response
    {
        return Inertia::render('admin/stalls/index', $this->stallService->getIndexData($request->only(['section', 'status', 'size', 'is_active', 'search', 'sort', 'direction'])));
    }

    public function store(StoreStallRequest $request)
    {
        return back()->with('success', $this->stallService->create($request->safe()->except('image'), $request->file('image')) ? 'Stall created successfully.' : '');
    }

    public function update(StoreStallRequest $request, Stall $stall)
    {
        return back()->with('success', $this->stallService->update($stall, $request->safe()->except('image'), $request->file('image')) ? 'Stall updated successfully.' : '');
    }

    public function destroy(Stall $stall)
    {
        return back()->with('success', tap('Stall deleted successfully.', fn () => $this->stallService->delete($stall)));
    }
}
