'use strict';

/**
 * Locale negotiation middleware
 * Handles Accept-Language header and ?locale query parameter
 * 
 * Supported locales: en, ur, ar, fa
 * Default: en
 */
module.exports = (config, { strapi }) => {
  const supportedLocales = ['en', 'ur', 'ar', 'fa'];
  const defaultLocale = 'en';

  return async (ctx, next) => {
    // Priority 1: Check for ?locale= query parameter (already handled by Strapi i18n, but we validate)
    let locale = ctx.query.locale;

    // Priority 2: Check Accept-Language header if no query param
    if (!locale && ctx.request.headers['accept-language']) {
      const acceptLanguage = ctx.request.headers['accept-language'];
      // Parse Accept-Language header (e.g., "ar-SA,ar;q=0.9,en;q=0.8")
      const languages = acceptLanguage
        .split(',')
        .map(lang => {
          const [code, qValue] = lang.trim().split(';q=');
          return {
            code: code.split('-')[0].toLowerCase(), // Extract base language code
            quality: qValue ? parseFloat(qValue) : 1.0,
          };
        })
        .sort((a, b) => b.quality - a.quality); // Sort by quality

      // Find first supported locale
      for (const lang of languages) {
        if (supportedLocales.includes(lang.code)) {
          locale = lang.code;
          break;
        }
      }
    }

    // Validate locale is supported
    if (locale && !supportedLocales.includes(locale)) {
      locale = defaultLocale; // Fallback to default if invalid
    }

    // Set default locale if none found
    if (!locale) {
      locale = defaultLocale;
    }

    // Add locale to query parameters for Strapi i18n plugin to use
    ctx.query.locale = locale;

    // Also set it in request headers for consistency
    ctx.request.locale = locale;

    await next();
  };
};

