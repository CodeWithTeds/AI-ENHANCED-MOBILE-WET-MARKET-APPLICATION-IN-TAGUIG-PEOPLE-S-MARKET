<?php

namespace App\Repositories;

use App\Models\User;
use App\Models\Vendor;

interface VendorRepositoryInterface
{
    public function findByUser(User $user): ?Vendor;

    public function findByUserWithDocuments(User $user): ?Vendor;
}
