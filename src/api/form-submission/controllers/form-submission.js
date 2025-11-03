'use strict';

/**
 * form-submission controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::form-submission.form-submission', ({ strapi }) => ({
  async downloadPdf(ctx) {
    const { id } = ctx.params;

    const submission = await strapi.entityService.findOne('api::form-submission.form-submission', id, {
      populate: ['pdf', 'form'],
    });

    if (!submission) {
      return ctx.notFound('Submission not found');
    }

    if (!submission.pdf) {
      return ctx.notFound('PDF not available for this submission');
    }

    // Get the PDF file entity
    const pdfFile = await strapi.entityService.findOne('plugin::upload.file', submission.pdf.id);

    if (!pdfFile) {
      return ctx.notFound('PDF file not found');
    }

    // Get the file URL
    const fileUrl = pdfFile.url.startsWith('http') 
      ? pdfFile.url 
      : `${process.env.ADMIN_URL || 'http://localhost:1337'}${pdfFile.url}`;

    // Set response headers
    ctx.set('Content-Type', 'application/pdf');
    ctx.set('Content-Disposition', `attachment; filename="${pdfFile.name || `submission-${id}.pdf`}"`);

    // Redirect to file URL or proxy the file
    return ctx.redirect(fileUrl);
  },
}));

