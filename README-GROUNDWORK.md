# Groundwork Implementation

This document describes the groundwork setup completed for the project.

## Node.js Version

- Node.js 20.17.0 is configured via `.nvmrc`
- Use `nvm use` or `nvm use 20.17.0` to switch to the correct version

## API Documentation (Swagger)

The `@strapi/plugin-documentation` plugin is installed and configured.

- **Access**: `/documentation` endpoint
- **Configuration**: `config/plugins.js`
- The documentation will be available at `http://localhost:1337/documentation` when the server is running

## RBAC (Role-Based Access Control)

### Roles Created

1. **Admin**: Full administrative access to all content types
   - Permissions: find, findOne, create, update, delete

2. **Content Editor**: Can create, update, and publish content (no delete)
   - Permissions: find, findOne, create, update

### Public Permissions (Locked by Default)

Public access is locked by default. Only the following read endpoints are accessible:
- `api::article.article` (find, findOne)
- `api::author.author` (find, findOne)
- `api::category.category` (find, findOne)
- `api::about.about` (find, findOne)
- `api::global.global` (find, findOne)
- `api::event.event` (find, findOne)

**Note**: `admission-form` requires authentication and is not accessible to public users.

### Setup Script

Run the RBAC setup script:
```bash
npm run setup:rbac
```

## Seed Script & Fixtures

The seed script (`scripts/seed.js`) includes:

### Locales
- Creates default locale: `en` (English)
- Additional locales: `fr` (French), `es` (Spanish)
- Automatically handles if i18n plugin is not installed

### Demo Events
Three sample events are created:
- Summer Conference 2024
- Tech Workshop Series
- Annual Gala Dinner

### Sample Admission Form
A sample admission form submission is created with:
- Personal information (name, email, phone, date of birth)
- Address
- Program selection
- Status (pending)

### Run Seed Script

```bash
npm run seed
# or
npm run seed:example
```

## Collections & Stable UIDs

All collections use stable UIDs following the pattern: `api::{singularName}.{singularName}`

### Existing Collections
- `api::article.article`
- `api::author.author`
- `api::category.category`
- `api::about.about`
- `api::global.global`

### New Collections
- `api::event.event` - Events management
- `api::admission-form.admission-form` - Admission form submissions

All schemas follow consistent naming conventions to avoid migration churn later.

## Content Types

### Event
- Title, slug, description
- Start/end dates
- Location
- Cover image
- Active status

### Admission Form
- Personal information (firstName, lastName, email, phone, dateOfBirth)
- Address
- Program
- Message
- Status (pending, reviewed, approved, rejected)

## Next Steps

1. Start the Strapi server: `npm run develop`
2. Access the admin panel and create your first admin user
3. Run the RBAC setup: `npm run setup:rbac`
4. Run the seed script: `npm run seed`
5. Access API documentation: `http://localhost:1337/documentation`

