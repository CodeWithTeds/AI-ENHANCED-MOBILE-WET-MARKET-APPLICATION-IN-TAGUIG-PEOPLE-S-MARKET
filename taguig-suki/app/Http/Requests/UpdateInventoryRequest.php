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
            'stock_quantity' => ['sometimes', 'numeric', 'min:0'],
            'reorder_level' => ['sometimes', 'numeric', 'min:0'],
            'max_stock_level' => ['nullable', 'numeric', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'selling_price' => ['sometimes', 'numeric', 'min:0'],
            'markup_percentage' => ['nullable', 'numeric', 'min:0', 'max:999'],
            'status' => ['sometimes', 'in:active,inactive,seasonal,discontinued'],
        ];
    }
}
