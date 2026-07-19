<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Section;
use App\Models\Stall;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StallController extends Controller
{
    use ApiResponse;

    /**
     * Get all active sections.
     */
    public function sections(): JsonResponse
    {
        $sections = Section::where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'slug', 'color']);

        return $this->successResponse($sections, 'Sections retrieved successfully');
    }

    /**
     * Get available (vacant) stalls, optionally filtered by section.
     */
    public function vacantStalls(Request $request): JsonResponse
    {
        $query = Stall::where('status', 'vacant')
            ->where('is_active', true);

        if ($request->has('section_id')) {
            $query->where('section_id', $request->section_id);
        }

        $stalls = $query->orderBy('stall_number')
            ->get([
                'id',
                'section_id',
                'section',
                'stall_number',
                'store_name',
                'size',
                'monthly_rent',
                'description',
            ]);

        return $this->successResponse($stalls, 'Vacant stalls retrieved successfully');
    }
}
