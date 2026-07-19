<?php

namespace App\Exceptions;

use App\Traits\ApiResponse;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\Routing\Exception\RouteNotFoundException;
use Throwable;

class ApiExceptionHandler
{
    use ApiResponse;

    public function handle(Throwable $e, Request $request): JsonResponse
    {
        if ($e instanceof ValidationException) {
            return $this->errorResponse('Validation failed', 422, $e->errors());
        }

        if ($e instanceof ModelNotFoundException) {
            return $this->errorResponse('Resource not found', 404);
        }

        if ($e instanceof AuthenticationException) {
            return $this->errorResponse('Unauthenticated', 401);
        }

        if ($e instanceof AuthorizationException) {
            return $this->errorResponse('Unauthorized', 403);
        }

        if ($e instanceof MethodNotAllowedHttpException) {
            return $this->errorResponse('Method not allowed', 405);
        }

        if ($e instanceof RouteNotFoundException) {
            return $this->errorResponse('Route not found', 404);
        }

        if ($e instanceof HttpException) {
            return $this->errorResponse($e->getMessage(), $e->getStatusCode());
        }

        return $this->errorResponse('Server error', 500);
    }
}
