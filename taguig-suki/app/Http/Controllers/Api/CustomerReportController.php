<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CustomerReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerReportController extends Controller
{
    public function __construct(private readonly CustomerReportService $reportService) {}

    /**
     * Generate purchase report for authenticated customer.
     *
     * GET /customer/reports?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
     */
    public function index(Request $request): JsonResponse
    {
        $dateFrom = $request->query('date_from');
        $dateTo = $request->query('date_to');

        if ($dateFrom && ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateFrom)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Invalid date_from format. Use YYYY-MM-DD.',
            ], 422);
        }
        if ($dateTo && ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $dateTo)) {
            return response()->json([
                'status' => 'error',
                'message' => 'Invalid date_to format. Use YYYY-MM-DD.',
            ], 422);
        }

        $report = $this->reportService->getReport(
            $request->user(),
            $dateFrom,
            $dateTo
        );

        return response()->json([
            'status' => 'success',
            'message' => 'Purchase report generated',
            'data' => $report,
        ]);
    }

    /**
     * Export report (same payload, for explicit export action).
     * GET /customer/reports/export?date_from=&date_to=
     */
    public function export(Request $request): JsonResponse
    {
        return $this->index($request);
    }
}
