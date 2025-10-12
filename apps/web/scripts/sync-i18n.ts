#!/usr/bin/env tsx
/**
 * Sync missing translation keys from en.json to all other language files
 *
 * This script adds any missing keys from the base locale (en.json) to other locale files.
 * Missing keys are added with English text as placeholders, preserving existing translations.
 * Files are formatted with sorted keys and 2-space indentation.
 *
 * Usage:
 *   pnpm i18n:sync
 *   npm run i18n:sync
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MESSAGES_DIR = path.join(__dirname, '..', 'messages')
const BASE_LANG = 'en.json'

interface MessageFile {
  [key: string]: unknown
}

function sortKeys(obj: MessageFile): MessageFile {
  const sorted: MessageFile = {}
  const keys = Object.keys(obj).sort()

  for (const key of keys) {
    sorted[key] = obj[key]
  }

  return sorted
}

async function syncTranslations(): Promise<void> {
  console.log(`🔄 Syncing missing translation keys from ${BASE_LANG}...\n`)

  // Read base language file
  const baseFilePath = path.join(MESSAGES_DIR, BASE_LANG)
  const baseContent = await readFile(baseFilePath, 'utf-8')
  const baseMessages: MessageFile = JSON.parse(baseContent)

  // Get all language files
  const files = await readdir(MESSAGES_DIR)
  const langFiles = files.filter((f) => f.endsWith('.json') && f !== BASE_LANG)

  for (const langFile of langFiles) {
    const langFilePath = path.join(MESSAGES_DIR, langFile)
    const langContent = await readFile(langFilePath, 'utf-8')
    const langMessages: MessageFile = JSON.parse(langContent)

    // Count keys (excluding $schema)
    const baseKeys = Object.keys(baseMessages).filter((k) => k !== '$schema')
    const langKeys = Object.keys(langMessages).filter((k) => k !== '$schema')
    const baseCount = baseKeys.length
    const langCount = langKeys.length

    if (langCount < baseCount) {
      const missing = baseCount - langCount
      console.log(`📝 Updating ${langFile} (${missing} missing keys)`)

      // Merge: base keys into language file (keeps existing translations, adds missing)
      const merged: MessageFile = { ...baseMessages, ...langMessages }

      // Sort keys alphabetically
      const sorted = sortKeys(merged)

      // Write back with pretty formatting
      await writeFile(langFilePath, JSON.stringify(sorted, null, 2) + '\n', 'utf-8')
    }
  }

  console.log()
  console.log('✅ Done! All language files now have the same keys.')
  console.log('   New keys use English text as placeholders - translate them with:')
  console.log('   pnpm i18n:translate')
  console.log()
}

// Run the script
syncTranslations().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
