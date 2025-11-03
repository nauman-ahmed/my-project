'use strict';

/**
 * custom form routes for public API
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/forms/:slug',
      handler: 'form.findBySlug',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/forms/:slug/submit',
      handler: 'form.submit',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

