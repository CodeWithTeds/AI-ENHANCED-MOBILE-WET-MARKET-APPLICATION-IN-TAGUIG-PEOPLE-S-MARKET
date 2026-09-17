<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'groq' => [
        // Primary key (legacy GROQ_API_KEY kept for backwards-compat)
        'api_key' => env('GROQ_API_KEY', env('GROQ_API_KEY_MAIN')),
        // Ordered fallback pool — first key is tried first, on 429 next is tried
        // Supports: GROQ_API_KEY_MAIN + _BACKUP + _2NDBACKUP + _3RDBACKUP + legacy GROQ_API_KEY
        'api_keys' => array_values(array_unique(array_filter([
            env('GROQ_API_KEY_MAIN'),
            env('GROQ_API_KEY_BACKUP'),
            env('GROQ_API_KEY_2NDBACKUP'),
            env('GROQ_API_KEY_3RDBACKUP'),
            env('GROQ_API_KEY'),
        ]))),
        'base_url' => env('GROQ_BASE_URL', 'https://api.groq.com/openai/v1'),
        'model' => env('GROQ_MODEL', 'openai/gpt-oss-20b'),
    ],

];
