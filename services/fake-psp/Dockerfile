FROM composer:2.11.1@sha256:8de2184c6de224f4689e8f80ed5f5edaf0030b6b8b7839a22a2bcb6722ac87d0 AS vendor
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --ignore-platform-reqs --optimize-autoloader --no-scripts
COPY src ./src
RUN composer dump-autoload --no-dev --optimize

FROM dunglas/frankenphp:1.13.5-php8.5.12-alpine@sha256:bf8051e99d28fd546b0d1c1b74329f3eba0496b56bb8cd979a10ab1265e28f5c
WORKDIR /app
COPY Caddyfile /etc/frankenphp/Caddyfile
COPY --from=vendor /app/vendor ./vendor
COPY src ./src
COPY public ./public
EXPOSE 8080
