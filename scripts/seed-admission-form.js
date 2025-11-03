'use strict';

/**
 * Seed script for Admission Form
 * Creates a ready-to-use Admission Form with all required fields
 * 
 * Usage: node ./scripts/seed-admission-form.js
 * Or from Strapi console: await require('./scripts/seed-admission-form.js')()
 */

async function seedAdmissionForm() {
  try {
    console.log('Creating Admission Form...');

    // Check if form already exists
    const existingForm = await strapi.entityService.findMany('api::form.form', {
      filters: { slug: 'admission-form' },
    });

    if (existingForm && existingForm.length > 0) {
      console.log('Admission Form already exists. Skipping...');
      return;
    }

    // Create the Admission Form with all fields
    const admissionForm = await strapi.entityService.create('api::form.form', {
      data: {
        name: 'Admission Form',
        slug: 'admission-form',
        description: 'Student admission application form',
        active: true,
        successMessage: 'Thank you for your admission application! We will review your submission and contact you soon.',
        notificationEmails: process.env.ADMISSION_FORM_EMAILS 
          ? JSON.parse(process.env.ADMISSION_FORM_EMAILS) 
          : ['admin@example.com'],
        storePdf: true,
        sendPdf: true,
        rateLimitPerIP: 5,
        fields: [
          {
            key: 'studentName',
            label: 'Student Name',
            type: 'text',
            required: true,
            placeholder: 'Enter student full name',
            helpText: 'Please enter the full name of the student',
            visibility: 'public',
          },
          {
            key: 'fatherName',
            label: "Father's Name",
            type: 'text',
            required: true,
            placeholder: "Enter father's full name",
            helpText: 'Please enter the full name of the father',
            visibility: 'public',
          },
          {
            key: 'dateOfBirth',
            label: 'Date of Birth',
            type: 'date',
            required: true,
            placeholder: 'Select date of birth',
            helpText: 'Please select the date of birth',
            visibility: 'public',
          },
          {
            key: 'grade',
            label: 'Grade/Class Applying For',
            type: 'select',
            required: true,
            options: ['Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10', 'Grade 11', 'Grade 12'],
            placeholder: 'Select grade',
            helpText: 'Please select the grade you are applying for',
            visibility: 'public',
          },
          {
            key: 'contactNumber',
            label: 'Contact Number',
            type: 'text',
            required: true,
            placeholder: 'Enter contact number',
            helpText: 'Please enter a valid contact number',
            validation: {
              regex: '^[0-9+\\-\\s()]+$',
              message: 'Please enter a valid contact number',
            },
            visibility: 'public',
          },
          {
            key: 'email',
            label: 'Email Address',
            type: 'email',
            required: true,
            placeholder: 'Enter email address',
            helpText: 'Please enter a valid email address',
            visibility: 'public',
          },
          {
            key: 'address',
            label: 'Address',
            type: 'textarea',
            required: true,
            placeholder: 'Enter complete address',
            helpText: 'Please enter your complete residential address',
            validation: {
              minLength: 10,
              maxLength: 500,
            },
            visibility: 'public',
          },
          {
            key: 'priorSchool',
            label: 'Prior School Name',
            type: 'text',
            required: false,
            placeholder: 'Enter previous school name',
            helpText: 'Please enter the name of the school you attended previously (if applicable)',
            visibility: 'public',
          },
          {
            key: 'guardianCNIC',
            label: "Guardian CNIC (National ID)",
            type: 'text',
            required: true,
            placeholder: 'Enter CNIC number',
            helpText: 'Please enter the CNIC number of the guardian',
            validation: {
              regex: '^[0-9]{5}-[0-9]{7}-[0-9]{1}$',
              message: 'CNIC format should be XXXXX-XXXXXXX-X',
            },
            visibility: 'public',
          },
          {
            key: 'emergencyContact',
            label: 'Emergency Contact Number',
            type: 'text',
            required: true,
            placeholder: 'Enter emergency contact number',
            helpText: 'Please enter an emergency contact number',
            visibility: 'public',
          },
          {
            key: 'medicalConditions',
            label: 'Medical Conditions (if any)',
            type: 'textarea',
            required: false,
            placeholder: 'Enter any medical conditions or allergies',
            helpText: 'Please inform us of any medical conditions or allergies',
            visibility: 'public',
          },
          {
            key: 'additionalNotes',
            label: 'Additional Notes',
            type: 'textarea',
            required: false,
            placeholder: 'Any additional information you would like to share',
            helpText: 'You can provide any additional information here',
            visibility: 'public',
          },
          {
            key: 'documents',
            label: 'Supporting Documents',
            type: 'file',
            required: false,
            helpText: 'Please upload any supporting documents (transcripts, certificates, etc.)',
            visibility: 'public',
          },
        ],
        publishedAt: new Date(),
      },
    });

    console.log(`Admission Form created successfully with ID: ${admissionForm.id}`);
    console.log('Admission Form is ready to use!');
    console.log(`Access the form at: GET /api/forms/admission-form`);
    console.log(`Submit the form at: POST /api/forms/admission-form/submit`);

  } catch (error) {
    console.error('Error creating Admission Form:', error);
    throw error;
  }
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await seedAdmissionForm();
  await app.destroy();

  process.exit(0);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = seedAdmissionForm;

