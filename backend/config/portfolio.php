<?php

return [

    /*
    | Origin of the Next.js site. Used for the CORS allow-list and as the
    | target of the revalidation webhook (POST {frontend_url}/api/revalidate).
    */
    'frontend_url' => rtrim((string) env('FRONTEND_URL', 'http://localhost:3100'), '/'),

    'revalidate_secret' => env('REVALIDATE_SECRET'),

    // The single admin account, seeded by AdminUserSeeder.
    'admin' => [
        'email' => env('ADMIN_EMAIL'),
        'password' => env('ADMIN_PASSWORD'),
    ],

];
