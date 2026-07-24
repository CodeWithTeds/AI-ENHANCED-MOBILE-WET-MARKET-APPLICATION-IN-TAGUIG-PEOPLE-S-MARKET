<?php

namespace App\Http\Requests\Admin;

use App\Enums\StallSize;
use App\Enums\StallStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Enum;

class StoreStallRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'section_id' => ['required', 'exists:sections,id'],
            'stall_number' => ['required', 'string', 'max:50'],
            'store_name' => ['required', 'string', 'max:255'],
            'vendor_id' => ['nullable', 'exists:users,id'],
            'status' => ['required', new Enum(StallStatus::class)],
            'size' => ['required', new Enum(StallSize::class)],
            'monthly_rent' => ['required', 'numeric', 'min:0'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_active' => ['boolean'],
            'image' => ['nullable', 'image', 'max:5120'],
        ];
    }
}
