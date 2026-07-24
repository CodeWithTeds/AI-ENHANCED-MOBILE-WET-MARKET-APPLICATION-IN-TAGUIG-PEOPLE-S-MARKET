<?php

namespace App\Repositories;

use App\Models\User;
use App\Models\Vendor;

class VendorRepository implements VendorRepositoryInterface
{
    public function findByUser(User $user): ?Vendor
    {
        return Vendor::where('user_id', $user->id)->first();
    }

    public function findByUserWithDocuments(User $user): ?Vendor
    {
        return Vendor::where('user_id', $user->id)
            ->with('documents')
            ->first();
    }
}
