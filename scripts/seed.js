'use strict';

const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');
const { categories, authors, articles, global, about } = require('../data/data.json');

async function seedExampleApp() {
  const shouldImportSeedData = await isFirstRun();

  if (shouldImportSeedData) {
    try {
      console.log('Setting up the template...');
      await importSeedData();
      console.log('Ready to go');
    } catch (error) {
      console.log('Could not import seed data');
      console.error(error);
    }
  } else {
    console.log(
      'Seed data has already been imported. We cannot reimport unless you clear your database first.'
    );
  }
}

async function isFirstRun() {
  const pluginStore = strapi.store({
    environment: strapi.config.environment,
    type: 'type',
    name: 'setup',
  });
  const initHasRun = await pluginStore.get({ key: 'initHasRun' });
  await pluginStore.set({ key: 'initHasRun', value: true });
  return !initHasRun;
}

async function setPublicPermissions(newPermissions) {
  // Find the ID of the public role
  const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
    where: {
      type: 'public',
    },
  });

  // Create the new permissions and link them to the public role
  const allPermissionsToCreate = [];
  Object.keys(newPermissions).map((controller) => {
    const actions = newPermissions[controller];
    const permissionsToCreate = actions.map((action) => {
      return strapi.query('plugin::users-permissions.permission').create({
        data: {
          action: `api::${controller}.${controller}.${action}`,
          role: publicRole.id,
        },
      });
    });
    allPermissionsToCreate.push(...permissionsToCreate);
  });
  await Promise.all(allPermissionsToCreate);
}

function getFileSizeInBytes(filePath) {
  const stats = fs.statSync(filePath);
  const fileSizeInBytes = stats['size'];
  return fileSizeInBytes;
}

function getFileData(fileName) {
  const filePath = path.join('data', 'uploads', fileName);
  // Parse the file metadata
  const size = getFileSizeInBytes(filePath);
  const ext = fileName.split('.').pop();
  const mimeType = mime.lookup(ext || '') || '';

  return {
    filepath: filePath,
    originalFileName: fileName,
    size,
    mimetype: mimeType,
  };
}

async function uploadFile(file, name) {
  return strapi
    .plugin('upload')
    .service('upload')
    .upload({
      files: file,
      data: {
        fileInfo: {
          alternativeText: `An image uploaded to Strapi called ${name}`,
          caption: name,
          name,
        },
      },
    });
}

// Create an entry and attach files if there are any
async function createEntry({ model, entry }) {
  try {
    // Actually create the entry in Strapi
    await strapi.documents(`api::${model}.${model}`).create({
      data: entry,
    });
  } catch (error) {
    console.error({ model, entry, error });
  }
}

async function checkFileExistsBeforeUpload(files) {
  const existingFiles = [];
  const uploadedFiles = [];
  const filesCopy = [...files];

  for (const fileName of filesCopy) {
    // Check if the file already exists in Strapi
    const fileWhereName = await strapi.query('plugin::upload.file').findOne({
      where: {
        name: fileName.replace(/\..*$/, ''),
      },
    });

    if (fileWhereName) {
      // File exists, don't upload it
      existingFiles.push(fileWhereName);
    } else {
      // File doesn't exist, upload it
      const fileData = getFileData(fileName);
      const fileNameNoExtension = fileName.split('.').shift();
      const [file] = await uploadFile(fileData, fileNameNoExtension);
      uploadedFiles.push(file);
    }
  }
  const allFiles = [...existingFiles, ...uploadedFiles];
  // If only one file then return only that file
  return allFiles.length === 1 ? allFiles[0] : allFiles;
}

async function updateBlocks(blocks) {
  const updatedBlocks = [];
  for (const block of blocks) {
    if (block.__component === 'shared.media') {
      const uploadedFiles = await checkFileExistsBeforeUpload([block.file]);
      // Copy the block to not mutate directly
      const blockCopy = { ...block };
      // Replace the file name on the block with the actual file
      blockCopy.file = uploadedFiles;
      updatedBlocks.push(blockCopy);
    } else if (block.__component === 'shared.slider') {
      // Get files already uploaded to Strapi or upload new files
      const existingAndUploadedFiles = await checkFileExistsBeforeUpload(block.files);
      // Copy the block to not mutate directly
      const blockCopy = { ...block };
      // Replace the file names on the block with the actual files
      blockCopy.files = existingAndUploadedFiles;
      // Push the updated block
      updatedBlocks.push(blockCopy);
    } else {
      // Just push the block as is
      updatedBlocks.push(block);
    }
  }

  return updatedBlocks;
}

async function importArticles() {
  for (const article of articles) {
    const cover = await checkFileExistsBeforeUpload([`${article.slug}.jpg`]);
    const updatedBlocks = await updateBlocks(article.blocks);

    await createEntry({
      model: 'article',
      entry: {
        ...article,
        cover,
        blocks: updatedBlocks,
        // Make sure it's not a draft
        publishedAt: Date.now(),
      },
    });
  }
}

async function importGlobal() {
  const favicon = await checkFileExistsBeforeUpload(['favicon.png']);
  const shareImage = await checkFileExistsBeforeUpload(['default-image.png']);
  return createEntry({
    model: 'global',
    entry: {
      ...global,
      favicon,
      // Make sure it's not a draft
      publishedAt: Date.now(),
      defaultSeo: {
        ...global.defaultSeo,
        shareImage,
      },
    },
  });
}

async function importAbout() {
  const updatedBlocks = await updateBlocks(about.blocks);

  await createEntry({
    model: 'about',
    entry: {
      ...about,
      blocks: updatedBlocks,
      // Make sure it's not a draft
      publishedAt: Date.now(),
    },
  });
}

async function importCategories() {
  for (const category of categories) {
    await createEntry({ model: 'category', entry: category });
  }
}

async function importAuthors() {
  for (const author of authors) {
    const avatar = await checkFileExistsBeforeUpload([author.avatar]);

    await createEntry({
      model: 'author',
      entry: {
        ...author,
        avatar,
      },
    });
  }
}

async function setupLocales() {
  try {
    // Check if i18n plugin is available
    const i18nPlugin = strapi.plugin('i18n');
    if (!i18nPlugin) {
      console.log('i18n plugin not found, skipping locale setup');
      return;
    }

    const defaultLocale = await strapi.query('plugin::i18n.locale').findOne({
      where: { code: 'en' },
    });

    if (!defaultLocale) {
      await strapi.query('plugin::i18n.locale').create({
        data: {
          name: 'English',
          code: 'en',
          isDefault: true,
        },
      });
      console.log('✓ Created default locale: en');
    }

    const locales = [
      { name: 'French', code: 'fr' },
      { name: 'Spanish', code: 'es' },
    ];

    for (const locale of locales) {
      const existing = await strapi.query('plugin::i18n.locale').findOne({
        where: { code: locale.code },
      });

      if (!existing) {
        await strapi.query('plugin::i18n.locale').create({
          data: {
            name: locale.name,
            code: locale.code,
            isDefault: false,
          },
        });
        console.log(`✓ Created locale: ${locale.code}`);
      }
    }
  } catch (error) {
    console.log('Could not setup locales (i18n plugin may not be installed):', error.message);
  }
}

async function importEvents() {
  const demoEvents = [
    {
      title: 'Summer Conference 2024',
      slug: 'summer-conference-2024',
      description: 'Join us for our annual summer conference featuring keynote speakers and workshops.',
      startDate: new Date('2024-07-15T09:00:00Z'),
      endDate: new Date('2024-07-17T17:00:00Z'),
      location: 'Convention Center, New York',
      isActive: true,
    },
    {
      title: 'Tech Workshop Series',
      slug: 'tech-workshop-series',
      description: 'A series of workshops covering the latest in web development and cloud technologies.',
      startDate: new Date('2024-08-01T10:00:00Z'),
      endDate: new Date('2024-08-01T16:00:00Z'),
      location: 'Tech Hub, San Francisco',
      isActive: true,
    },
    {
      title: 'Annual Gala Dinner',
      slug: 'annual-gala-dinner',
      description: 'Celebrate the year with our annual gala dinner and awards ceremony.',
      startDate: new Date('2024-12-10T19:00:00Z'),
      endDate: new Date('2024-12-10T23:00:00Z'),
      location: 'Grand Ballroom, Chicago',
      isActive: true,
    },
  ];

  for (const event of demoEvents) {
    await createEntry({
      model: 'event',
      entry: {
        ...event,
        publishedAt: Date.now(),
      },
    });
  }

  console.log('✓ Created demo events');
}

async function importAdmissionForm() {
  const sampleAdmission = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+1-555-0123',
    dateOfBirth: new Date('2000-01-15'),
    address: '123 Main Street, New York, NY 10001',
    program: 'Computer Science',
    message: 'I am very interested in joining your program and would like to learn more about the admission process.',
    status: 'pending',
  };

  await createEntry({
    model: 'admission-form',
    entry: sampleAdmission,
  });

  console.log('✓ Created sample Admission Form');
}

async function importSeedData() {
  // Setup locales (if i18n plugin is available)
  await setupLocales();

  // Allow read of application content types
  await setPublicPermissions({
    article: ['find', 'findOne'],
    category: ['find', 'findOne'],
    author: ['find', 'findOne'],
    global: ['find', 'findOne'],
    about: ['find', 'findOne'],
    event: ['find', 'findOne'],
  });

  // Create all entries
  await importCategories();
  await importAuthors();
  await importArticles();
  await importGlobal();
  await importAbout();
  await importEvents();
  await importAdmissionForm();
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await seedExampleApp();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
