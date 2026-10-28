#!/bin/sh
# Container start: cache config with the real env, bring the schema up to date, seed what is
# missing (every seeder is idempotent and never overwrites admin edits), then serve public/.
set -e

php artisan config:cache
php artisan route:cache
php artisan migrate --force
php artisan db:seed --force

# Render and Koyeb pass the port to listen on in $PORT.
exec frankenphp php-server --listen ":${PORT:-8080}" --root public/
