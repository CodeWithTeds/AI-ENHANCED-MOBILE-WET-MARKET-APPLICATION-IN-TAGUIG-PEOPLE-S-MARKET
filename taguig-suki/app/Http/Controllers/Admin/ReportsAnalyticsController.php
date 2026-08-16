<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Services\Admin\ReportsAnalyticsService;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class ReportsAnalyticsController extends Controller
{
    public function __construct(private readonly ReportsAnalyticsService $reportsService) {}

    public function index(Request $request): Response
    {
        return Inertia::render('admin/reports/index', $this->reportsService->getOverviewData(
            $request->only(['range'])
        ));
    }
}
