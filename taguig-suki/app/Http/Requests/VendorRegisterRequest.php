<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class VendorRegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Personal info
            'full_name' => ['required', 'string', 'max:255'],
            'email' => [
                'required',
                'string',
                'email',
                'max:255',
                'unique:users,email',
                function (string $attribute, mixed $value, \Closure $fail) {
                    if (\App\Models\RejectedEmail::isBlocked($value)) {
                        $fail(\App\Models\RejectedEmail::blockedMessage($value));
                    }
                },
            ],
            'phone' => ['required', 'string', 'max:20'],
            'password' => ['required', Password::min(8)],

            // Business info
            'stall_name' => ['required', 'string', 'max:255'],
            'stall_id' => ['required', 'exists:stalls,id'],
            'product_categories' => ['required', 'array', 'min:1'],
            'product_categories.*' => ['string'],

            // Documents
            'business_permit' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            'stall_lease' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
            'valid_id' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:5120'],
        ];
    }

    public function messages(): array
    {
        return [
            'email.required' => 'Email address is required.',
            'email.email' => 'Please provide a valid email address.',
            'email.unique' => 'This email address is already registered.',
        ];
    }
}
