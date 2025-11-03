/**
 * Bootstrap Locales Script
 * 
 * Idempotent script to set up i18n locales: en, ur, ar, fa
 * Can be run multiple times safely - only creates missing locales
 * 
 * Usage:
 *   npx ts-node scripts/bootstrap-locales.ts
 *   OR
 *   npm run bootstrap:locales (if script is added to package.json)
 */

async function bootstrapLocales() {
  try {
    console.log('Setting up i18n locales...');

    // Check if i18n plugin is available
    const i18nPlugin = strapi.plugin('i18n');
    if (!i18nPlugin) {
      console.log('⚠️  i18n plugin not found, skipping locale setup');
      console.log('   Make sure i18n plugin is enabled in config/plugins.js');
      return;
    }

    // Define locales to create
    const locales = [
      { name: 'English', code: 'en', isDefault: true },
      { name: 'Urdu', code: 'ur', isDefault: false },
      { name: 'Arabic', code: 'ar', isDefault: false },
      { name: 'Persian', code: 'fa', isDefault: false },
    ];

    // Find existing default locale
    const existingDefault = await strapi.query('plugin::i18n.locale').findOne({
      where: { isDefault: true },
    });

    // If no default locale exists, we'll create 'en' as default
    // Otherwise, ensure only one default exists
    let defaultCreated = false;

    for (const locale of locales) {
      const existing = await strapi.query('plugin::i18n.locale').findOne({
        where: { code: locale.code },
      });

      if (existing) {
        // Update isDefault flag if needed
        if (locale.isDefault && !existing.isDefault) {
          // If we want this to be default but another one is default, unset the other first
          if (existingDefault && existingDefault.code !== locale.code) {
            await strapi.query('plugin::i18n.locale').update({
              where: { id: existingDefault.id },
              data: { isDefault: false },
            });
          }
          await strapi.query('plugin::i18n.locale').update({
            where: { id: existing.id },
            data: { isDefault: true },
          });
          console.log(`✓ Updated locale: ${locale.code} (set as default)`);
          defaultCreated = true;
        } else if (!locale.isDefault && existing.isDefault && existingDefault?.code === locale.code) {
          // If this was default but shouldn't be, and no other default is being created
          // Keep it as default for now to avoid breaking existing content
          console.log(`✓ Locale already exists: ${locale.code} (keeping as default)`);
        } else {
          console.log(`✓ Locale already exists: ${locale.code}`);
        }
      } else {
        // Create new locale
        // If this should be default and no default exists yet, make it default
        const shouldBeDefault = locale.isDefault && !defaultCreated && !existingDefault;
        
        await strapi.query('plugin::i18n.locale').create({
          data: {
            name: locale.name,
            code: locale.code,
            isDefault: shouldBeDefault,
          },
        });
        
        if (shouldBeDefault) {
          defaultCreated = true;
          console.log(`✓ Created locale: ${locale.code} (set as default)`);
        } else {
          console.log(`✓ Created locale: ${locale.code}`);
        }
      }
    }

    // Ensure at least one default locale exists
    const currentDefault = await strapi.query('plugin::i18n.locale').findOne({
      where: { isDefault: true },
    });

    if (!currentDefault) {
      // Set 'en' as default if no default exists
      const enLocale = await strapi.query('plugin::i18n.locale').findOne({
        where: { code: 'en' },
      });
      if (enLocale) {
        await strapi.query('plugin::i18n.locale').update({
          where: { id: enLocale.id },
          data: { isDefault: true },
        });
        console.log('✓ Set "en" as default locale');
      }
    }

    // Verify locales
    const allLocales = await strapi.query('plugin::i18n.locale').findMany({});
    console.log(`\n✓ Locale setup completed!`);
    console.log(`  Total locales: ${allLocales.length}`);
    console.log(`  Locales: ${allLocales.map(l => l.code).join(', ')}`);
    const defaultLocale = allLocales.find(l => l.isDefault);
    if (defaultLocale) {
      console.log(`  Default locale: ${defaultLocale.code}`);
    }
  } catch (error) {
    console.error('Error setting up locales:', error);
    throw error;
  }
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await bootstrapLocales();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

