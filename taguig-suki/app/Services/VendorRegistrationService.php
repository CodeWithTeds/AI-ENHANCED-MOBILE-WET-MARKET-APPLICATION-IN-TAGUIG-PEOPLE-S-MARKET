<?php

namespace App\Services;

use App\Enums\VendorStatus;
use App\Models\Stall;
use App\Models\User;
use App\Models\Vendor;
use App\Models\VendorDocument;
use App\Repositories\VendorRepositoryInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class VendorRegistrationService
{
    public function __construct(
        private readonly VendorRepositoryInterface $vendorRepository,
    ) {}

    /**
     * @throws ValidationException
     */
    public function register(array $data, array $files): array
    {
        $stall = Stall::findOrFail($data['stall_id']);

        if ($stall->status->value !== 'vacant') {
            throw ValidationException::withMessages([
                'stall_id' => ['Selected stall is no longer available.'],
            ]);
        }

        return DB::transaction(function () use ($data, $files, $stall) {
            $user = $this->createUser($data);
            $vendor = $this->createVendor($user, $data, $stall);
            $this->reserveStall($stall, $user, $data['stall_name']);
            $this->uploadDocuments($vendor, $files);

            $token = $user->createToken('mobile_token')->plainTextToken;

            return [
                'user' => $user,
                'vendor' => $vendor->load('documents'),
                'token' => $token,
            ];
        });
    }

    public function getStatus(User $user): Vendor
    {
        $vendor = $this->vendorRepository->findByUserWithDocuments($user);

        if (!$vendor) {
            throw new \Symfony\Component\HttpKernel\Exception\NotFoundHttpException('No vendor profile found');
        }

        return $vendor;
    }

    private function createUser(array $data): User
    {
        return User::create([
            'name' => $data['full_name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'is_admin' => false,
        ]);
    }

    private function createVendor(User $user, array $data, Stall $stall): Vendor
    {
        $stallLocation = "Stall {$stall->stall_number}, {$stall->section}";

        return Vendor::create([
            'user_id' => $user->id,
            'stall_name' => $data['stall_name'],
            'stall_location' => $stallLocation,
            'product_categories' => $data['product_categories'],
            'status' => VendorStatus::Pending->value,
        ]);
    }

    private function reserveStall(Stall $stall, User $user, string $storeName): void
    {
        $stall->update([
            'vendor_id' => $user->id,
            'store_name' => $storeName,
            'status' => 'occupied',
        ]);
    }

    private function uploadDocuments(Vendor $vendor, array $files): void
    {
        $documentTypes = ['business_permit', 'stall_lease', 'valid_id'];

        foreach ($documentTypes as $type) {
            if (!isset($files[$type])) {
                continue;
            }

            $path = $files[$type]->store("vendors/{$vendor->id}", 'public');

            VendorDocument::create([
                'vendor_id' => $vendor->id,
                'document_type' => $type,
                'file_path' => $path,
                'original_name' => $files[$type]->getClientOriginalName(),
            ]);
        }
    }
}
