'use strict';

/**
 * form-submission service
 */

const { createCoreService } = require('@strapi/strapi').factories;
const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');

module.exports = createCoreService('api::form-submission.form-submission', ({ strapi }) => ({
  async generatePdf(form, submission, data) {
    try {
      // Generate HTML template
      const html = this.generateHtmlTemplate(form, submission, data);

      // Generate PDF using puppeteer
      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      });

      await browser.close();

      // Upload PDF to Strapi
      const uploadService = strapi.plugins['upload'].services.upload;
      const fs = require('fs');
      const path = require('path');
      const os = require('os');

      // Create temporary file
      const tempDir = os.tmpdir();
      const fileName = `form-submission-${submission.id}-${Date.now()}.pdf`;
      const tempFilePath = path.join(tempDir, fileName);

      try {
        // Write buffer to temp file
        fs.writeFileSync(tempFilePath, pdfBuffer);
        const fileStat = fs.statSync(tempFilePath);

        // Create file object for upload (similar to seed.js pattern)
        const fileData = {
          path: tempFilePath,
          name: fileName,
          type: 'application/pdf',
          size: fileStat.size,
        };

        // Upload file
        const pdfFile = await uploadService.upload({
          data: {
            fileInfo: {
              name: fileName.replace('.pdf', ''),
              caption: `Form Submission: ${form.name}`,
              alternativeText: `PDF submission for ${form.name}`,
            },
          },
          files: fileData,
        });

        // Clean up temp file
        fs.unlinkSync(tempFilePath);

        return Array.isArray(pdfFile) ? pdfFile[0] : pdfFile;
      } catch (uploadError) {
        // Clean up temp file on error
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
        throw uploadError;
      }
    } catch (error) {
      strapi.log.error('Error generating PDF:', error);
      return null;
    }
  },

  generateHtmlTemplate(form, submission, data) {
    const fields = form.fields || [];
    
    let fieldsHtml = '';
    fields.forEach((field) => {
      const value = data[field.key];
      if (value !== undefined && value !== null && value !== '') {
        let displayValue = value;
        
        if (field.type === 'checkbox') {
          displayValue = value ? 'Yes' : 'No';
        } else if (field.type === 'date') {
          displayValue = new Date(value).toLocaleDateString();
        } else if (Array.isArray(value)) {
          displayValue = value.join(', ');
        }

        fieldsHtml += `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold; width: 30%;">${field.label}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${displayValue}</td>
          </tr>
        `;
      }
    });

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 20px;
          }
          .header {
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            color: #333;
          }
          .meta {
            margin-bottom: 20px;
            color: #666;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 12px;
            color: #666;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>${form.name}</h1>
        </div>
        <div class="meta">
          <p><strong>Submitted:</strong> ${new Date(submission.submittedAt).toLocaleString()}</p>
          <p><strong>Submission ID:</strong> ${submission.id}</p>
        </div>
        <table>
          ${fieldsHtml}
        </table>
        <div class="footer">
          <p>This is an automated submission from ${form.name}</p>
        </div>
      </body>
      </html>
    `;
  },

  async sendNotificationEmail(form, submission, data, pdfFile) {
    try {
      // Create nodemailer transporter
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true' || false,
        auth: {
          user: process.env.SMTP_USERNAME,
          pass: process.env.SMTP_PASSWORD,
        },
        tls: {
          rejectUnauthorized: process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== 'false',
        },
      });

      // Generate email HTML
      const emailHtml = this.generateEmailTemplate(form, submission, data);

      const emailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@example.com',
        replyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM || 'noreply@example.com',
        to: Array.isArray(form.notificationEmails) 
          ? form.notificationEmails.join(',') 
          : form.notificationEmails,
        subject: `New Form Submission: ${form.name}`,
        html: emailHtml,
      };

      // Attach PDF if available and requested
      if (form.sendPdf && pdfFile) {
        try {
          const fileEntity = await strapi.entityService.findOne('plugin::upload.file', pdfFile.id);
          if (fileEntity && fileEntity.url) {
            // Get the file URL and download it
            const fs = require('fs');
            const path = require('path');
            const https = require('https');
            const http = require('http');
            const url = require('url');
            const os = require('os');

            const fileUrl = fileEntity.url.startsWith('http') 
              ? fileEntity.url 
              : `${process.env.ADMIN_URL || 'http://localhost:1337'}${fileEntity.url}`;

            const parsedUrl = url.parse(fileUrl);
            const client = parsedUrl.protocol === 'https:' ? https : http;
            const tempFilePath = path.join(os.tmpdir(), `pdf-${submission.id}-${Date.now()}.pdf`);

            await new Promise((resolve, reject) => {
              const fileStream = fs.createWriteStream(tempFilePath);
              client.get(fileUrl, (response) => {
                response.pipe(fileStream);
                fileStream.on('finish', () => {
                  fileStream.close();
                  resolve();
                });
              }).on('error', reject);
            });

            const fileBuffer = fs.readFileSync(tempFilePath);
            emailOptions.attachments = [
              {
                filename: `${fileEntity.name || `submission-${submission.id}`}.pdf`,
                content: fileBuffer,
                contentType: 'application/pdf',
              },
            ];

            // Clean up temp file
            fs.unlinkSync(tempFilePath);
          }
        } catch (error) {
          strapi.log.error('Error attaching PDF to email:', error);
          // Continue without attachment
        }
      }

      // Send email using nodemailer
      const info = await transporter.sendMail(emailOptions);
      strapi.log.info(`Email sent successfully: ${info.messageId}`);
    } catch (error) {
      strapi.log.error('Error sending notification email:', error);
      // Don't throw - email failure shouldn't break submission
    }
  },

  generateEmailTemplate(form, submission, data) {
    const fields = form.fields || [];
    let fieldsHtml = '';
    
    fields.forEach((field) => {
      const value = data[field.key];
      if (value !== undefined && value !== null && value !== '') {
        let displayValue = value;
        
        if (field.type === 'checkbox') {
          displayValue = value ? 'Yes' : 'No';
        } else if (field.type === 'date') {
          displayValue = new Date(value).toLocaleDateString();
        } else if (Array.isArray(value)) {
          displayValue = value.join(', ');
        }

        fieldsHtml += `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${field.label}</td>
            <td style="padding: 8px; border-bottom: 1px solid #ddd;">${displayValue}</td>
          </tr>
        `;
      }
    });

    const adminUrl = process.env.ADMIN_URL || 'http://localhost:1337/admin';
    const submissionUrl = `${adminUrl}/content-manager/collection-types/api::form-submission.form-submission/${submission.id}`;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .header {
            background-color: #333;
            color: white;
            padding: 20px;
            text-align: center;
          }
          .content {
            background-color: #f9f9f9;
            padding: 20px;
            margin-top: 20px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background-color: white;
            margin-top: 10px;
          }
          .button {
            display: inline-block;
            padding: 10px 20px;
            background-color: #007bff;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>New Form Submission</h1>
          </div>
          <div class="content">
            <p><strong>Form:</strong> ${form.name}</p>
            <p><strong>Submitted:</strong> ${new Date(submission.submittedAt).toLocaleString()}</p>
            <p><strong>Submission ID:</strong> ${submission.id}</p>
            <h3>Submission Data:</h3>
            <table>
              ${fieldsHtml}
            </table>
            <a href="${submissionUrl}" class="button">View Submission in Admin</a>
          </div>
        </div>
      </body>
      </html>
    `;
  },
}));

