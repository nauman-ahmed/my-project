'use strict';

/**
 * form router
 */

const { createCoreRouter } = require('@strapi/strapi').factories;

module.exports = createCoreRouter('api::form.form', {
  config: {
    find: {
      middlewares: [],
      policies: [],
    },
    findOne: {
      middlewares: [],
      policies: [],
    },
    create: {
      middlewares: [],
      policies: [],
    },
    update: {
      middlewares: [],
      policies: [],
    },
    delete: {
      middlewares: [],
      policies: [],
    },
  },
});

