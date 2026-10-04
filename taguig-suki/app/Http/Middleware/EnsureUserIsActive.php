<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsActive
{
    /**
     * Block requests from deactivated accounts, even if they still hold a token.
     * Revokes the offending token so the session cannot be reused.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->isActive()) {
            $user->currentAccessToken()?->delete();

            if ($request->is('api/*')) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Your account has been deactivated. Please contact the administrator.',
                    'data' => null,
                ], 403);
            }

            abort(403, 'Your account has been deactivated.');
        }

        return $next($request);
    }
}
