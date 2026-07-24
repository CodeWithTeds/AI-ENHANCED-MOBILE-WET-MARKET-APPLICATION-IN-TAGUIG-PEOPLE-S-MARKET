<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreInventoryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'product_id' => ['required', 'exists:products,id'],
            'stock_quantity' => ['required', 'integer', 'min:0'],
            'reorder_level' => ['nullable', 'integer', 'min:0'],
            'max_stock_level' => ['nullable', 'integer', 'min:0'],
            'is_available' => ['nullable', 'boolean'],
            'status' => ['nullable', 'in:active,inactive,seasonal,discontinued'],
            'batch_number' => ['nullable', 'string', 'max:100'],
            'expiry_date' => ['nullable', 'date', 'after_or_equal:today'],
            'harvest_date' => ['nullable', 'date', 'before_or_equal:today'],
            'source_location' => ['nullable', 'string', 'max:255'],
            'storage_type' => ['nullable', 'in:ambient,chilled,frozen'],
            'weight_per_unit' => ['nullable', 'numeric', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'selling_price' => ['nullable', 'numeric', 'min:0'],
            'markup_percentage' => ['nullable', 'numeric', 'min:0', 'max:999'],
            'supplier_name' => ['nullable', 'string', 'max:255'],
            'supplier_contact' => ['nullable', 'string', 'max:100'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
