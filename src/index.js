'use strict';

module.exports = {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/*{ strapi }*/) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    // Add database index on events.startAt for range queries
    try {
      const db = strapi.db.connection;
      const client = strapi.db.config.connection.client;
      const tableName = 'events';
      const columnName = 'start_at';

      // Check if index already exists and create if not
      if (client === 'postgres') {
        const indexName = 'idx_events_start_at';
        const hasIndex = await db.raw(`
          SELECT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = '${tableName}' 
            AND indexname = '${indexName}'
          );
        `);
        
        if (!hasIndex.rows[0].exists) {
          await db.raw(`CREATE INDEX ${indexName} ON ${tableName}(${columnName});`);
          strapi.log.info(`✓ Created index ${indexName} on ${tableName}.${columnName}`);
        }
      } else if (client === 'mysql') {
        const indexName = 'idx_events_start_at';
        const hasIndex = await db.raw(`
          SELECT COUNT(*) as count 
          FROM information_schema.statistics 
          WHERE table_schema = DATABASE() 
          AND table_name = '${tableName}' 
          AND index_name = '${indexName}';
        `);
        
        if (hasIndex[0][0].count === 0) {
          await db.raw(`CREATE INDEX ${indexName} ON ${tableName}(${columnName});`);
          strapi.log.info(`✓ Created index ${indexName} on ${tableName}.${columnName}`);
        }
      } else if (client === 'sqlite') {
        // SQLite automatically creates indexes for foreign keys and primary keys
        // For SQLite, we'll create the index directly (it will be ignored if exists)
        const indexName = 'idx_events_start_at';
        try {
          await db.raw(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${tableName}(${columnName});`);
          strapi.log.info(`✓ Created index ${indexName} on ${tableName}.${columnName}`);
        } catch (error) {
          // Index might already exist, which is fine
          if (!error.message.includes('already exists')) {
            strapi.log.warn(`Could not create index: ${error.message}`);
          }
        }
      }
    } catch (error) {
      // Log error but don't fail bootstrap - index creation is optional optimization
      strapi.log.warn(`Could not create index on events.startAt: ${error.message}`);
    }
  },
};
