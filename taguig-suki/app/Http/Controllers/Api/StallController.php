<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\StallService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StallController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly StallService $stallService) {}

    public function sections(): JsonResponse
    {
        return $this->successResponse($this->stallService->getActiveSections(), 'Sections retrieved successfully');
    }

    public function vacantStalls(Request $request): JsonResponse
    {
        return $this->successResponse($this->stallService->getVacantStalls($request->section_id), 'Vacant stalls retrieved successfully');
    }
}
