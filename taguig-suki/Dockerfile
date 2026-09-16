FROM php:8.4-apache

# Install system deps + Node 22
RUN apt-get update && apt-get install -y \
    git curl zip unzip libzip-dev libicu-dev libonig-dev libsodium-dev \
    libpng-dev libjpeg-dev libfreetype6-dev libxml2-dev libpq-dev \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) pdo pdo_mysql pdo_pgsql zip mbstring intl bcmath opcache gd exif pcntl \
    && a2dismod mpm_event mpm_worker || true \
    && rm -f /etc/apache2/mods-enabled/mpm_event.* /etc/apache2/mods-enabled/mpm_worker.* || true \
    && a2enmod mpm_prefork rewrite || true \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy app (Railway Root Directory is taguig-suki, so context is this folder)
COPY . .

# PHP deps (use --no-interaction, allow plugins)
ENV COMPOSER_ALLOW_SUPERUSER=1
RUN composer install --no-dev --optimize-autoloader --no-interaction --no-scripts

# Node deps + build (legacy-peer-deps needed for react 19 + @dotlottie/react-player)
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps
RUN npm run build

# Laravel optimize
RUN php artisan package:discover --ansi || true
RUN chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R 775 storage bootstrap/cache \
    && php artisan storage:link || true

# Apache config: point to public + allow .htaccess (overwrite vhost to avoid sed bugs)
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN printf '<VirtualHost *:80>\n    DocumentRoot /var/www/html/public\n    <Directory /var/www/html/public>\n        AllowOverride All\n        Require all granted\n        Options Indexes FollowSymLinks\n    </Directory>\n    ErrorLog ${APACHE_LOG_DIR}/error.log\n    CustomLog ${APACHE_LOG_DIR}/access.log combined\n</VirtualHost>\n' > /etc/apache2/sites-available/000-default.conf \
    && printf '<Directory /var/www/html/public>\n    AllowOverride All\n    Require all granted\n</Directory>\n' > /etc/apache2/conf-available/laravel.conf \
    && a2enconf laravel || true \
    && chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html/public \
    && cat /etc/apache2/sites-available/000-default.conf; echo "---VHOST OK---"; ls -la /var/www/html/public/ | head -20; echo "---"; ls -la /var/www/html/public/index.php 2>&1 | head

EXPOSE 80

# Railway provides $PORT, make Apache listen on $PORT + fix MPM at runtime
CMD bash -c "a2dismod mpm_event mpm_worker 2>/dev/null || true; rm -f /etc/apache2/mods-enabled/mpm_event.* /etc/apache2/mods-enabled/mpm_worker.* 2>/dev/null || true; a2enmod mpm_prefork rewrite 2>/dev/null || true; sed -ri -e \"s/Listen 80/Listen \${PORT:-80}/g\" /etc/apache2/ports.conf && sed -ri -e \"s/:80/:\\\${PORT:-80}/g\" /etc/apache2/sites-available/*.conf; php artisan migrate --force --no-interaction || true; php artisan config:cache; php artisan route:cache; php artisan view:cache; apache2-foreground"

