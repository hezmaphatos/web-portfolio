# Production image for container hosts (Render, Koyeb, Fly…): FrankenPHP = PHP 8.4 + web server
# in one process. The disk is ephemeral, so uploads must go to object storage (MEDIA_DISK=s3)
# and the queue runs inline (QUEUE_CONNECTION=sync). See docs/DEPLOY.md → "Option B".
FROM dunglas/frankenphp:1-php8.4

RUN install-php-extensions pdo_mysql gd intl exif zip bcmath opcache \
    && cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini"

COPY docker/php.ini "$PHP_INI_DIR/conf.d/zz-app.ini"
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Dependencies first so code-only changes reuse this layer.
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

COPY . .
RUN mkdir -p storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache \
    && composer dump-autoload --optimize --no-dev --no-interaction

ENV APP_ENV=production \
    APP_DEBUG=false \
    LOG_CHANNEL=stderr \
    QUEUE_CONNECTION=sync \
    MEDIA_DISK=s3 \
    MEDIA_ORIGINALS_DISK=s3-private \
    TRUSTED_PROXIES=*

CMD ["sh", "/app/docker/start.sh"]
