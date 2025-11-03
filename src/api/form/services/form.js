'use strict';

/**
 * form service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::form.form', ({ strapi }) => ({
  async findBySlug(slug) {
    const forms = await strapi.entityService.findMany('api::form.form', {
      filters: { slug, active: true, publishedAt: { $notNull: true } },
      populate: ['fields'],
    });

    if (!forms || forms.length === 0) {
      return null;
    }

    return forms[0];
  },

  async validateSubmission(form, data, files) {
    const errors = [];
    const fieldMap = new Map();

    // Create a map of fields by key
    form.fields.forEach((field) => {
      fieldMap.set(field.key, field);
    });

    // Validate each field
    for (const field of form.fields) {
      const value = data[field.key];
      const fieldFiles = files ? files.filter(f => f.fieldName === field.key) : [];

      // Check required fields
      if (field.required) {
        if (field.type === 'file') {
          if (!fieldFiles || fieldFiles.length === 0) {
            errors.push({
              field: field.key,
              message: `${field.label} is required`,
            });
          }
        } else if (value === undefined || value === null || value === '') {
          errors.push({
            field: field.key,
            message: `${field.label} is required`,
          });
        }
      }

      // Type-specific validation
      if (value !== undefined && value !== null && value !== '' && field.type !== 'file') {
        // Email validation
        if (field.type === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            errors.push({
              field: field.key,
              message: `${field.label} must be a valid email address`,
            });
          }
        }

        // Number validation
        if (field.type === 'number') {
          const num = Number(value);
          if (isNaN(num)) {
            errors.push({
              field: field.key,
              message: `${field.label} must be a valid number`,
            });
          } else {
            const validation = field.validation || {};
            if (validation.min !== undefined && num < validation.min) {
              errors.push({
                field: field.key,
                message: `${field.label} must be at least ${validation.min}`,
              });
            }
            if (validation.max !== undefined && num > validation.max) {
              errors.push({
                field: field.key,
                message: `${field.label} must be at most ${validation.max}`,
              });
            }
          }
        }

        // Select/Radio validation
        if ((field.type === 'select' || field.type === 'radio') && field.options) {
          const options = Array.isArray(field.options) ? field.options : field.options.values || [];
          if (!options.includes(value)) {
            errors.push({
              field: field.key,
              message: `${field.label} must be one of the allowed options`,
            });
          }
        }

        // Regex validation
        if (field.validation && field.validation.regex && field.type !== 'email') {
          const regex = new RegExp(field.validation.regex);
          if (!regex.test(value)) {
            errors.push({
              field: field.key,
              message: field.validation.message || `${field.label} format is invalid`,
            });
          }
        }

        // Min/Max length for text fields
        if ((field.type === 'text' || field.type === 'textarea') && field.validation) {
          if (field.validation.minLength && value.length < field.validation.minLength) {
            errors.push({
              field: field.key,
              message: `${field.label} must be at least ${field.validation.minLength} characters`,
            });
          }
          if (field.validation.maxLength && value.length > field.validation.maxLength) {
            errors.push({
              field: field.key,
              message: `${field.label} must be at most ${field.validation.maxLength} characters`,
            });
          }
        }
      }
    }

    // Check for extra fields not in the form
    for (const key in data) {
      if (!fieldMap.has(key)) {
        errors.push({
          field: key,
          message: `Unknown field: ${key}`,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  async checkRateLimit(form, ip) {
    if (!form.rateLimitPerIP) {
      return { allowed: true };
    }

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const recentSubmissions = await strapi.entityService.findMany('api::form-submission.form-submission', {
      filters: {
        form: { id: form.id },
        ip,
        submittedAt: { $gt: oneHourAgo },
      },
    });

    const count = Array.isArray(recentSubmissions) ? recentSubmissions.length : 0;

    if (count >= form.rateLimitPerIP) {
      return {
        allowed: false,
        message: `Rate limit exceeded. Maximum ${form.rateLimitPerIP} submissions per hour.`,
      };
    }

    return { allowed: true };
  },
}));

