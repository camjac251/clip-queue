/**
 * Drizzle Kit Configuration
 *
 * Configures migrations and schema generation.
 *
 * Migration Best Practices:
 * - Drizzle generates: XXXX_random_name.sql (intentional for uniqueness)
 * - Add SQL comments at top of migration file to document changes:
 *   /**
 *    * Migration: Brief description
 *    * Date: YYYY-MM-DD
 *    *
 *    * Detailed changes...
 *    *\/
 * - Sequential numbers (0000, 0001) provide ordering
 * - Random names prevent merge conflicts between branches
 */

import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_PATH || './data/clips.db'
  },
  verbose: true,
  strict: true
})
