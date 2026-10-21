<?php

return [

    /*
    | Only the Next.js origin may call the API from a browser (the three public
    | POSTs: view, defeat, contact). Server-side fetches are not subject to CORS.
    */

    'paths' => ['api/*'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    'allowed_origins' => [rtrim((string) env('FRONTEND_URL', 'http://localhost:3100'), '/')],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Content-Type', 'Accept', 'Authorization', 'X-Requested-With'],

    'exposed_headers' => [],

    'max_age' => 3600,

    'supports_credentials' => false,

];
