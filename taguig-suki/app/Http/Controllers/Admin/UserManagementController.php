<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\Admin\UserManagementService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class UserManagementController extends Controller
{
    public function __construct(private readonly UserManagementService $userService) {}

    /**
     * Display customer accounts with search, filters & pagination.
     * Manages customer accounts, including viewing, updating, activating, or deactivating users.
     */
    public function index(Request $request): Response
    {
        return Inertia::render('admin/users/index', $this->userService->getIndexData(
            $request->only(['search', 'status', 'role', 'sort', 'direction'])
        ));
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate(UserManagementService::validationRules($user));

        // Convert is_admin boolean properly, is_active already boolean via validation
        $this->userService->update($user, $validated);

        return back()->with('success', "User \"{$user->name}\" updated successfully.");
    }

    public function toggleStatus(User $user): RedirectResponse
    {
        $this->userService->toggleStatus($user);

        $status = $user->fresh()->is_active ? 'activated' : 'deactivated';

        return back()->with('success', "User \"{$user->name}\" has been {$status}.");
    }

    public function activate(User $user): RedirectResponse
    {
        $this->userService->activate($user);

        return back()->with('success', "User \"{$user->name}\" activated.");
    }

    public function deactivate(User $user): RedirectResponse
    {
        $this->userService->deactivate($user);

        return back()->with('success', "User \"{$user->name}\" deactivated.");
    }

    public function destroy(User $user): RedirectResponse
    {
        if (auth()->id() === $user->id) {
            return back()->with('error', 'You cannot delete your own account.');
        }

        $name = $user->name;
        $this->userService->delete($user);

        return back()->with('success', "User \"{$name}\" deleted successfully.");
    }
}
