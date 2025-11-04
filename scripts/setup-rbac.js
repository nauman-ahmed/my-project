'use strict';

/**
 * Setup RBAC Roles and Permissions
 * Creates Admin and Content Editor roles with appropriate permissions
 * Locks public permissions by default - only opens read endpoints explicitly
 */

async function setupRBAC() {
  try {
    console.log('Setting up RBAC roles and permissions...');

    // Find or create Admin role
    let adminRole = await strapi.query('plugin::users-permissions.role').findOne({
      where: { name: 'Admin' },
    });

    if (!adminRole) {
      adminRole = await strapi.query('plugin::users-permissions.role').create({
        data: {
          name: 'Admin',
          description: 'Full administrative access to all content',
          type: 'authenticated',
        },
      });
      console.log('✓ Created Admin role');
    } else {
      console.log('✓ Admin role already exists');
    }

    // Find or create Content Editor role
    let contentEditorRole = await strapi.query('plugin::users-permissions.role').findOne({
      where: { name: 'Content Editor' },
    });

    if (!contentEditorRole) {
      contentEditorRole = await strapi.query('plugin::users-permissions.role').create({
        data: {
          name: 'Content Editor',
          description: 'Can create, update, and publish content',
          type: 'authenticated',
        },
      });
      console.log('✓ Created Content Editor role');
    } else {
      console.log('✓ Content Editor role already exists');
    }

    // Get all content types
    const contentTypes = [
      'api::article.article',
      'api::author.author',
      'api::category.category',
      'api::about.about',
      'api::global.global',
      'api::event.event',
      'api::admission-form.admission-form',
    ];

    // Grant full permissions to Admin role
    for (const contentType of contentTypes) {
      const actions = ['find', 'findOne', 'create', 'update', 'delete'];
      for (const action of actions) {
        const actionName = `${contentType}.${action}`;
        const existing = await strapi.query('plugin::users-permissions.permission').findOne({
          where: {
            action: actionName,
            role: adminRole.id,
          },
        });

        if (!existing) {
          await strapi.query('plugin::users-permissions.permission').create({
            data: {
              action: actionName,
              role: adminRole.id,
            },
          });
        }
      }
    }
    console.log('✓ Granted full permissions to Admin role');

    // Grant limited permissions to Content Editor role (no delete)
    for (const contentType of contentTypes) {
      const actions = ['find', 'findOne', 'create', 'update'];
      for (const action of actions) {
        const actionName = `${contentType}.${action}`;
        const existing = await strapi.query('plugin::users-permissions.permission').findOne({
          where: {
            action: actionName,
            role: contentEditorRole.id,
          },
        });

        if (!existing) {
          await strapi.query('plugin::users-permissions.permission').create({
            data: {
              action: actionName,
              role: contentEditorRole.id,
            },
          });
        }
      }
    }
    console.log('✓ Granted Content Editor permissions (no delete)');

    // Lock public permissions - only allow read for specific endpoints
    // IMPORTANT: Preserve authentication permissions so users can login/register
    const publicRole = await strapi.query('plugin::users-permissions.role').findOne({
      where: { type: 'public' },
    });

    if (publicRole) {
      // Get all existing public permissions
      const allPublicPermissions = await strapi.query('plugin::users-permissions.permission').findMany({
        where: { role: publicRole.id },
      });

      // Preserve authentication permissions (login, register, etc.)
      const authPermissions = allPublicPermissions.filter((perm) =>
        perm.action.startsWith('plugin::users-permissions.auth.')
      );

      // Delete only content-type related permissions (not auth permissions)
      const contentTypePermissions = allPublicPermissions.filter(
        (perm) => !perm.action.startsWith('plugin::users-permissions.auth.')
      );

      for (const perm of contentTypePermissions) {
        await strapi.query('plugin::users-permissions.permission').delete({
          where: { id: perm.id },
        });
      }

      // Ensure authentication permissions are enabled
      const authActions = [
        'plugin::users-permissions.auth.callback',
        'plugin::users-permissions.auth.connect',
        'plugin::users-permissions.auth.emailConfirmation',
        'plugin::users-permissions.auth.forgotPassword',
        'plugin::users-permissions.auth.local',
        'plugin::users-permissions.auth.register',
        'plugin::users-permissions.auth.resetPassword',
        'plugin::users-permissions.auth.sendEmailConfirmation',
      ];

      for (const action of authActions) {
        const existing = await strapi.query('plugin::users-permissions.permission').findOne({
          where: {
            action: action,
            role: publicRole.id,
          },
        });

        if (!existing) {
          await strapi.query('plugin::users-permissions.permission').create({
            data: {
              action: action,
              role: publicRole.id,
            },
          });
        }
      }

      // Only allow read access to these content types
      const publicReadContentTypes = [
        'api::article.article',
        'api::author.author',
        'api::category.category',
        'api::about.about',
        'api::global.global',
        'api::event.event',
        'api::admission-form.admission-form',
      ];

      for (const contentType of publicReadContentTypes) {
        const actions = ['find', 'findOne'];
        for (const action of actions) {
          const actionName = `${contentType}.${action}`;
          const existing = await strapi.query('plugin::users-permissions.permission').findOne({
            where: {
              action: actionName,
              role: publicRole.id,
            },
          });

          if (!existing) {
            await strapi.query('plugin::users-permissions.permission').create({
              data: {
                action: actionName,
                role: publicRole.id,
              },
            });
          }
        }
      }

      console.log('✓ Locked public permissions - only read access granted');
      console.log('  Public can read: articles, authors, categories, about, global, events, admission-forms');
      console.log('  Authentication endpoints are preserved and accessible');
    }

    console.log('\n✓ RBAC setup completed successfully!');
  } catch (error) {
    console.error('Error setting up RBAC:', error);
    throw error;
  }
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await setupRBAC();
  await app.destroy();

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

