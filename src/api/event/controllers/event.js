'use strict';

/**
 * event controller
 * Supports CRUD operations for all locales: en, ur, ar, fa
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::event.event', ({ strapi }) => {
  // Supported locales
  const SUPPORTED_LOCALES = ['en', 'ur', 'ar', 'fa'];
  const DEFAULT_LOCALE = 'en';

  // Helper function to get all available locales
  const getAllLocales = async () => {
    try {
      /** @type {any} */
      const locales = await strapi.query('plugin::i18n.locale').findMany({
        sort: { code: 'asc' },
      });
      return locales.map(locale => locale.code);
    } catch (error) {
      // Fallback to default locales if query fails
      return SUPPORTED_LOCALES;
    }
  };

  // Helper function to validate and normalize locale
  const validateLocale = (locale) => {
    if (!locale) {
      return DEFAULT_LOCALE;
    }
    const normalizedLocale = String(locale).toLowerCase().trim();
    if (SUPPORTED_LOCALES.includes(normalizedLocale)) {
      return normalizedLocale;
    }
    // Fallback to default if invalid locale
    return DEFAULT_LOCALE;
  };

  // Helper function to get documentId from id (numeric or documentId)
  const getDocumentId = async (id) => {
    const isNumericId = !isNaN(Number(id)) && Number.isInteger(Number(id));
    
    if (isNumericId) {
      try {
        const entity = await strapi.entityService.findOne('api::event.event', Number(id), {
          populate: [],
        });
        return entity?.documentId || null;
      } catch (error) {
        return null;
      }
    }
    
    return String(id);
  };

  return {
  async find(ctx) {
    const { query } = ctx;
    
    // Extract custom filters
    const { date_from, date_to, upcoming, locale, ...restQuery } = query;
    
    // Build filters for where clause
    /** @type {any} */
    let filters = restQuery.filters || {};
    if (typeof filters !== 'object' || Array.isArray(filters)) {
      filters = {};
    }
    
    // Date range filter
    if (date_from || date_to) {
      filters.startAt = filters.startAt || {};
      if (date_from && typeof date_from === 'string') {
        filters.startAt.$gte = new Date(date_from);
      }
      if (date_to && typeof date_to === 'string') {
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
    // TEMPORARILY DISABLED FOR DEBUGGING - uncomment to enable published filter
    // if (!ctx.state.user) {
    //   filters.publishedAt = { $notNull: true };
    // }
    
    // Validate and normalize locale
    const validatedLocale = validateLocale(locale || query.locale);
    
    // Update query with filters
    ctx.query = {
      ...restQuery,
      filters,
      populate: query.populate || ['cover'],
      sort: query.sort || 'startAt:asc',
      locale: validatedLocale,
    };
    
    // Use entityService.findMany with proper pagination
    /** @type {any} */
    const pagination = ctx.query.pagination || query.pagination || {};
    const page = pagination.page || 1;
    const pageSize = pagination.pageSize || 25;
    const start = (page - 1) * pageSize;
    
    const entities = await strapi.entityService.findMany('api::event.event', {
      filters: filters,
      populate: ctx.query.populate || ['cover'],
      sort: ctx.query.sort || 'startAt:asc',
      locale: validatedLocale,
      limit: pageSize,
      start: start,
    });
    
    // Get total count for meta
    const total = await strapi.entityService.count('api::event.event', {
      filters: filters,
    });
    
    // Format response in Strapi's standard format
    return {
      data: entities || [],
      meta: {
        pagination: {
          page: page,
          pageSize: pageSize,
          pageCount: Math.ceil(total / pageSize),
          total: total,
        },
      },
    };
  },
  
  async findOne(ctx) {
    const { id } = ctx.params;
    const { query } = ctx;
    /** @type {any} */
    const requestedLocale = validateLocale(query.locale);
    /** @type {any} */
    const populate = query.populate || ['cover'];
    
    let entity = null;
    let locale = requestedLocale;
    
    // Helper function to try finding entity
    const tryFindEntity = async (targetLocale) => {
      let foundEntity = null;
      
      // Check if id is numeric (traditional ID) or documentId (UUID-like string)
      const isNumericId = !isNaN(Number(id)) && Number.isInteger(Number(id));
      
      try {
        if (isNumericId) {
          // If it's a numeric ID, try entityService first
          try {
            foundEntity = await strapi.entityService.findOne('api::event.event', Number(id), {
              populate: populate,
              locale: targetLocale,
            });
          } catch (entityError) {
            // If not found by numeric ID, try as documentId (in case it's actually a documentId that looks numeric)
            try {
              foundEntity = await strapi.documents('api::event.event').findOne({
                documentId: String(id),
                locale: String(targetLocale),
                populate: Array.isArray(populate) ? populate : ['cover'],
              });
            } catch (docError) {
              // Continue to slug search
            }
          }
        } else {
          // If it's not numeric, try documentId first (for UUIDs)
          try {
            foundEntity = await strapi.documents('api::event.event').findOne({
              documentId: String(id),
              locale: String(targetLocale),
              populate: Array.isArray(populate) ? populate : ['cover'],
            });
          } catch (docError) {
            // If not found by documentId, try as numeric ID (in case it's actually numeric)
            try {
              foundEntity = await strapi.entityService.findOne('api::event.event', id, {
                populate: populate,
                locale: targetLocale,
              });
            } catch (entityError) {
              // Continue to slug search
            }
          }
        }
      } catch (error) {
        // Continue to slug search
      }
      
      // If not found by ID/documentId, try finding by slug
      if (!foundEntity) {
        /** @type {any} */
        const slugFilters = {
          slug: id,
        };
        // Note: Published filter temporarily disabled - uncomment if needed
        // if (!ctx.state.user) {
        //   slugFilters.publishedAt = { $notNull: true };
        // }
        
        const entities = await strapi.entityService.findMany('api::event.event', {
          filters: slugFilters,
          populate: populate,
          locale: targetLocale,
          limit: 1,
        });
        
        if (entities.length > 0) {
          foundEntity = entities[0];
        }
      }
      
      return foundEntity;
    };
    
    // Try to find in requested locale first
    entity = await tryFindEntity(requestedLocale);
    
    // If not found in requested locale and requested locale is not default, try default locale
    if (!entity && requestedLocale !== DEFAULT_LOCALE) {
      entity = await tryFindEntity(DEFAULT_LOCALE);
      if (entity) {
        locale = DEFAULT_LOCALE; // Update locale to reflect what we actually returned
      }
    }
    
    // Apply status filter for public API (only if not authenticated)
    // Note: This is temporarily disabled - uncomment if you want to hide unpublished events
    // if (!ctx.state.user && entity && !entity.publishedAt) {
    //   entity = null;
    // }
    
    if (!entity) {
      return ctx.notFound();
    }
    
    // Format response in Strapi's standard format
    return {
      data: entity,
      meta: requestedLocale !== locale ? {
        locale: {
          requested: requestedLocale,
          returned: locale,
          fallback: true
        }
      } : undefined
    };
  },
  
  async create(ctx) {
    const { query } = ctx;
    /** @type {any} */
    const body = ctx.request.body || {};
    
    // Extract and validate locale from query or body
    const locale = validateLocale(query.locale || body.locale);
    
    // Get data from body (remove locale if present in data)
    const data = { ...(body.data || body) };
    if (data.locale) {
      delete data.locale;
    }
    
    // Use documents API which properly handles UID field generation (slug)
    const entity = await strapi.documents('api::event.event').create({
      data: data,
      locale: locale,
    });
    
    // Populate relations if needed
    /** @type {any} */
    const populate = query.populate || ['cover'];
    if (Array.isArray(populate) && populate.length > 0) {
      const populated = await strapi.documents('api::event.event').findOne({
        documentId: entity.documentId,
        locale: locale,
        populate: populate,
      });
      return {
        data: populated,
      };
    }
    
    // Format response in Strapi's standard format
    return {
      data: entity,
    };
  },
  
  async update(ctx) {
    const { id } = ctx.params;
    const { query } = ctx;
    /** @type {any} */
    const body = ctx.request.body || {};
    
    // Extract locale from query or body - don't default to 'en' if explicitly provided
    let locale = query.locale || body.locale;
    if (locale) {
      locale = validateLocale(locale);
    } else {
      locale = DEFAULT_LOCALE; // Only default if not provided at all
    }
    
    // Get data from body (remove locale if present in data)
    const data = { ...(body.data || body) };
    if (data.locale) {
      delete data.locale;
    }
    
    // Remove slug from data if present (it's auto-generated from title)
    if (data.slug) {
      delete data.slug;
    }
    
    /** @type {any} */
    const populate = query.populate || ['cover'];
    
    let entity = null;
    let documentId = null;
    
    // Check if id is numeric (traditional ID) or documentId (UUID-like string)
    const isNumericId = !isNaN(Number(id)) && Number.isInteger(Number(id));
    
    // If numeric ID, first find the documentId by searching across locales
    if (isNumericId) {
      // Try to find the entity and get its documentId
      for (const searchLocale of SUPPORTED_LOCALES) {
        try {
          const found = await strapi.entityService.findOne('api::event.event', Number(id), {
            populate: [],
            locale: searchLocale,
          });
          if (found && found.documentId) {
            documentId = found.documentId;
            break;
          }
        } catch (e) {
          // Continue to next locale
        }
      }
      
      // If still not found by entityService, try query API
      if (!documentId) {
        try {
          /** @type {any} */
          const entities = await strapi.query('api::event.event').findMany({
            where: { id: Number(id) },
            limit: 1,
          });
          if (entities && entities.length > 0 && entities[0].documentId) {
            documentId = entities[0].documentId;
          }
        } catch (e) {
          // Continue
        }
      }
    } else {
      // If it's not numeric, treat as documentId
      documentId = String(id);
    }
    
    // If we have a documentId, use documents API for update (works across locales)
    if (documentId) {
      try {
        // First, check if the entry exists in the requested locale
        let entryExists = false;
        try {
          const existing = await strapi.documents('api::event.event').findOne({
            documentId: documentId,
            locale: locale,
          });
          entryExists = !!existing;
        } catch (e) {
          entryExists = false;
        }
        
        if (entryExists) {
          // Entry exists in requested locale, update it
        entity = await strapi.documents('api::event.event').update({
            documentId: documentId,
            locale: locale,
          data: data,
        });
        } else {
          // Entry doesn't exist in requested locale, create a translation
          const i18nService = strapi.plugin('i18n')?.service('localizations');
          if (i18nService) {
            // Get an existing entry to use as base (prefer non-default locale if updating non-default)
            let baseEntry = null;
            const searchOrder = locale !== DEFAULT_LOCALE 
              ? [locale, ...SUPPORTED_LOCALES.filter(l => l !== locale)]
              : SUPPORTED_LOCALES;
            
            for (const baseLocale of searchOrder) {
              try {
                baseEntry = await strapi.documents('api::event.event').findOne({
                  documentId: documentId,
                  locale: baseLocale,
                });
                if (baseEntry) break;
              } catch (e) {
                // Continue
              }
            }
            
            if (baseEntry) {
              // Create localization for the requested locale only
              entity = await i18nService.createLocalization(
                {
                  documentId: documentId,
                  locale: locale,
                },
                data
              );
              
              if (!entity) {
                throw new Error(`Failed to create localization for locale ${locale}`);
              }
            } else {
              throw new Error(`Base entry not found for documentId: ${documentId}`);
            }
          } else {
            throw new Error(`i18n service not available. Cannot create translation for locale ${locale}`);
          }
        }
        
        // Populate if needed
        if (Array.isArray(populate) && populate.length > 0 && entity && entity.documentId) {
          entity = await strapi.documents('api::event.event').findOne({
            documentId: documentId,
            locale: locale,
            populate: populate,
          });
        }
      } catch (docError) {
        strapi.log.error(`Failed to update event in locale ${locale}:`, docError.message);
        return ctx.badRequest(`Failed to update event in locale ${locale}: ${docError.message}`);
      }
    } else {
      // Fallback: Use entityService with numeric ID
      if (isNumericId) {
        try {
          entity = await strapi.entityService.update('api::event.event', Number(id), {
            data: data,
            populate: populate,
            locale: locale,
          });
        } catch (entityError) {
          return ctx.badRequest(`Failed to update event: ${entityError.message}`);
        }
      } else {
        return ctx.badRequest(`Invalid event ID: ${id}`);
      }
    }
    
    // Format response in Strapi's standard format
    return {
      data: entity,
    };
  },
  
  async delete(ctx) {
    const { id } = ctx.params;
    const { query } = ctx;
    
    // Note: Locale parameter is ignored for delete operations
    // Delete operations remove all locales of an event
    strapi.log.info(`Delete request for event ID: ${id} (locale parameter ignored for delete)`);
    
    // Check if id is numeric (traditional ID) or documentId (UUID-like string)
    const isNumericId = !isNaN(Number(id)) && Number.isInteger(Number(id));
    const numericId = isNumericId ? Number(id) : null;
    const providedDocumentId = !isNumericId ? String(id) : null;
    
    let foundEntity = null;
    let documentId = providedDocumentId; // If documentId is provided directly, use it
    
    // If documentId is provided directly, try to delete immediately
    if (providedDocumentId) {
      strapi.log.info(`Attempting to delete event with documentId: ${providedDocumentId}`);
      try {
        const deleted = await strapi.documents('api::event.event').delete({
          documentId: providedDocumentId,
        });
        
        if (deleted) {
          strapi.log.info(`Successfully deleted event with documentId: ${providedDocumentId}`);
          return {
            data: deleted,
          };
        }
        
        // If documents API returns null/undefined, try query API deletion
        strapi.log.info(`Documents API returned null, trying query API deletion for documentId: ${providedDocumentId}`);
        /** @type {any} */
        const deletedCount = await strapi.query('api::event.event').delete({
          where: { documentId: providedDocumentId },
        });
        
        if (deletedCount !== null && deletedCount !== undefined) {
          strapi.log.info(`Successfully deleted via query API, deleted count: ${deletedCount}`);
          return {
            data: { documentId: providedDocumentId },
            meta: { deleted: true },
          };
        }
        
        strapi.log.warn(`Both deletion methods returned null/undefined for documentId: ${providedDocumentId}`);
        return ctx.badRequest(`Failed to delete event with documentId ${providedDocumentId}. Event may not exist.`);
      } catch (docError) {
        strapi.log.error(`Failed to delete event with documentId ${providedDocumentId}:`, docError.message);
        return ctx.badRequest(`Failed to delete event: ${docError.message}`);
      }
    }
    
    // For numeric IDs, find the entity first
    // Strategy 1: Try to find entity using query API - prioritize locale from query if provided
    const requestedLocale = query.locale ? validateLocale(query.locale) : null;
    const searchLocales = requestedLocale 
      ? [requestedLocale, ...SUPPORTED_LOCALES.filter(l => l !== requestedLocale)]
      : SUPPORTED_LOCALES;
    
    try {
      // First, try searching in the requested locale (if provided)
      if (requestedLocale) {
        try {
          /** @type {any} */
          const localeEntities = await strapi.query('api::event.event').findMany({
            where: { id: numericId, locale: requestedLocale },
            limit: 1,
          });
          if (localeEntities && localeEntities.length > 0) {
            foundEntity = localeEntities[0];
            documentId = localeEntities[0].documentId || null;
          }
        } catch (e) {
          strapi.log.warn(`Failed to find event ${id} in locale ${requestedLocale}:`, e.message);
        }
      }
      
      // If not found in requested locale, try without locale filter
      if (!foundEntity) {
        try {
          /** @type {any} */
          let entities = await strapi.query('api::event.event').findMany({
            where: { id: numericId },
            limit: 100, // Get more to ensure we find it across locales
          });
          
          if (entities && entities.length > 0) {
            foundEntity = entities[0];
            documentId = entities[0].documentId || null;
          }
        } catch (e) {
          strapi.log.warn(`Failed to find event ${id} without locale filter:`, e.message);
        }
      }
      
      // If still not found, try searching each locale explicitly
      if (!foundEntity) {
        for (const locale of searchLocales) {
          try {
            /** @type {any} */
            const localeEntities = await strapi.query('api::event.event').findMany({
              where: { id: numericId, locale: locale },
              limit: 1,
            });
            if (localeEntities && localeEntities.length > 0) {
              foundEntity = localeEntities[0];
              documentId = localeEntities[0].documentId || null;
              break;
            }
          } catch (e) {
            // Continue to next locale
          }
        }
      }
    } catch (queryError) {
      strapi.log.warn(`Query API failed for ID ${id}:`, queryError.message);
    }
    
    // Strategy 2: If not found and it's numeric, try entityService with each locale (prioritize requested locale)
    if (!documentId && isNumericId) {
      try {
        // Try entityService with each locale (prioritize requested locale first)
        for (const locale of searchLocales) {
          try {
            const entity = await strapi.entityService.findOne('api::event.event', numericId, {
              populate: [],
              locale: locale,
            });
            if (entity && entity.documentId) {
              documentId = entity.documentId;
              foundEntity = entity;
              strapi.log.info(`Found event ${id} in locale ${locale} with documentId: ${documentId}`);
              break;
            }
          } catch (e) {
            // Continue to next locale
            strapi.log.debug(`Event ${id} not found in locale ${locale}`);
          }
        }
        
        // If still not found, try documents API as fallback
        if (!documentId) {
          for (const locale of searchLocales) {
            try {
              const doc = await strapi.documents('api::event.event').findMany({
                locale: locale,
                filters: { id: numericId },
              });
              if (doc && doc.length > 0 && doc[0] && doc[0].documentId) {
                documentId = doc[0].documentId;
                foundEntity = doc[0];
                strapi.log.info(`Found event ${id} via documents API in locale ${locale} with documentId: ${documentId}`);
                break;
              }
            } catch (e) {
              // Continue to next locale
            }
          }
        }
      } catch (docError) {
        strapi.log.warn(`EntityService search failed for ID ${id}:`, docError.message);
      }
    }
    
    // Strategy 3: If we have documentId but no foundEntity, get entity info
    if (documentId && !foundEntity) {
      try {
        /** @type {any} */
        const entities = await strapi.query('api::event.event').findMany({
          where: { documentId: documentId },
          limit: 1,
        });
        if (entities && entities.length > 0) {
          foundEntity = entities[0];
        }
      } catch (e) {
        // Use documentId for deletion even if we can't find the entity
      }
    }
    
    // If we have a documentId, delete all locales using documents API
    if (documentId) {
      try {
        strapi.log.info(`Attempting to delete event with documentId: ${documentId} (ID: ${id})`);
        
        // Try documents API first (deletes all locales)
        const deleted = await strapi.documents('api::event.event').delete({
          documentId: documentId,
        });
        
        // Always verify deletion, even if documents API returns success
        strapi.log.info(`Verifying deletion for documentId: ${documentId}`);
        let stillExists = true;
        try {
          const verify = await strapi.query('api::event.event').findMany({
            where: { documentId: documentId },
            limit: 10,
          });
          stillExists = verify && verify.length > 0;
          if (stillExists) {
            strapi.log.warn(`Entity still exists after documents API delete. Found ${verify.length} entries. Using query API to force delete.`);
          } else {
            strapi.log.info(`Deletion verified - entity no longer exists`);
          }
        } catch (verifyError) {
          strapi.log.warn(`Could not verify deletion:`, verifyError.message);
        }
        
        // If entity still exists, force delete using query API
        if (stillExists) {
          strapi.log.info(`Force deleting all entries with documentId: ${documentId} using query API`);
          /** @type {any} */
          const deletedCount = await strapi.query('api::event.event').delete({
            where: { documentId: documentId },
          });
          
          // Verify again
          try {
            const verifyAgain = await strapi.query('api::event.event').findMany({
              where: { documentId: documentId },
              limit: 1,
            });
            if (!verifyAgain || verifyAgain.length === 0) {
              strapi.log.info(`Successfully deleted via query API, deleted count: ${deletedCount}`);
              return {
                data: foundEntity || { id: numericId || id, documentId: documentId },
                meta: { deleted: true, method: 'query-api' },
              };
            } else {
              strapi.log.error(`Entity still exists after query API deletion! Found ${verifyAgain.length} entries.`);
              return ctx.badRequest(`Failed to delete event. Entity still exists after deletion attempts.`);
            }
          } catch (verifyError2) {
            strapi.log.warn(`Could not verify second deletion, but assuming success. Count: ${deletedCount}`);
            if (deletedCount !== null && deletedCount !== undefined) {
              return {
                data: foundEntity || { id: numericId || id, documentId: documentId },
                meta: { deleted: true, method: 'query-api' },
              };
            }
          }
        } else {
          // Deletion verified, return success
          strapi.log.info(`Successfully deleted event with documentId: ${documentId}`);
          return {
            data: deleted || foundEntity || { id: numericId || id, documentId: documentId },
            meta: { deleted: true, method: 'documents-api' },
          };
        }
        
      } catch (docError) {
        strapi.log.error(`Failed to delete by documentId ${documentId}:`, docError.message);
        strapi.log.error(`Error stack:`, docError.stack);
        // Fall through to numeric ID deletion
      }
    }
    
    // Fallback: Delete by numeric ID (may only delete one locale)
    if (isNumericId) {
      try {
        const deleted = await strapi.entityService.delete('api::event.event', numericId);
        if (deleted) {
          return {
            data: deleted,
          };
        }
      } catch (entityError) {
        // Try query API as last resort
        try {
          /** @type {any} */
          const deletedCount = await strapi.query('api::event.event').delete({
            where: { id: numericId },
          });
          
          if (deletedCount !== null && deletedCount !== undefined) {
            return {
              data: foundEntity || { id: numericId },
              meta: { deleted: true },
            };
          }
        } catch (queryError) {
          strapi.log.error(`Failed to delete event ${id}:`, queryError.message);
          return ctx.badRequest(`Failed to delete event: ${queryError.message}`);
        }
      }
    }
    
    // If we reach here and couldn't find the entity, return 404
    if (!foundEntity && !documentId) {
      strapi.log.warn(`Event with ID ${id} not found in any locale`);
      return ctx.notFound(`Event with ID ${id} not found`);
    }
    
    // If we reach here, deletion failed but entity exists
    strapi.log.error(`Failed to delete event with ID ${id}. Found: ${foundEntity ? 'yes' : 'no'}, documentId: ${documentId || 'none'}`);
    return ctx.badRequest(`Failed to delete event with ID ${id}. Please check server logs for details.`);
  },
  };
});

