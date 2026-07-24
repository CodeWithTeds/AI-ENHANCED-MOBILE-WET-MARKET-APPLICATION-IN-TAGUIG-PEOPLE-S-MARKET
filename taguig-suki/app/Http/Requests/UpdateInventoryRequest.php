<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateInventoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'reorder_level' => ['sometimes', 'integer', 'min:0'],
            'max_stock_level' => ['nullable', 'integer', 'min:0'],
            'is_available' => ['sometimes', 'boolean'],
            'status' => ['sometimes', 'in:active,inactive,seasonal,discontinued'],
            'batch_number' => ['nullable', 'string', 'max:100'],
            'expiry_date' => ['nullable', 'date'],
            'harvest_date' => ['nullable', 'date'],
            'source_location' => ['nullable', 'string', 'max:255'],
            'storage_type' => ['sometimes', 'in:ambient,chilled,frozen'],
            'weight_per_unit' => ['nullable', 'numeric', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'selling_price' => ['sometimes', 'numeric', 'min:0'],
            'markup_percentage' => ['nullable', 'numeric', 'min:0', 'max:999'],
            'supplier_name' => ['nullable', 'string', 'max:255'],
            'supplier_contact' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
