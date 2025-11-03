'use strict';

/**
 * event controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::event.event', ({ strapi }) => {
  // Create base controller instance for accessing default methods
  const baseController = createCoreController('api::event.event');
  
  return {
    async find(ctx) {
      const { query } = ctx;
      
      // Extract custom filters
      const { date_from, date_to, upcoming, locale, ...restQuery } = query;
      
      // Build filters for where clause
      const filters = {
        ...(restQuery.filters || {}),
      };
      
      // Date range filter
      if (date_from || date_to) {
        filters.startAt = filters.startAt || {};
        if (date_from) {
          filters.startAt.$gte = new Date(date_from);
        }
        if (date_to) {
          filters.startAt.$lte = new Date(date_to);
        }
      }
      
      // Upcoming filter (events starting from now onwards)
      if (upcoming === 'true' || upcoming === true) {
        filters.startAt = filters.startAt || {};
        filters.startAt.$gte = new Date();
      }
      
      // Status filter - only show published by default for public API
      // This can be overridden if needed for admin
      if (!ctx.state.user) {
        filters.status = 'published';
        filters.publishedAt = { $notNull: true };
      }
      
      // Update query with filters
      ctx.query = {
        ...restQuery,
        filters,
        populate: query.populate || ['cover'],
        sort: query.sort || 'startAt:asc',
        locale: locale || query.locale || 'en',
      };
      
      // Call default find method
      return await baseController.find(ctx);
    },
    
    async findOne(ctx) {
      const { id } = ctx.params;
      const { query } = ctx;
      
      // Try to find by documentId first
      let entity = null;
      
      try {
        // First, try as documentId
        entity = await strapi.documents('api::event.event').findOne({
          documentId: id,
          populate: query.populate || ['cover'],
          locale: query.locale || 'en',
        });
      } catch (error) {
        // If not found, try by slug
      }
      
      // If not found by documentId, try finding by slug
      if (!entity) {
        const entities = await strapi.documents('api::event.event').findMany({
          filters: {
            slug: id,
            ...(!ctx.state.user && { status: 'published', publishedAt: { $notNull: true } }),
          },
          populate: query.populate || ['cover'],
          locale: query.locale || 'en',
          limit: 1,
        });
        
        if (entities.length > 0) {
          entity = entities[0];
        }
      }
      
      // Apply status filter for public API
      if (!ctx.state.user && entity) {
        if (entity.status !== 'published' || !entity.publishedAt) {
          entity = null;
        }
      }
      
      if (!entity) {
        return ctx.notFound();
      }
      
      // Sanitize and transform the output
      const sanitizedEntity = await baseController.sanitizeOutput(entity, ctx);
      
      return baseController.transformResponse(sanitizedEntity);
    },
  };
});

