'use strict';

/**
 * custom form-submission routes
 */

module.exports = {
  routes: [
    {
      method: 'GET',
      path: '/form-submissions/:id/pdf',
      handler: 'form-submission.downloadPdf',
      config: {
        auth: {
          scope: ['find', 'findOne'],
        },
        policies: [],
        middlewares: [],
      },
    },
  ],
};

