<?php

return [

    /*
    | Read by Laravel's TrustProxies middleware. Behind a platform load balancer (Render, Koyeb)
    | set TRUSTED_PROXIES=* so the contact throttle sees the visitor's IP instead of the balancer's;
    | `*` trusts only the direct caller. Leave empty when PHP faces the internet directly.
    */
    'proxies' => env('TRUSTED_PROXIES') ?: null,

];
