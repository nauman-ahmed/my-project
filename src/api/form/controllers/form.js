'use strict';

/**
 * form controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::form.form', ({ strapi }) => ({
  async findBySlug(ctx) {
    const { slug } = ctx.params;

    const form = await strapi.service('api::form.form').findBySlug(slug);

    if (!form) {
      return ctx.notFound('Form not found');
    }

    // Return only public fields (no PII, no admin-only fields)
    const publicFields = form.fields.filter((field) => field.visibility === 'public');

    return {
      id: form.id,
      name: form.name,
      slug: form.slug,
      description: form.description,
      successMessage: form.successMessage,
      fields: publicFields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        options: field.options,
        required: field.required,
        validation: field.validation,
        placeholder: field.placeholder,
        helpText: field.helpText,
      })),
    };
  },

  async submit(ctx) {
    const { slug } = ctx.params;
    
    // Parse data from request body (can be JSON string or object)
    let data = {};
    if (ctx.request.body.data) {
      if (typeof ctx.request.body.data === 'string') {
        try {
          data = JSON.parse(ctx.request.body.data);
        } catch (e) {
          data = ctx.request.body.data;
        }
      } else {
        data = ctx.request.body.data;
      }
    } else {
      // If no data field, use entire body (excluding files)
      const body = { ...ctx.request.body };
      delete body.files;
      data = body;
    }
    
    const files = ctx.request.files || {};
    const ip = ctx.request.ip || ctx.request.headers['x-forwarded-for'] || 'unknown';
    const userAgent = ctx.request.headers['user-agent'] || 'unknown';
    const locale = ctx.request.headers['accept-language'] || 'en';

    // Find the form
    const form = await strapi.service('api::form.form').findBySlug(slug);

    if (!form) {
      return ctx.notFound('Form not found');
    }

    // Check rate limit
    const rateLimitCheck = await strapi.service('api::form.form').checkRateLimit(form, ip);
    if (!rateLimitCheck.allowed) {
      return ctx.tooManyRequests(rateLimitCheck.message);
    }

    // Prepare files array for validation
    const fileArray = [];
    if (files && Object.keys(files).length > 0) {
      for (const key in files) {
        const file = files[key];
        if (Array.isArray(file)) {
          file.forEach(f => fileArray.push({ ...f, fieldName: key }));
        } else {
          fileArray.push({ ...file, fieldName: key });
        }
      }
    }

    // Validate submission
    const validation = await strapi.service('api::form.form').validateSubmission(
      form,
      data,
      fileArray
    );

    if (!validation.valid) {
      return ctx.badRequest('Validation failed', { errors: validation.errors });
    }

    // Process file uploads
    let uploadedFiles = [];
    if (files && Object.keys(files).length > 0) {
      const fileFields = form.fields.filter(f => f.type === 'file');
      for (const field of fileFields) {
        const fieldFiles = files[field.key];
        if (fieldFiles) {
          const fileList = Array.isArray(fieldFiles) ? fieldFiles : [fieldFiles];
          for (const file of fileList) {
            try {
              const uploaded = await strapi.plugins['upload'].services.upload.upload({
                data: {
                  fileInfo: {
                    name: file.name || `file-${Date.now()}`,
                    alternativeText: field.label,
                    caption: field.label,
                  },
                },
                files: file,
              });
              if (Array.isArray(uploaded)) {
                uploadedFiles.push(...uploaded);
              } else {
                uploadedFiles.push(uploaded);
              }
            } catch (error) {
              strapi.log.error('Error uploading file:', error);
              return ctx.badRequest('Error uploading file', { error: error.message });
            }
          }
        }
      }
    }

    // Create submission
    let submission = await strapi.entityService.create('api::form-submission.form-submission', {
      data: {
        form: form.id,
        data,
        submittedAt: new Date(),
        files: uploadedFiles.map(f => f.id || f),
        ip,
        userAgent,
        locale,
      },
      populate: ['form'],
    });

    // Generate PDF if needed
    let pdfFile = null;
    if (form.storePdf || form.sendPdf) {
      pdfFile = await strapi.service('api::form-submission.form-submission').generatePdf(
        form,
        submission,
        data
      );
      
      if (pdfFile) {
        submission = await strapi.entityService.update('api::form-submission.form-submission', submission.id, {
          data: {
            pdf: pdfFile.id,
          },
        });
      }
    }

    // Send email notifications
    if (form.notificationEmails && Array.isArray(form.notificationEmails) && form.notificationEmails.length > 0) {
      await strapi.service('api::form-submission.form-submission').sendNotificationEmail(
        form,
        submission,
        data,
        pdfFile
      );
    }

    return {
      submissionId: submission.id,
      message: form.successMessage || 'Thank you for your submission!',
    };
  },
}));

