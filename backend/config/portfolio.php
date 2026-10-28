<?php

return [

    /*
    | Origin of the Next.js site. Used for the CORS allow-list and as the
    | target of the revalidation webhook (POST {frontend_url}/api/revalidate).
    */
    'frontend_url' => rtrim((string) env('FRONTEND_URL', 'http://localhost:3100'), '/'),

    'revalidate_secret' => env('REVALIDATE_SECRET'),

    // Seconds the revalidation webhook may take (it runs after the response; one retry on failure).
    'revalidate_timeout' => (int) env('REVALIDATE_TIMEOUT', 10),

    // The single admin account, seeded by AdminUserSeeder.
    'admin' => [
        'email' => env('ADMIN_EMAIL'),
        'password' => env('ADMIN_PASSWORD'),
    ],

    // Media library limits (docs/API.md → Media). Sizes in kilobytes, widths in pixels.
    'media' => [
        // Served files go to `disk` (public URLs); untouched image originals (EXIF intact) go to
        // `originals_disk`, which must never be public. Production: `s3` + `s3-private` (docs/DEPLOY.md).
        'disk' => env('MEDIA_DISK', 'public'),
        'originals_disk' => env('MEDIA_ORIGINALS_DISK', 'local'),
        'image_max_kb' => 8192,
        'pdf_max_kb' => 10240,
        'video_max_kb' => 30720,
        'max_width' => 1920,
        'thumb_width' => 480,
        'blur_width' => 20,
        'webp_quality' => 82,
        // Width × height limit checked before GD decodes an image (~4–5 bytes per pixel in memory):
        // 40 MP needs ~180 MB, so production PHP wants memory_limit ≥ 256M.
        'max_pixels' => 40_000_000,
    ],

];
