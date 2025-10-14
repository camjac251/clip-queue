/**
 * Path Resolution Utilities
 *
 * Finds the workspace root using find-up to avoid hardcoded relative paths.
 */

import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

import { findUpSync } from 'find-up-simple'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Cached workspace root path to avoid repeated file system lookups
 */
let workspaceRoot: string | undefined

/**
 * Find the monorepo workspace root by walking up directories
 * looking for pnpm-workspace.yaml (synchronous)
 */
export function findWorkspaceRoot(): string {
  if (workspaceRoot) return workspaceRoot

  const workspaceFile = findUpSync('pnpm-workspace.yaml', {
    cwd: __dirname
  })

  if (!workspaceFile) {
    throw new Error('Could not find workspace root (pnpm-workspace.yaml)')
  }

  workspaceRoot = dirname(workspaceFile)
  return workspaceRoot
}

/**
 * Get the workspace root (initializes on first call)
 */
export function getWorkspaceRoot(): string {
  return findWorkspaceRoot()
}

/**
 * Resolve a path relative to the workspace root
 */
export function resolveFromRoot(...paths: string[]): string {
  return join(getWorkspaceRoot(), ...paths)
}
