'use strict';

/**
 * custom admission-form routes
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/admission-forms',
      handler: 'admission-form.find',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/admission-forms/:id',
      handler: 'admission-form.findOne',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/admission-forms',
      handler: 'admission-form.create',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'PUT',
      path: '/admission-forms/:id',
      handler: 'admission-form.update',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'DELETE',
      path: '/admission-forms/:id',
      handler: 'admission-form.delete',
      config: {
        auth: false,
        policies: [],
        middlewares: [],
      },
    },
  ],
};

