#!/usr/bin/env tsx
/**
 * Check for missing translation keys across all language files
 *
 * This script validates that all locale files have the same keys as the base locale (en.json).
 * It's useful to run before committing changes to ensure translation completeness.
 *
 * Usage:
 *   pnpm i18n:check
 *   npm run i18n:check
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MESSAGES_DIR = path.join(__dirname, '..', 'messages')
const BASE_LANG = 'en.json'

// ANSI color codes
const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const NC = '\x1b[0m' // No Color

interface MessageFile {
  [key: string]: unknown
}

async function checkTranslations(): Promise<void> {
  console.log('🔍 Checking translation completeness...\n')

  // Read base language file
  const baseFilePath = path.join(MESSAGES_DIR, BASE_LANG)
  const baseContent = await readFile(baseFilePath, 'utf-8')
  const baseMessages: MessageFile = JSON.parse(baseContent)

  // Filter out $schema key
  const baseKeys = Object.keys(baseMessages).filter((k) => k !== '$schema')
  const baseCount = baseKeys.length

  console.log(`📋 Base language (${BASE_LANG}): ${baseCount} keys\n`)

  // Check all language files
  const files = await readdir(MESSAGES_DIR)
  const langFiles = files.filter((f) => f.endsWith('.json') && f !== BASE_LANG)

  let hasMissing = false

  for (const langFile of langFiles) {
    const langFilePath = path.join(MESSAGES_DIR, langFile)
    const langContent = await readFile(langFilePath, 'utf-8')
    const langMessages: MessageFile = JSON.parse(langContent)

    const langKeys = Object.keys(langMessages).filter((k) => k !== '$schema')
    const langCount = langKeys.length

    if (langCount !== baseCount) {
      hasMissing = true
      const diff = baseCount - langCount
      console.log(`${RED}✗ ${langFile}${NC}`)
      console.log(`  Keys: ${langCount} / ${baseCount} (missing ${diff})`)

      // Show which keys are missing (limit to 20)
      const missingKeys = baseKeys.filter((k) => !langKeys.includes(k))
      const displayKeys = missingKeys.slice(0, 20)

      for (const key of displayKeys) {
        console.log(`    - ${key}`)
      }

      if (missingKeys.length > 20) {
        console.log(`    ... and ${missingKeys.length - 20} more`)
      }

      console.log()
    } else {
      console.log(`${GREEN}✓ ${langFile}${NC} (${langCount} keys)`)
    }
  }

  console.log()

  if (hasMissing) {
    console.log(`${RED}✗ Some translations are incomplete${NC}\n`)
    console.log('To sync all files, run: pnpm i18n:sync\n')
    process.exit(1)
  } else {
    console.log(`${GREEN}✓ All translations are complete!${NC}`)
    process.exit(0)
  }
}

// Run the script
checkTranslations().catch((error) => {
  console.error(`${RED}Error:${NC}`, error)
  process.exit(1)
})
