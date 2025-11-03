module.exports = [
  'strapi::logger',
  'strapi::errors',
  'strapi::security',
  'strapi::cors',
  'strapi::poweredBy',
  'strapi::query',
  {
    name: 'global::locale-negotiation',
    config: {},
    resolve: './src/middlewares/locale-negotiation',
  },
  'strapi::body',
  'strapi::session',
  'strapi::favicon',
  'strapi::public',
];
