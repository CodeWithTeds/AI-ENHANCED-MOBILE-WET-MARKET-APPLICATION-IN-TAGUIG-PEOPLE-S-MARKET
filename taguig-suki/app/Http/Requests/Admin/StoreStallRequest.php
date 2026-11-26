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

    protected function prepareForValidation(): void
    {
        if ($this->has('vendor_id') && ($this->vendor_id === '' || $this->vendor_id === '0')) {
            $this->merge(['vendor_id' => null]);
        }

        if ($this->has('is_active')) {
            $this->merge(['is_active' => filter_var($this->is_active, FILTER_VALIDATE_BOOLEAN)]);
        }

        if ($this->has('size')) {
            $size = StallSize::tryFrom((string) $this->input('size'));
            if ($size !== null) {
                $this->merge(['monthly_rent' => $size->monthlyRent()]);
            }
        }
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
