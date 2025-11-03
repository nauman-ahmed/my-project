module.exports = () => ({
  documentation: {
    enabled: true,
    config: {
      openapi: '3.0.0',
      info: {
        version: '1.0.0',
        title: 'My Project API Documentation',
        description: 'API Documentation for My Project',
        contact: {
          name: 'API Support',
          email: 'support@example.com',
        },
      },
      servers: [
        {
          url: process.env.API_URL || 'http://localhost:1337/api',
          description: 'Development server',
        },
      ],
      'x-strapi-config': {
        path: '/documentation',
        showGeneratedFiles: true,
        generateDefaultResponse: true,
      },
    },
  },
});
