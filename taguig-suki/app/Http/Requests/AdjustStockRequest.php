<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AdjustStockRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'quantity' => ['required', 'integer', 'not_in:0'],
            'type' => ['required', 'in:restock,sold,returned,spoiled,adjustment,reserved,unreserved,transferred'],
            'reason' => ['nullable', 'string', 'max:500'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'unit_cost' => ['nullable', 'numeric', 'min:0'],
            'supplier_name' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'quantity.not_in' => 'Quantity cannot be zero.',
            'type.in' => 'Invalid stock movement type.',
        ];
    }
}
