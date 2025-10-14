#!/usr/bin/env tsx
/**
 * Sync missing translation keys from en.json to all other language files
 *
 * This script adds any missing keys from the base locale (en.json) to other locale files.
 * Missing keys are added with English text as placeholders, preserving existing translations.
 * Files are automatically sorted and formatted with Prettier (using prettier-plugin-sort-json).
 *
 * Usage:
 *   pnpm i18n:sync
 *   npm run i18n:sync
 */
import { execSync } from 'node:child_process'
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

async function syncTranslations(): Promise<void> {
  console.log(`🔄 Syncing missing translation keys from ${BASE_LANG}...\n`)

  // Read base language file
  const baseFilePath = path.join(MESSAGES_DIR, BASE_LANG)

  // Format base file first (canonical source) - Prettier will sort keys automatically
  console.log(`📝 Formatting base language file (${BASE_LANG})`)
  try {
    execSync(`prettier --write "${baseFilePath}"`, { stdio: 'ignore' })
  } catch {
    console.warn(`⚠️  Could not format ${BASE_LANG} with Prettier`)
  }

  // Re-read base file after formatting (now sorted)
  const formattedBaseContent = await readFile(baseFilePath, 'utf-8')
  const formattedBaseMessages: MessageFile = JSON.parse(formattedBaseContent)
  console.log()

  // Get all language files
  const files = await readdir(MESSAGES_DIR)
  const langFiles = files.filter((f) => f.endsWith('.json') && f !== BASE_LANG)

  for (const langFile of langFiles) {
    const langFilePath = path.join(MESSAGES_DIR, langFile)
    const langContent = await readFile(langFilePath, 'utf-8')
    const langMessages: MessageFile = JSON.parse(langContent)

    // Count keys (excluding $schema)
    const baseKeys = Object.keys(formattedBaseMessages).filter((k) => k !== '$schema')
    const langKeys = Object.keys(langMessages).filter((k) => k !== '$schema')
    const baseCount = baseKeys.length
    const langCount = langKeys.length

    // Detect changes needed
    const missingKeys = baseKeys.filter((k) => !langKeys.includes(k))
    const needsFormatting = langCount === baseCount // All keys present, may just need sorting

    if (missingKeys.length > 0) {
      console.log(`📝 Updating ${langFile} (${missingKeys.length} missing keys)`)
      console.log(
        `   New keys: ${missingKeys.slice(0, 5).join(', ')}${missingKeys.length > 5 ? '...' : ''}`
      )

      // Merge: base keys into language file (keeps existing translations, adds missing)
      const merged: MessageFile = { ...formattedBaseMessages, ...langMessages }

      // Write back - Prettier will sort and format automatically
      await writeFile(langFilePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8')

      // Format with Prettier (sorts keys automatically via prettier-plugin-sort-json)
      try {
        execSync(`prettier --write "${langFilePath}"`, { stdio: 'ignore' })
      } catch {
        console.warn(`⚠️  Could not format ${langFile} with Prettier`)
      }
    } else if (needsFormatting) {
      // No missing keys, but may need sorting/formatting
      console.log(`📝 Formatting ${langFile} (sorting keys)`)
      try {
        execSync(`prettier --write "${langFilePath}"`, { stdio: 'ignore' })
      } catch {
        console.warn(`⚠️  Could not format ${langFile} with Prettier`)
      }
    }
  }

  console.log()
  console.log('✅ Done! All language files now have the same keys.')
  console.log('   Keys are automatically sorted alphabetically.')
  console.log('   New keys use English text as placeholders - translate them with:')
  console.log('   pnpm i18n:translate')
  console.log()
}

// Run the script
syncTranslations().catch((error) => {
  console.error('Error:', error)
  process.exit(1)
})
